import { safeExecute } from "../../../../db/config.js";

// Length of the answer preview surfaced in notifications.
const PREVIEW_LENGTH = 160;

const buildPreview = (content) => {
  if (typeof content !== "string") return "";
  const collapsed = content.replace(/\s+/g, " ").trim();
  if (collapsed.length <= PREVIEW_LENGTH) return collapsed;
  return `${collapsed.slice(0, PREVIEW_LENGTH).trimEnd()}…`;
};

const mapNotification = (row) => ({
  answerId: row.answer_id,
  questionHash: row.question_hash,
  questionTitle: row.question_title,
  answerPreview: buildPreview(row.content),
  answererName: `${row.first_name} ${row.last_name}`.trim(),
  createdAt: row.created_at,
});

// Shape for an "someone upvoted your answer" notification. Kept compatible with
// the answer-notification item so the frontend can render one merged feed.
const mapVoteNotification = (row) => ({
  type: "vote",
  answerId: row.answer_id,
  questionHash: row.question_hash,
  questionTitle: row.question_title,
  answerPreview: buildPreview(row.content),
  voterName: `${row.first_name} ${row.last_name}`.trim(),
  createdAt: row.created_at,
});

// ── One-time schema support ───────────────────────────────────────────────────
// Adds users.last_seen_answer_id so we can compute per-owner "unseen" answers.
// Idempotent: checks information_schema before ALTERing (MySQL has no
// ADD COLUMN IF NOT EXISTS across all supported versions).
export const ensureNotificationSupport = async () => {
  const rows = await safeExecute(
    `SELECT COUNT(*) AS cnt
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'last_seen_answer_id'`,
    [],
  );

  if (!rows?.[0]?.cnt) {
    await safeExecute(
      `ALTER TABLE users ADD COLUMN last_seen_answer_id BIGINT NULL`,
      [],
    );
  }

  // Marker for "upvote on my answer" notifications. answer_votes has no
  // surrogate id, so we track the last-seen vote by its created_at timestamp.
  const voteCol = await safeExecute(
    `SELECT COUNT(*) AS cnt
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'last_seen_vote_at'`,
    [],
  );

  if (!voteCol?.[0]?.cnt) {
    await safeExecute(
      `ALTER TABLE users ADD COLUMN last_seen_vote_at DATETIME NULL`,
      [],
    );
  }
};

// ── GET /api/notifications/answers/unseen ─────────────────────────────────────
// New answers on the current user's questions that they have not seen yet.
export const getUnseenAnswerNotificationsService = async ({ userId }) => {
  const rows = await safeExecute(
    `SELECT a.answer_id, a.content, a.created_at,
            q.question_hash, q.title AS question_title,
            au.first_name, au.last_name
       FROM answers a
       JOIN questions q ON q.question_id = a.question_id
       JOIN users au    ON au.user_id = a.user_id
       JOIN users me    ON me.user_id = ?
      WHERE q.user_id = ?
        AND a.user_id <> q.user_id
        AND a.answer_id > COALESCE(me.last_seen_answer_id, 0)
      ORDER BY a.answer_id DESC
      LIMIT 50`,
    [userId, userId],
  );

  const data = rows.map(mapNotification);
  return { data, count: data.length };
};

// ── POST /api/notifications/answers/seen ──────────────────────────────────────
// Marks every current answer on this user's questions as seen.
export const markAnswerNotificationsSeenService = async ({ userId }) => {
  await safeExecute(
    `UPDATE users
        SET last_seen_answer_id = (
          SELECT COALESCE(MAX(a.answer_id), 0)
            FROM answers a
            JOIN questions q ON q.question_id = a.question_id
           WHERE q.user_id = ?
        )
      WHERE user_id = ?`,
    [userId, userId],
  );
  return { success: true };
};

// ── GET /api/notifications/answers ────────────────────────────────────────────
// Recent answers on this user's questions (bell/reopen view, ignores seen state).
export const getRecentAnswerNotificationsService = async ({ userId, limit = 10 }) => {
  const safeLimit = Math.min(50, Math.max(1, parseInt(limit) || 10));
  const rows = await safeExecute(
    `SELECT a.answer_id, a.content, a.created_at,
            q.question_hash, q.title AS question_title,
            au.first_name, au.last_name
       FROM answers a
       JOIN questions q ON q.question_id = a.question_id
       JOIN users au    ON au.user_id = a.user_id
      WHERE q.user_id = ?
        AND a.user_id <> q.user_id
      ORDER BY a.answer_id DESC
      LIMIT ${safeLimit}`,
    [userId],
  );
  return { data: rows.map(mapNotification) };
};

