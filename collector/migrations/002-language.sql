-- Add `language` (the browser UI language, primary subtag) without dropping the
-- table, for the same reason as 001: schema.sql starts with DROP TABLE, and
-- SQLite cannot add a column to a UNIQUE constraint.
--
-- Existing rows get '' and stay that way. Nothing recorded before this column
-- existed carries the browser's language, and the user agent that might have
-- hinted at it is discarded by design. The Android question this column exists
-- to answer is answerable only by NEW reports.
PRAGMA foreign_keys = OFF;

CREATE TABLE reports_new (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  first_seen  TEXT    NOT NULL,
  runtime     TEXT    NOT NULL,
  engine      TEXT    NOT NULL DEFAULT '',
  language    TEXT    NOT NULL DEFAULT '',
  said        TEXT    NOT NULL DEFAULT '',
  resolved    TEXT    NOT NULL,
  checked     INTEGER NOT NULL,
  broken      INTEGER NOT NULL,
  failing     TEXT    NOT NULL,
  country     TEXT,
  UNIQUE (runtime, engine, language, said, resolved, checked, broken)
);

INSERT INTO reports_new (id, first_seen, runtime, engine, language, said, resolved, checked, broken, failing, country)
  SELECT id, first_seen, runtime, engine, '', said, resolved, checked, broken, failing, country FROM reports;

DROP TABLE reports;
ALTER TABLE reports_new RENAME TO reports;

PRAGMA foreign_keys = ON;
