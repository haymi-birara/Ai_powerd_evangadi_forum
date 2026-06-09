import { GoogleGenAI } from "@google/genai";
import { safeExecute } from "../../../../db/config.js";
import "dotenv/config";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const normalizeWhiteSpaces = (value) => value.replace(/\s+/g, " ").trim();
export const normalizeQuestionText = ({ title }) => {
  return normalizeWhiteSpaces(`${title || ""}`.normalize("NFKC").toLowerCase());
};

// Vector Embedding/ source text alew and options store yaregal
export const generateQuestionEmbedding = async (sourceText, options = {}) => {
  // Our usecase for AI  embedding-001- Rerrival document for document search (ke questions ende web search endiyareg selemnfelg)
  const { taskType = `RETRIEVAL_DOCUMENT ` } = options;

  try {
    const response = await ai.models.embedContent({
      model: GEMINI_EMBEDDING_MODEL,
      contents: sourceText,
      config: {
        taskType: taskType,
        outputDimensionality: 768,
      },
    });

    // Embeddingun yemnagegnew values lay new- source gemini doc/ value[0.01233, -0,999]
    const values = response.embeddings[0].values;

    if (!Array.isArray(values) || values.length === 0) {
      throw new Error("Gemini embedding response doesn't contain values");
    }

    // return embedding yetebale object
    return {
      embedding: values,
    };
  } catch (err) {
    throw err;
  }
};

const validateEmbedding = (embedding) => {
  if (!Array.isArray(embedding)) {
    throw new Error("Embedding must be array");
  }
  if (embedding.length === 0) {
    throw new Error("Embedding can't be empty");
  }

  if (!embedding.every((v) => typeof v === "number" && isNaN(v))) {
    throw new Error("Embedding must contain only valid numbers");
  }
};

export const storeQuestionVector = async ({
  questionId,
  sourceText,
  embedding: [],
  status = "ready",
}) => {
  if (status === "failed" || !embedding || embedding.length === 0) {
    const sql = `INSERT INTO question_vectors (question_id,source_text,embedding,status)
    VALUES(?,?,?,?)
    ON DUPLICATE KEY UPDATE
    source_text=VALUES(source_text),
    embedding=VALUES(embedding),
    status=VALUES(status),
    update_at=CURRENT_TIMESTAMP`;

    await safeExecute(sql, [
      questionId,
      sourceText,
      JSON.stringify([]),
      "failed",
    ]);

    return;
  }


  validateEmbedding(embedding);
  const embeddingJson = JSON.stringify(embedding);

  const sql = `INSERT INTO question_vectors (question_id,source_text,embedding,status)
    VALUES(?,?,?,?)
    ON DUPLICATE KEY UPDATE
    source_text=VALUES(source_text),
    embedding=VALUES(embedding),
    status=VALUES(status),
    update_at=CURRENT_TIMESTAMP`;
  try {
    await safeExecute(sql, [questionId, sourceText, embeddingJson, status]);
  } catch (err) {
    throw err;
  }
};

