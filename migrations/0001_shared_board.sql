PRAGMA foreign_keys = ON;

CREATE TABLE partners (
  slot INTEGER PRIMARY KEY CHECK (slot IN (1, 2)),
  uid TEXT NOT NULL UNIQUE CHECK (length(trim(uid)) > 0),
  display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1))
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  assignee_uid TEXT NOT NULL REFERENCES partners(uid),
  status TEXT NOT NULL CHECK (status IN ('todo', 'in_progress', 'blocked', 'completed')),
  deadline TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX tasks_created_at_id ON tasks(created_at, id);

CREATE TABLE board_metadata (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision BETWEEN 0 AND 9007199254740991)
);
INSERT INTO board_metadata (id, revision) VALUES (1, 0);
