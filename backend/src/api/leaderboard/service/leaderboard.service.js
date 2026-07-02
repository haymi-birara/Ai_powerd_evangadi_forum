import { safeExecute } from "../../../../db/config.js";

// Community recognition titles awarded by leaderboard rank (top 3). These are
// surfaced as a "badge of recognition" so the community can see who is leading
// on community upvotes.
const RANK_RECOGNITION = [
  'Community Champion',
  'Top Contributor',
  'Rising Star',
];

// Resolve the recognition label for a monthly leaderboard slot, folding in any
// persisted annual honors so the board matches the community badge shown on
// answers. Mirrors the resolution in getCommunityRecognitionByUser (kept inline
// here to avoid a recursive call back into the leaderboard query).
//   • championMonths >= 3         → "Champion of the Year"
//   • championMonths 1–2 & rank 1 → "{months+1}× Champion" (leading again)
//   • championMonths 1–2          → "{months}× Champion"
//   • otherwise                   → the plain rank label
const resolveRecognition = (rankLabel, championMonths, leadingNow) => {
  const months = Number(championMonths) || 0;
  if (months >= 3) return 'Champion of the Year';
  if (months >= 1) return leadingNow ? `${months + 1}× Champion` : `${months}× Champion`;
  return rankLabel || null;
};

// Fetch display badges for a set of user IDs in one query.
// Excludes internal tracking entries (Quick Responder Credit).
const fetchBadgesForUsers = async (userIds) => {
  if (userIds.length === 0) return {};

  const placeholders = userIds.map(() => '?').join(', ');
  const rows = await safeExecute(
    `SELECT user_id, badge_name
     FROM user_badges
     WHERE user_id IN (${placeholders})
       AND badge_name != 'Quick Responder Credit'
     ORDER BY earned_at ASC`,
    userIds
  );

  // Group into { [userId]: string[] }
  return rows.reduce((acc, row) => {
    if (!acc[row.user_id]) acc[row.user_id] = [];
    acc[row.user_id].push(row.badge_name);
    return acc;
  }, {});
};

// Monthly leaderboard — top 3 by upvotes received this calendar month × 5.
// Only upvote points are measurable per-month without a ledger. Other trust
// events (welcome bonus, quick responder, weekly consistency) are included
// in the all-time trust_score but cannot be isolated to a specific month.
// `answerCount` reflects the member's total answers (their overall contribution)
// rather than only answers authored this month — an answer written in a prior
// month can still earn upvotes now, so a per-month author count reads as a
// misleading "0 answers" next to a positive score.
// Tie-breaker 1: most answers authored overall.
// Tie-breaker 2: earliest user_id (longest-standing member wins).
// Only active users are included (limited/blocked/removed are excluded).
// The month window is a half-open range on a UTC start-of-month so the SQL can
// use a created_at index and stays consistent with the UTC `period` below.
export const getMonthlyLeaderboardService = async () => {
  const rows = await safeExecute(
    `SELECT
       u.user_id    AS userId,
       u.first_name AS firstName,
       u.last_name  AS lastName,
       u.trust_score AS trustScore,
       COALESCE(mv.vote_count * 5, 0)  AS pointsThisPeriod,
       COALESCE(mv.vote_count, 0)      AS votesThisPeriod,
       COALESCE(ac.answer_count, 0)    AS answerCount
     FROM users u
     LEFT JOIN (
       SELECT a.user_id, COUNT(*) AS vote_count
       FROM answer_votes av
       INNER JOIN answers a ON a.answer_id = av.answer_id
       WHERE av.created_at >= DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01')
         AND av.created_at <  DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01') + INTERVAL 1 MONTH
       GROUP BY a.user_id
     ) mv ON mv.user_id = u.user_id
     LEFT JOIN (
       SELECT user_id, COUNT(*) AS answer_count
       FROM answers
       GROUP BY user_id
     ) ac ON ac.user_id = u.user_id
     LEFT JOIN user_moderation_status ums ON ums.user_id = u.user_id
     WHERE (ums.status IS NULL OR ums.status = 'active')
       AND COALESCE(mv.vote_count, 0) > 0
     ORDER BY pointsThisPeriod DESC, answerCount DESC, u.user_id ASC
     LIMIT 3`,
    []
  );

  const userIds = rows.map(r => r.userId);
  const badgeMap = await fetchBadgesForUsers(userIds);

  // Yearly / multi-month recognition so the board matches the community badge
  // shown elsewhere (crown for "Champion of the Year", "N× Champion" streaks).
  // Best-effort: fall back to the plain rank label if the ledger is unavailable.
  const championCounts = await getYearlyChampionCounts().catch(() => ({}));

  // Compute the period label in UTC so it matches the UTC month window above.
  const now = new Date();
  const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  return {
    period,
    data: rows.map((row, i) => ({
      rank:             i + 1,
      recognition:      resolveRecognition(RANK_RECOGNITION[i], championCounts[row.userId], i === 0),
      userId:           row.userId,
      firstName:        row.firstName,
      lastName:         row.lastName,
      trustScore:       row.trustScore,
      pointsThisPeriod: row.pointsThisPeriod,
      votesThisPeriod:  row.votesThisPeriod,
      answerCount:      row.answerCount,
      badges:           badgeMap[row.userId] || [],
    })),
  };
};

