-- Add `engine` (the Chromium major) WITHOUT dropping the table.
--
-- schema.sql begins with DROP TABLE IF EXISTS, which is right for a fresh
-- install and would have destroyed the twenty-four reports strangers had
-- already sent. SQLite cannot add a column to a UNIQUE constraint either, so
-- this is the standard rebuild: new table, copy, drop, rename.
--
-- Existing rows get '' and stay that way. The user agent is discarded before
-- storage by design, so the engine version of a report already taken does not
-- exist anywhere to be recovered. Do not invent one from the family version:
-- that number is exactly what this column exists because it is not.
PRAGMA foreign_keys = OFF;

CREATE TABLE reports_new (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  first_seen  TEXT    NOT NULL,
  runtime     TEXT    NOT NULL,
  engine      TEXT    NOT NULL DEFAULT '',
  said        TEXT    NOT NULL DEFAULT '',
  resolved    TEXT    NOT NULL,
  checked     INTEGER NOT NULL,
  broken      INTEGER NOT NULL,
  failing     TEXT    NOT NULL,
  country     TEXT,
  UNIQUE (runtime, engine, said, resolved, checked, broken)
);

INSERT INTO reports_new (id, first_seen, runtime, engine, said, resolved, checked, broken, failing, country)
  SELECT id, first_seen, runtime, '', said, resolved, checked, broken, failing, country FROM reports;

DROP TABLE reports;
ALTER TABLE reports_new RENAME TO reports;

PRAGMA foreign_keys = ON;
