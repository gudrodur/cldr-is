# Measurements

**Dates are per section, not per file.** The runtime table below was measured
2026-09-05; the workaround, manual-formatter, Vivaldi, correctness and upstream
sections were measured 2026-09-07 and 2026-09-08 and each says so. This heading
claimed a single date for all of them until 2026-09-08, which is the
heading-disagrees-with-its-section defect this project keeps finding elsewhere.

The probe that produced the runtime table is
`scripts/probe-worker-intl.mjs` (run with `npm run probe`; needs `wrangler` on
PATH). The gap did not move between workerd 1.20260820.1 and 1.20260826.1.

## Bare workerd, no polyfill

**Two different things were measured, and until 2026-09-08 only one of them
had been.** The table below comes from `wrangler dev --local`, which is
`workerd` running on this machine. The deployed Cloudflare edge is Cloudflare's
own build of it, and writing "Cloudflare Workers (workerd)" quietly asserted the
two were interchangeable — an unearned claim in a parenthesis, which is where
they are easiest to miss.

So a bare Worker with no polyfill was deployed to the real edge and probed
(`intl-is-edgeprobe`, deployed and deleted 2026-09-08):

| | deployed Cloudflare Worker |
|---|---|
| `DateTimeFormat("is")` / `NumberFormat("is")` / `Collator("is")` | all `en-US` |
| `toLocaleDateString("is-IS", {month:"long", …})` | `September 2, 2026` |
| `(1234567.89).toLocaleString("is-IS")` | `1,234,567.89` |
| `{style:"currency", currency:"ISK"}` | `ISK 2,500` |
| sorted names | `Aðalheiður, Ævar, Ásta, Ólafur, Örn, Þórður` (English order) |
| **`PluralRules("is").select(21)`** | **`one`** — Icelandic |

Identical to the local table in every respect, the surviving plural rules
included. The inference was right; it is now a measurement, and the two rows of
this document that said "Cloudflare Workers (workerd)" can say it because both
were checked rather than because one was assumed to stand for the other.

## Local workerd via `wrangler dev --local`, no polyfill

| locale | DateTimeFormat month | weekday | PluralRules(1,2,5,11,21,101) | NumberFormat 1234567.89 | RelativeTimeFormat -2 day | ListFormat a,b,c | resolved locale |
|---|---|---|---|---|---|---|---|
| is | December | Monday | one/other/other/other/one/one | 1,234,567.89 | 2 days ago | a, b, and c | en-US |
| en | December | Monday | one/other/other/other/other/other | 1,234,567.89 | 2 days ago | a, b, and c | en |
| pl | grudzień | poniedziałek | one/few/many/many/many/many | 1 234 567,89 | 2 dni temu | a, b i c | pl |
| es | diciembre | lunes | one/other/other/other/other/other | 1.234.567,89 | hace 2 días | a, b y c | es |
| uk | грудень | понеділок | one/few/many/many/one/one | 1 234 567,89 | 2 дні тому | a, b і c | uk |
| ru | декабрь | понедельник | one/few/many/many/one/one | 1 234 567,89 | 2 дня назад | a, b и c | ru |
| tl | Disyembre | Lunes | one/one/one/one/one/one | 1,234,567.89 | 2 araw ang nakalipas | a, b, at c | fil |

**`one` and `other` in that column are CLDR category keywords, not text.**
`PluralRules.select()` returns the same English identifiers in every locale —
Icelandic has `one`/`other`, Polish has `one`/`few`/`many`/`other` — and the
caller maps them to its own wording. The Icelandic row is the interesting one:
English answers `other` for 21 and Icelandic answers `one`, which is why it is
"21 bíll" and not "21 bílar". That difference is the proof the Icelandic rules
really are present in a runtime where nothing else Icelandic is.

Only `is` is broken, and only PluralRules is right for it. Chrome 152 (headless
probe) shows the identical row. Collation resolves to the same order in every
locale. Whether that is because workerd's ICU carries no Icelandic collation
tailoring, or carries it and cannot negotiate the locale, is not separated here
— the observable is the order, and Edge on the desktop turns out to be a case
where those two come apart.

## Cost of the workaround in one production app

> **Read this section with the 2026-09-07 measurements below.** The browser half
> below was built, shipped behind a flag and then **turned off**: 191,966 B gzip
> was not worth it against 2,774 B of manual formatters. The server half is still
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
| manual formatters + collator, every export | 6,770 B | **2,774 B** |
| formatjs `is` lazy chunk (dates + numbers only, **no collation**) | 1,137,104 B | **191,966 B** |

69x smaller, and it is the only one of the two that covers sorting.