// All-time leaderboard — top 3 by cumulative trust_score.
// Tie-breaker 1: most total answers posted.
// Tie-breaker 2: earliest user_id (stable, deterministic ordering).
// Only active users are included (limited/blocked/removed are excluded).
export const getAllTimeLeaderboardService = async () => {
  const rows = await safeExecute(
    `SELECT
       u.user_id    AS userId,
       u.first_name AS firstName,
       u.last_name  AS lastName,
       u.trust_score AS trustScore,
       COALESCE(ac.total, 0) AS answerCount
     FROM users u
     LEFT JOIN (
       SELECT user_id, COUNT(*) AS total
       FROM answers
       GROUP BY user_id
     ) ac ON ac.user_id = u.user_id
     LEFT JOIN user_moderation_status ums ON ums.user_id = u.user_id
     WHERE (ums.status IS NULL OR ums.status = 'active')
       AND u.trust_score > 0
     ORDER BY u.trust_score DESC, answerCount DESC, u.user_id ASC
     LIMIT 3`,
    []
  );

  const userIds = rows.map(r => r.userId);
  const badgeMap = await fetchBadgesForUsers(userIds);

  return {
    data: rows.map((row, i) => ({
      rank:             i + 1,
      recognition:      RANK_RECOGNITION[i] || null,
      userId:           row.userId,
      firstName:        row.firstName,
      lastName:         row.lastName,
      trustScore:       row.trustScore,
      pointsThisPeriod: row.trustScore,
      answerCount:      row.answerCount,
      badges:           badgeMap[row.userId] || [],
    })),
  };
};

// Leaderboard for a specific COMPLETED month, read from the persisted awards
// ledger (leaderboard_awards). Defaults to the previous calendar month in UTC.
// Returns the same row shape as the monthly board so the UI can reuse it.
export const getLastMonthLeaderboardService = async (period) => {
  // Previous UTC month as 'YYYY-MM' when no explicit period is given.
  const now = new Date();
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const targetPeriod = period || `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`;

  // The awards ledger is created lazily at startup and may be absent if that
  // step was skipped (e.g. the DB user lacks CREATE privilege). Treat a missing
  // table as "no awards yet" so this endpoint stays 200 and the page keeps
  // working instead of failing the whole leaderboard.
  let rows;
  try {
    rows = await safeExecute(
      `SELECT
         la.rank_position AS rankPosition,
         la.recognition   AS recognition,
         la.votes         AS votesThisPeriod,
         u.user_id        AS userId,
         u.first_name     AS firstName,
         u.last_name      AS lastName,
         u.trust_score    AS trustScore,
         COALESCE(ac.answer_count, 0) AS answerCount
       FROM leaderboard_awards la
       INNER JOIN users u ON u.user_id = la.user_id
       LEFT JOIN (
         SELECT user_id, COUNT(*) AS answer_count
         FROM answers
         GROUP BY user_id
       ) ac ON ac.user_id = la.user_id
       WHERE la.period = ?
       ORDER BY la.rank_position ASC`,
      [targetPeriod]
    );
  } catch (err) {
    if (err?.code === 'ER_NO_SUCH_TABLE') {
      return { period: targetPeriod, data: [] };
    }
    throw err;
  }

  const badgeMap = await fetchBadgesForUsers(rows.map(r => r.userId));

  return {
    period: targetPeriod,
    data: rows.map((row) => ({
      rank:             row.rankPosition,
      recognition:      row.recognition,
      userId:           row.userId,
      firstName:        row.firstName,
      lastName:         row.lastName,
      trustScore:       row.trustScore,
      votesThisPeriod:  row.votesThisPeriod,
      pointsThisPeriod: row.votesThisPeriod * 5,
      answerCount:      row.answerCount,
      badges:           badgeMap[row.userId] || [],
    })),
  };
};

// Returns a map of { [userId]: recognitionTitle } for the current monthly
// top-3 vote leaders. Used to surface a "badge of recognition" next to a
// leader's name across the forum (e.g. on their answers). Best-effort callers
// should treat a thrown error as "no recognition".
export const getMonthlyRecognitionByUser = async () => {
  const { data } = await getMonthlyLeaderboardService();
  return data.reduce((acc, entry) => {
    if (entry.recognition) acc[entry.userId] = entry.recognition;
    return acc;
  }, {});
};

// ─────────────────────────────────────────────────────────────────────────────
// Option A — persisted monthly awards (enables multi-month streaks + yearly).
// ─────────────────────────────────────────────────────────────────────────────

