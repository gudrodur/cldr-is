-- Add `app` (the embedding in-app browser) without dropping the table — same
-- rebuild as 001-003, for the same two reasons: schema.sql starts with DROP
-- TABLE, and SQLite cannot add a column to a UNIQUE constraint.
--
-- Existing rows read '' and cannot be backfilled. The report that prompted this
-- column said "Messenger browser" only because the reader typed it; the user
-- agent that said `FB_IAB/MESSENGER` was discarded before storage, by design.
PRAGMA foreign_keys = OFF;

CREATE TABLE reports_new (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  first_seen        TEXT    NOT NULL,
  runtime           TEXT    NOT NULL,
  engine            TEXT    NOT NULL DEFAULT '',
  app               TEXT    NOT NULL DEFAULT '',
  language          TEXT    NOT NULL DEFAULT '',
  said              TEXT    NOT NULL DEFAULT '',
  resolved          TEXT    NOT NULL,
  resolved_collator TEXT    NOT NULL DEFAULT '',
  checked           INTEGER NOT NULL,
  broken            INTEGER NOT NULL,
  failing           TEXT    NOT NULL,
  country           TEXT,
  UNIQUE (runtime, engine, app, language, said, resolved, resolved_collator, checked, broken)
);

INSERT INTO reports_new (id, first_seen, runtime, engine, app, language, said, resolved, resolved_collator, checked, broken, failing, country)
  SELECT id, first_seen, runtime, engine, '', language, said, resolved, resolved_collator, checked, broken, failing, country FROM reports;

DROP TABLE reports;
ALTER TABLE reports_new RENAME TO reports;

PRAGMA foreign_keys = ON;
