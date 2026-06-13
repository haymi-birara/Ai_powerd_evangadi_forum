import { safeExecute } from '../../../../db/config.js';
import { NotFoundError } from '../../../utils/errors/index.js';

/**
 * Compute cosine similarity between two vectors.
 *
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number} Cosine similarity score between -1 and 1
 */
function cosineSimilarity(vecA, vecB) {
  // Ensure both vectors exist and have the same length
  if (
    !Array.isArray(vecA) ||
    !Array.isArray(vecB) ||
    vecA.length === 0 ||
    vecA.length !== vecB.length
  ) {
    return 0;
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    // Ensure vector values are valid numbers
    if (
      typeof vecA[i] !== 'number' ||
      typeof vecB[i] !== 'number'
    ) {
      return 0;
    }

    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  // Prevent division by zero
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Find questions similar to a given question hash using cosine similarity.
 *
 * @param {string} questionHash - Hash of the source question
 * @param {number} k - Maximum number of results
 * @param {number} threshold - Minimum similarity score
 * @returns {Promise<object>}
 */
export const getSimilarQuestionsService = async (
  questionHash,
  k,
  threshold,
) => {
  // --- 1. Fetch source question and its embedding ---
  const sourceSql = `
    SELECT
      q.question_id,
      q.question_hash,
      qv.embedding
    FROM questions q
    JOIN question_vectors qv
      ON q.question_id = qv.question_id
      AND qv.status = 'ready'
    WHERE q.question_hash = ?
    LIMIT 1
  `;

  const rows = await safeExecute(sourceSql, [questionHash]);
  if (rows.length === 0) {
    throw new NotFoundError('Question not found');
  }
  const sourceQuestion = rows[0];

  const sourceVector =
    typeof sourceQuestion.embedding === 'string'
      ? JSON.parse(sourceQuestion.embedding)
      : sourceQuestion.embedding;

  // --- 2. Fetch all other ready vectors ---
  const vectorsSql = `
    SELECT
      question_id,
      embedding
    FROM question_vectors
    WHERE question_id != ?
      AND status = 'ready'
  `;

  const otherVectors = await safeExecute(vectorsSql, [
    sourceQuestion.question_id,
  ]);

  // --- 3. Compute similarity scores ---
  const similarities = [];

  for (const row of otherVectors) {
    const candidateVector =
      typeof row.embedding === 'string'
        ? JSON.parse(row.embedding)
        : row.embedding;

    const score = cosineSimilarity(
      sourceVector,
      candidateVector,
    );

    similarities.push({
      questionId: row.question_id,
      score,
    });
  }

  // --- 4. Resolve threshold and limit ---
  const parsedThreshold = Number(threshold);
  const parsedK = Number(k);

  const minThreshold = Number.isFinite(parsedThreshold)
    ? parsedThreshold
    : Number(process.env.RECOMMEND_THRESHOLD || 0.75);

  const limit = Number.isFinite(parsedK)
    ? parsedK
    : Number(process.env.RECOMMEND_K || 5);

  // --- 5. Filter, sort, and limit ---
  const filtered = similarities
    .filter(item => item.score >= minThreshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const questionIds = filtered.map(
    item => item.questionId,
  );

  // Return early if no matches are found
  if (questionIds.length === 0) {
    return {
      success: true,
      message:
        'Similar questions fetched successfully',
      data: [],
      meta: {
        total: 0,
        k: limit,
        threshold: minThreshold,
        query: null,
        questionHash,
      },
    };
  }

  // --- 6. Hydrate question details ---
  const placeholders = questionIds
    .map(() => '?')
    .join(',');

  const hydrateSql = `
    SELECT
      q.question_id,
      q.question_hash,
      q.title,
      q.content,
      q.created_at,
      q.updated_at,
      u.user_id,
      u.first_name,
      u.last_name,
      COUNT(a.answer_id) AS answer_count
    FROM questions q
    JOIN users u
      ON q.user_id = u.user_id
    LEFT JOIN answers a
      ON q.question_id = a.question_id
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

  const hydratedQuestions = await safeExecute(
    hydrateSql,
    questionIds,
  );

  // Build lookup map for O(1) access
  const questionsMap = new Map();

  for (const question of hydratedQuestions) {
    questionsMap.set(
      question.question_id,
      question,
    );
  }

  // --- 7. Merge similarity scores with question details ---
  const finalResults = filtered
    .map(item => {
      const question = questionsMap.get(
        item.questionId,
      );

      if (!question) {
        return null;
      }

      return {
        id: question.question_id,
        questionHash: question.question_hash,
        title: question.title,
        content: question.content,
        answerCount: Number(
          question.answer_count,
        ),
        createdAt: question.created_at,
        updatedAt: question.updated_at,
        author: {
          id: question.user_id,
          firstName: question.first_name,
          lastName: question.last_name,
        },
        score: Number(item.score.toFixed(4)),
      };
    })
    .filter(Boolean);

  return {
    success: true,
    message:
      'Similar questions fetched successfully',
    data: finalResults,
    meta: {
      total: finalResults.length,
      k: limit,
      threshold: minThreshold,
      query: null,
      questionHash,
    },
  };
};