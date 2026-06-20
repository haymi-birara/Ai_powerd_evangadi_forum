// This module handles generating and storing question embeddings, as well as performing semantic search for questions based on their embeddings. It uses Google Gemini for generating text embeddings and includes an in-memory cache to optimize search performance by avoiding frequent database reads for embeddings. The module also provides a function to store or update question vectors in the database, with error handling to mark failed embedding attempts appropriately.

import { GoogleGenAI } from "@google/genai"; // Google Gemini API client
import { safeExecute } from "../../../../db/config.js"; // For executing database queries safely with parameter validation
import "dotenv/config"; // Load environment variables from .env file, including GEMINI_API_KEY and model names

const normalizeWhiteSpaces = (value) => value.replace(/\s+/g, " ").trim();
export const normalizeQuestionText = ({ title, content }) => {
  const combined = `${title || ""}\n${content || ""}`;
  return normalizeWhiteSpaces(combined.normalize("NFKC").toLowerCase());
};
// Checks if the embedding cache is still valid based on the defined TTL. If the cache is stale, it will be reloaded from the database on the next search request.
const isCacheWarm = () =>
  Date.now() - embeddingCache.loadedAt < CACHE_TTL_MS;

const loadEmbeddingCache = async () => {
  const rows = await safeExecute(
    `SELECT question_id, embedding FROM question_vectors WHERE status = 'ready'`,
    [],
  );
// Clear the existing cache before loading fresh data to ensure it reflects the current state of the database. This prevents stale embeddings from being used in search results after updates.
  embeddingCache.vectors.clear();

  // Each row's embedding is stored as a JSON string in the database, so we need to parse it back into an array. We then convert it to a Float32Array for memory efficiency. If parsing fails (e.g., due to malformed data), we skip that row and it won't be included in the cache, which means it won't affect search results.
  for (const row of rows) {
    try {
      const arr =
        typeof row.embedding === "string"
          ? JSON.parse(row.embedding)
          : row.embedding;
      embeddingCache.vectors.set(row.question_id, new Float32Array(arr));
    } catch {
      // Skip rows with malformed embeddings — they will remain in DB with status='ready'
      // but won't affect search results.
    }
  }

  embeddingCache.loadedAt = Date.now();
};

// Called by storeQuestionVector after a successful write so the next search
// picks up the new embedding.
export const invalidateEmbeddingCache = () => {
  embeddingCache.loadedAt = 0;
};

// ---------------------------------------------------------------------------
// Gemini helpers
// ---------------------------------------------------------------------------
// Generates a concise AI answer using Gemini when no semantically similar questions are found. The prompt instructs Gemini to focus on accuracy and avoid fabricating information, which is important for maintaining trustworthiness in the answers provided to users.
const generateAIAnswer = async (query) => {
  const prompt = [
    "You are a helpful programming forum assistant.",
    "A user searched for related questions but none were found.",
    "Answer the following question concisely and clearly in 2-4 sentences.",
    "Focus on accuracy. Do not make up facts.",
    "",
    `Question: ${query}`,
  ].join("\n");

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
    });
    return response?.text?.trim() || null;
  } catch {
    return null;
  }
};

const normalizeWhiteSpaces = (value) => value.replace(/\s+/g, " ").trim();

export const normalizeQuestionText = ({ title, content }) => {
  const combined = `${title || ""} ${content || ""}`;
  return normalizeWhiteSpaces(combined.normalize("NFKC").toLowerCase());
};

export const generateQuestionEmbedding = async (sourceText, options = {}) => {
  const { taskType = "RETRIEVAL_DOCUMENT" } = options;

  const response = await ai.models.embedContent({
    model: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001",
    contents: sourceText,
    config: { taskType, outputDimensionality: 768 },
  });

  const values = response.embeddings[0].values;

  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("Gemini embedding response doesn't contain values");
  }

  return { embedding: values };
};

// ---------------------------------------------------------------------------
// Cosine similarity
// ---------------------------------------------------------------------------

const cosineSimilarity = (a, b) => {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];// Dot product of the two vectors, which measures their directional similarity. A higher dot product indicates that the vectors are more aligned in the same direction.
    magA += a[i] * a[i];// Magnitude of vector a, calculated as the square root of the sum of squares of its components. This represents the length of the vector in the embedding space.
    magB += b[i] * b[i];// Magnitude of vector b, calculated similarly to magA. Both magnitudes are used to normalize the dot product, ensuring that the cosine similarity is a value between -1 and 1, where 1 means the vectors are identical in direction, 0 means they are orthogonal (no similarity), and -1 means they are diametrically opposed.
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
};

