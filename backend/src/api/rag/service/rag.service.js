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

  // Step 4 - Compute cosine similarity
  const scored = [];

  for (const row of vectorRows) {
    const vector = parseEmbedding(row.embedding);

    if (!Array.isArray(vector) || vector.length === 0) {
      continue;
    }

    const score = cosineSimilarity(queryEmbedding, vector);
    scored.push({ chunkId: row.chunkId, chunkIndex: row.chunkIndex, score });
  }

  // Step 5 - Sort and filter
  const ranked = scored.sort((a, b) => b.score - a.score);
  const top = ranked.slice(0, limit);

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
