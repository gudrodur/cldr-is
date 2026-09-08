-- One row per (runtime, verdict). Not one row per visit.
--
-- What is deliberately NOT here: the full user agent, any IP address, any
-- cookie or visitor id, and any timestamp finer than a date. The first version
-- stored raw user agents and republished them on a public endpoint; a rare user
-- agent is a visitor id whatever the column is called.
--
-- `runtime` is derived in the Worker from a fixed family list and a major
-- version — "Safari 18 / macOS" — and the raw string is discarded before this
-- table sees anything.
DROP TABLE IF EXISTS reports;
CREATE TABLE reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  first_seen  TEXT    NOT NULL,          -- date only, YYYY-MM-DD
  runtime     TEXT    NOT NULL,          -- "Safari 18 / macOS", what the browser reports
  -- NOT NULL with an empty default, and that is load-bearing rather than tidy:
  -- SQLite treats NULL as DISTINCT in a UNIQUE constraint, so a nullable column
  -- here silently switched the dedupe off for the common case. Every page load
  -- reports with no `said`, so every page load inserted a row and the flood the
  -- constraint exists to absorb was unthrottled again for anyone who omitted the
  -- field. Measured 2026-09-08: three identical no-`said` reports made three
  -- rows; three identical ones WITH `said` made one.
  said        TEXT    NOT NULL DEFAULT '',
  resolved    TEXT    NOT NULL,          -- Intl.DateTimeFormat("is").resolvedOptions().locale
  checked     INTEGER NOT NULL,
  broken      INTEGER NOT NULL,
  failing     TEXT    NOT NULL,          -- JSON array of case ids
  country     TEXT,                      -- Cloudflare's two letters, nothing finer
  -- Makes a repeat visit and a flood equally free: both no-op.
  UNIQUE (runtime, said, resolved, checked, broken)
);