const validateEmbedding = (embedding) => {
  if (!Array.isArray(embedding)) throw new Error("Embedding must be array");
  if (embedding.length === 0) throw new Error("Embedding can't be empty");
  if (!embedding.every((v) => typeof v === "number" && !isNaN(v))) {
    throw new Error("Embedding must contain only valid numbers");
  }
};

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export const searchQuestionsSemanticService = async ({
  query,
  k = 5,
  threshold = 0.75,
}) => {
  const { embedding: queryEmbedding } = await generateQuestionEmbedding(
    query,
    { taskType: "RETRIEVAL_QUERY" },
  );

  if (!isCacheWarm()) await loadEmbeddingCache();

  if (embeddingCache.vectors.size === 0) {
    const aiAnswer = await generateAIAnswer(query);
    return { data: [], aiAnswer };
  }

  const queryVec = new Float32Array(queryEmbedding);
  const scored = [];

  for (const [questionId, embedding] of embeddingCache.vectors) {
    const score = cosineSimilarity(queryVec, embedding);
    if (score >= threshold) scored.push({ questionId, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, k);

  if (top.length === 0) {
    const aiAnswer = await generateAIAnswer(query);
    return { data: [], aiAnswer };
  }

  const ids = top.map((s) => s.questionId);
  const placeholders = ids.map(() => "?").join(",");

  const questionsSql = `
    SELECT
      q.question_id AS id,
      q.question_hash AS questionHash,
      q.title,
      q.content,
      q.created_at AS createdAt,
      q.updated_at AS updatedAt,
      COUNT(DISTINCT a.answer_id) AS answerCount,
      u.user_id AS authorId,
      u.first_name AS firstName,
      u.last_name AS lastName
    FROM questions q
    JOIN users u ON u.user_id = q.user_id
    LEFT JOIN answers a ON a.question_id = q.question_id
    WHERE q.question_id IN (${placeholders})
    GROUP BY
      q.question_id, q.question_hash, q.title, q.content,
      q.created_at, q.updated_at, u.user_id, u.first_name, u.last_name
  `;

  const questionRows = await safeExecute(questionsSql, ids);
  const scoreMap = new Map(top.map((s) => [s.questionId, s.score]));

  const data = questionRows
    .map((row) => ({
      id: row.id,
      questionHash: row.questionHash,
      title: row.title,
      content: row.content,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      answerCount: row.answerCount,
      author: {
        id: row.authorId,
        firstName: row.firstName,
        lastName: row.lastName,
      },
      score: scoreMap.get(row.id) ?? 0,
    }))
    .sort((a, b) => b.score - a.score);

  return { data, aiAnswer: null };
};

export const getSimilarQuestionsService = async ({
  questionHash,
  k = 5,
  threshold = 0.75,
}) => {
  // Fetch only the source question's metadata — indexed by questionHash.
  const sourceRow = await safeExecute(
    `SELECT qv.question_id, qv.embedding
     FROM question_vectors qv
     JOIN questions q ON q.question_id = qv.question_id
     WHERE q.question_hash = ? AND qv.status = 'ready'`,
    [questionHash],
  );

  if (sourceRow.length === 0) return [];

  const sourceId = sourceRow[0].question_id;
  const rawEmbedding =
    typeof sourceRow[0].embedding === "string"
      ? JSON.parse(sourceRow[0].embedding)
      : sourceRow[0].embedding;
  const sourceEmbedding = new Float32Array(rawEmbedding);

  if (!isCacheWarm()) await loadEmbeddingCache();

  const scored = [];
  for (const [questionId, embedding] of embeddingCache.vectors) {
    if (questionId === sourceId) continue;
    const score = cosineSimilarity(sourceEmbedding, embedding);
    if (score >= threshold) scored.push({ questionId, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, k);

  if (top.length === 0) return [];

  const ids = top.map((s) => s.questionId);
  const placeholders = ids.map(() => "?").join(",");

  const questionsSql = `
    SELECT
      q.question_id AS id,
      q.question_hash AS questionHash,
      q.title,
      q.created_at AS createdAt,
      u.first_name AS firstName,
      u.last_name AS lastName,
      COUNT(DISTINCT a.answer_id) AS answerCount
    FROM questions q
    JOIN users u ON u.user_id = q.user_id
    LEFT JOIN answers a ON a.question_id = q.question_id
    WHERE q.question_id IN (${placeholders})
    GROUP BY q.question_id, q.question_hash, q.title, q.created_at, u.first_name, u.last_name
  `;

  const rows = await safeExecute(questionsSql, ids);
  const scoreMap = new Map(top.map((s) => [s.questionId, s.score]));

  return rows
    .map((row) => ({ ...row, score: scoreMap.get(row.id) ?? 0 }))
    .sort((a, b) => b.score - a.score);
};

// ---------------------------------------------------------------------------
// Store / upsert vector
// ---------------------------------------------------------------------------

export const storeQuestionVector = async ({
  questionId,
  sourceText,
  embedding = [],
  status = "ready",
}) => {
  const isFailed = status === "failed" || !embedding || embedding.length === 0;

  if (!isFailed) validateEmbedding(embedding);

  const sql = `
    INSERT INTO question_vectors (question_id, source_text, embedding, status)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
    source_text=VALUES(source_text),
    embedding=VALUES(embedding),
    status=VALUES(status),
    updated_at=CURRENT_TIMESTAMP`;
  try {
    await safeExecute(sql, [questionId, sourceText, embeddingJson, status]);
  } catch (err) {
    throw err;
  }
};

  await safeExecute(sql, [
    questionId,
    sourceText,
    isFailed ? JSON.stringify([]) : JSON.stringify(embedding),
    isFailed ? "failed" : status,
  ]);

  // New embedding written — next search must reload the cache.
  if (!isFailed) invalidateEmbeddingCache();
};
