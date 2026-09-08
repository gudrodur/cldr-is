import { describe, expect, it } from "vitest";
import { is as dateFnsIs } from "date-fns/locale/is";
import reference from "../docs/reference.json" with { type: "json" };
import { CASES, INSTANT, NAMES, sourceOf } from "../docs/cases.js";

// docs/reference.json is the "correct" column of the demo page. It is generated
// (npm run measure) rather than typed, and this is what stops it from quietly
// going stale: if a Node/ICU upgrade moves a CLDR rendering, or someone edits a
// case without regenerating, the page would keep showing an answer nobody has
// verified since. Here the committed file is checked against what this Node
// answers right now.
describe("docs/reference.json is current", () => {
  it("covers every case, and only those cases", () => {
    expect(reference.cases.map((c) => c.id).sort()).toEqual(CASES.map((c) => c.id).sort());
  });

  it("still matches what this Node's full ICU produces", () => {
    for (const c of CASES) {
      const recorded = reference.cases.find((r) => r.id === c.id)!;
      expect(c.run(), `${c.label} — run \`npm run measure\` and commit the result`).toBe(
        recorded.cldr,
      );
    }
  });

  it("records the expression it actually ran", () => {
    for (const c of CASES) {
      const recorded = reference.cases.find((r) => r.id === c.id)!;
      expect(recorded.expr).toBe(sourceOf(c));
    }
  });

  it("pins the instant and the name list the page renders", () => {
    expect(reference.instant).toBe(INSTANT);
    expect(reference.names).toEqual(NAMES);
  });

  it("carries the extra data the plural gloss needs", () => {
    const plural = reference.cases.find((c) => c.id === "plural")!;
    expect(plural.extra?.categoriesIs).toEqual(["one", "other"]);
    // The row's whole point: English and Icelandic disagree about 21.
    expect(plural.extra?.english).toBe("other");
    expect(plural.cldr).toBe("one");
  });

  it("keeps every case id reportable", () => {
    // The collector filters incoming case ids against /^[a-z0-9-]{1,40}$/ and
    // silently drops anything else — an id with an underscore or a capital would
    // vanish from every report with no error anywhere. Pin the two together.
    for (const c of CASES) {
      expect(c.id, `${c.id} would be dropped by the collector`).toMatch(/^[a-z0-9-]{1,40}$/);
    }
  });

  it("still matches what date-fns ships today", () => {
    // The one claim in this repo about a moving third party. date-fns can change
    // its Icelandic abbreviations in a patch release, and the README, the
    // measurements doc and the demo page all render this table — so a change
    // there has to fail here rather than make three documents wrong at once.
    const months = Array.from({ length: 12 }, (_, i) =>
      dateFnsIs.localize.month(i, { width: "abbreviated" }),
    );
    expect(months, "date-fns changed — run `npm run measure` and re-read the prose").toEqual(
      reference.dateFns.monthsShort,
    );
    expect(dateFnsIs.options.weekStartsOn).toBe(reference.dateFns.weekStartsOn);

    // And the divergence the docs describe is recomputed, not asserted from memory.
    const cldr = Array.from({ length: 12 }, (_, i) =>
      new Intl.DateTimeFormat("is-IS", { month: "short", timeZone: "UTC" }).format(
        Date.UTC(2026, i, 15),
      ),
    );
    expect(cldr).toEqual(reference.dateFns.cldrMonthsShort);
    expect(reference.dateFns.differing).toEqual(
      months.map((m, i) => (m === cldr[i] ? null : i)).filter((i) => i !== null),
    );
  });
});
