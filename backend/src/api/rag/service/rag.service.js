import { safeExecute } from "../../../../db/config.js";
import {
  generateQuestionEmbedding,
  normalizeQuestionText,
} from "../../question/service/vector.service.js";
import { NotFoundError, BadRequestError } from "../../../utils/errors/index.js";
import {
  toNumberOrFallback,
  parseEmbedding,
  cosineSimilarity,
} from "../../../utils/vectorUtils.js";

export const searchInDocumentService = async ({
  documentId,
  userId,
  query,
  k,
}) => {
  const normalizedQuery = typeof query === "string" ? query.trim() : "";

  if (!normalizedQuery) {
    throw new BadRequestError("Query is required");
  }

  const limit = Math.max(1, Math.min(20, toNumberOrFallback(k, 5)));

  // Step 1 - Verify document ownership and status
  const docSql = `
    SELECT document_id, status
    FROM documents
    WHERE document_id = ? AND user_id = ?
    LIMIT 1
  `;

  const docRows = await safeExecute(docSql, [documentId, userId]);

  if (docRows.length === 0) {
    throw new NotFoundError("Document not found");
  }

  if (docRows[0].status !== "ready") {
    throw new BadRequestError(
      "Document is not ready for search. Please wait for processing to complete.",
    );
  }

  // Step 2 - Embed the search query using the same normalization pipeline as stored chunk vectors
  const normalizedText = normalizeQuestionText({ title: normalizedQuery });
  const { embedding: queryEmbedding } = await generateQuestionEmbedding(
    normalizedText,
    { taskType: "RETRIEVAL_QUERY" },
  );

  // Step 3 - Fetch all chunk vectors for this document
  const vectorsSql = `
    SELECT
      dcv.chunk_id AS chunkId,
      dcv.embedding,
      dc.chunk_index AS chunkIndex
    FROM document_chunk_vectors dcv
    JOIN document_chunks dc ON dc.chunk_id = dcv.chunk_id
    WHERE dc.document_id = ? AND dcv.status = 'ready'
  `;

  const vectorRows = await safeExecute(vectorsSql, [documentId]);

  if (vectorRows.length === 0) {
    return {
      query: normalizedQuery,
      results: [],
    };
  }
  // Step 4 - Compute cosine similarity and keep only top-k (O(n log k))
  const heap = [];

  const heapPush = (item) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (heap[parent].score <= heap[i].score) break;
      [heap[parent], heap[i]] = [heap[i], heap[parent]];
      i = parent;
    }
  };

  const heapPop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      while (true) {
        const left = 2 * i + 1;
        const right = 2 * i + 2;
        let smallest = i;
        if (left < heap.length && heap[left].score < heap[smallest].score)
          smallest = left;
        if (right < heap.length && heap[right].score < heap[smallest].score)
          smallest = right;
        if (smallest === i) break;
        [heap[i], heap[smallest]] = [heap[smallest], heap[i]];
        i = smallest;
      }
    }
    return top;
  };

  for (const row of vectorRows) {
    const vector = parseEmbedding(row.embedding);
    if (!Array.isArray(vector) || vector.length === 0) continue;

    const score = cosineSimilarity(queryEmbedding, vector);
    if (heap.length < limit) {
      heapPush({ chunkId: row.chunkId, chunkIndex: row.chunkIndex, score });
    } else if (score > heap[0].score) {
      heapPop();
      heapPush({ chunkId: row.chunkId, chunkIndex: row.chunkIndex, score });
    }
  }

  // Step 5 - Extract top-k in descending order
  const top = heap.sort((a, b) => b.score - a.score);

  if (top.length === 0) {
    return {
      query: normalizedQuery,
      results: [],
    };
  }

  // Step 6 - Hydrate with actual text content
  const chunkIds = top.map((item) => item.chunkId);
  const placeholders = chunkIds.map(() => "?").join(", ");

  const chunksSql = `
    SELECT
      chunk_id AS chunkId,
      content AS excerpt
    FROM document_chunks
    WHERE chunk_id IN (${placeholders})
  `;

  const chunkRows = await safeExecute(chunksSql, chunkIds);
  const chunksById = new Map(chunkRows.map((row) => [row.chunkId, row]));

  const results = top
    .map((item) => {
      const chunk = chunksById.get(item.chunkId);
      if (!chunk) return null;
      return {
        chunkId: item.chunkId,
        chunkIndex: item.chunkIndex,
        score: item.score,
        excerpt: chunk.excerpt,
      };
    })
    .filter(Boolean);

  return {
    query: normalizedQuery,
    results,
  };
};
import fs from "fs/promises";
import { extractTextFromPDF } from "../../../utils/pdfParser.js";
import { chunkText } from "../../../utils/chunk.js";
import { safeExecute } from "../../../../db/config.js";
import {
  getDocumentEmbedding,
  getQueryEmbedding,
  answerFromRagChunksService,
} from "../../../utils/ragGemini.js";
import { BadRequestError, NotFoundError } from "../../../utils/errors/index.js";