// Idempotently create the awards ledger. Runs at startup. No foreign keys:
// the app DB user may lack the REFERENCES privilege, and awards are a
// derived snapshot that we never need referential enforcement on.
export const ensureLeaderboardAwardsSupport = async () => {
  const rows = await safeExecute(
    `SELECT COUNT(*) AS cnt
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'leaderboard_awards'`,
    [],
  );

  if (!rows?.[0]?.cnt) {
    await safeExecute(
      `CREATE TABLE leaderboard_awards (
         award_id      INT AUTO_INCREMENT PRIMARY KEY,
         user_id       INT NOT NULL,
         period        CHAR(7) NOT NULL,           -- 'YYYY-MM' (a completed month)
         rank_position TINYINT NOT NULL,           -- 1..3
         recognition   VARCHAR(50) NOT NULL,
         votes         INT NOT NULL DEFAULT 0,
         awarded_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         UNIQUE KEY uniq_period_rank (period, rank_position),
         INDEX idx_awards_user (user_id),
         INDEX idx_awards_period (period)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      [],
    );
  }
};

// Snapshot every COMPLETED month (period < current UTC month) that has upvotes
// into the awards ledger. Idempotent: the UNIQUE(period, rank_position) key +
// INSERT IGNORE means already-recorded months are skipped, and a completed
// month's votes never change, so re-running is safe and cheap.
export const snapshotCompletedMonthlyAwards = async () => {
  const rows = await safeExecute(
    `SELECT period, user_id, votes, rnk
       FROM (
         SELECT
           t.period,
           t.user_id,
           t.votes,
           ROW_NUMBER() OVER (
             PARTITION BY t.period
             ORDER BY t.votes DESC, t.user_id ASC
           ) AS rnk
         FROM (
           SELECT
             DATE_FORMAT(av.created_at, '%Y-%m') AS period,
             a.user_id,
             COUNT(*) AS votes
           FROM answer_votes av
           INNER JOIN answers a ON a.answer_id = av.answer_id
           LEFT JOIN user_moderation_status ums ON ums.user_id = a.user_id
           WHERE av.created_at < DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01')
             AND (ums.status IS NULL OR ums.status = 'active')
           GROUP BY period, a.user_id
         ) t
       ) ranked
      WHERE ranked.rnk <= 3`,
    [],
  );

  for (const row of rows) {
    const recognition = RANK_RECOGNITION[row.rnk - 1] || null;
    if (!recognition) continue;
    await safeExecute(
      `INSERT IGNORE INTO leaderboard_awards
         (user_id, period, rank_position, recognition, votes)
       VALUES (?, ?, ?, ?, ?)`,
      [row.user_id, row.period, row.rnk, recognition, row.votes],
    );
  }
};

// How many times each user has finished #1 in a COMPLETED month within the
// given calendar year. Drives the multi-month streak / yearly-champion badge.
// Returns { [userId]: championMonths }.
export const getYearlyChampionCounts = async (year) => {
  const y = year || new Date().getUTCFullYear();
  const rows = await safeExecute(
    `SELECT user_id, COUNT(*) AS championMonths
       FROM leaderboard_awards
      WHERE rank_position = 1
        AND period LIKE ?
      GROUP BY user_id`,
    [`${y}-%`],
  );
  return rows.reduce((acc, r) => {
    acc[r.user_id] = r.championMonths;
    return acc;
  }, {});
};

// Combined recognition used for the community badge shown next to a member's
// name (e.g. on their answers). Merges the LIVE current-month standing with the
// PERSISTED history so the label reflects both "who is leading right now" and
// "who has been recognized across the year".
//
// Resolution per user:
//   • on the current board  → the board's resolved title (Community Champion /
//                             Top Contributor / Rising Star, or the folded-in
//                             streak/yearly label like "2× Champion"). This is
//                             taken verbatim so answer badges match the board.
//   • off the board with    → their earned "{months}× Champion" (1–2) or
//     prior #1 finishes       "Champion of the Year" (3+), which persists.
//
// Because the live monthly title is recomputed on every call, the badge updates
// as standings change (no caching).
export const getCommunityRecognitionByUser = async () => {
  // Keep the persisted ledger current for any freshly-completed months.
  try {
    await snapshotCompletedMonthlyAwards();
  } catch (err) {
    console.error('[recognition] snapshotCompletedMonthlyAwards failed (non-fatal):', err.message);
  }

  const [liveMap, championCounts] = await Promise.all([
    getMonthlyRecognitionByUser(),          // { userId: resolved live title } (already folds in streak/yearly)
    getYearlyChampionCounts(),              // { userId: championMonths }
  ]);

  const result = {};

  // Earned annual honors persist even when a member is not on the current board.
  for (const [userId, months] of Object.entries(championCounts)) {
    if (months >= 3) {
      result[userId] = 'Champion of the Year';
    } else if (months >= 1) {
      result[userId] = `${months}× Champion`;
    }
  }

  // The live monthly board is authoritative for anyone currently ranked — it
  // already resolves the streak/yearly label (e.g. "2× Champion" when leading
  // again), so overlay it last to keep answer badges identical to the board.
  for (const [userId, title] of Object.entries(liveMap)) {
    result[userId] = title;
  }

  return result;
};
