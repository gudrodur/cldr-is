-- One row per page load that reported.
--
-- What is deliberately NOT here: IP address, any cookie or visitor id, referrer,
-- anything that identifies a person. The user agent is the subject of the
-- measurement — without it a verdict is a result with no subject — and it is the
-- only thing here that could be called identifying at all.
CREATE TABLE IF NOT EXISTS reports (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  seen_at      TEXT    NOT NULL,          -- ISO 8601, second precision
  user_agent   TEXT    NOT NULL,
  resolved     TEXT    NOT NULL,          -- Intl.DateTimeFormat("is").resolvedOptions().locale
  checked      INTEGER NOT NULL,          -- how many checks ran
  broken       INTEGER NOT NULL,          -- how many disagreed with CLDR
  failing      TEXT    NOT NULL,          -- JSON array of the case ids that failed
  country      TEXT                       -- Cloudflare's coarse country, no finer
);
CREATE INDEX IF NOT EXISTS reports_seen_at ON reports (seen_at);
