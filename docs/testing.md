# What makes a test worth having

Every rule here was learned by breaking it in this repository, most of them on
2026-09-08, and each one names the instance and what it cost. None of it is
specific to Icelandic; it is specific to code whose correctness is a claim about
someone else's data.

## 1. A green suite is evidence about its corpus and nothing else

The parity claim read *"200 000 random strings drawn from the whole character
set — zero divergences"*. The pool was the Icelandic alphabet plus ASCII.

Three defects lived in the gap between that sentence and that pool: canonically
equivalent input comparing unequal, every character above U+0062 sharing one
weight so `compareIs("中", "文")` returned 0, and `ß` tying with `ss`. The tests
were honest about what they ran. The sentence was not, and nobody re-read the
sentence against the generator.

**Read the claim and the pool side by side and make them the same words.**
Widening the sentence costs nothing and feels like precision. Widening the pool
is the only thing that is.

It happened twice. The replacement sentence said non-Icelandic letters sort
"next to the base letter they decompose to" — true, and again wider than the
pool, which only held letters decomposing onto an *Icelandic* base. That gap is
where `ł` was hiding, sorting ahead of every Icelandic name in a member list.

## 2. Run a new test against the code it is meant to catch

A guard you have never seen fail is not a guard. Before believing a test, revert
the fix and watch it go red.

Six tests were added for the defects above; all six were run against the previous
commit first and all six failed there. Two tests written the same day did *not*
fail against the old code, which is how it was discovered that they tested
nothing.

This costs one minute and it is the only direct evidence a test constrains
anything.

## 3. Pinning both sides to the same option makes the test true by construction

An early version of the date formatters asserted equality against
`toLocaleString(locale, { timeZone: "UTC", ... })` — with `timeZone: "UTC"` on
*both* sides. It passed. It was measuring nothing, because the call sites it
replaced passed no timeZone at all and rendered the viewer's wall clock.

The bug survived a review round. It was caught by running the same comparison in
a second time zone: identical in `Atlantic/Reykjavik`, divergent in
`Europe/Copenhagen`.

**Ask what the assertion would look like if the code were wrong.** If the answer
is "the same", the test is a tautology. And run anything time-dependent in more
than one zone; `TZ=Europe/Copenhagen npm test` costs nothing.

## 4. A guard nobody runs is not a guard

`test/reference.test.ts` exists to fail when the published page's answers drift
from what Node's ICU produces now. It ran only when somebody happened to type
`npm test`. There was no CI at all.

That was tolerable while the page was a file in a repository. It stopped being
tolerable the morning the page went public and started telling readers what CLDR
says.

## 5. A guard that fails on something harmless stops being read

The first CI run of that workflow failed. Every one of the twelve CLDR answers
was identical; the only difference was `"generatedBy": "Node v24.19.0"` on a
laptop against `v24.20.0` on the runner.

Comparing provenance instead of answers is the mirror image of a test that cannot
fail, and it is just as bad: a gate that goes red over a patch release teaches
people to click past it, and then nobody reads the one that matters. The step now
strips the provenance fields and diffs the rest — and was verified by corrupting
an answer on purpose and watching both guards fire.

## 6. Derive the table; do not document it

The ASCII punctuation order in this repository was right from the first day. The
combining-mark order was wrong for weeks. The difference is not care — the
punctuation order was **read off ICU by a generator**, and the mark order was
reasoned about and typed in.

A hand-written table describing someone else's behaviour is a guess that looks
like a fact, however carefully it is written. Three tables here are now generated
from ICU and re-derived by a test, so a CLDR change fails CI instead of silently
making the documentation wrong.

**Where the authority is a library you can call, call it.**

## 7. Assert against an oracle, not against taste

The runtime you develop in cannot tell you whether your Icelandic is right —
your Chrome is the broken one. Node still has the data, so Node is the oracle,
and every manual formatter is pinned to the CLDR rendering of the same input
under Node's full ICU.

