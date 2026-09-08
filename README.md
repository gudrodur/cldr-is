# intl-is

Icelandic locale data, collation, and a working recipe for the JavaScript
`Intl` API on runtimes that ship without it.

### → [Does your browser speak Icelandic?](https://gudrodur.github.io/intl-is/)

One page, twelve checks, run in whatever browser opens it and compared against
what CLDR actually says. **Open it in Chrome and in Firefox** — that is the whole
problem in one comparison, and it takes ten seconds.

If everything passes, the bug is invisible from where you are sitting, which is
exactly how it reaches production. Firefox, Safari and Node ship full ICU;
Chrome and Edge on the **desktop** do not — while **on Android it depends on
the device**, not on the version: two reports from the same Chrome 151 on
Android disagree with each other, and every Android build that does have
Icelandic is missing the same one piece of it. Readers of this page found all of
that in an afternoon. See below.

**Status: not published, not yet built as a package.** This repository holds the
code and the measurements while the approach earns production mileage in one
application. It will go to npm when that experience exists.

**It is a recipe as much as a package, and copying it is a supported way to use
it.** For dates and numbers, hand-writing your own is a reasonable choice — the
code is thirty lines and you can write them. What is worth taking is not the
code but the parts that are easy to get wrong and invisible when you do: the
CLDR values, the three traps in [`src/format.ts`](src/format.ts), and above all
the way to check your own work (["Pin it to
Node"](#pin-whatever-you-write-to-node) below). Copy the file, keep the tests,
delete the rest. For **collation** the advice is the opposite: do not hand-write
it — see [below](#collation-the-part-no-polyfill-can-fix) for why.

## The problem

Chromium keeps only "the minimum locale data for non-UI languages", and
Icelandic is one of them because Chrome's own UI is not translated to it. Every
runtime built on Chromium's ICU inherits the gap:

- **Chrome and Edge on the desktop** — `new Date().toLocaleDateString("is", { month: "long" })`
  returns `December`, not `desember`. This is Chrome's *build*, not the engine:
  see the Vivaldi measurement below, which is the same Chromium with Icelandic
  present. **Opera has since been measured — on Android, where it has Icelandic**
  (below); Opera on the desktop and Brave anywhere are still unmeasured, and the
  Android result is a reason to stop assuming rather than to assume the other
  way. If you use one, the demo page will tell you in a second. **Firefox is not affected** — measured on
  Firefox 155, every check passing on the same page where Chrome 152 fails
  eleven of twelve. That is what makes this easy to miss: the developer testing
  in Firefox sees Icelandic and ships English to most of their visitors. **Safari
  is not affected either** — Safari 26 on macOS and Safari 26 on iOS both pass
  all twelve checks, reported through the page on 2026-09-08. **Every `/ iOS`
  row measures Apple's WebKit**, whatever name the label carries: Apple requires
  it, so a `Firefox 155 / iOS` row (one arrived) says nothing about Gecko and a
  `Chrome / iOS` row says nothing about Chromium. On iOS the browser name is a
  skin. There is no Apple
  hardware in this project, so those reports are the measurement. The first one
  arrived as a screenshot with no version in it, which is why the page records a
  runtime label now and why these two carry numbers.
- **Cloudflare Workers (workerd)** embeds the same ICU data, so a server-rendered
  page has the gap too. Upstream:
  [cloudflare/workerd#64](https://github.com/cloudflare/workerd/issues/64), open
  since 2022.

Node ships full ICU and is fine — which is why Node is the right oracle to test
against, and why a test suite can pass while production is wrong.

### Chromium on Android is split down the middle, and not by version

Every Chromium row from Android, as recorded on 2026-09-08. The counts move as
people open the page, so treat this as a dated snapshot and
[`/summary`](https://intl-is-reports.gudrodur.workers.dev/summary) as the
authority:

| | resolved | checks failing |
|---|---|---|
| Chrome 150 / Android | **`is`** | 1 of 12 — `currency` |
| Chrome 151 / Android | **`is`** | 1 of 12 — `currency` |
| Chrome 151 / Android · "Messenger browser" | **`is`** | 1 of 12 — `currency` |
| Chrome 152 / Android | **`is`** | 1 of 12 — `currency` |
| Edge 152 / Android | **`is`** | 1 of 12 — `currency` |
| Opera 101 / Android | **`is`** | 1 of 12 — `currency` |
| Samsung Internet 30 / Android | **`is`** | 1 of 12 — `currency` |
| **Chrome 151 / Android** | `en-US` | 11 of 12 |
| Chrome 152 / Linux · Windows · macOS | `en-US`, `en-US`/`en-GB`, `en-GB` | 11 of 12 each |

**`Chrome 151 / Android` is on both sides of that line.** Same family, same
major version, same platform, opposite verdicts. Whatever decides this is not
the Chromium version — and Icelandic on Android reaches back to at least 150,
so there is no version at which it "arrived" either.

On the desktop nothing is split at all: every row that is Chrome is on the
English side, and the desktop rows carrying Icelandic are Vivaldi wearing
Chrome's user agent — a different browser, and a different signature (see
below).

An earlier version of this section, written when 151 had reported once, said
"whatever carries Icelandic to Android arrived in 152 and does not reach the
desktop build". Three more Android reports arrived within the hour and killed
it: two on 151 with Icelandic, one on 150. The retraction is left visible on
purpose. This section has now been rewritten twice by strangers' data, and both
times the previous version was a rule inferred from a corpus too small to carry
one — which is the same defect this project keeps finding in its own code.

**What survives is sharper than what was retracted.** Every Android row that
has Icelandic fails **exactly one check, and it is the same check every time** —
`currency` — across four Chromium browser families. `currency` is its own ICU
tree, `curr_tree`, and it is one of the four the pending Chromium change
[crrev.com/c/4514575](https://chromium-review.googlesource.com/c/chromium/deps/icu/+/4514575)
adds for `is` on the desktop. Independent rows landing on one tree short of
correct is not the shape of a locale that is simply absent; it is the shape of a
partial locale data set, missing the same tree the desktop patch would add.

**Two different passing signatures, and they should not be conflated.** The
Android rows pass 11 of 12. The desktop rows that pass — Vivaldi — pass all 12,
and so does Firefox on Android, which is Gecko and not part of this question at
all. A desktop Chromium with Icelandic and an Android Chromium with Icelandic
are not carrying the same data.

Stated carefully about what is still **not** established: nothing here explains
why two Chrome 151 Android devices disagree. Naming a mechanism now would be a
third inference of exactly the confidence that has already been retracted twice
on this page, so it stays a question — but it is no longer an unanswerable one.
**Device language was the obvious suspect and was simply not being recorded**,
which is the same defect as the engine version one paragraph down: the page
could read it and did not. Since 2026-09-08 every report carries the browser's
UI language as a bare language code (`is`, `en` — the primary subtag only; the
ordered `navigator.languages` list is close to a visitor id and is deliberately
not collected). Two Android reports from devices set to different languages will
settle it. Every row that raised the question reads empty, so the answer has to
come from new reports — **if you are reading this on Android, opening the page
is the experiment.**

**Version numbers in a browser label are not engine versions, and the collector
used to lose the difference.** "Opera 101" and "Samsung Internet 30" are the
vendor's own numbering; the Chromium they run on is a separate number sitting
right there in the same user agent, and it was being read and discarded. Since
2026-09-08 the collector stores it as `engine` (`Chromium 152`) alongside the
family label, so a row like Opera's can be placed on the same axis as Chrome's
instead of guessed at. **Every row in the table above predates that column and
reads empty** — the user agent is discarded before storage by design, so the
engine version of the reports that raised the question no longer exists anywhere
to be recovered. That is why this section says "four browser families" and not
"N Chromium versions": the version axis is exactly what these rows cannot speak
to. They need re-reporting, not repairing.

### Being Chromium is not the same as being broken: Vivaldi

An earlier version of this README said "Chrome, Edge, Opera, Brave, and anything
else on the same engine". A reader pointed out that Vivaldi speaks Icelandic,
and they were right. Measured 2026-09-08 on this machine, both browsers on
Chromium 152, minutes apart:

| | Vivaldi 8.2.4 | Chrome 152 |
|---|---|---|
| `Intl.DateTimeFormat("is").resolvedOptions().locale` | `is` | `en-US` |
| month `long` | `2. september 2026` | `September 2, 2026` |
| number | `1.234.567,89` | `1,234,567.89` |
| currency | `2.500 kr.` | `ISK 2,500` |
| `localeCompare(_, "is")` sort | `… Ýrr, Þórður, Ævar, Örn` | `… Örn, Úlfur, Ýrr, Þórður` |
| two-letter locales with `DateTimeFormat` data | **61** | 60 |
| ditto with `Collator` data | **54** | 53 |
| `icudtl.dat` | 10,957,760 B | 10,876,560 B |

**One locale of difference. 81,200 bytes.** Neither ships an Icelandic UI
translation, so this is not the "non-UI language" rule doing its job — it is a
downstream Chromium vendor deciding the filter costs more than it saves, and
paying 0.7% of their ICU data for it.

That number is worth holding onto, because the argument against fixing this
upstream has always been about size, and nobody had measured the size of *one
locale*. The figure that gets quoted, ~10 MB to ~30 MB, is for swapping in the
entire full-ICU data file, and it was never a measurement either (see the
upstream section below).

Measured 2026-09-05 on bare workerd and Chrome 152: for `is`,
`Intl.DateTimeFormat`, `NumberFormat`, `RelativeTimeFormat`, `ListFormat` and
`Collator` all resolve to `en-US`; only `PluralRules` is correct. Full tables in
[docs/measurements.md](docs/measurements.md).

## Two ways to close it

|  | polyfill the data | format manually |
|---|---|---|
| what it is | load formatjs's CLDR data for `is` | render Icelandic from a month table and a few string joins |
| browser cost | **191,966 B gzip**, Chromium visitors only | **2,774 B gzip**, everyone |
| speed | ~800 ns with the formatter reused; **~28,000 ns** per `toLocaleString` call that passes an options object | ~80 ns |
| covers collation | a `Collator` polyfill exists, but **707,603 B gzip and 12.7% off ICU across Latin** — see below | yes |
| covers arbitrary locales and options | yes | no, only the shapes you write |

Both were built and shipped in the same application. The recommendation below is
what came out of running them, not a preference stated in advance.

### On the server: polyfill

The server is where the polyfill earns its size. It is loaded once per isolate,
not per visitor, and it makes every `Intl` class work for every locale the site
serves — which matters the moment the site is not Icelandic-only.

```ts
// server entry, FIRST import
import "intl-is/server";
```

Four things that are not obvious and each cost a debugging session:

- it has to be `polyfill-force`, not `polyfill`: the runtime *has* an
  `Intl.DateTimeFormat`, it just answers in English, so the conditional polyfill
  decides nothing is wrong and does nothing;
- `polyfill-force` replaces the global class for **every** locale, so a server
  that formats other languages must load their data too, or they regress. This
  line used to say the regression looked like `en` pluralising 21 as "one" and
  Polish relative time coming out in Icelandic. Re-measured on the versions this
  repo pins: `en` and `de` relative time do come out in Icelandic, and
  **Polish throws** — `TypeError: Cannot read properties of undefined (reading
  'indexOf')`. A crash is easier to notice than wrong text, which makes the
  original warning understate the failure rather than overstate it;
- leave `PluralRules` native — it is already correct for `is`, and faster;
- a one-line self-test on a health endpoint is worth having, because this failure
  is silent and looks like English copy.

### In the browser: format manually

This is the part where our recommendation changed after measuring it.

The obvious move is to load the same data in the browser behind a
`shouldPolyfill` gate. We built that ([`src/client.ts`](src/client.ts)), shipped
it behind a flag, measured it, and **turned it off**: 191,966 B gzip, most of it
the time-zone table `@formatjs/intl-datetimeformat` needs, to fix a handful of
rendered dates. The manual formatters that replaced it are 2,774 B gzip for
dates, numbers *and* collation — 69× smaller. (That figure is every export of
both modules, bundled with esbuild and gzipped, so it can be reproduced. An
earlier README said 1,618 B, measured over only the subset one application
imported, which nobody else could check.)

They are also faster, but read that claim carefully rather than off the table
above. `toLocaleString(locale, options)` costs ~28 µs because it builds a
formatter on nearly every call; the same call **without** an options object is
~930 ns, and a hoisted `Intl.DateTimeFormat` you reuse is ~816 ns. So against
the code we actually replaced — 35 call sites — manual is between 12× and 350×
faster depending on the site, and against a reader who caches their formatter
properly it is about 10×.

That range is the honest shape of it, and an earlier version of this paragraph
hid it by saying the 35 sites "all passed options". Counted from the diff: **17
passed an options object** (the ~28,000 ns case, where manual is ~350× faster)
and **18 passed only a locale string** (the ~930 ns case, where it is ~12×). The
dramatic number belongs to half the sites, and it is dramatic because of a
pattern that is easy to fix without any of this.

[`src/format.ts`](src/format.ts) has the shapes we needed, and
`formatIsNumber` beside them. Import them, or copy the file — both are fine.

### Pin whatever you write to Node

This is the part that matters more than the code, and the reason "write it by
hand" is safe advice here rather than reckless. **The runtime you are developing
in cannot tell you whether your Icelandic is right** — your Chrome is the broken
one. Node still has the data, so Node is the oracle:

```ts
// Node full ICU renders what CLDR says. Assert against it, not against taste.
expect(formatIsDateTimeNumeric(d)).toBe(
  d.toLocaleString("is-IS", { day: "2-digit", month: "2-digit", year: "numeric",
                              hour: "2-digit", minute: "2-digit" }),
);
```

Write that once per shape and the hand-written table stops being a guess. It is
what catches the abbreviated months (`sep.` with a period, `maí` without), and
it is why copying this repo's *tests* matters more than copying its code.

Two ways to get the test itself wrong:

- **Do not pin with `timeZone: "UTC"` on the Intl side unless the call site
  passes one.** That makes the equality true by construction and hides the bug
  it was meant to catch. It hid exactly this one from us for a review round: the
  date+time shapes were reading UTC parts where the calls they replaced read the
  viewer's, which matched perfectly in Reykjavík and diverged in 19 of 49
  comparisons in `Europe/Copenhagen`.
- **Run the suite in more than one time zone.** `TZ=Europe/Copenhagen npm test`
  costs nothing and is the only thing that would have caught the above.

### Server-rendered pages: the two halves must agree

This is the reason the choice matters more on an SSR page than in a SPA. If the
server formats with full data and the client re-renders with fallback data, the
markup disagrees with itself and React reports a hydration mismatch — or worse,
silently keeps one of the two.

There are only two coherent answers: the same data on both sides, or manual
formatting on both sides. **Icelandic formatting manual everywhere** is the one
we run: the server keeps the polyfill for the other locales and for anything
still going through `Intl`, while every Icelandic date, number and sort on both
sides comes from the same pure functions. They cannot disagree, because they are
the same code — and they are right, because they are pinned to CLDR.

Measured on the live site in Chrome 152 (2026-09-07): 26 formatted Icelandic
dates in the server markup, every one present identically in the hydrated DOM,
zero console errors or warnings. In that same browser at that same moment,
`toLocaleDateString("is-IS", { month: "long" })` returned `August 15, 2026` and
`Intl.DateTimeFormat("is").resolvedOptions().locale` returned `en-US`. The
runtime was broken and the page was right.

## Collation: the part no polyfill can fix

This section used to say formatjs had no `Collator` polyfill at all. That was
asserted rather than checked, and it was wrong:
[`@formatjs/intl-collator`](https://www.npmjs.com/package/@formatjs/intl-collator)
has been on npm since 2026-05-14. Measured against the native
`Intl.Collator("is")` it replaces, with Node full ICU as the oracle:

| @formatjs/intl-collator 0.2.7 | |
|---|---|
| an ordinary ten-name Icelandic list | **correct** |
| Icelandic alphabet + tailored letters, 5,473 ordered pairs | 10 divergences, all on `ä` / `ø` / `å` |
| every ordered pair of the 450 Latin letters, 202,500 | **25,766 divergences (12.7%)** |
| bundled, minified, gzipped | **707,603 B** |

Its own README says why: it provides "the ECMA-402 constructor/prototype surface
and a deterministic baseline comparator", with "full CLDR/UCA collation data
compilation" still future work. So collation *is* installable now — the basics
land, CLDR exactness does not, and 707 KB gzip is not a price a page pays for
sorting.

Without it, on Chromium and workerd `localeCompare(_, "is")` silently sorts by
the English alphabet:

```
ö z á a þ t æ e ð d   →  aáædðeötzþ   (en-US fallback)
                      →  aádðetzþæö   (Icelandic)
```

`á é í ó ú ý ð þ æ ö` are letters in their own right, not accented variants. In a
member list, Ævar lands second instead of second-to-last and Þórður sorts among
the T's.

```ts
import { compareIs } from "intl-is/collate";

names.sort(compareIs);
```

Pinned to Node full ICU over **every ordered pair of all 450 Latin letters**
through Latin Extended-B — 202,500 comparisons, zero divergences — plus every
pair of the Icelandic alphabet in both cases, 253 Icelandic country names, both
the composed and decomposed spelling of every accented letter, ASCII
punctuation, case, digits, and 500 000 random strings drawn from that set.

The Latin coverage is not completeness for its own sake. `ł` used to fall
outside the table, into a band below every letter, so **`Łukasz` and `Michał`
sorted ahead of every Icelandic name in the list** — and Polish is the most
widely spoken foreign language in Iceland. A list of names in the languages
actually spoken here, Polish, Vietnamese, Turkish, Hungarian, Latvian, Czech and
Norwegian among them, now comes out in exactly ICU's order.

Four details were read off ICU rather than reasoned about, and all four would
have been wrong from memory:

- ICU orders punctuation by **DUCET category**, so `_` sorts before `-` despite
  the higher code point.
- `œ` and `ß` **expand** to `oe`/`ss` rather than taking a weight of their own —
  and they are not equal to what they expand to. The level they differ on is the
  **secondary**, which you can see by asking for `sensitivity: "accent"`: no case
  level, and `ß` still sorts after `ss`. That is why ICU puts `aß` *after* `Ass`
  even though `a` sorts before `A` — a secondary difference outranks an earlier
  case difference, and a tertiary marker gets that pair backwards.
- ICU **normalises before it compares**, so `"á"` and `"a" + U+0301` are the same
  string to it. Text really does arrive decomposed — macOS filesystems, some
  paste sources — so a comparator that skips this splits a name from its own
  other spelling.
- ICU's secondary order for **combining marks is not code-point order**: U+0306
  (breve) sorts before U+0302 (circumflex). There are 59 distinct ranks among
  the 112 marks in U+0300–U+036F, and they compare **position by position**
  rather than as a set — so `ǡ` (a + U+0307 + U+0304) sorts *before* `ā`
  (a + U+0304). Adding the code points together, which is the obvious shortcut,
  makes `ô` and `ŏ` interchangeable.

  **The limit of this, stated precisely:** those ranks are applied through the
  decompose-to-a-base path, which only runs when NFC composes the base and its
  mark back into one code point. `a` + U+0306 composes to `ă` and is ordered
  correctly; `n` + U+0306 has no precomposed form, so the mark falls to the
  fallback band and is ordered by code point instead. Over all 112×112 mark
  pairs on such a base that is **37.8% divergent from ICU** — every Latin letter
  the alphabet actually uses is fine, and a base with no precomposed form is
  not. Doing better means making marks primary-ignorable and accumulating them
  at the secondary level, which is a different algorithm from the one here.

Not claimed: exact ICU order for characters outside the Latin script — Greek,
Cyrillic, Hebrew, CJK, emoji, unlisted symbols. Two things *are* guaranteed for
them. Two different characters never compare equal, because a caller reads 0 as
"these are the same" and drops one of them. And an unlisted **letter** sorts
after the alphabet rather than before it: both are wrong against ICU, but a name
in a script this table does not cover belongs at the bottom of a member list,
not ahead of `Aðalheiður`. That choice is measured, not assumed — against ICU
over assigned characters it diverges on 18.5% of pairs where one shared band
diverged on 53.5%, and on Latin-plus-CJK-plus-digits 1.0% against 37.9%. It is
worse in exactly one place, a uniform draw over the whole code space, which is
mostly *unassigned* code points and therefore not text.

It is about **2.4× slower than a native `Intl.Collator`** (17 ms versus 7 ms
sorting 10 000 names) and the tables above cost **901 B gzip** on top of what it
was before them. Those are the two measurements here that do not favour this
approach, and they buy the whole Latin script.

## The trap next door: date-fns is a separate axis

A polyfill fixes `Intl`. It does not fix a library that never used `Intl`.
[react-day-picker](https://daypicker.dev/) — and therefore every shadcn/ui
calendar and date picker — localises through **date-fns**, so a fully polyfilled
page still renders `October 2026` and `Su Mo Tu We Th Fr Sa` until a locale is
passed:

```ts
import { is } from "date-fns/locale/is";
<DayPicker locale={is} />   // október, Má Þr Mi Fi Fö La Su, Monday-first
```

One more thing to check once you do: date-fns's abbreviated Icelandic months are
**not** CLDR's. date-fns gives `mars, apríl, júní, júlí, ágúst, sept.` where CLDR
gives `mar., apr., jún., júl., ágú., sep.` — six of twelve differ. If anything
else on the page renders CLDR short months, the calendar will not match it.

That comparison is a claim about a package that can change it in a patch
release, so it is not maintained by hand: `npm run measure` reads both tables —
date-fns's and Node's — writes them into `docs/reference.json`, and
`test/reference.test.ts` fails if date-fns ever ships different ones. The demo
page renders that file rather than a copy.

## The page, and how it is built

[The page at the top](https://gudrodur.github.io/intl-is/) is the only place the
failure is *visible* rather than described. Source:
[`docs/index.html`](docs/index.html).

It reports what it measured, so a runtime nobody here owns still gets measured
instead of guessed at — that is how Safari got into the table. What comes back is
public: **[everything it has collected](https://intl-is-reports.gudrodur.workers.dev/summary)**,
one row per runtime and verdict, with a runtime label rather than a user agent.

It has to be served rather than opened off the disk (it loads two files beside
it):

```bash
npx serve docs      # then open the printed URL
```

The checks it runs are not a second copy of anything: `docs/cases.js` defines
each one once, `scripts/measure.mjs` runs those same functions under Node's full
ICU to produce the "correct" column, and the page imports the same file. A
comparison page whose two halves have drifted apart is worse than no page.

## Measurements

Every number in this README, with its method and date:
[docs/measurements.md](docs/measurements.md).
`scripts/probe-worker-intl.mjs` re-measures a bare workerd for any locale
(`npm run probe`, needs `wrangler` on PATH), so the gap can be re-checked per
workerd release.

## Do not wait for the upstream fix

Use this today. But the reason to use it is not the one an earlier version of
this README gave, and the difference matters if you were about to give up.

**On Chromium, the fix is written. It has been waiting on review since 2023.**

- The request: [issues.chromium.org/40624456](https://issues.chromium.org/issues/40624456),
  open since April 2019 — seven years, 48 comments, 158 stars.
- The fix: [crrev.com/c/4514575](https://chromium-review.googlesource.com/c/chromium/deps/icu/+/4514575),
  "Add `is` to common.json", uploaded by a Chromium engineer in May 2023,
  rebased that August, still `NEW`. It adds `is` to `curr_tree`, **`coll_tree`**,
  `unit_tree` and `zone_tree` — collation included.

The last substantive word on that CL is from October 2023: *"This will increase
the data 60K for every users. Is this what Chrome team PM decide to increase the
locale support?"* Nobody has answered it since.

So this is **not** a refusal, and not quite the policy wall this README used to
describe. The filter rule is real —
[`filters/common.json`](https://chromium.googlesource.com/chromium/deps/icu/+/refs/heads/main/filters/common.json)
keeps *"only the minimum locale data for non-UI languages"*, and the qualifying
condition is whether Chrome's own UI is translated, not whether the language is
used on the web. But a patch exists that would move Icelandic out of that list,
and what is blocking it is one unanswered question about roughly 60 KB.

Which is why the Vivaldi measurement above is worth having: a shipping Chromium
already carries Icelandic, and the whole difference is **81,200 bytes**. That
number is now posted on both threads.

**workerd#64 is not a refusal. It is silence, which is worse.**
[cloudflare/workerd#64](https://github.com/cloudflare/workerd/issues/64) was
opened 2022-09-30. The maintainer was *receptive* — "annoying but maybe not a
huge deal for a server binary" — and the reporter went and measured it: swapping
in the full `icudt71l.dat` took the binary from 63 MB to 82 MB and nothing
crashed. (The often-quoted "data goes from ~10 MB to ~30 MB" is the maintainer
*asking* whether that follows, not a measurement anyone made.) Five comments
over five days, and then
**nothing: no comment, no label, no assignee, for 1,434 days** as of 2026-09-08.
A willing maintainer and four years of silence is a worse signal than a "no",
because a "no" can be argued with.

**Mozilla went the other way and stopped, which is the interesting part.**
[Bug 1612379](https://bugzilla.mozilla.org/show_bug.cgi?id=1612379) proposed
trimming Firefox's ICU data from all 459 locales ICU ships down to the ones
Firefox itself is translated into — 1,816,512 bytes off the `.dat` file, 11.1 MB
to 9.3 MB — and it
stalled on the principle that dropping languages with millions of speakers is
not acceptable, and that once Firefox's intl data is available to the Web it
should remain available. Deprioritised P2 → P5, to revisit "once we have ICU4X".

That is the whole thing in one comparison: two vendors looked at the same couple
of megabytes of locale data and reached opposite conclusions, and that is why
your Icelandic dates work in Firefox and not in Chrome. It is a values split
rather than a technical inevitability.

**So why still not wait?** Not because nobody has asked — they have, for seven
years, and the patch is written. Because none of the three threads is blocked on
anything a user can supply. Chromium's needs a product decision, workerd's needs
a maintainer to look at it again, and Mozilla's is waiting on ICU4X. Filing
another bug adds nothing to any of them; the useful contribution is a
measurement, which is why the Vivaldi figure went on the two live threads rather
than into a new issue.

Two things worth watching. The near one is
[crrev.com/c/4514575](https://chromium-review.googlesource.com/c/chromium/deps/icu/+/4514575)
— if it lands, Chrome's half of this problem ends, collation included. The far
one is **ICU4X**, which both threads independently point at: the workerd
reporter ("I'm starting to understand why the Unicode Consortium is pushing
ICU4X") and Mozilla's own resolution. Data loaded on demand per locale is the
shape that makes this question go away, rather than the shape that makes someone
choose which languages are worth 1.8 MB.

## License

MIT
