-- Add `resolved_collator` without dropping the table — same rebuild as 001/002.
--
-- `resolved` has always been DateTimeFormat's, and the page ran a collation
-- check against it as though one locale answered for both. It does not:
-- Edge 153 on Windows reported en-GB dates on 2026-09-08 and still sorted
-- Icelandic correctly. Existing rows read '' and cannot be backfilled.
PRAGMA foreign_keys = OFF;

CREATE TABLE reports_new (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  first_seen        TEXT    NOT NULL,
  runtime           TEXT    NOT NULL,
  engine            TEXT    NOT NULL DEFAULT '',
  language          TEXT    NOT NULL DEFAULT '',
  said              TEXT    NOT NULL DEFAULT '',
  resolved          TEXT    NOT NULL,
  resolved_collator TEXT    NOT NULL DEFAULT '',
  checked           INTEGER NOT NULL,
  broken            INTEGER NOT NULL,
  failing           TEXT    NOT NULL,
  country           TEXT,
  UNIQUE (runtime, engine, language, said, resolved, resolved_collator, checked, broken)
);

INSERT INTO reports_new (id, first_seen, runtime, engine, language, said, resolved, resolved_collator, checked, broken, failing, country)
  SELECT id, first_seen, runtime, engine, language, said, resolved, '', checked, broken, failing, country FROM reports;

DROP TABLE reports;
ALTER TABLE reports_new RENAME TO reports;

PRAGMA foreign_keys = ON;
