// intl-is-reports — what the demo page measured, from whoever opened it.
//
// A review on 2026-09-08 found the first version's privacy promise untrue: it
// stored every reporter's full user-agent string and republished it on a public
// endpoint. No column was called a visitor id, but a rare user agent IS one, and
// the page did not tell anyone their string would become a public row.
//
// So the raw string never reaches the database now. It is reduced, in this
// Worker, to a runtime label from a fixed list — "Safari 18 / macOS" — which is
// what the project actually wants to know and carries too little entropy to
// single anyone out. Everything unrecognised becomes "other".

interface Env {
  DB: D1Database;
}

const CORS = {
  "access-control-allow-origin": "https://gudrodur.github.io",
  "access-control-allow-methods": "POST, GET, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

// Every legitimate report is a few hundred bytes. A 2 MB body was accepted by
// the first version.
const MAX_BODY = 4096;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });

// Order matters: Vivaldi, Edge, Opera, Brave and Samsung Internet all carry
// "Chrome" in their user agent, and Safari's is carried by every WebKit browser.
// Most specific first, and the generic ones last.
export const FAMILIES: Array<[string, RegExp]> = [
  ["Vivaldi", /Vivaldi\/(\d+)/],
  ["Edge", /Edg(?:e|A|iOS)?\/(\d+)/],
  ["Opera", /OPR\/(\d+)/],
  ["Samsung Internet", /SamsungBrowser\/(\d+)/],
  ["Firefox", /Firefox\/(\d+)/],
  // On iOS every browser is WebKit underneath and identifies with its own token
  // rather than Chrome/ or Firefox/. Without these, an iPhone running Chrome
  // lands in "other" and looks like an unknown engine when it is not.
  //
  // Read those rows carefully: the name is a skin. Apple requires WebKit, so
  // "Firefox 155 / iOS" and "Chrome 152 / iOS" are both measurements of Safari's
  // engine, and neither says anything about Gecko or Chromium. The label is kept
  // because it is what the reader chose and it groups their reports; the engine
  // it implies is not the one running.
  ["Chrome", /CriOS\/(\d+)/],
  ["Firefox", /FxiOS\/(\d+)/],
  // Android WebView, which is a DIFFERENT APK from Chrome and renders every
  // in-app browser we have seen. Google's convention is a `; wv)` token in the
  // platform section; the `Chrome/<major>` that follows is the Chromium build,
  // not the Chrome app.
  //
  // This was found by a reader, not by us. Their report arrived labelled
  // `Chrome 151 / Android` and would have been indistinguishable from Chrome if
  // they had not typed "Messenger browser" into the correction box — the same
  // way Vivaldi was found. Calling a WebView "Chrome" is assigning an identity
  // the row cannot carry.
  //
  // It matters for the open Android question: WebView ships separately from
  // Chrome, so a Chrome-app-specific data path would not explain a WebView
  // having Icelandic. One does.
  ["WebView", /;\s*wv\)[^]*?Chrome\/(\d+)/],
  ["Chrome", /Chrome\/(\d+)/],
  // iOS and iPadOS put a build token between the version and the word Safari
  // — "Version/26.0 Mobile/15E148 Safari/604.1" — so an anchored " Safari"
  // matched macOS and dropped every iPhone into "other". Measured 2026-09-08:
  // a real iOS report arrived labelled "other / iOS".
  ["Safari", /Version\/(\d+)[.\d]*(?:\s+\S+)? Safari/],
  ["Node", /node\.js\/v?(\d+)/i],
];

export const PLATFORMS: Array<[string, RegExp]> = [
  ["iOS", /iPhone|iPad|iPod/],
  ["Android", /Android/],
  ["macOS", /Mac OS X|Macintosh/],
  ["Windows", /Windows/],
  ["Linux", /Linux|X11/],
];

