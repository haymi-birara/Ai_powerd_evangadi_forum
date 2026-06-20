import crypto from "crypto";
import { safeExecute } from "../../../../db/config.js";
import { BadRequestError, NotFoundError } from "../../../utils/errors/index.js";
import {
  generateQuestionEmbedding,
  normalizeQuestionText,
  storeQuestionVector,
} from "./vector.service.js";

const toNumberOrFallback = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

const dotProduct = (a, b) => {
  let sum = 0;
  const limit = Math.min(a.length, b.length);

  for (let i = 0; i < limit; i += 1) {
    sum += a[i] * b[i];
  }

  return sum;
};

const magnitude = (arr) => Math.sqrt(arr.reduce((sum, value) => sum + value * value, 0));

const cosineSimilarity = (a, b) => {
  const magA = magnitude(a);
  const magB = magnitude(b);

  if (magA === 0 || magB === 0) {
    return 0;
  }

  return dotProduct(a, b) / (magA * magB);
};

const generateQuestionHash = () => {
  return crypto.randomBytes(8).toString("hex");
};

export const createQuestionWithVectorService = async ({ userId, title, content }) => {
  if (!userId) {
    throw new BadRequestError("User is required");
  }

  const questionHash = generateQuestionHash();

  const insertQuestionSql = `
    INSERT INTO questions (question_hash, user_id, title, content)
    VALUES (?, ?, ?, ?)
  `;

  const insertResult = await safeExecute(insertQuestionSql, [
    questionHash,
    userId,
    title,
    content,
  ]);

  const questionId = insertResult.insertId;
  const sourceText = normalizeQuestionText({ title, content });

  try {
    const { embedding } = await generateQuestionEmbedding(sourceText, {
      taskType: "RETRIEVAL_DOCUMENT",
    });

    await storeQuestionVector({
      questionId,
      sourceText,
      embedding,
      status: "ready",
    });
  } catch (err) {
    console.warn(
      `[vector] Embedding failed for question ${questionId} — stored with status=failed:`,
      err.message,
    );
    await storeQuestionVector({
      questionId,
      sourceText,
      embedding: [],
      status: "failed",
    });
  }

  return {
    question: {
      id: questionId,
      questionHash,
      title,
      content,
      userId,
    },
  };
};

const buildQuestionFilters = (filters) => {
  const conditions = [];
  const params = [];

  if (filters.search) {
    conditions.push("(q.title LIKE ? OR q.content LIKE ?)");
    const searchTerm = `%${filters.search}%`;
    params.push(searchTerm, searchTerm);
  }

  if (filters.mine && filters.userId) {
    conditions.push("q.user_id = ?");
    params.push(filters.userId);
  }

  if (conditions.length === 0) {
    return {
      whereClause: "",
      params,
    };
  }

  return {
    whereClause: `WHERE ${conditions.join(" AND ")}`,
    params,
  };
};

const fetchQuestionDetailsByIds = async (ids) => {
  if (!ids || ids.length === 0) {
    return [];
  }

  const placeholders = ids.map(() => "?").join(", ");
  const detailsSql = `
    SELECT
      q.question_id AS id,
      q.question_hash AS questionHash,
      q.title,
      q.content,
      q.created_at AS createdAt,
      q.updated_at AS updatedAt,
      u.user_id AS userId,
      u.first_name AS firstName,
      u.last_name AS lastName,
      COUNT(DISTINCT a.answer_id) AS answerCount
    FROM questions q
    JOIN users u
      ON u.user_id = q.user_id
    LEFT JOIN answers a
      ON a.question_id = q.question_id
    WHERE q.question_id IN (${placeholders})
    GROUP BY
      q.question_id,
      q.question_hash,
      q.title,
      q.content,
      q.created_at,
      q.updated_at,
      u.user_id,
      u.first_name,
      u.last_name
  `;

  return safeExecute(detailsSql, ids);
};

const toQuestionWithAuthor = (question) => {
  if (!question) {
    return question;
  }

  const { userId, firstName, lastName, ...rest } = question;

  return {
    ...rest,
    author: {
      id: userId,
      firstName,
      lastName,
    },
  };
};

const searchQuestionsLexicalFallback = async ({ query, limit }) => {
  return getQuestionsService({ search: query }).then((rows) => rows.slice(0, limit));
};

