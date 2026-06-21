import fs from "fs/promises";
import { extractTextFromPDF } from "../../../utils/pdfParser.js";
import { chunkText } from "../../../utils/chunk.js";
import { safeExecute } from "../../../../db/config.js";
import { getDocumentEmbedding, getQueryEmbedding, answerFromRagChunksService } from "../../../utils/ragGemini.js";
import { BadRequestError, NotFoundError } from "../../../utils/errors/index.js";



export const createDocumentFromUploadService= async (file, userId)=>{

    let documentId;
    

    try 
    {
        if (userId=== null){
            throw new Error ("Authenticated user ID is missing.");
        }

        const storagePath = file.path ?? null;
        const title= file.originalname ?? null;
        const mimeType= file.mimetype ?? null;
        const byteSize= file.size ?? null;

        // 1 Initial DB Record: Insert document as 'processing'

        const insertResult= await safeExecute(
            ` INSERT INTO documents 
            (user_id, title, mime_type, byte_size, storage_path, status)
            VALUES (?, ?, ?, ?, ?, 'processing')`,

            [userId, title, mimeType, byteSize, storagePath]);

             documentId =  insertResult.insertId;

        
        //  2 Parse PDF: Extract text from PDF buffer
        const fileBuffer= await fs.readFile(file.path);
        if (!fileBuffer){
            throw new Error ("Unable to read upload PDF file.")
        } 

        const text = await extractTextFromPDF(fileBuffer);
        if (!text|| text.trim().length===0){
            throw new Error ("No readable text found in PDF document.");
        }


        // 3 Chunking: Split text into overlapping segments 
        const chunks = chunkText (text);
        if (chunks.length===0){
            throw new Error ("No text found in PDF");
        }

        // 4. Embedding: Loop through chunks properly
        for (let i=0; i<chunks.length; i++){
            const chunk= chunks[i];

            // Call Gemini API to get vector embedding for the chunk
            const embedding = await getDocumentEmbedding (chunk);
            if (embedding === undefined || embedding=== null){
                throw new Error ("Failed to generate embedding for PDF chunk.");
            }

            const embeddingJson= JSON.stringify(embedding);
            if (embeddingJson===undefined ){
                throw new Error ("Embedding could not be serialized for storage.");        
            }
            // Store Vector : save chunk to database
            const chunkResult= await safeExecute(
                `INSERT INTO document_chunks
                (document_id, chunk_index, content)
                VALUES(?,?,?)`,
                [documentId, i, chunk], );

            const ChunkId = chunkResult.insertId;
            
            // Store Vector : save vector embeddings to database
            await safeExecute(
                `INSERT INTO document_chunk_vectors (chunk_id, source_text, embedding) VALUES (?, ?, ?)`,
                [ChunkId, chunk, embeddingJson]
            );
        }

        // 5. Finalize: Update document status to ready
        await safeExecute(`UPDATE documents SET status='ready' WHERE document_id=?`, [documentId]);
        
        return {
            document_id: documentId,
            title: file.originalname,
            mime_type: file.mimetype,   
            byte_size: file.size,      
            storage_path: file.path,    
            status: "ready",
            error_message: null,        
            created_at: new Date().toISOString(), 
            updated_at: new Date().toISOString(), 
            user_id: userId,
        };


    } catch (error) {
    // Finalize (Error Case): Update status to 'failed' and save error
    if (documentId) {
      await safeExecute(
        `UPDATE documents SET status='failed', error_message=? WHERE document_id=?`,
        [error.message, documentId],
      );
    }
    throw error;
  }

}

const dotProduct = (a, b) => {
  let sum = 0;
  const limit = Math.min(a.length, b.length);
  for (let i = 0; i < limit; i++) {
    sum += a[i] * b[i];
  }
  return sum;
};

const magnitude = (arr) => Math.sqrt(arr.reduce((sum, val) => sum + val * val, 0));

const cosineSimilarity = (a, b) => {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
};

const parseEmbedding = (rawEmbedding) => {
  if (Array.isArray(rawEmbedding)) {
    return rawEmbedding;
  }
  if (Buffer.isBuffer(rawEmbedding)) {
    try {
      return JSON.parse(rawEmbedding.toString("utf-8"));
    } catch {
      return null;
    }
  }
  if (typeof rawEmbedding === "string") {
    try {
      return JSON.parse(rawEmbedding);
    } catch {
      return null;
    }
  }
  return null;
};

export const queryDocumentService = async ({ documentId, query, userId }) => {
  if (!userId) {
    throw new BadRequestError("Authenticated user ID is missing.");
  }

  // 1. Verify document ownership and readiness
  const documentRows = await safeExecute(
    `SELECT * FROM documents WHERE document_id = ? AND user_id = ?`,
    [documentId, userId]
  );
  if (documentRows.length === 0) {
    throw new NotFoundError("Document not found");
  }

  const document = documentRows[0];
  if (document.status !== "ready") {
    throw new BadRequestError("Document is not ready for querying");
  }

  // 2. Embed the query
  const queryEmbedding = await getQueryEmbedding(query);

  // 3. Fetch all chunk vectors for this document
  const chunkRows = await safeExecute(
    `SELECT dc.chunk_id AS chunkId, dc.chunk_index AS chunkIndex, dc.content, dcv.embedding
     FROM document_chunks dc
     INNER JOIN document_chunk_vectors dcv ON dc.chunk_id = dcv.chunk_id
     WHERE dc.document_id = ? AND dcv.status = 'ready'`,
    [documentId]
  );

  if (chunkRows.length === 0) {
    throw new BadRequestError("No processed chunks found for this document.");
  }

  // 4. Calculate similarities and score
  const scored = [];
  for (const row of chunkRows) {
    const vector = parseEmbedding(row.embedding);
    if (!Array.isArray(vector) || vector.length === 0) {
      continue;
    }
    const score = cosineSimilarity(queryEmbedding, vector);
    scored.push({
      chunkId: row.chunkId,
      chunkIndex: row.chunkIndex,
      content: row.content,
      score,
    });
  }

  // 5. Filter by threshold (optional, using process.env.RAG_SEARCH_THRESHOLD or fallback 0.45)
  const searchThreshold = process.env.RAG_SEARCH_THRESHOLD
    ? parseFloat(process.env.RAG_SEARCH_THRESHOLD)
    : 0.45;

  // Filter matches. If none meet the threshold, we fall back to all sorted matches.
  const thresholdMatches = scored.filter((item) => item.score >= searchThreshold);
  const ranked = (thresholdMatches.length > 0 ? thresholdMatches : scored).sort(
    (a, b) => b.score - a.score
  );

  // Take top k chunks
  const limit = process.env.RAG_SEARCH_K ? parseInt(process.env.RAG_SEARCH_K, 10) : 5;
  const topChunks = ranked.slice(0, limit);

  if (topChunks.length === 0) {
    throw new BadRequestError("Could not retrieve relevant content to answer the query.");
  }

  // 6. Generate answer using Gemini
  const responseData = await answerFromRagChunksService(query, topChunks);

  return responseData;
};