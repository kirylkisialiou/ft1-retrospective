-- FT1 - Retrospective
-- Re-run safely on empty/dev DBs. For existing DBs with old tables, this resets data.

DROP TABLE IF EXISTS seats;
DROP TABLE IF EXISTS deals;
DROP TABLE IF EXISTS cards;
DROP TABLE IF EXISTS sprint;
DROP TABLE IF EXISTS sprints;

CREATE TABLE sprints (
  id TEXT PRIMARY KEY,
  number INTEGER NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT 'FT1 - Retrospective',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);

CREATE UNIQUE INDEX idx_sprints_one_active ON sprints(status) WHERE status = 'active';
CREATE INDEX idx_sprints_number ON sprints(number DESC);
CREATE UNIQUE INDEX idx_sprints_slug ON sprints(slug);

CREATE TABLE cards (
  id TEXT PRIMARY KEY,
  sprint_id TEXT NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'human',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_cards_sprint ON cards(sprint_id, created_at DESC);

CREATE TABLE deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sprint_id TEXT NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  card_ids TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_deals_sprint ON deals(sprint_id, id DESC);

CREATE TABLE seats (
  sprint_id TEXT NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
  seat_index INTEGER NOT NULL CHECK (seat_index >= 0 AND seat_index <= 7),
  occupant_token TEXT NOT NULL,
  display_name TEXT NOT NULL,
  claimed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (sprint_id, seat_index)
);

CREATE UNIQUE INDEX idx_seats_token ON seats(sprint_id, occupant_token);
CREATE INDEX idx_seats_sprint ON seats(sprint_id);

INSERT INTO sprints (id, number, slug, title, status)
VALUES ('sprint-1', 1, 's-1', 'FT1 - Retrospective', 'active');