Without an oracle you are asserting your own opinion and calling it a test. With
one, `sep.` versus `sept.` stops being a matter of memory.

## 8. Do not assert what you can check

Three claims here were published as fact without being measured:

- *"Firefox and Safari ship full ICU"* — Safari had never been tested; there is
  no Mac in this project.
- *"Chrome, Edge, Opera, Brave, and anything else on the same engine"* — Vivaldi
  is that engine and ships Icelandic. A reader pointed it out within an hour of
  the page going public.
- *"There is no `Collator` polyfill and none is in progress"* —
  `@formatjs/intl-collator` had been on npm for four months. That one reached two
  upstream bug threads before it was corrected.

Each sentence was cheap to write and expensive to be caught on. The measurement
that replaced the second one — 81,200 bytes — turned out to be the most useful
number in the whole project.

**A sentence that could be checked in ten seconds will be, by someone.**

## 9. A measurement needs its subject recorded

The Safari result arrived as a screenshot of the demo page: all twelve checks
green. Genuinely useful, and the browser version is gone forever, because the
page did not print it.

The page now shows `navigator.userAgent` beside its verdict, so a screenshot is a
complete record rather than a result with no subject.

## 10. Check the exit status, not the emptiness of the output

`command | grep -i thing || echo "NOT FOUND"` prints `NOT FOUND` when `command`
itself failed. A pipeline failure then reads as a finding.

This produced a confidently wrong correction to a `CLAUDE.md` once, from a
`gcloud` call against an expired token. Read `$?` on the command you care about,
not the emptiness of what came out of the pipe.

## 11. A percentage from a random sample needs its spread

Two runs of the same random sweep gave 3,353 and 3,408 divergences. Publishing
either as *the* number invites a reader to reproduce it and conclude something
has changed when nothing has.

Either make the sweep deterministic with a fixed seed, or say the count moves and
give the range. Where a design decision rests on such a comparison — this one
decided where unlisted letters sort — run both arms over the *same* fixed pools
in the same process, and report every pool including the one that does not favour
your choice.

## 12. Say what you could not check

Eight of sixty claims in this repository's README were, at one point,
unverifiable from the repository: measured inside an application nobody else can
run. They were not wrong. They were unfalsifiable, which in a document that sells
itself on measurement is its own kind of defect.

"I could not verify this" is a result. It is more useful than a plausible
substitute, and it tells a reader exactly how far to trust the rest.

## 13. A count about a live dataset decays; a shape does not

This rule cost four corrections in one afternoon, three of them made *after*
writing the previous one down, and one inside the very commit that explained the
problem. It is the most-repeated mistake in this repository's history.

The README describes a table that strangers append to by opening a page. Every
count written into it — "three browsers agree", "six Android rows", "four
desktop rows", "across three majors" — was accurate when typed and wrong within
the hour. Nothing failed. No test went red. The document simply became false
while everyone's attention was elsewhere, which is the worst available failure
mode: silent, and invisible to the whole test suite.

**The distinction that matters is not accuracy, it is what new data does to the
claim:**

- A claim new data can **falsify** is fine, and is the entire point of
  collecting any. *"Every Gecko row passes all twelve"* is a real assertion that
  one failing row would destroy, and it should be written exactly that boldly.
- A claim new data merely makes **stale** is a maintenance burden assigned to
  nobody. *"Three browsers agree"* is not refuted by a fourth agreeing — it is
  just quietly wrong, and it is wrong in the direction of understating your own
  evidence.

So state the shape and let the endpoint carry the arithmetic: "every Chromium
family that has reported from Android", "several desktop rows", "on every
version anyone has reported". Where a table is genuinely useful, date it
explicitly as a snapshot and link the live source beside it.

