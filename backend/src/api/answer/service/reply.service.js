import { safeExecute } from "../../../../db/config.js";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../../../utils/errors/index.js";
import {
  moderateContent,
  checkUserModerationStatus,
} from "../../moderation/service/contentModerator.service.js";

// ── One-time schema support ───────────────────────────────────────────────────
// Creates the answer_replies table (question-owner replies to answers).
// Idempotent via CREATE TABLE IF NOT EXISTS so it is safe to call on startup.
// Foreign keys are intentionally omitted here because some hosting DB users lack
// the REFERENCES privilege; referential integrity is enforced at the app layer,
// and the canonical schema.sql still declares the constraints for environments
// that support them.
export const ensureAnswerReplySupport = async () => {
  await safeExecute(
    `CREATE TABLE IF NOT EXISTS answer_replies (
       reply_id INT AUTO_INCREMENT PRIMARY KEY,
       answer_id INT NOT NULL,
       question_id INT NOT NULL,
       user_id INT NOT NULL,
       content TEXT NOT NULL,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
       INDEX idx_answer_replies_answer_id (answer_id),
       INDEX idx_answer_replies_created_at (created_at)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    [],
  );
};

const mapReply = (row) => ({
  id: row.id,
  content: row.content,
  createdAt: row.createdAt,
  user: {
    id: row.userId,
    firstName: row.firstName,
    lastName: row.lastName,
  },
});

/**
 * Create a reply to an answer. Any authenticated (non-blocked) user may reply;
 * replies are open to the whole community, not just the question owner.
 */
export const createReplyService = async ({ answerId, content, userId }) => {
  // Blocked / rate-limited users cannot post.
  const userStatus = await checkUserModerationStatus(userId);
  if (!userStatus.allowed) {
    throw new ForbiddenError(userStatus.reason, "USER_POSTING_RESTRICTED");
  }

  const rows = await safeExecute(
    `SELECT a.answer_id AS answerId, a.question_id AS questionId,
            q.user_id AS questionOwnerId, q.title AS questionTitle, q.content AS questionContent
       FROM answers a
       JOIN questions q ON q.question_id = a.question_id
      WHERE a.answer_id = ?
      LIMIT 1`,
    [answerId],
  );

  if (!rows || rows.length === 0) {
    throw new NotFoundError("Answer not found", "ANSWER_NOT_FOUND");
  }

  const { questionId, questionTitle, questionContent } = rows[0];

  // Content moderation: block offensive / spammy replies before they are stored.
  const modDecision = await moderateContent({
    postType: "answer",
    content,
    questionContext: `${questionTitle} — ${questionContent}`,
  });

  if (modDecision.action === "flag") {
    const err = new BadRequestError(
      modDecision.reason ||
        "Your reply may violate community guidelines. Please keep it respectful.",
      "CONTENT_MODERATION_REJECTED",
    );
    err.guidance =
      modDecision.guidance || "Please keep all replies respectful and professional.";
    throw err;
  }

  const result = await safeExecute(
    `INSERT INTO answer_replies (answer_id, question_id, user_id, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, NOW(), NOW())`,
    [answerId, questionId, userId, content],
  );

  const created = await safeExecute(
    `SELECT r.reply_id AS id, r.content, r.created_at AS createdAt,
            u.user_id AS userId, u.first_name AS firstName, u.last_name AS lastName
       FROM answer_replies r
       JOIN users u ON u.user_id = r.user_id
      WHERE r.reply_id = ?
      LIMIT 1`,
    [result.insertId],
  );

  return mapReply(created[0]);
};

/**
 * Fetch replies for a list of answer ids, grouped by answerId (oldest first).
 * Returns an object: { [answerId]: Reply[] }.
 */
export const getRepliesForAnswers = async (answerIds) => {
  if (!Array.isArray(answerIds) || answerIds.length === 0) return {};

  const placeholders = answerIds.map(() => "?").join(", ");
  const rows = await safeExecute(
    `SELECT r.reply_id AS id, r.answer_id AS answerId, r.content, r.created_at AS createdAt,
            u.user_id AS userId, u.first_name AS firstName, u.last_name AS lastName
       FROM answer_replies r
       JOIN users u ON u.user_id = r.user_id
      WHERE r.answer_id IN (${placeholders})
      ORDER BY r.created_at ASC`,
    answerIds,
  );

  const map = {};
  for (const row of rows) {
    if (!map[row.answerId]) map[row.answerId] = [];
    map[row.answerId].push(mapReply(row));
  }
  return map;
};
