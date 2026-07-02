-- Migration 003: Add 'evaluator' role to users table
-- Run once on an existing database.
-- Safe to re-run: MODIFY COLUMN on an ENUM is idempotent for values already present.

ALTER TABLE `users`
  MODIFY COLUMN `role` ENUM('user', 'admin', 'evaluator') NOT NULL DEFAULT 'user';
