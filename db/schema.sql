-- ============================================================
-- Kiwi's Archive — Auth & Profile system schema
--
-- Run this ONCE against your EXISTING D1 database
-- (`serpentshand-db`). It only adds new tables/columns; it does
-- not touch or delete any existing forum data.
--
--   wrangler d1 execute serpentshand-db --remote --file=./db/schema.sql
--
-- (drop --remote to apply to your local dev database instead)
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name  TEXT,
  description   TEXT,
  avatar_url    TEXT,
  is_admin      INTEGER NOT NULL DEFAULT 0,   -- future-proofing for admins; promote with:
                                               --   UPDATE users SET is_admin = 1 WHERE username = '...';
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,                -- random 32-byte hex token, not the DB row id
  user_id    INTEGER NOT NULL,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_users_username       ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email          ON users(email);

-- ------------------------------------------------------------
-- Link the EXISTING `messages` table to accounts.
--
-- IMPORTANT: SQLite/D1 does not support "ADD COLUMN IF NOT
-- EXISTS". If you've already run this migration once, skip the
-- two ALTER TABLE lines below (D1 will error with
-- "duplicate column name" if you re-run them, which is safe to
-- ignore / comment out).
-- ------------------------------------------------------------
ALTER TABLE messages ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE messages ADD COLUMN updated_at DATETIME;

CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
