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
const FAMILIES: Array<[string, RegExp]> = [
  ["Vivaldi", /Vivaldi\/(\d+)/],
  ["Edge", /Edg(?:e|A|iOS)?\/(\d+)/],
  ["Opera", /OPR\/(\d+)/],
  ["Samsung Internet", /SamsungBrowser\/(\d+)/],
  ["Firefox", /Firefox\/(\d+)/],
  ["Chrome", /Chrome\/(\d+)/],
  ["Safari", /Version\/(\d+)[.\d]* Safari/],
  ["Node", /node\.js\/v?(\d+)/i],
];

const PLATFORMS: Array<[string, RegExp]> = [
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
// Some browsers cannot be told apart from the client side at all. Measured
// 2026-09-08: Vivaldi 8.2.4 sends Chrome's user agent verbatim, reports "Google
// Chrome" in navigator.userAgentData.brands, AND in the high-entropy
// fullVersionList — the only difference is the patch build (…112 vs …82), which
// identifies a build and not a browser. So detection cannot do it, and the page
// asks instead: `said` below is a name the reader typed. That is better data
// than any sniffing would produce, because the reader knows the answer.
function runtimeLabel(userAgent: string): string {
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

      // Optional, typed by the reader when the detected label is wrong. Same
      // treatment as everything else from a stranger: printable ASCII, short.
      // Empty string, never null: the UNIQUE constraint below counts NULLs as
      // distinct from each other, so a null here would switch off deduplication
      // for every report that does not carry a name — which is most of them.
      const said =
        typeof body.said === "string"
          ? body.said.replace(/[^\x20-\x7E]/g, "").slice(0, 40).trim()
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
        `INSERT OR IGNORE INTO reports (first_seen, runtime, said, resolved, checked, broken, failing, country)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          new Date().toISOString().slice(0, 10),
          runtimeLabel(rawAgent),
          said,
          resolved,
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
        stored: { runtime: runtimeLabel(rawAgent), said: said || null, resolved, checked, broken },
      });
    }

    if (url.pathname === "/summary" && request.method === "GET") {
      const { results } = await env.DB.prepare(
        `SELECT runtime, said, resolved, checked, broken, failing, MIN(first_seen) AS since
           FROM reports
          GROUP BY runtime, said, resolved, checked, broken
          ORDER BY runtime, said`,
      ).all();

      const totals = await env.DB.prepare(
        `SELECT COUNT(*) AS rows, COUNT(DISTINCT runtime) AS runtimes,
                SUM(CASE WHEN broken = 0 THEN 1 ELSE 0 END) AS passing
           FROM reports`,
      ).first();

      return json({
        note:
          "Reports from https://gudrodur.github.io/intl-is/. The database stores a runtime label " +
          "(browser family, major version, coarse platform), the resolved locale, the check counts, " +
          "which checks failed, and Cloudflare's two-letter country. It never receives or stores the " +
          "full user agent, an IP address, a cookie or any visitor id. One row per runtime and verdict.",
        caveat:
          "`runtime` is what the browser reports and some cannot be told apart from the page at all " +
          "— Vivaldi is byte-identical to Chrome in the user agent, the brand list and the " +
          "high-entropy hints. `said` is a name the reader typed when the detection was wrong, and " +
          "is the more reliable of the two when present.",
        totals,
        runtimes: results,
      });
    }

    return json({ routes: ["POST /report", "GET /summary"] }, 404);
  },
};
