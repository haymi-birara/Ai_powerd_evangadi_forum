-- Migration 004 — UP
-- Adds the two tables that previously existed only in live databases with no
-- tracked DDL (captured from production so fresh installs match it):
--   - leaderboard_awards: monthly leaderboard winner recognition
--   - user_otps: one-time codes (login/verification flows)
-- CREATE TABLE IF NOT EXISTS is idempotent — safe to re-run.
-- Compatible with MySQL 8 and MariaDB.

CREATE TABLE IF NOT EXISTS `leaderboard_awards` (
  `award_id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `period` CHAR(7) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rank_position` TINYINT NOT NULL,
  `recognition` VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `votes` INT NOT NULL DEFAULT 0,
  `awarded_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`award_id`),
  UNIQUE KEY `uniq_period_rank` (`period`, `rank_position`),
  KEY `idx_awards_user` (`user_id`),
  KEY `idx_awards_period` (`period`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_otps` (
  `user_id` INT NOT NULL,
  `purpose` VARCHAR(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `otp_hash` CHAR(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `attempts` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `purpose`),
  KEY `idx_user_otps_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
