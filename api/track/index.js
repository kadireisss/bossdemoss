// api/track/index.js

function getEnv() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    console.error("KV_REST_API_URL / KV_REST_API_TOKEN env tanımlı değil!");
  }
  return { url, token };
}

function parseDevice(ua = "") {
  const lower = ua.toLowerCase();
  if (lower.includes("mobile") || lower.includes("android") || lower.includes("iphone")) return "Mobile";
  if (lower.includes("tablet") || lower.includes("ipad")) return "Tablet";
  return "Desktop";
}

function formatDateLabel(d) {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hour = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return {
    dayKey: `${year}-${month}-${day}`,
    display: `${day}.${month}.${year} ${hour}:${min}`,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { url: KV_URL, token: KV_TOKEN } = getEnv();
  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ ok: false, error: "KV env eksik" });
  }

  const now = Date.now();
  const nowDate = new Date(now);
  const { dayKey, display } = formatDateLabel(nowDate);

  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["cf-connecting-ip"] ||
    req.socket.remoteAddress ||
    null;

  const ua = req.headers["user-agent"] || "";
  const device = parseDevice(ua);

  let body = {};
  if (req.method === "POST") {
    try {
      body = typeof req.body === "object" && req.body !== null ? req.body : {};
    } catch (e) {
      body = {};
    }
  }

  const page = body.url || req.headers["referer"] || null;
  const referrer = body.referrer || req.headers["referer"] || null;

  const sessionIdBase = `${ip || ""}|${ua}`;
  const sessionId = Buffer.from(sessionIdBase).toString("base64").slice(0, 32);
  const eventId = `${now}-${Math.random().toString(16).slice(2, 10)}`;

  const sessionKey = `session:${sessionId}`;
  const eventKey = `event:${eventId}`;
  const dayKeyTotal = `hits:day:${dayKey}`;

  const eventData = {
    time: display,
    ts: now,
    ip: ip || "-",
    country: (req.headers["cf-ipcountry"] || "XX").toString(),
    page: page || "-",
    referrer: referrer || "",
    device,
  };

  const sessionData = {
    sessionId,
    ip: eventData.ip,
    country: eventData.country,
    ua,
    lastPage: eventData.page,
    lastReferrer: eventData.referrer,
    device,
    lastSeen: now,
  };

  const headers = {
    Authorization: `Bearer ${KV_TOKEN}`,
    "Content-Type": "application/json",
  };

  try {
    await Promise.all([
      fetch(`${KV_URL}/set/${encodeURIComponent(sessionKey)}`, {
        method: "POST",
        headers,
        body: JSON.stringify(sessionData),
      }),
      fetch(`${KV_URL}/set/${encodeURIComponent(eventKey)}`, {
        method: "POST",
        headers,
        body: JSON.stringify(eventData),
      }),
      fetch(`${KV_URL}/zadd/online`, {
        method: "POST",
        headers,
        body: JSON.stringify({ score: now, member: sessionId }),
      }),
      fetch(`${KV_URL}/zadd/events`, {
        method: "POST",
        headers,
        body: JSON.stringify({ score: now, member: eventId }),
      }),
      fetch(`${KV_URL}/incr/hits:total`, {
        method: "POST",
        headers,
      }),
      fetch(`${KV_URL}/incr/${encodeURIComponent(dayKeyTotal)}`, {
        method: "POST",
        headers,
      }),
    ]);
  } catch (e) {
    console.error("KV/Upstash track error:", e);
  }

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      mode: "live",
      message: "Track endpoint çalışıyor (GET).",
      ip,
    });
  }

  return res.status(200).json({
    ok: true,
    mode: "live",
  });
}