**The exception is measurements of fixed artefacts**, and it is not a small one
— 707,603 B gzipped, 12.7% of Latin pairs, 81,200 bytes of `icudtl.dat`. Those
are properties of a file that will read the same next year, and hedging them
would throw away the precision that makes them worth having. The test is whether
anyone can change the number by opening a web page.

## 14. Do not assign an identity a row cannot carry

The most repeated mistake in this project, four times in one afternoon, and
every instance looked like ordinary summarising rather than like an error.

The collector stores a *label*, derived from a user agent that is then thrown
away. A label is not an identity. Vivaldi sends Chrome's user agent verbatim —
byte-identical in the brand list and the high-entropy hints too — so a row
reading `Chrome 152 / Linux` may be Chrome, Vivaldi, or something else that has
never been named here. Writing "the desktop rows carrying Icelandic are Vivaldi"
converted several unattributable rows into a claim about one browser, in a
sentence written to *correct* the previous version of the same error.

The four:

- "the desktop rows carrying Icelandic are Vivaldi" — exactly one of them said so.
- "every row that is Chrome is on the English side" — several rows *labelled*
  Chrome were not.
- "Safari 26 on iOS passes all twelve" — no such row. The passing iOS row reads
  `other / iOS`, recorded while the Safari pattern was broken, and the endpoint's
  own `knownGap` note says it cannot be relabelled.
- a comparison table showing `Chromium 152` for rows whose engine column is
  empty — read off the family label and presented as recorded.