// ── GET /api/notifications/votes/unseen ───────────────────────────────────────
// Upvotes on the current user's answers that they have not seen yet.
export const getUnseenVoteNotificationsService = async ({ userId }) => {
  const rows = await safeExecute(
    `SELECT a.answer_id, a.content, av.created_at,
            q.question_hash, q.title AS question_title,
            vu.first_name, vu.last_name
       FROM answer_votes av
       JOIN answers a   ON a.answer_id = av.answer_id
       JOIN questions q ON q.question_id = a.question_id
       JOIN users vu    ON vu.user_id = av.user_id
      WHERE a.user_id = ?
        AND av.user_id <> a.user_id
        AND av.created_at > COALESCE(
              (SELECT last_seen_vote_at FROM users WHERE user_id = ?),
              '1970-01-01 00:00:00')
      ORDER BY av.created_at DESC
      LIMIT 50`,
    [userId, userId],
  );

  const data = rows.map(mapVoteNotification);
  return { data, count: data.length };
};

// ── POST /api/notifications/votes/seen ────────────────────────────────────────
// Marks every current upvote on this user's answers as seen.
export const markVoteNotificationsSeenService = async ({ userId }) => {
  await safeExecute(
    `UPDATE users
        SET last_seen_vote_at = (
          SELECT COALESCE(MAX(av.created_at), UTC_TIMESTAMP())
            FROM answer_votes av
            JOIN answers a ON a.answer_id = av.answer_id
           WHERE a.user_id = ?
        )
      WHERE user_id = ?`,
    [userId, userId],
  );
  return { success: true };
};

// ── GET /api/notifications/votes ──────────────────────────────────────────────
// Recent upvotes on this user's answers (reopen view, ignores seen state).
export const getRecentVoteNotificationsService = async ({ userId, limit = 10 }) => {
  const safeLimit = Math.min(50, Math.max(1, parseInt(limit) || 10));
  const rows = await safeExecute(
    `SELECT a.answer_id, a.content, av.created_at,
            q.question_hash, q.title AS question_title,
            vu.first_name, vu.last_name
       FROM answer_votes av
       JOIN answers a   ON a.answer_id = av.answer_id
       JOIN questions q ON q.question_id = a.question_id
       JOIN users vu    ON vu.user_id = av.user_id
      WHERE a.user_id = ?
        AND av.user_id <> a.user_id
      ORDER BY av.created_at DESC
      LIMIT ${safeLimit}`,
    [userId],
  );
  return { data: rows.map(mapVoteNotification) };
};

// ── GET /api/notifications/moderation ────────────────────────────────────────
// Returns the current user's own moderation history: their flagged posts with
// decisions, plus their current incident count and moderation status.
export const getModerationNoticesService = async ({ userId }) => {
  const [flags, standing] = await Promise.all([
    safeExecute(
      `SELECT
         mf.flag_id        AS flagId,
         mf.post_type      AS postType,
         mf.category,
         mf.queue_status   AS decision,
         mf.ai_reason      AS reason,
         mf.flagged_at     AS flaggedAt,
         mf.reviewed_at    AS reviewedAt,
         COALESCE(q.title, 'Your answer')            AS contentTitle,
         COALESCE(q.question_hash, aq.question_hash)  AS questionHash,
         SUBSTRING(COALESCE(q.content, a.content), 1, 120) AS contentPreview
       FROM moderation_flags mf
       LEFT JOIN questions q  ON mf.post_type = 'question' AND q.question_id  = mf.post_id
       LEFT JOIN answers   a  ON mf.post_type = 'answer'   AND a.answer_id    = mf.post_id
       LEFT JOIN questions aq ON mf.post_type = 'answer'   AND aq.question_id = a.question_id
      WHERE mf.author_id = ?
      ORDER BY mf.flagged_at DESC
      LIMIT 20`,
      [userId]
    ),
    safeExecute(
      `SELECT status, incident_count AS incidentCount, blocked_until AS blockedUntil
         FROM user_moderation_status
        WHERE user_id = ? LIMIT 1`,
      [userId]
    ),
  ]);

  const CATEGORY_LABELS = {
    spam: 'Spam', harassment: 'Harassment',
    off_topic: 'Off-topic', low_quality: 'Low quality',
  };

  return {
    data: flags.map(r => ({
      flagId:         r.flagId,
      postType:       r.postType,
      category:       CATEGORY_LABELS[r.category] || r.category,
      decision:       r.decision,   // 'pending' | 'approved' | 'removed'
      reason:         r.reason,
      flaggedAt:      r.flaggedAt,
      reviewedAt:     r.reviewedAt,
      contentTitle:   r.contentTitle,
      questionHash:   r.questionHash,
      contentPreview: r.contentPreview,
    })),
    standing: standing.length
      ? {
          status:        standing[0].status,
          incidentCount: Number(standing[0].incidentCount),
          blockedUntil:  standing[0].blockedUntil,
        }
      : { status: 'active', incidentCount: 0, blockedUntil: null },
  };
};
