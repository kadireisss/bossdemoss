// api/track/index.js
export default async function handler(req, res) {
  try {
    const KV_URL = process.env.KV_REST_API_URL;
    const KV_TOKEN = process.env.KV_REST_API_TOKEN;

    if (!KV_URL || !KV_TOKEN) {
      return res.status(500).json({ ok: false, error: "KV env eksik" });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Yalnızca POST destekleniyor" });
    }

    let body = {};
    try {
      if (typeof req.body === "string") {
        body = JSON.parse(req.body || "{}");
      } else if (req.body && typeof req.body === "object") {
        body = req.body;
      } else {
        const chunks = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        const raw = Buffer.concat(chunks).toString("utf8");
        body = JSON.parse(raw || "{}");
      }
    } catch (e) {
      body = {};
    }

    const url = body.url || "";
    const referrer = body.referrer || "";
    const ua = body.ua || body.userAgent || "";

    const now = Date.now();

    const ip =
      (req.headers["x-real-ip"] ||
        (Array.isArray(req.headers["x-forwarded-for"])
          ? req.headers["x-forwarded-for"][0]
          : (req.headers["x-forwarded-for"] || "").split(",")[0]) ||
        req.socket?.remoteAddress ||
        "0.0.0.0").toString();

    const lowerUA = (ua || "").toLowerCase();
    let device = "Desktop";
    if (lowerUA.includes("mobile")) device = "Mobile";
    if (lowerUA.includes("tablet")) device = "Tablet";

    const country = req.headers["cf-ipcountry"] || "XX";

    const unique = Buffer.from(ip + ua).toString("base64");

    const headers = {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json",
    };

    // 1) ONLINE ZSET: her hit'te kullanıcının son aktivite zamanını güncelle
    await fetch(`${KV_URL}/zadd/online`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        score: now,
        member: unique,
      }),
    });

    // 2) TOTAL & TODAY COUNTERS
    const d = new Date(now);
    const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;

    await fetch(`${KV_URL}/incr/hits:total`, {
      method: "POST",
      headers,
    });

    await fetch(`${KV_URL}/incr/hits:day:${dayKey}`, {
      method: "POST",
      headers,
    });

    // 3) EVENT KAYDI
    const eventId = `${now}-${unique}`;

    const eventPayload = {
      time: new Date(now).toISOString(),
      ip,
      country,
      page: url,
      referrer,
      device,
      ua,
    };

    await fetch(`${KV_URL}/set/event:${encodeURIComponent(eventId)}`, {
      method: "POST",
      headers,
      body: JSON.stringify(eventPayload),
    });

    await fetch(`${KV_URL}/zadd/events`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        score: now,
        member: eventId,
      }),
    });

    // sadece son 500 event'i tut
    await fetch(`${KV_URL}/zremrangebyrank/events/0/-501`, {
      method: "POST",
      headers,
    });

    return res.status(200).json({
      ok: true,
      stored: {
        ip,
        country,
        url,
        referrer,
        device,
      },
    });
  } catch (err) {
    console.error("TRACK ERROR:", err);
    return res
      .status(500)
      .json({ ok: false, error: err?.message || "track error" });
  }
}