**The test is one question: could this row have been produced by something other
than the thing I just called it?** If yes, name what was recorded ("rows
labelled Chrome"), state the attribution separately with its
evidence, and say plainly that the rest cannot be attributed.

**This rule's own example was wrong when it was written.** It said to state the
attribution as "one names Vivaldi in a reader's correction" — and an audit two
hours later found that **no correction on a Chrome-labelled desktop row names a
browser**. The closest is a reader-typed build number, `8.2.4133.47`, which is
Vivaldi's and which identifies a build rather than a browser.

That scoping matters, and the first version of this paragraph did not have it:
it said "no stored correction names a browser at all", which a third reader
falsified in one query — `Zen 1.21.10b / Linux` and `Messenger browser` are
both stored corrections and both name browsers. **A rule against unscoped
attribution acquired an unscoped universal while confessing to one.** The rule against attributing an
identity a row cannot carry attributed one in its own worked example. Read that
as the strongest evidence for the rule rather than against it: the sentence that
felt safest was written by the person who had just spent an hour fixing four
instances of the same defect. That is not hedging — it is the difference between a measurement
and a guess wearing its clothes.

Note what makes this one hard to catch: the wrong version is *shorter*, reads
more confidently, and is usually true of the row you were actually looking at.

## 15. A field derived from an attacker-controlled input is attacker-controlled

Everything the collector knows about a browser comes from a string the reporter
sends, and every derived field inherits that. `runtimeLabel`, `engineLabel` and
the platform are all functions of `navigator.userAgent`, which anyone can set —
Chrome does it with one command-line flag, and DevTools' device toolbar does it
with two clicks.

Measured 2026-09-08: Chrome 152 with an iPhone user agent still resolves `en-US`
for every `Intl` constructor and still sorts wrong, because **emulation changes
the label and the viewport, never ICU**. That report would be stored as
`Safari 26 / iOS` failing all twelve checks — confidently, permanently, and in
direct contradiction of the real Safari row.

Two things follow, and the second is the uncomfortable one:

1. **Say so where people can act on it.** The page now asks readers not to
   report from an emulated device, because that is cheaper than any detection.
2. **A privacy decision can be an auditability cost.** Discarding the user agent
   is right — a rare one is a visitor id whatever the column is called — but it
   means a poisoned row can never be re-examined, only deleted. That trade is
   worth making here and it should be made knowingly, not discovered later.

## 16. A gap you are explaining is a bug report about your collector

When you catch yourself writing "this data cannot say why", stop. Ask what would
have had to be recorded, then check whether it was available and thrown away.

Three times in one afternoon the answer was yes, and each time the document had
already spent a careful paragraph reasoning around the hole instead:

- **Engine version.** Every Chromium browser carries `Chrome/<major>` whatever
  it calls itself. The collector parsed that exact token to build a family label
  and discarded the number, so "Opera 101" could not be compared with
  "Chrome 152" at all. Within an hour of adding the column it settled a
  different question entirely.
- **Device language.** Named as the leading suspect in two consecutive rewrites,
  never measured, and readable as `navigator.language`.
- **The collator's resolved locale.** The page ran a collation check and
  reported only `DateTimeFormat`'s locale, as though one tag answered for every
  ICU tree. It does not — which is precisely the subject of this whole
  repository.

Adding a field costs one line and one migration. Reasoning around its absence
costs a paragraph that must be relitigated every time new data arrives, and it
*reads as rigour*, which is what makes it hard to see.

When you do add one, say in the document that existing rows read empty and
cannot be backfilled. The temptation is to let a new column quietly imply the
whole table answers the new question.

## 17. One sentence must not cover two corpora

`formatIsNumber` was pinned over 20,000 pseudo-random values spanning the whole
double range. The eight date shapes beside it were pinned at **one instant
each** — `2026-09-02T12:07:07Z` and a few hand-built `Date`s. Two exported
functions had no test at all, and the three exported name tables were never
compared to CLDR directly.

One sentence covered all of it: *pinned to Node's full ICU*. It was true of the
number formatter and it read as a claim about the module.

That is the same defect as rule 1, one level up. Rule 1 says a green suite is
evidence about its corpus; this says that when a file holds several corpora of
very different strength, a single summary sentence quietly promotes the weakest
to the strength of the strongest. Nobody lied and nobody had to: the sentence
was written when the number sweep was the new thing, and the date shapes simply
never came up again.

Two things fix it, and the second matters more:

1. **Write the corpus into the test, not the prose.** `test/parity.test.ts`
   carries its counts and its two known limits in the file that runs them, and a
   `covers every date shape the module exports` case fails when an export is
   added with no row — so the coverage claim is checked rather than remembered.
2. **When you strengthen one function's testing, look at its neighbours in the
   same breath.** The asymmetry is created by improvement, not by neglect. Every
   time a corpus is widened for one export, the exports beside it get further
   behind the sentence that describes all of them.

Measured when this rule was written (2026-09-09): widening the date corpus to
~3.8 million comparisons across six time zones found **zero** divergences inside
the claimed range and **two** limits outside it that nothing had recorded. A
sweep that finds nothing is not a wasted sweep; it converts "we believe" into
"we measured", and it is the only way to tell those two apart.

## 18. A zone with no DST is a test bench with a hole in it

Iceland dropped daylight saving in 1968. Nearly every European country kept it.
So the zone this code is *for* is the one zone where an offset never moves, and a
suite run at home exercises the whole DST axis on nothing.

Measured over the parity sweep's own 5,000 instants: **30.1%** carry a summer
offset in `Europe/Copenhagen`, **34.4%** in `America/Los_Angeles`, **0.0%** in
`Atlantic/Reykjavik`. Not "few". None.

The demonstration rather than the argument: change `formatIsTime` to read local
fields instead of UTC fields. Four tests fail in Copenhagen. **One** fails in
Reykjavík — and only because of a historical pin added the same day. Without it,
the mutation is invisible where the developer sits.

Two things follow, and the second is the general one.

**Run the suite where the property varies, not where the users are.** The
temptation is the opposite: test in the zone you ship to. That is precisely the
zone chosen for having no variation in the thing under test.

**And check what your reference is actually asserting.** The instant shapes read
`getUTC*` and render the result as Icelandic time, on the ground that Iceland is
UTC+0 year-round. The reference passed `timeZone: "UTC"`. So the assertion was
`getUTCHours()` equals `Intl(timeZone: "UTC")` — an identity between two
spellings of the same thing, which cannot fail for any reason connected to
Iceland. That is rule 3 again, and it was committed inside the file written to
fix rule 1. A test can be true by construction along an axis nobody named, in a
file whose whole subject is corpus width.

## 19. tzdata answers a question you did not ask

Pointing the reference at `timeZone: "Atlantic/Reykjavik"` produces divergence on
**39.6%** of a 1600–2400 sweep: every instant before 1912, by 16 minutes and 8
seconds. The obvious reading is "the module is wrong about Iceland's history".

It is not. **16:08 is not Reykjavík's offset from anything.** tzdata merges zones
that have agreed since 1970 and keeps a single history for the survivor, so
`Atlantic/Reykjavik` is a backward *link* to `Africa/Abidjan` — and the pre-1912
"Icelandic local time" the platform reports is Abidjan's local mean time
(4.03° W). Reykjavík is at 21.9° W; its LMT was about −01:28. Iceland's real
history, UTC−1 from 1908 with DST in 1917–1919, 1921 and 1939–1968, **is in no
JavaScript runtime at all**.

Confirmed rather than reasoned: `Africa/Abidjan` and `Atlantic/Reykjavik` render
the same 1900 instant identically, and the pin fails if tzdata ever unmerges
them.

The rule: **before treating an oracle's disagreement as your defect, establish
that the oracle is answering your question.** A time zone id is a name for a
history, and a platform is free to substitute a different history behind the same
name when the two agree over the range it cares about. The parity floor here is
1970 because that is where the data starts being about Iceland — not where the
module starts being right, and there is no way to find out which from inside
JavaScript.

## 20. `diff` of two empty streams exits 0, and that reads as agreement

The claim "`src/format.ts` and xj-greenfield's `is-date.ts` are byte-identical
from `IS_WEEKDAYS` down" was checked, repeatedly, with:

```bash
diff <(sed -n '/^const IS_WEEKDAYS/,$p' a.ts) <(sed -n '/^const IS_WEEKDAYS/,$p' b.ts)
```

Both files declare `export const IS_WEEKDAYS`, so the address `^const` matched
**nothing in either file**, `sed` printed nothing twice, and `diff` compared two
empty streams and exited 0. The check reported agreement every time it was run,
and the files had never agreed: greenfield's copy carries call-site comments
naming its own routes, which the package cannot have and should not.

The measured truth is narrower and worth stating precisely: the two are
**code-identical and comment-divergent** — 34 non-comment lines apart, all of
them `formatIsNumber`/`roundDecimal`, which greenfield keeps in
`lib/public-number.ts` instead.

This is the same shape as the `|| echo` trap in `~/.claude/CLAUDE.md`: a
pipeline's *failure to select anything* is reported as a *finding about the
content*. A comparison whose inputs are empty must be an error, not a pass. Make
the extractor assert it extracted something:

```bash
sed -n '/^export const IS_WEEKDAYS/,$p' a.ts | grep -q . || { echo "marker not found"; exit 2; }
```

Two-thirds of a "verify the mirror" step is verifying that the step ran.

## 21. A fix with no pin passes the suite, and the suite is the reason you believe it

Two changes shipped together here. Reverting the date fix failed 7 tests, in six
zones, immediately. Reverting the collation fix — putting the ligatures back at
the wrong level — failed **nothing**: 161 tests passed with the defect
reinstated, because the new behaviour had no pin, only a hand-run script that
was not in the repo.

A green suite after a change means the change did not break the pins that exist.
It says nothing whatever about the change itself. The only evidence that a new
pin is a pin is watching it fail: break the fix deliberately, in each of the
distinct ways it could be got wrong (here: level too high, level too low for the
one exception, expansion absent entirely), and confirm a different failure each
time. Three mutations, three failures, then the fix goes back.