const getSimilarQuestionsLexicalFallback = async ({ sourceQuestionId, limit }) => {
  const sourceSql = `
    SELECT q.title, q.content
    FROM questions q
    WHERE q.question_id = ?
    LIMIT 1
  `;

  const sourceRows = await safeExecute(sourceSql, [sourceQuestionId]);
  const source = sourceRows[0] || {};
  const raw = `${source.title || ""} ${source.content || ""}`.toLowerCase();
  const tokens = Array.from(
    new Set(raw.split(/[^a-z0-9]+/).filter((token) => token.length >= 4)),
  ).slice(0, 6);

  const conditions = [];
  const params = [];

  for (const token of tokens) {
    conditions.push("(q.title LIKE ? OR q.content LIKE ?)");
    const like = `%${token}%`;
    params.push(like, like);
  }

  const whereSearch =
    conditions.length > 0 ? `AND (${conditions.join(" OR ")})` : "";

  const fallbackSql = `
    SELECT
      q.question_id AS id,
      q.question_hash AS questionHash,
      q.title,
      q.content,
      q.created_at AS createdAt,
      q.updated_at AS updatedAt,
      u.user_id AS userId,
      u.first_name AS firstName,
      u.last_name AS lastName,
      COUNT(DISTINCT a.answer_id) AS answerCount
    FROM questions q
    JOIN users u
      ON u.user_id = q.user_id
    LEFT JOIN answers a
      ON a.question_id = q.question_id
    WHERE q.question_id <> ?
    ${whereSearch}
    GROUP BY
      q.question_id,
      q.question_hash,
      q.title,
      q.content,
      q.created_at,
      q.updated_at,
      u.user_id,
      u.first_name,
      u.last_name
    ORDER BY q.created_at DESC
    LIMIT ${limit}
  `;

  const lexicalRows = await safeExecute(fallbackSql, [sourceQuestionId, ...params]);

  if (lexicalRows.length > 0 || conditions.length === 0) {
    return lexicalRows;
  }

  const broadFallbackSql = `
    SELECT
      q.question_id AS id,
      q.question_hash AS questionHash,
      q.title,
      q.content,
      q.created_at AS createdAt,
      q.updated_at AS updatedAt,
      u.user_id AS userId,
      u.first_name AS firstName,
      u.last_name AS lastName,
      COUNT(DISTINCT a.answer_id) AS answerCount
    FROM questions q
    JOIN users u
      ON u.user_id = q.user_id
    LEFT JOIN answers a
      ON a.question_id = q.question_id
    WHERE q.question_id <> ?
    GROUP BY
      q.question_id,
      q.question_hash,
      q.title,
      q.content,
      q.created_at,
      q.updated_at,
      u.user_id,
      u.first_name,
      u.last_name
    ORDER BY q.created_at DESC
    LIMIT ${limit}
  `;

  return safeExecute(broadFallbackSql, [sourceQuestionId]);
};
export const getQuestionsService = async (filters = {}) => {
  const normalizedLimit = 100;
  const sortColumn = "q.created_at";
  const normalizedSortOrder = "DESC";

  const { whereClause, params } = buildQuestionFilters(filters);

  const listSql = `
    SELECT
      q.question_id AS id,
      q.question_hash AS questionHash,
      q.title,
      q.content,
      q.created_at AS createdAt,
      q.updated_at AS updatedAt,
      u.user_id AS userId,
      u.first_name AS firstName,
      u.last_name AS lastName,
      COUNT(DISTINCT a.answer_id) AS answerCount
    FROM questions q
    JOIN users u
      ON u.user_id = q.user_id
    LEFT JOIN answers a
      ON a.question_id = q.question_id
    ${whereClause}
    GROUP BY
      q.question_id,
      q.question_hash,
      q.title,
      q.content,
      q.created_at,
      q.updated_at,
      u.user_id,
      u.first_name,
      u.last_name
    ORDER BY ${sortColumn} ${normalizedSortOrder}
    LIMIT ${normalizedLimit}
  `;

  const rows = await safeExecute(listSql, params);

  return rows;
};