// "Safari 18 / macOS". Family from a fixed list, MAJOR version only, coarse
// platform. Nothing else survives — not the build number, not the OS version,
// not the original string.
//
// This table is hand-written, and it has been wrong three times in one day: iOS
// Safari, then Chrome on iOS, then Firefox on iOS, each discovered only because
// a real report arrived reading "other". A hand-written table describing someone
// else's strings is a guess that looks like a fact — so it is pinned in
// collector/runtime-label.test.ts against real user agents, and anything it
// cannot place is COUNTED in /summary rather than quietly filed under "other".
//
// Some browsers cannot be told apart from the client side at all. Measured
// 2026-09-08: Vivaldi 8.2.4 sends Chrome's user agent verbatim, reports "Google
// Chrome" in navigator.userAgentData.brands, AND in the high-entropy
// fullVersionList — the only difference is the patch build (…112 vs …82), which
// identifies a build and not a browser. So detection cannot do it, and the page
// asks instead: `said` below is a name the reader typed. That is better data
// than any sniffing would produce, because the reader knows the answer.
export function runtimeLabel(userAgent: string): string {
  let family = "other";
  let version = "";
  for (const [name, pattern] of FAMILIES) {
    const hit = pattern.exec(userAgent);
    if (hit) {
      family = name;
      // A major version above four digits is not a version; drop it rather than
      // let an arbitrary number through.
      version = hit[1] && hit[1].length <= 4 ? hit[1] : "";
      break;
    }
  }
  let platform = "other";
  for (const [name, pattern] of PLATFORMS) {
    if (pattern.test(userAgent)) {
      platform = name;
      break;
    }
  }
  return `${family}${version ? " " + version : ""} / ${platform}`;
}

