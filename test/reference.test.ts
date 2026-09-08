import { describe, expect, it } from "vitest";
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
});
