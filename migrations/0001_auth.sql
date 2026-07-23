-- ============================================================
-- Migration: 0001_auth.sql
-- Adds user accounts and session management to the archive.
-- Run this once against your D1 database.
--
-- Via Wrangler CLI:
--   npx wrangler d1 execute <your-db-name> --file=migrations/0001_auth.sql
--
-- Or apply in the Cloudflare Dashboard under D1 → your database → Console.
-- ============================================================

-- Users table: stores credentials and public profile information.
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,       -- login handle, URL-safe, 3-40 chars
  email         TEXT UNIQUE NOT NULL,       -- private, used for login only
  password_hash TEXT NOT NULL,              -- "pbkdf2:salt:hash" format (base64)
  display_name  TEXT,                       -- shown publicly on posts and profile
  description   TEXT,                       -- bio / about text
  avatar_url    TEXT,                       -- public image URL
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table: one row per active browser session.
-- Sessions expire after 30 days; expired rows can be pruned without data loss.
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,              -- crypto.randomUUID() — 128-bit random
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Add user_id to messages so posts can be attributed to registered users.
-- NULL = legacy anonymous post (preserved as-is).
ALTER TABLE messages ADD COLUMN user_id INTEGER REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
