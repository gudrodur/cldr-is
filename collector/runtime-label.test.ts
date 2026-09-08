import { describe, expect, it } from "vitest";
import { FAMILIES, runtimeLabel } from "./src/index.ts";

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