export const createDocumentFromUploadService = async (file, userId) => {
  let documentId;

  try {
    if (!userId) {
      throw new BadRequestError("Authenticated user ID is missing.");
    }

    const storagePath = file.path ?? null;
    const title = file.originalname ?? null;
    const mimeType = file.mimetype ?? null;
    const byteSize = file.size ?? null;

    // 1. Initial DB Record: Insert document as 'processing'
    const insertResult = await safeExecute(
      ` INSERT INTO documents 
            (user_id, title, mime_type, byte_size, storage_path, status)
            VALUES (?, ?, ?, ?, ?, 'processing')`,
      [userId, title, mimeType, byteSize, storagePath],
    );

    documentId = insertResult.insertId;

    // 2. Parse PDF: Extract text from PDF buffer
    let fileBuffer;
    try {
      fileBuffer = await fs.readFile(file.path);
    } catch (err) {
      throw new BadRequestError("Unable to read uploaded PDF file.");
    }

    const text = await extractTextFromPDF(fileBuffer);
    if (!text || text.trim().length === 0) {
      throw new BadRequestError("No readable text found in PDF document.");
    }

    // 3. Chunking: Split text into overlapping segments
    const chunks = chunkText(text);
    if (chunks.length === 0) {
      throw new BadRequestError("No text found in PDF");
    }

    // 4. Embedding: Process in concurrent batches (Copilot fix)
    const BATCH_SIZE = 5;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const batchIndices = Array.from(
        { length: batch.length },
        (_, idx) => i + idx,
      );

      // Fire off batch requests concurrently
      const batchPromises = batch.map(async (chunk, localIdx) => {
        const globalIndex = batchIndices[localIdx];

        // Call Gemini API to get vector embedding for the chunk
        const embedding = await getDocumentEmbedding(chunk);
        if (embedding === undefined || embedding === null) {
          throw new Error("Failed to generate embedding for PDF chunk.");
        }

        const embeddingJson = JSON.stringify(embedding);
        if (embeddingJson === undefined) {
          throw new Error("Embedding could not be serialized for storage.");
        }

        return { chunk, globalIndex, embeddingJson };
      });

      // Wait for the entire batch of API requests to finish
      const batchResults = await Promise.all(batchPromises);

      // Sequential DB insertion for the resolved batch to maintain consistency
      for (const result of batchResults) {
        const chunkResult = await safeExecute(
          `INSERT INTO document_chunks (document_id, chunk_index, content) VALUES (?, ?, ?)`,
          [documentId, result.globalIndex, result.chunk],
        );

        const chunkId = chunkResult.insertId;

        await safeExecute(
          `INSERT INTO document_chunk_vectors (chunk_id, source_text, embedding) VALUES (?, ?, ?)`,
          [chunkId, result.chunk, result.embeddingJson],
        );
      }
    }

    // 5. Finalize: Update document status to ready
    await safeExecute(
      `UPDATE documents SET status='ready' WHERE document_id=?`,
      [documentId],
    );

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

const MAX_CHUNKS_PER_UPLOAD = 50;


export const createDocumentFromUploadService= async (file, userId)=>{

    let documentId;
    

    try 
    {
        if (userId== null){
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
        const fileBuffer = await fs.readFile(file.path);

        // Quick signature check to avoid relying only on mimetype/extension.
        const magic = fileBuffer.subarray(0, 5).toString("utf8");
        if (magic !== "%PDF-") {
            const err = new Error("Uploaded file is not a valid PDF.");
            err.statusCode = 400;
            throw err;
        }

        const text = await extractTextFromPDF(fileBuffer);
        if (!text || text.trim().length === 0) {
            const err = new Error("No readable text found in PDF document.");
            err.statusCode = 400;
            throw err;
        }


        // 3 Chunking: Split text into overlapping segments 
        const chunks = chunkText(text);
        if (chunks.length === 0) {
            const err = new Error("No text found in PDF");
            err.statusCode = 400;
            throw err;
        }
        if (chunks.length > MAX_CHUNKS_PER_UPLOAD) {
            const err = new Error(`Document is too large. Maximum allowed chunks is ${MAX_CHUNKS_PER_UPLOAD}.`);
            err.statusCode = 400;
            throw err;
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

            const chunkId = chunkResult.insertId;
            
            // Store Vector : save vector embeddings to database
            await safeExecute(
                `INSERT INTO document_chunk_vectors (chunk_id, source_text, embedding) VALUES (?, ?, ?)`,
                [chunkId, chunk, embeddingJson]
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
            user_id: userId,
        };


    } catch (error) {
    // Finalize (Error Case): Update status to 'failed' and save error
    if (documentId) {
      // Clean up partial chunk/vector writes; vectors cascade on chunk delete.
      await safeExecute(`DELETE FROM document_chunks WHERE document_id=?`, [
        documentId,
      ]);
      await safeExecute(
        `UPDATE documents SET status='failed', error_message=? WHERE document_id=?`,
        [error.message, documentId],
      );
    }
    throw error;
  }
};

const dotProduct = (a, b) => {
  let sum = 0;
  const limit = Math.min(a.length, b.length);
  for (let i = 0; i < limit; i++) {
    sum += a[i] * b[i];
  }
  return sum;
};

const magnitude = (arr) =>
  Math.sqrt(arr.reduce((sum, val) => sum + val * val, 0));

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
    [documentId, userId],
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
    [documentId],
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
  const thresholdMatches = scored.filter(
    (item) => item.score >= searchThreshold,
  );
  const ranked = (thresholdMatches.length > 0 ? thresholdMatches : scored).sort(
    (a, b) => b.score - a.score,
  );

  // Take top k chunks
  const parsedk = process.env.RAG_SEARCH_K
    ? Number.parseInt(process.env.RAG_SEARCH_K, 10)
    : NaN;
  const limit = Number.isFinite(parsedk) && parsedk > 0 ? parsedk : 5;
  const topChunks = ranked.slice(0, limit);
  if (topChunks.length === 0) {
    throw new BadRequestError(
      "Could not retrieve relevant content to answer the query.",
    );
  }

  // 6. Generate answer using Gemini
  const responseData = await answerFromRagChunksService(query, topChunks);

  return responseData;
};