// The app doing the embedding, when the browser is an in-app one.
//
// A reader's Messenger report on 2026-09-08 arrived labelled `Chrome 151 /
// Android` and only said Messenger because they typed it. The user agent said
// so too — `[FB_IAB/MESSENGER;…]` — and we discarded it. That is the third
// field in one day whose absence was left for prose to argue about.
//
// It is its own axis, not part of the runtime label. `WebView 151 / Android`
// says what is rendering; this says which app it is rendering inside. Folding
// them into one string would lose the ability to compare a Messenger WebView
// with a plain Chrome on the same engine, which is exactly the comparison the
// Android question needs.
//
// A hand-written table about someone else's strings is a guess that looks like
// a fact — this file has been wrong four times that way already — so it is
// pinned in the tests and anything unmatched stays EMPTY rather than being
// guessed at. An app name is low entropy (these are among the most installed
// apps on earth) and carries far less than the user agent it replaces.
export const IN_APP: Array<[string, RegExp]> = [
  ["Messenger", /FB_IAB\/MESSENGER|FBAN\/MessengerFor/],
  ["Facebook", /FB_IAB\/FB4A|FBAN\/FBIOS|\bFBAV\//],
  ["Instagram", /\bInstagram\b/],
  ["TikTok", /\bmusical_ly\b|\bTikTok\b|BytedanceWebview/],
  ["Snapchat", /\bSnapchat\b/i],
  ["WeChat", /MicroMessenger/],
  ["LINE", /\bLine\/\d/],
  ["LinkedIn", /LinkedInApp/],
  ["X", /\bTwitter(?:Android|ForiPhone)?\b/],
  ["Google app", /\bGSA\/\d/],
  ["Pinterest", /\bPinterest(?:Android|ForiOS)?\b/],
  ["Slack", /\bSlack(?:App)?\//],
];

export function appLabel(userAgent: string): string {
  for (const [name, pattern] of IN_APP) if (pattern.test(userAgent)) return name;
  return "";
}

// The engine version, separately, because the family version is not it.
//
// "Opera 101 / Android" and "Samsung Internet 30 / Android" both pass while
// "Chrome 151 / Android" fails, and until 2026-09-08 nothing here could say
// whether that was one Chromium version disagreeing with another or five
// unrelated numbers sitting in a table. Every Chromium browser carries
// `Chrome/<major>` in its user agent whatever it calls itself — that IS the
// engine version, and it was being read and discarded.
//
// Empty for everything else, and deliberately not guessed at: Gecko's `rv:`
// tracks Firefox's own number so it adds nothing, and every iOS browser reports
// the same frozen `AppleWebKit/605.1.15` regardless of which WebKit is running,
// so a version there would be a fabrication.
//
// `Chrome/` is NOT a reliable Chromium marker on its own, which a review caught
// here rather than a report: **legacy EdgeHTML Edge sent
// `… Chrome/64.0.3282.140 Safari/537.36 Edge/18.17763`** — a browser that is
// neither Chromium nor WebKit, which this would have stored as "Chromium 64".
// EdgeHTML has been dead since 2020 and no such report has arrived, so this
// guards against a fabricated row rather than an observed one. It is still
// worth having: the whole point of the family table above is that a
// hand-written rule about someone else's strings is a guess, and "nothing
// spoofs Chrome/" is exactly that kind of guess.
//
// The discriminator is the token, not the version: EdgeHTML sent `Edge/`,
// Chromium Edge sends `Edg/`. `EdgA/` (Android, Chromium) and `EdgiOS/` (iOS,
// WebKit) match neither, and are handled by the rules above and below.
const LEGACY_EDGEHTML = / Edge\/\d/;

export function engineLabel(userAgent: string): string {
  if (LEGACY_EDGEHTML.test(userAgent)) return "";
  const hit = /Chrome\/(\d+)/.exec(userAgent);
  if (!hit || !hit[1] || hit[1].length > 4) return "";
  return `Chromium ${hit[1]}`;
}

// Strict: `Number(true)` is 1, and the first version stored "1 check ran" for a
// report that sent `checked: true`. A wrong row is worse than a rejected one.
function integerInRange(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return value >= min && value <= max ? value : null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    if (url.pathname === "/report" && request.method === "POST") {
      const declared = Number(request.headers.get("content-length") ?? "0");
      if (!Number.isFinite(declared) || declared > MAX_BODY) {
        return json({ error: `body must be under ${MAX_BODY} bytes` }, 413);
      }

      let body: Record<string, unknown>;
      try {
        const text = await request.text();
        if (text.length > MAX_BODY) return json({ error: "body too large" }, 413);
        body = JSON.parse(text) as Record<string, unknown>;
      } catch {
        return json({ error: "expected JSON" }, 400);
      }

      const rawAgent = typeof body.userAgent === "string" ? body.userAgent.slice(0, 400) : "";
      const resolved =
        typeof body.resolved === "string" && /^[A-Za-z0-9-]{2,35}$/.test(body.resolved)
          ? body.resolved
          : null;
      const checked = integerInRange(body.checked, 1, 100);
      const broken = checked === null ? null : integerInRange(body.broken, 0, checked);
      if (!rawAgent || !resolved || checked === null || broken === null) {
        return json({ error: "userAgent, resolved, checked and broken are required" }, 400);
      }

      // What Intl.Collator resolved, kept apart from `resolved` (which is
      // DateTimeFormat's). These are different ICU trees — `coll_tree` and the
      // date trees — and one field for both is a conflation that hid the most
      // interesting row this project has recorded: Edge 153 on Windows
      // reported `en-GB` dates on 2026-09-08 while sorting Icelandic
      // CORRECTLY, and nothing stored could say whether that was real
      // collation data or a check too weak to tell. It is real: the English
      // collator puts these ten names in a demonstrably different order.
      //
      // Collation is the part of this problem with no polyfill, so a build
      // that has it and nothing else is exactly the case worth being able to
      // see. Same validation as `resolved`.
      const resolvedCollator =
        typeof body.resolvedCollator === "string" &&
        /^[A-Za-z0-9-]{2,35}$/.test(body.resolvedCollator)
          ? body.resolvedCollator
          : "";

      // The browser's UI language, primary subtag only. The one field that can
      // settle why two reports from the same Chrome 151 on Android disagree
      // about whether Icelandic is present — see the Android section of the
      // README, which has had to retract a version-based explanation twice.
      //
      // Two to three lowercase letters and nothing else. Anything longer is
      // either a region-tagged form the page was asked not to send or someone
      // probing the endpoint; either way it is dropped rather than stored, on
      // the same rule as everything else here — a wrong row is worse than an
      // absent one. Empty string, never null, for the UNIQUE constraint.
      const language =
        typeof body.language === "string" && /^[a-z]{2,3}$/.test(body.language) ? body.language : "";

      // Optional, typed by the reader when the detected label is wrong. Same
      // treatment as everything else from a stranger: printable ASCII, short.
      // Empty string, never null: the UNIQUE constraint below counts NULLs as
      // distinct from each other, so a null here would switch off deduplication
      // for every report that does not carry a name — which is most of them.
      //
      // The build noise gets stripped too. The first person to use the field
      // pasted "8.2.4133.47 (Official Build) (x86_64)" straight out of an About
      // dialog — a version with no browser in it, which tells a later reader of
      // /summary nothing. The page asks for the name now, and this keeps the
      // stored value to something a human can read.
      const said =
        typeof body.said === "string"
          ? body.said
              .replace(/[^\x20-\x7E]/g, "")
              .replace(/\((official build|[^)]*\b(x86|arm|64-bit|32-bit)[^)]*)\)/gi, "")
              .replace(/\s{2,}/g, " ")
              .slice(0, 40)
              .trim()
          : "";

      const failing = Array.isArray(body.failing)
        ? body.failing
            .filter((id) => typeof id === "string" && /^[a-z0-9-]{1,40}$/.test(id))
            .slice(0, 40)
        : [];

      // INSERT OR IGNORE against a uniqueness constraint on the whole row's
      // meaning. Legitimate traffic is one row per runtime per verdict, so a
      // repeat visit and a flood both cost one no-op. Measured before this
      // existed: 8 rows/second from one client, 7x D1's daily write allowance,
      // which would have taken the endpoint down for everyone.
      await env.DB.prepare(
        `INSERT OR IGNORE INTO reports (first_seen, runtime, engine, app, language, said, resolved, resolved_collator, checked, broken, failing, country)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          new Date().toISOString().slice(0, 10),
          runtimeLabel(rawAgent),
          engineLabel(rawAgent),
          appLabel(rawAgent),
          language,
          said,
          resolved,
          resolvedCollator,
          checked,
          broken,
          JSON.stringify(failing),
          request.headers.get("cf-ipcountry") ?? null,
        )
        .run();

      // Tell the reporter exactly what was kept. They are entitled to know, and
      // it makes the promise checkable from the browser console.
      return json({
        ok: true,
        stored: {
          runtime: runtimeLabel(rawAgent),
          engine: engineLabel(rawAgent) || null,
          app: appLabel(rawAgent) || null,
          language: language || null,
          resolvedCollator: resolvedCollator || null,
          said: said || null,
          resolved,
          checked,
          broken,
        },
      });
    }

    if (url.pathname === "/summary" && request.method === "GET") {
      const { results } = await env.DB.prepare(
        `SELECT runtime, engine, app, language, said, resolved, resolved_collator AS resolvedCollator,
                checked, broken, failing, MIN(first_seen) AS since
           FROM reports
          GROUP BY runtime, engine, app, language, said, resolved, resolved_collator, checked, broken
          ORDER BY runtime, engine, app, said`,
      ).all();

      const totals = await env.DB.prepare(
        `SELECT COUNT(*) AS rows, COUNT(DISTINCT runtime) AS runtimes,
                SUM(CASE WHEN broken = 0 THEN 1 ELSE 0 END) AS passing,
                -- A row the family table could not place. Not a browser that is
                -- unknown to the world — a gap in a hand-written list, and the
                -- only signal that it needs extending. Silence here is how three
                -- iOS browsers went unrecognised for a day.
                SUM(CASE WHEN runtime LIKE 'other %' THEN 1 ELSE 0 END) AS unlabelled
           FROM reports`,
      ).first();

      return json({
        note:
          "Reports from https://gudrodur.github.io/intl-is/. The database stores a runtime label " +
          "(browser family, major version, coarse platform), the engine version where the user agent " +
          "states one, the embedding app when the browser is an in-app one, the browser UI language as a " +
          "bare language code, the resolved locale, the check counts, " +
          "which checks failed, and Cloudflare's two-letter country. It never receives or stores the " +
          "full user agent, an IP address, a cookie or any visitor id. `said` is free text a reader " +
          "typed and is republished here verbatim. One row per runtime, typed name and verdict.",
        caveat:
          "`runtime` is what the browser reports and some cannot be told apart from the page at all " +
          "— Vivaldi is byte-identical to Chrome in the user agent, the brand list and the " +
          "high-entropy hints. `said` is a name the reader typed when the detection was wrong, and " +
          "is the more reliable of the two when present — but it is unverified self-report, nothing " +
          "checks it, and every distinct spelling is its own row, so read it as a hint and group by " +
          "hand rather than counting on it.",
        engineNote:
          "`engine` is the Chromium major read from the `Chrome/<major>` token every Chromium " +
          "browser carries, whatever it calls itself — so Opera's 101 and Samsung Internet's 30 " +
          "can be placed on the same axis as Chrome's 152. It is empty, never guessed, for Gecko " +
          "(whose `rv:` only repeats Firefox's own number) and for every iOS browser (which all " +
          "report the same frozen AppleWebKit build). Rows first seen before 2026-09-08 also read " +
          "empty and CANNOT be backfilled: the user agent is discarded before storage, so the " +
          "engine version of the reports this column was added to answer is gone. Those rows need " +
          "re-reporting, not repairing.",
        languageNote:
          "`language` is the browser's own UI language, primary subtag only — `is`, `en` — added " +
          "2026-09-08 to answer one question: two reports from the same Chrome 151 on Android " +
          "disagree about whether Icelandic is present, and no field recorded before that date " +
          "could say why. The ordered navigator.languages list is deliberately NOT collected; it " +
          "is close to a visitor id. Rows first seen before 2026-09-08 read empty and cannot be " +
          "backfilled, so the question is answered by NEW Android reports or not at all.",
        appNote:
          "`app` names the application an in-app browser is running inside — Messenger, Instagram, " +
          "TikTok — read from the tokens those apps append to the user agent. It is its own field " +
          "and not part of `runtime`, which says what is RENDERING: an in-app browser on Android is " +
          "`WebView`, a different APK from Chrome, and on iOS it is WebKit like everything else. " +
          "Empty means either an ordinary browser or an app whose token this hand-written table " +
          "does not know; it is never guessed. Added 2026-09-08 after a reader\'s Messenger report " +
          "was stored as plain `Chrome 151 / Android` — the user agent said MESSENGER and the " +
          "collector threw it away. Rows before that date read empty and cannot be backfilled.",
        iosNote:
          "Every `/ iOS` row measures Apple's WebKit whatever the browser name says — Apple requires " +
          "it — so `Firefox … / iOS` is not a Gecko result and `Chrome … / iOS` is not a Chromium one.",
        knownGap:
          "A row reading `other / iOS` from 2026-09-08 is a detection bug, not an unknown browser: " +
          "the Safari pattern required the word Safari immediately after the version and iOS puts a " +
          "build token in between, so every iPhone landed in `other` until it was fixed that day. " +
          "The affected row cannot be relabelled — the user agent is discarded before storage, so " +
          "nothing here can say whether it was Safari or Chrome on iOS, both of which are WebKit and " +
          "both of which pass. It is left as recorded rather than guessed at.",
        totals,
        runtimes: results,
      });
    }

    return json({ routes: ["POST /report", "GET /summary"] }, 404);
  },
};
