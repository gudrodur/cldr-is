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
  -- "Chromium 152", read from the `Chrome/<major>` token every Chromium browser
  -- carries whatever it calls itself. The family version is NOT the engine
  -- version — Opera 101 and Samsung Internet 30 are their own numbering — and
  -- that is the whole reason this column exists: without it a table of Android
  -- rows cannot say whether it shows one engine version or five. Empty (never
  -- NULL, see `said` below) for Gecko and for every iOS browser, where no
  -- honest version can be read.
  engine      TEXT    NOT NULL DEFAULT '',
  -- The browser's own UI language, primary subtag only: "is", "en", "pl". Not
  -- the ordered navigator.languages list, which is a fingerprinting vector; not
  -- the region, which cannot affect which ICU language data a build carries.
  -- Exists to answer why two reports from the same Chrome 151 on Android
  -- disagree about whether Icelandic is present.
  language    TEXT    NOT NULL DEFAULT '',
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
  UNIQUE (runtime, engine, language, said, resolved, checked, broken)
);