The manual figure was **1,618 B until 2026-09-08** and moved for two reasons, one
honest bookkeeping and one real. The bookkeeping: 1,618 B was measured over the
subset of exports one application imported, which nobody else could reproduce;
the number above is every export of both modules, bundled and gzipped, so it can
be. The real one: the collation tables added that day cost **901 B gzip**, and
they buy correct order for the whole Latin script — see below.

**Method, so these are reproducible.** Size:
`npx esbuild <entry> --bundle --minify --format=esm --target=es2022`, then
`gzip -9`. Speed: the median of nine sorts of 10 000 generated Icelandic names,
in one Node process, against `Intl.Collator("is")` in the same run. Every figure
on this page was taken that way on 2026-09-08, and an earlier version of this
section printed 731 B, 774 B and 952 B for quantities a re-measurement put at
901 B and 808 B — three numbers for one event, none of them reproducible,
because the method was never written down.

One caveat in the polyfill's favour, and it is real: the 191,966 B is behind a
`shouldPolyfill` gate, so Firefox and Safari visitors download none of it, while
the 2,774 B ships to everyone including the browsers that never had the bug.
At this ratio that does not change the conclusion, but it is the honest framing.

## Speed

Date formatting, 200 000 iterations, Node full ICU — the case that *favours*
`Intl`, since in a Chromium browser it is both slower and wrong:

| | ns/op |
|---|---|
| manual `formatIsDateTimeNumeric` | **76–98** |
| `Intl.DateTimeFormat`, formatter reused | 816–860 |
| `date.toLocaleDateString("is-IS")` — no options | 581 |
| `date.toLocaleString("is-IS")` — no options | 928 |
| `date.toLocaleString("is-IS", opts)` — hoisted options object | 28,290 |
| `date.toLocaleString("is-IS", opts)` — fresh object literal | 28,513 |
| `new Intl.DateTimeFormat(...)` constructed per call | 30,567 |

**The 28 µs is specific to passing an options object, and that is the honest
caveat on this table.** V8 caches the no-options formatter per locale, so a bare
`toLocaleDateString(locale)` is ~581 ns; the moment an options object appears the
cache is missed and a formatter is built almost every call. Object identity does
not help — hoisting the options constant changed nothing (28,290 vs 28,513 ns).

So the comparison depends on which code you mean:

- versus what this application actually had — 36 call sites, a **majority**
  passing an options object and the rest passing only a locale (2026-09-08).
  Manual is ~350× faster on the ones with options; on the ones
  without, the bare-call figures in the table above bracket the ratio rather
  than pin it, and no run measured that split directly. This line said "all passing options" until it was checked, and then
  gave an exact 17/18 split that the recorded call-site list does not reproduce;
  the split is stated as a majority now because that is what the evidence
  carries;
- versus a reader who hoists and reuses an `Intl.DateTimeFormat` — about **10×**;
- versus a bare no-options call — about **7×**.

All three are real. Quoting only the first would be quoting the worst case as if
it were the case, and the first is large mostly because of a call pattern that
can be fixed without adopting anything here. Figures are Node 24 on one machine
and drift a few per cent between runs; treat them as orders of magnitude.

Sorting, same machine:

| names | `compareIs` | `Intl.Collator("is")` |
|---|---|---|
| 253 | 0.1 ms | 0.1 ms |
| 2 000 | 3.2 ms | 1.4 ms |
| 10 000 | 17.3 ms | 7.3 ms |

Re-measured 2026-09-08 after the correctness fixes below. They made it *faster*,
not slower: dropping a second per-character map lookup for the case rank took
10 000 names from 19.0 ms to 17.3 ms while adding NFC handling and the expansion
level. The normalisation is behind a regex test, so a string with no combining
mark never pays for it.

**The collator is ~2.4× slower than native ICU.** It is the one number here that
does not favour this approach, and it is the price of being correct on a runtime
whose own collator is not. An earlier draft was 5.5× worse again (111.9 ms at
10 000) by allocating two arrays per comparison; walking both strings in place
with `codePointAt` and caching each character's weight by code point is what
closed it. A first attempt that cached by character *string* changed nothing —
the cost was the allocation, not the lookup.

## Vivaldi: the same Chromium, with Icelandic

**Single run, one machine, 2026-09-08, driven over CDP with no committed
script.** The `icudtl.dat` byte sizes below were later re-derived by parsing the
package table of contents directly and agree exactly; the locale counts and the
`is.pak` rows were not, and rest on that one run.

Measured 2026-09-08, both browsers on Chromium 152, on this machine, minutes
apart, driven over CDP against their own fresh profiles.