export const getSingleQuestionService = async ({ questionHash }) => {
  const normalizedAnswerLimit = 100;

  const questionSql = `
    SELECT
      q.question_id AS id,
      q.question_hash AS questionHash,
      q.title,
      q.content,
      q.created_at AS createdAt,
      q.updated_at AS updatedAt,
      u.user_id AS userId,
      u.first_name AS firstName,
      u.last_name AS lastName,
      COUNT(DISTINCT a.answer_id) AS answerCount
    FROM questions q
    JOIN users u
      ON u.user_id = q.user_id
    LEFT JOIN answers a
      ON a.question_id = q.question_id
    WHERE q.question_hash = ?
    GROUP BY
      q.question_id,
      q.question_hash,
      q.title,
      q.content,
      q.created_at,
      q.updated_at,
      u.user_id,
      u.first_name,
      u.last_name
  `;

  const questionRows = await safeExecute(questionSql, [questionHash]);

  if (questionRows.length === 0) {
    throw new NotFoundError("Question not found");
  }

  const question = questionRows[0];

  const answersSql = `
    SELECT
      a.answer_id AS id,
      a.content,
      a.created_at AS createdAt,
      a.updated_at AS updatedAt,
      au.user_id AS userId,
      au.first_name AS userFirstName,
      au.last_name AS userLastName
    FROM answers a
    JOIN users au
      ON au.user_id = a.user_id
    WHERE a.question_id = ?
    ORDER BY a.created_at DESC
    LIMIT ${normalizedAnswerLimit}
  `;

  const answerRows = await safeExecute(answersSql, [question.id]);
  const answers = answerRows.map(row => ({
    id: row.id,
    content: row.content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    user: {
      id: row.userId,
      firstName: row.userFirstName,
      lastName: row.userLastName,
    },
  }));

  return {
    ...question,
    answers,
  };
};

export const searchQuestionsSemanticService = async ({ query, k, threshold }) => {
  const normalizedQuery = typeof query === "string" ? query.trim() : "";

  if (!normalizedQuery) {
    throw new BadRequestError("Query is required");
  }

  const limit = Math.max(1, Math.min(20, toNumberOrFallback(k, 5)));
  const searchThreshold = Math.max(0, Math.min(1, toNumberOrFallback(threshold, 0.75)));

  const normalizedText = normalizeQuestionText({ title: normalizedQuery });
  const { embedding: queryEmbedding } = await generateQuestionEmbedding(normalizedText, {
    taskType: "RETRIEVAL_QUERY",
  });

  const vectorsSql = `
    SELECT qv.question_id AS questionId, qv.embedding
    FROM question_vectors qv
    WHERE qv.status = 'ready'
  `;

  const vectorRows = await safeExecute(vectorsSql, []);

  if (vectorRows.length === 0) {
    const fallbackData = await searchQuestionsLexicalFallback({
      query: normalizedQuery,
      limit,
    });

    return {
      data: fallbackData.map(toQuestionWithAuthor),
      meta: {
        total: fallbackData.length,
        k: limit,
        threshold: searchThreshold,
      },
    };
  }

  const scored = [];

  for (const row of vectorRows) {
    const vector = parseEmbedding(row.embedding);

    if (!Array.isArray(vector) || vector.length === 0) {
      continue;
    }

    const score = cosineSimilarity(queryEmbedding, vector);

    scored.push({ questionId: row.questionId, score });
  }

  const thresholdMatches = scored.filter((item) => item.score >= searchThreshold);
  const ranked = (thresholdMatches.length > 0 ? thresholdMatches : scored).sort(
    (a, b) => b.score - a.score,
  );
  const top = ranked.slice(0, limit);

  if (top.length === 0) {
    const fallbackData = await searchQuestionsLexicalFallback({
      query: normalizedQuery,
      limit,
    });

    return {
      data: fallbackData.map(toQuestionWithAuthor),
      meta: {
        total: fallbackData.length,
        k: limit,
        threshold: searchThreshold,
      },
    };
  }

  const ids = top.map((item) => item.questionId);
  const detailRows = await fetchQuestionDetailsByIds(ids);
  const detailsById = new Map(detailRows.map((row) => [row.id, row]));

  const data = top
    .map((item) => {
      const question = detailsById.get(item.questionId);

      if (!question) {
        return null;
      }

      return {
        ...toQuestionWithAuthor(question),
        score: item.score,
      };
    })
    .filter(Boolean);

  return {
    data,
    meta: {
      total: data.length,
      k: limit,
      threshold: searchThreshold,
    },
  };
};

