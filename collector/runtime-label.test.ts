import { describe, expect, it } from "vitest";
import { appLabel, engineLabel, FAMILIES, runtimeLabel } from "./src/index.ts";

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

// Found by review, not by a report — and that is the point. `Chrome/` alone is
// not a Chromium marker: legacy EdgeHTML Edge spoofed it, and would otherwise
// have been stored with a fabricated engine version. Extinct since 2020, so
// this guards a row that has never arrived rather than one that has.
describe("engineLabel and legacy EdgeHTML", () => {
  const EDGEHTML =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36 Edge/18.17763";

  it("refuses to call EdgeHTML a Chromium", () => {
    expect(/Chrome\/(\d+)/.test(EDGEHTML)).toBe(true); // the trap is real
    expect(engineLabel(EDGEHTML)).toBe("");
  });

  it("still reads Chromium Edge, which sends Edg/ and not Edge/", () => {
    expect(
      engineLabel(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0",
      ),
    ).toBe("Chromium 153");
  });

  it("still reads Edge on Android (EdgA/) and refuses Edge on iOS (WebKit)", () => {
    expect(
      engineLabel(
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36 EdgA/152.0.0.0",
      ),
    ).toBe("Chromium 152");
    expect(
      engineLabel(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/131.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("");
  });
});

// Android WebView. Note the provenance, because this file's rule is real user
// agents and this one is NOT captured: the report that prompted it arrived on
// 2026-09-08 labelled `Chrome 151 / Android` and the string was discarded before
// storage, as designed. The reader typed "Messenger browser" into the correction
// box, which is the only reason we know what it was.
//
// So the shape below is built from Google's documented WebView convention (a
// `; wv)` token in the platform section) plus the FB_IAB tokens Facebook's
// in-app browsers are known to append — not from a captured string. If a real
// one ever arrives and disagrees, the real one wins and this fixture goes.
describe("Android WebView is not Chrome", () => {
  const MESSENGER =
    "Mozilla/5.0 (Linux; Android 14; SM-S911B Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/151.0.0.0 Mobile Safari/537.36 [FB_IAB/MESSENGER;FBAV/500.0.0.0;]";

  it("labels a WebView as WebView, not Chrome", () => {
    expect(runtimeLabel(MESSENGER)).toBe("WebView 151 / Android");
  });

  it("still reports the Chromium build underneath it", () => {
    // The version in the label is WebView's; the engine column is what makes it
    // comparable with a Chrome row. Both are 151 here and that is a fact about
    // this string, not a rule.
    expect(engineLabel(MESSENGER)).toBe("Chromium 151");
  });

  it("does not steal rows from the branded Android browsers", () => {
    // Every one of these carries Chrome/ too. The WebView rule sits AFTER them
    // in the family table and must not change what they resolve to.
    const cases: Array<[string, string]> = [
      [
        "Chrome 151 / Android",
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36",
      ],
      [
        "Edge 152 / Android",
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36 EdgA/152.0.0.0",
      ],
      [
        "Samsung Internet 30 / Android",
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/30.0 Chrome/152.0.0.0 Mobile Safari/537.36",
      ],
    ];
    for (const [expected, agent] of cases) expect(runtimeLabel(agent)).toBe(expected);
  });

  it("does not fire on a desktop string that merely contains wv somewhere", () => {
    // The token is `; wv)` in the platform section, not the letters w and v.
    expect(
      runtimeLabel(
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 SomeThing/wv",
      ),
    ).toBe("Chrome 152 / Linux");
  });
});

// The embedding app. Same provenance caveat as the WebView block above: these
// are the documented token conventions of each app, not strings we captured.
// The one real report behind all of this was stored without its user agent.
describe("appLabel", () => {
  it.each([
    ["[FB_IAB/MESSENGER;FBAV/500.0.0.0;]", "Messenger"],
    ["[FBAN/MessengerForiOS;FBAV/460.0;]", "Messenger"],
    ["[FB_IAB/FB4A;FBAV/460.0.0.0;]", "Facebook"],
    ["[FBAN/FBIOS;FBAV/460.0;]", "Facebook"],
    ["Instagram 300.0.0.0 Android", "Instagram"],
    ["MicroMessenger/8.0.49", "WeChat"],
    ["Line/13.5.0", "LINE"],
    ["musical_ly_2023 BytedanceWebview/d8a21c6", "TikTok"],
    ["LinkedInApp/9.30", "LinkedIn"],
    ["GSA/300.0.0", "Google app"],
  ])("reads %s", (fragment, expected) => {
    expect(appLabel(`Mozilla/5.0 (Linux; Android 14; wv) Chrome/152.0.0.0 ${fragment}`)).toBe(
      expected,
    );
  });

  it("is empty, never guessed, for an ordinary browser", () => {
    expect(
      appLabel(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36",
      ),
    ).toBe("");
    expect(appLabel("Mozilla/5.0 (X11; Linux x86_64; rv:155.0) Gecko/20100101 Firefox/155.0")).toBe(
      "",
    );
  });

  it("is a separate axis from the runtime label", () => {
    // The whole point: one string yields BOTH what renders and what it renders
    // inside. Folding them together would lose the comparison.
    const ua =
      "Mozilla/5.0 (Linux; Android 14; SM-S911B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/151.0.0.0 Mobile Safari/537.36 [FB_IAB/MESSENGER;FBAV/500.0.0.0;]";
    expect(runtimeLabel(ua)).toBe("WebView 151 / Android");
    expect(appLabel(ua)).toBe("Messenger");
    expect(engineLabel(ua)).toBe("Chromium 151");
  });
});

// iOS in-app browsers. Facebook, Messenger and Instagram all send
// `Mobile/15E148` with no `Version/… Safari` and no `CriOS/`, so every one of
// them landed in `other` — Android announces itself with `; wv)` and iOS
// announces nothing. The app token is the only evidence there is, so the rule
// is: an unrecognised browser inside a KNOWN app is a WebView.
//
// Same provenance caveat as above: shapes built from each app's documented
// token conventions, not captured strings.
describe("an unrecognised browser inside a known app is a WebView", () => {
  it.each([
    [
      "WebView / iOS",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBDV/iPhone14,2;FBSV/17.1]",
    ],
    [
      "WebView / iOS",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/460.0;]",
    ],
    [
      "WebView / iOS",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0 (iPhone14,2; iOS 17_5)",
    ],
  ])("labels %s", (expected, agent) => {
    expect(runtimeLabel(agent)).toBe(expected);
  });

  it("carries no version, because the string offers none", () => {
    // FBAV is the APP's version and FBSV is the iOS release. Neither is the
    // engine, and inventing one from them would be a fabrication.
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/460.0;]";
    expect(runtimeLabel(ua)).not.toMatch(/\d/);
    expect(appLabel(ua)).toBe("Messenger");
  });

  it("leaves a real browser and a genuinely unknown one alone", () => {
    // Safari still wins on its own pattern...
    expect(
      runtimeLabel(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("Safari 26 / iOS");
    // ...and an unknown browser with NO app stays `other`, so the `unlabelled`
    // counter in /summary keeps meaning "extend the family table".
    expect(
      runtimeLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) SomeNewBrowser/1.0"),
    ).toBe("other / iOS");
  });
});