| | Vivaldi 8.2.4 | Chrome 152 |
|---|---|---|
| `Intl.DateTimeFormat("is").resolvedOptions().locale` | `is` | `en-US` |
| `Intl.Collator("is").resolvedOptions().locale` | `is` | `en-US` |
| `DateTimeFormat.supportedLocalesOf(["is"])` | `["is"]` | `[]` |
| month `long` | `2. september 2026` | `September 2, 2026` |
| weekday | `miðvikudagur` | `Wednesday` |
| number | `1.234.567,89` | `1,234,567.89` |
| currency ISK | `2.500 kr.` | `ISK 2,500` |
| relative time | `fyrir 2 dögum` | `2 days ago` |
| list | `a, b og c` | `a, b, and c` |
| two-letter locales with `DateTimeFormat` data | **61** | 60 |
| two-letter locales with `Collator` data | **54** | 53 |
| `icudtl.dat` on disk | 10,957,760 B | 10,876,560 B |
| Icelandic UI translation (`locales/is.pak`) | no | no |

**The whole difference is one locale and 81,200 bytes** — 0.7% of the ICU data
they both carry. Neither browser has an Icelandic UI, so Chromium's stated rule
("keep only the minimum locale data for non-UI languages") is not what separates
them; a downstream vendor simply declined to apply the filter that hard.

Why this matters beyond a browser recommendation: every argument against fixing
this upstream has been about size, and the number always quoted — ~10 MB to
~30 MB — is for swapping in the *entire* full-ICU data file, and was never
measured by anyone (see below). Nobody had measured the cost of **one** locale.
It is 81,200 bytes, and a shipping Chromium browser already pays it.

Found because a reader of the demo page said "Vivaldi uses Chromium and we still
speak Icelandic there". The README had claimed "Chrome, Edge, Opera, Brave, and
anything else on the same engine", which was asserted rather than measured — the
same class of defect as the Safari claim beside it. **Opera has since been measured** — on Android, where it
has Icelandic and fails only `currency` like every other Chromium row from that
platform. Opera *on the desktop* and Brave anywhere are still unmeasured, and
this line said "Opera and Brave are still unmeasured" after the Opera row had
already arrived.

### compareIs against a native Collator, 2026-09-08

Sorting 7,200 Icelandic names (18 distinct, repeated 400×), median of nine runs,
Node 24 on one machine, `a.sort(compareIs)` against
`a.sort(new Intl.Collator("is").compare)`:

| | median |
|---|---|
| `compareIs` | 4.94 ms |
| native `Intl.Collator("is")` | 2.45 ms |
| **ratio** | **2.02×** |

An earlier run over a different list gave 17.3 ms vs 7.3 ms, a ratio of 2.4×.
Both are one machine, and the README says "roughly 2×" rather than either
figure because that is the precision two runs support.

**Why this number existed nowhere for an afternoon.** The 2.06× from a third run
was quoted in the README with no method recorded anywhere — not here, not in the
`src/collate.ts` comment the README designates as the method home. A reviewer
found its only sources were the README, the diff that added it, and the commit
message defending it. A figure that cites itself is not a measurement, and the
same edit had just added a promise that every number's method lives in this
file. This section is that promise being kept.

## Correctness

Manual output pinned against Node full ICU, character for character:

| what | assertions | divergences |
|---|---|---|
| date shapes vs `toLocale*` with the call sites' own options, in `Atlantic/Reykjavik`, `Europe/Copenhagen`, `America/New_York` | 147 | **0** |
| collation vs `Intl.Collator("is")`, alphabet pairs + 253 country names + tailored letters + punctuation | 243,049 | **0** |
| collation vs `Intl.Collator("is")`, every pair over the covered set: alphabet both cases, NFC/NFD spellings, the `ß`/`ẞ`/`œ`/`Œ` expansion families, digits, punctuation, and 500 000 random strings drawn from that set | 407,114 | **0** |
| collation vs `Intl.Collator("is")`, **every ordered pair of all 450 Latin letters** through Latin Extended-B | 202,500 | **0** |
| collation, a name list in the languages actually spoken in Iceland (Polish, Vietnamese, Turkish, Hungarian, Latvian, Czech, Norwegian, German) | 27 names | **identical order** |
| `formatIsNumber` vs `toLocaleString("is-IS")` across the whole double range, exponents −320 to +320, plus the non-finite values | 900,028 | **0** |

### What the Latin row cost, and why it was worth it

The letter tables were added on 2026-09-08 after a question about `ö` versus
`õ`. Those two were already right. What the measurement found instead was that
**every Latin letter outside the table fell into the fallback band, below every
letter** — so `Łukasz` and `Michał` sorted ahead of every Icelandic name, and
Polish is the most widely spoken foreign language in Iceland. The same pass
found that ICU's secondary order for combining marks is not code-point order and
that marks compare position by position, which had `ô`/`ŏ` and `ǡ`/`ā` wrong.

