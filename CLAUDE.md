# cldr-is

A catalogue of measured methods for Icelandic dates, numbers and sorting on
runtimes that lack the CLDR data, plus a small report collector Worker. Not an
npm package and never will be (#23). Read `README.md` first.

## Names

The repo and the package were renamed `intl-is` -> `cldr-is` on 2026-09-09. Two
things kept the old name on purpose, and this is the map:

| old name | what it is | now |
|---|---|---|
| `~/Development/projects/intl-is` | the local checkout directory | the repo is `cldr-is`; the directory is only a path |
| `intl-is-reports` | the collector Worker and its D1 database | keeps the name: a Worker name is a hostname and does not redirect |

Say `cldr-is` for the repo and `intl-is-reports` for the Worker. Do not rename
either Worker or database (see the comment in `collector/wrangler.jsonc`).

## Commands

`npm run typecheck && npm test` is the gate (CI runs both). Typecheck covers
`src/`, `test/` (root `tsconfig.json`, DOM + Node types) and `collector/`
(`collector/tsconfig.json`, workerd types, no DOM).

## Layout

- `src/` is the copyable code: read, copy, measure. Nothing here is published.
- `test/` pins every method against Node's full ICU.
- `scripts/` generates `docs/*.json` (`npm run measure`, `npm run measure:methods`).
  Those files are never hand-edited. The scripts rewrite a file, and its
  `generatedAt`, only when an answer changed.
- `collector/` is the live Worker (`intl-is-reports`) and its D1 database.
- `docs/index.html` is the demo page, served by GitHub Pages; it POSTs reports
  to the Worker.

## Collector (live)

- **Account:** the personal Cloudflare account (the Worker is served from
  `intl-is-reports.gudrodur.workers.dev`). Use the personal token, not an
  organisation's.
- **Deploy is manual.** No workflow deploys it: from `collector/`, run
  `npx wrangler deploy`. Merging to `main` deploys nothing. The demo page goes
  live through Pages and the Worker separately, so a change that touches both
  needs both.
- **Schema changes are migrations, applied once each, in numeric order:**
  `collector/migrations/001-engine.sql`, `002-language.sql`,
  `003-resolved-collator.sql`, `004-app.sql`. Apply the next one with
  `npx wrangler d1 execute intl-is-reports --remote --file=migrations/00N-name.sql`,
  and deploy the Worker after the column exists, never before.
- **Never run `collector/schema.sql` against the live database.** It begins with
  `DROP TABLE IF EXISTS reports` and is only for a fresh database; it already
  includes every migration.
- Privacy is a property of the schema: no raw user agent, IP, cookie or
  timestamp finer than a date is stored. Keep it that way.
