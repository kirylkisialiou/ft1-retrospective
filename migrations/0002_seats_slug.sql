-- Non-destructive: add sprint.slug + seats for FT1 - Retrospective
-- Existing sprints/cards/deals are kept. Do NOT run schema.sql (it DROPs).
--
-- Note: `ALTER TABLE ... ADD COLUMN slug` fails if slug already exists — that is OK,
-- skip that statement and continue with UPDATE / CREATE INDEX / seats.

ALTER TABLE sprints ADD COLUMN slug TEXT;

UPDATE sprints
SET slug = 's-' || CAST(number AS TEXT)
WHERE slug IS NULL OR slug = '';

-- Deduplicate slugs if numbers collided somehow
UPDATE sprints
SET slug = slug || '-' || substr(id, 1, 6)
WHERE id IN (
  SELECT id FROM sprints s
  WHERE EXISTS (
    SELECT 1 FROM sprints o
    WHERE o.slug = s.slug AND o.id != s.id AND o.rowid < s.rowid
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sprints_slug ON sprints(slug);

CREATE TABLE IF NOT EXISTS seats (
  sprint_id TEXT NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
  seat_index INTEGER NOT NULL CHECK (seat_index >= 0 AND seat_index <= 7),
  occupant_token TEXT NOT NULL,
  display_name TEXT NOT NULL,
  claimed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (sprint_id, seat_index)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_seats_token ON seats(sprint_id, occupant_token);
CREATE INDEX IF NOT EXISTS idx_seats_sprint ON seats(sprint_id);
