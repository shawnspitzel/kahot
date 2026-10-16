-- Quizzle schema (single user, so no users table).
-- All timestamps are ISO-8601 strings written by the server.

CREATE TABLE IF NOT EXISTS sets (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  title           TEXT    NOT NULL,
  description     TEXT    NOT NULL DEFAULT '',
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL,
  last_studied_at TEXT
);

CREATE TABLE IF NOT EXISTS cards (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  set_id          INTEGER NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  position        INTEGER NOT NULL,
  term            TEXT    NOT NULL DEFAULT '',
  definition      TEXT    NOT NULL DEFAULT '',
  image_url       TEXT,
  starred         INTEGER NOT NULL DEFAULT 0,
  -- Study progress: 0 = not known, 1 = familiar, 2 = mastered.
  level           INTEGER NOT NULL DEFAULT 0,
  times_correct   INTEGER NOT NULL DEFAULT 0,
  times_incorrect INTEGER NOT NULL DEFAULT 0,
  last_studied_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_cards_set ON cards(set_id, position);

CREATE TABLE IF NOT EXISTS folders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
);

-- A set can live in any number of folders.
CREATE TABLE IF NOT EXISTS folder_sets (
  folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  set_id    INTEGER NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  added_at  TEXT    NOT NULL,
  PRIMARY KEY (folder_id, set_id)
);

CREATE TABLE IF NOT EXISTS match_scores (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  set_id     INTEGER NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  time_ms    INTEGER NOT NULL,
  created_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS test_results (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  set_id     INTEGER NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  score      INTEGER NOT NULL,
  total      INTEGER NOT NULL,
  created_at TEXT    NOT NULL
);
