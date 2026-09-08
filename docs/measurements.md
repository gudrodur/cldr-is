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

> **Read this section with the 2026-09-07 measurements below.** The browser half
> below was built, shipped behind a flag and then **turned off**: 191,966 B gzip
> was not worth it against 1,618 B of manual formatters. The server half is still
> running. This table is kept because the numbers are what settled the question.


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

---

# The manual alternative, measured 2026-09-07

Everything below was measured after the same application replaced its
client-side `Intl` calls with manual Icelandic formatters and turned the browser
polyfill off. Node 24.19.0, Chrome 152.0.7977.82, workerd 1.20260826.1.

## Size

esbuild `--bundle --minify --format=esm --target=es2022`, then `gzip -9`. The
module set is the Icelandic date shapes, the number formatter and the collator —
everything the application needs to render Icelandic without `Intl`.

| | raw | gzip |
|---|---|---|
| manual formatters + collator | 3,933 B | **1,618 B** |
| formatjs `is` lazy chunk (dates + numbers only, **no collation**) | 1,137,104 B | **191,966 B** |

119× smaller, and it is the only one of the two that covers sorting.

One caveat in the polyfill's favour, and it is real: the 191,966 B is behind a
`shouldPolyfill` gate, so Firefox and Safari visitors download none of it, while
the 1,618 B ships to everyone including the browsers that never had the bug.
At this ratio that does not change the conclusion, but it is the honest framing.

## Speed

Date formatting, 200 000 iterations, Node full ICU — the case that *favours*
`Intl`, since in a Chromium browser it is both slower and wrong:

| | ns/op | ops/s |
|---|---|---|
| manual `formatIsDateTimeNumeric` | **98** | 10,225,512 |
| `Intl.DateTimeFormat`, formatter reused | 860 | 1,162,555 |
| `Intl.DateTimeFormat` constructed per call | 30,567 | 32,715 |
| `date.toLocaleString("is-IS", opts)` | 30,474 | 32,814 |

The last row is what the application actually had at 35 call sites, so the
replacement is ~310× faster per call, not 9×.

Sorting, same machine:

| names | `compareIs` | `Intl.Collator("is")` |
|---|---|---|
| 253 | 0.5 ms | 0.2 ms |
| 2 000 | 5.2 ms | 1.5 ms |
| 10 000 | 20.1 ms | 6.7 ms |

**The collator is ~3× slower than native ICU.** It is the one number here that
does not favour this approach, and it is the price of being correct on a runtime
whose own collator is not. An earlier draft was 5.5× worse again (111.9 ms at
10 000) by allocating two arrays per comparison; walking both strings in place
with `codePointAt` and caching each character's weight by code point is what
closed it. A first attempt that cached by character *string* changed nothing —
the cost was the allocation, not the lookup.

## Correctness

Manual output pinned against Node full ICU, character for character:

| what | assertions | divergences |
|---|---|---|
| date shapes vs `toLocale*` with the call sites' own options, in `Atlantic/Reykjavik`, `Europe/Copenhagen`, `America/New_York` | 147 | **0** |
| collation vs `Intl.Collator("is")`, alphabet pairs + 253 country names + tailored letters + punctuation | 243,049 | **0** |
| collation vs `Intl.Collator("is")`, random strings over the whole character set | 200,000 | **0** |

The date figure is 49 comparisons run in each of three time zones. Running them
in more than one zone is not decoration: the first version of that sweep rendered
UTC wall-clock where the replaced calls rendered the viewer's, and it passed its
own tests because they pinned `timeZone: "UTC"` on both sides. In Reykjavík
everything matched; in Copenhagen 19 of 49 diverged.

## Server-rendered page, hydration

Live site, Chrome 152, 2026-09-07:

| | result |
|---|---|
| formatted Icelandic dates in the server markup | 26 |
| of those, identical in the hydrated DOM | **26** |
| React hydration warnings, console errors | **0** |
| `toLocaleDateString("is-IS", { month: "long" })` in that same browser | `August 15, 2026` |
| `Intl.DateTimeFormat("is").resolvedOptions().locale` | `en-US` |

The last two rows are the control: the runtime was broken at the moment the page
was correct, which is what makes the first three rows mean something.

(A 27th regex hit in the server markup was the string `16. maí 2026` inside a
human-written event description, not a formatted date. Three English month names
in the markup are all the event title `Félagsfundur April 2026`, typed by a
person on Facebook.)

## date-fns is not Intl

`date-fns/locale/is`, read directly:

| width | months |
|---|---|
| abbreviated | jan. feb. **mars apríl** maí **júní júlí ágúst sept.** okt. nóv. des. |
| CLDR abbreviated | jan. feb. **mar. apr.** maí **jún. júl. ágú. sep.** okt. nóv. des. |

Six of twelve differ. `weekStartsOn` is 1 and the short weekdays are
`Su Má Þr Mi Fi Fö La`, both correct — the divergence is only in the abbreviated
month names, and only matters if something else on the page renders CLDR ones.

## Upstream, measured 2026-09-08

Not a benchmark, but the same discipline: read rather than assumed.

| | |
|---|---|
| cloudflare/workerd#64 opened | 2022-09-30 |
| last comment on it | 2022-10-04 |
| **days dormant** | **1,434** |
| labels / assignees | none / none |
| full-ICU cost, measured by the reporter | binary 63 MB → 82 MB, data ~10 MB → ~30 MB |
| Chromium's rule | `filters/common.json`: "Keep only the minimum locale data for non-UI languages" — the condition is whether Chrome's UI is translated, not whether the language is used |
| Mozilla bug 1612379 (trim Firefox 459 → ~100–150 locales, ~1.8 MB) | stalled on principle, P2 → P5, "revisit once we have ICU4X" |

The maintainer on workerd#64 was receptive, not opposed. Four years of silence
after a receptive reply is a stronger reason to plan around this than a refusal
would be.