| | before | after |
|---|---|---|
| Latin letter pairs matching ICU | 190,658 of 202,500 | **202,500 of 202,500** |
| collator alone, gzip | 808 B | 1,709 B |
| 10 000 names sorted | 19.0 ms | 17.3 ms |

The fallback for characters the tables do not reach was changed in the same
pass, and the effect was measured both ways over fixed pools rather than
assumed:

| pool | unlisted letters ABOVE the alphabet | one shared low band |
|---|---|---|
| assigned characters U+0020–U+2FFF | **fewer** divergences | roughly twice as many |
| Latin + CJK + digits + punctuation | **fewer** | several times as many |
| Greek + Cyrillic | equal | equal |
| CJK block | equal | equal |
| uniform draw over the whole code space | 23.1% | **~1.5%** |

**This table used to carry exact percentages and no longer does, on purpose.**
They were 18.5 / 53.5 / 1.0 / 37.9 / 14.1 / 1.3 / 23.1 / 2.0, and an independent
re-measurement could not reproduce most of them — not because the conclusion is
wrong but because the pools were named and never defined, and the result moves by
tens of points with how you build them. A balanced Latin/CJK/digit/punctuation
pool and a Han-heavy one give 33% and 4.8% for the same cell.

What survives re-measurement, and is what the decision actually rested on: on
every text-like pool the above-the-alphabet placement diverges from ICU **less**,
on single-script letter pools the two designs are **identical** (both order
unlisted letters by code point), and the shared low band wins on exactly one
pool — a uniform draw over the whole code space, which is mostly *unassigned*
code points and therefore not text. That last cell is the only one whose
construction is unambiguous, and it reproduces exactly at 23.1%.

A number nobody can reproduce is not a measurement, whichever way it points.

The second collation row replaced a "200 000 random strings over the whole
character set — 0 divergences" line on 2026-09-08, because that line was not
true in the way it read. The pool those strings were drawn from was the
Icelandic set plus ASCII, not the whole character set, and a second reader who
went outside it found three divergence classes at once: canonically equivalent
input (NFC vs NFD) comparing unequal, every character above U+0062 sharing one
fallback weight so `compareIs("中", "文")` returned 0, and `ß`/`ss` tying where
ICU separates them. All three are fixed and all three are now pinned in CI; what
the table claims and what the tests run are the same set. Outside it — CJK,
emoji, symbols against *each other* — parity is still not claimed, and a sweep
that goes there still finds a few thousand divergences per hundred thousand
random pairs (the count moves run to run; the sweep is random and the claim is
only that it is nonzero). What is now guaranteed everywhere is weaker but
unconditional: two different strings never compare equal, and the order is by
code point.

The date figure is 49 comparisons run in each of three time zones. Running them
in more than one zone is not decoration: the first version of that sweep rendered
UTC wall-clock where the replaced calls rendered the viewer's, and it passed its
own tests because they pinned `timeZone: "UTC"` on both sides. In Reykjavík
everything matched; in Copenhagen 19 of 49 diverged. Re-measured against the
pre-fix sources 2026-09-08: 19 of 49 in `Europe/Copenhagen`, and in
`Atlantic/Reykjavik` every date comparison matched — one of the 49, a `-0`
number case, is a separate zone-independent defect the same commit fixed.

## Server-rendered page, hydration

Live site, Chrome 152, 2026-09-07 — re-measured 2026-09-08 and the substance
holds while the count does not, which is what a live page does: **25** formatted
dates today, all 25 identical in the hydrated DOM, zero console messages. The
published 26 counted one more regex hit, a date written by hand inside an event
description that lives in the serialized payload rather than the visible markup.
Treat the integer as a snapshot of an event list, not a constant:

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
| **days dormant** | **1,435** |
| labels / assignees | none / none |
| full-ICU cost, **measured** by the reporter | binary 63 MB → 82 MB (`icudt71l.dat` swapped in, nothing crashed) |
| full-ICU data cost | **not measured by anyone.** "~10 MB → ~30 MB" is the maintainer asking whether that follows, in the comment that also asks the startup question. Quoting it as a measurement is the easy mistake here |
| Chromium's rule | `filters/common.json`: "Keep only the minimum locale data for non-UI languages" — the condition is whether Chrome's UI is translated, not whether the language is used |
| Mozilla bug 1612379 (trim Firefox's ICU data from all 459 locales ICU ships to the ones Firefox is translated into: `.dat` 11,143,312 → 9,326,800 B, −1,816,512) | stalled on principle, P2 → P5, "revisit once we have ICU4X". The bug states 459; it never states a target count |

The maintainer on workerd#64 was receptive, not opposed. Four years of silence
after a receptive reply is a stronger reason to plan around this than a refusal
would be.
