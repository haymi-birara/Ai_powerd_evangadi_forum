import { safeExecute } from "../../../../db/config.js";
import { NotFoundError } from "../../../utils/errors/index.js";

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
      au.first_name AS firstName,
      au.last_name AS lastName
    FROM answers a
    JOIN users au
      ON au.user_id = a.user_id
    WHERE a.question_id = ?
    ORDER BY a.created_at DESC
    LIMIT ${normalizedAnswerLimit}
  `;

  const answerRows = await safeExecute(answersSql, [question.id]);

  return {
    ...question,
    answers: answerRows,
  };
};
