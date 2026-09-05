# Measurements

All measured 2026-09-05. The probe that produced the runtime table is
`scripts/probe-worker-intl.mjs` (run with `npm run probe`; needs `wrangler` on
PATH). The gap did not move between workerd 1.20260820.1 and 1.20260826.1.

## Bare workerd (Cloudflare Workers), no polyfill

| locale | DateTimeFormat month | weekday | PluralRules(1,2,5,11,21,101) | NumberFormat 1234567.89 | RelativeTimeFormat -2 day | ListFormat a,b,c | resolved locale |
|---|---|---|---|---|---|---|---|
| is | December | Monday | one/other/other/other/one/one | 1,234,567.89 | 2 days ago | a, b, and c | en-US |
| en | December | Monday | one/other/other/other/other/other | 1,234,567.89 | 2 days ago | a, b, and c | en |
| pl | grudzień | poniedziałek | one/few/many/many/many/many | 1 234 567,89 | 2 dni temu | a, b i c | pl |
| es | diciembre | lunes | one/other/other/other/other/other | 1.234.567,89 | hace 2 días | a, b y c | es |
| uk | грудень | понеділок | one/few/many/many/one/one | 1 234 567,89 | 2 дні тому | a, b і c | uk |
| ru | декабрь | понедельник | one/few/many/many/one/one | 1 234 567,89 | 2 дня назад | a, b и c | ru |
| tl | Disyembre | Lunes | one/one/one/one/one/one | 1,234,567.89 | 2 araw ang nakalipas | a, b, at c | fil |

Only `is` is broken, and only PluralRules is right for it. Chrome 152 (headless
probe) shows the identical row. Collation resolves to the same order in every
locale because workerd's ICU has no collation tailoring at all.

## Cost of the workaround in one production app

Server (Cloudflare Worker, seven locales loaded, golden time zones):

| | Total Upload | gzip |
|---|---|---|
| before | 12,686 KiB | 2,757 KiB |
| after | 16,264 KiB | 3,262 KiB |

Browser (Vite build, Icelandic only, lazy chunk):

| asset | size |
|---|---|
| lazy `is` data chunk | 1,137,104 B raw / 191,966 B gzip |
| entry delta for the shouldPolyfill checks + loader | +50,693 B raw / +10,718 B gzip |

Most of the chunk is `add-golden-tz.js`, the time-zone table the DateTimeFormat
polyfill needs. A build that only needs Atlantic/Reykjavik could drop it; that
has not been measured yet.
