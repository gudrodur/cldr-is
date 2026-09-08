import { describe, expect, it } from "vitest";
import { engineLabel, FAMILIES, runtimeLabel } from "./src/index.ts";

// Real user agents, not shapes invented to match the regexes. The table these
// pin has been wrong three times in one day — iOS Safari, then Chrome on iOS,
// then Firefox on iOS — and each was found by a stranger's report reading
// "other" rather than by anything here. That is the wrong way round.
const AGENTS: Array<[string, string]> = [
  [
    "Safari 26 / iOS",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
  ],
  [
    "Safari 26 / iOS",
    "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
  ],
  [
    "Safari 26 / macOS",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
  ],
  [
    "Chrome 152 / iOS",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/152.0.0.0 Mobile/15E148 Safari/604.1",
  ],
  [
    "Firefox 140 / iOS",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/140.0 Mobile/15E148 Safari/605.1.15",
  ],
  [
    "Edge 131 / iOS",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/131.0 Mobile/15E148 Safari/604.1",
  ],
  [
    "Chrome 152 / Linux",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
  ],
  [
    "Chrome 152 / Android",
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36",
  ],
  [
    "Chrome 152 / Windows",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
  ],
  [
    "Firefox 155 / Linux",
    "Mozilla/5.0 (X11; Linux x86_64; rv:155.0) Gecko/20100101 Firefox/155.0",
  ],
  [
    "Firefox 155 / Windows",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:155.0) Gecko/20100101 Firefox/155.0",
  ],
  [
    "Firefox 155 / Android",
    "Mozilla/5.0 (Android 14; Mobile; rv:155.0) Gecko/155.0 Firefox/155.0",
  ],
  [
    "Edge 131 / Windows",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.86",
  ],
  [
    "Opera 116 / Linux",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 OPR/116.0.0.0",
  ],
  [
    "Samsung Internet 30 / Android",
    "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/30.0 Chrome/152.0.0.0 Mobile Safari/537.36",
  ],
  [
    // Vivaldi sends Chrome's string verbatim and is SUPPOSED to land here. This
    // is not a gap; it is the measurement that the correction field exists for.
    "Chrome 152 / Linux",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
  ],
];

describe("runtimeLabel", () => {
  for (const [expected, agent] of AGENTS) {
    it(`labels ${expected}`, () => {
      expect(runtimeLabel(agent), agent).toBe(expected);
    });
  }

  it("orders the family list so a lookalike never wins", () => {
    // Edge, Opera, Vivaldi and Samsung Internet all carry "Chrome/" and every
    // WebKit browser carries "Safari". Whichever is more specific has to be
    // tested first, so this pins the order rather than trusting it stays.
    const order = FAMILIES.map(([name]) => name);
    expect(order.indexOf("Edge")).toBeLessThan(order.lastIndexOf("Chrome"));
    expect(order.indexOf("Opera")).toBeLessThan(order.lastIndexOf("Chrome"));
    expect(order.indexOf("Samsung Internet")).toBeLessThan(order.lastIndexOf("Chrome"));
    expect(order.lastIndexOf("Chrome")).toBeLessThan(order.indexOf("Safari"));
  });

  it("says other rather than guessing, and keeps the platform", () => {
    // A label it cannot place must still carry the platform, because that is
    // what makes an unrecognised row actionable instead of a shrug.
    expect(runtimeLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) SomeNewBrowser/1.0")).toBe(
      "other / iOS",
    );
    expect(runtimeLabel("")).toBe("other / other");
  });

  it("keeps a version out of the label when it is not a version", () => {
    expect(runtimeLabel("Chrome/999999 (X11; Linux x86_64)")).toBe("Chrome / Linux");
  });
});

// The engine version, pinned on the SAME strings as the family label above.
//
// The point of this column is that "Opera 101" and "Samsung Internet 30" are
// the vendor's own numbering and say nothing about which Chromium is running.
// So these expectations are about the extraction, not about any browser: the
// pairing in a fixture is whatever the fixture says, and a real Samsung
// Internet 30 sits on a much older base than the one written here.
describe("engineLabel", () => {
  it.each([
    // Every Chromium browser carries Chrome/<major> whatever it calls itself.
    ["Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36", "Chromium 152"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.86", "Chromium 131"],
    ["Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 OPR/116.0.0.0", "Chromium 131"],
    ["Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/30.0 Chrome/152.0.0.0 Mobile Safari/537.36", "Chromium 152"],
    // Gecko: rv: only repeats Firefox's own number, so there is nothing to add.
    ["Mozilla/5.0 (X11; Linux x86_64; rv:155.0) Gecko/20100101 Firefox/155.0", ""],
    ["Mozilla/5.0 (Android 14; Mobile; rv:155.0) Gecko/155.0 Firefox/155.0", ""],
    // iOS: all of these are WebKit and all report the same frozen 605.1.15.
    // A Chromium version here would be a fabrication — and note that neither
    // CriOS nor EdgiOS carries a Chrome/ token, so nothing leaks through.
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/152.0.0.0 Mobile/15E148 Safari/604.1", ""],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/131.0 Mobile/15E148 Safari/604.1", ""],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15", ""],
  ])("reads %s", (agent, expected) => {
    expect(engineLabel(agent)).toBe(expected);
  });

  // The one that matters for the README's Android claim: a family version and
  // an engine version that disagree, from one string.
  it("separates the vendor's number from the engine's", () => {
    const opera =
      "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36 OPR/101.0.0.0";
    expect(runtimeLabel(opera)).toBe("Opera 101 / Android");
    expect(engineLabel(opera)).toBe("Chromium 152");
  });

  it("refuses a number that is not a version rather than storing it", () => {
    expect(engineLabel("Chrome/12345678")).toBe("");
    expect(engineLabel("no chromium here")).toBe("");
  });
});