export const getSimilarQuestionsService = async ({ questionHash, k, threshold }) => {
  const baseQuestionSql = `
    SELECT q.question_id AS id
    FROM questions q
    WHERE q.question_hash = ?
    LIMIT 1
  `;

  const baseQuestionRows = await safeExecute(baseQuestionSql, [questionHash]);

  if (baseQuestionRows.length === 0) {
    throw new NotFoundError("Question not found");
  }

  const sourceQuestionId = baseQuestionRows[0].id;

  const sourceVectorSql = `
    SELECT qv.embedding
    FROM question_vectors qv
    WHERE qv.question_id = ? AND qv.status = 'ready'
    LIMIT 1
  `;

  const sourceVectorRows = await safeExecute(sourceVectorSql, [sourceQuestionId]);

  if (sourceVectorRows.length === 0) {
    const fallbackData = await getSimilarQuestionsLexicalFallback({
      sourceQuestionId,
      limit: Math.max(1, Math.min(20, toNumberOrFallback(k, 5))),
    });

    return {
      data: fallbackData.map(toQuestionWithAuthor),
      meta: {
        total: fallbackData.length,
        k: Math.max(1, Math.min(20, toNumberOrFallback(k, 5))),
        threshold: Math.max(0, Math.min(1, toNumberOrFallback(threshold, 0.75))),
      },
    };
  }

  const sourceEmbedding = parseEmbedding(sourceVectorRows[0].embedding);

  if (!Array.isArray(sourceEmbedding) || sourceEmbedding.length === 0) {
    const fallbackData = await getSimilarQuestionsLexicalFallback({
      sourceQuestionId,
      limit: Math.max(1, Math.min(20, toNumberOrFallback(k, 5))),
    });

    return {
      data: fallbackData.map(toQuestionWithAuthor),
      meta: {
        total: fallbackData.length,
        k: Math.max(1, Math.min(20, toNumberOrFallback(k, 5))),
        threshold: Math.max(0, Math.min(1, toNumberOrFallback(threshold, 0.75))),
      },
    };
  }

  const limit = Math.max(1, Math.min(20, toNumberOrFallback(k, 5)));
  const searchThreshold = Math.max(0, Math.min(1, toNumberOrFallback(threshold, 0.75)));

  const candidateSql = `
    SELECT qv.question_id AS questionId, qv.embedding
    FROM question_vectors qv
    WHERE qv.status = 'ready' AND qv.question_id <> ?
  `;

  const candidateRows = await safeExecute(candidateSql, [sourceQuestionId]);
  const scored = [];

  for (const row of candidateRows) {
    const vector = parseEmbedding(row.embedding);

    if (!Array.isArray(vector) || vector.length === 0) {
      continue;
    }

    const score = cosineSimilarity(sourceEmbedding, vector);

    scored.push({ questionId: row.questionId, score });
  }

  const thresholdMatches = scored.filter((item) => item.score >= searchThreshold);
  const ranked = (thresholdMatches.length > 0 ? thresholdMatches : scored).sort(
    (a, b) => b.score - a.score,
  );
  const top = ranked.slice(0, limit);

  if (top.length === 0) {
    const fallbackData = await getSimilarQuestionsLexicalFallback({
      sourceQuestionId,
      limit,
    });

    return {
      data: fallbackData.map(toQuestionWithAuthor),
      meta: {
        total: fallbackData.length,
        k: limit,
        threshold: searchThreshold,
      },
    };
  }

  const ids = top.map((item) => item.questionId);
  const detailRows = await fetchQuestionDetailsByIds(ids);
  const detailsById = new Map(detailRows.map((row) => [row.id, row]));

  const data = top
    .map((item) => {
      const question = detailsById.get(item.questionId);

      if (!question) {
        return null;
      }

      return {
        ...toQuestionWithAuthor(question),
        score: item.score,
      };
    })
    .filter(Boolean);

  return {
    data,
    meta: {
      total: data.length,
      k: limit,
      threshold: searchThreshold,
    },
  };
};
