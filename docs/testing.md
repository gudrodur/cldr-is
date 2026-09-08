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
