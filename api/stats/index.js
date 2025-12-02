// api/stats/index.js

function getEnv() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    console.error("KV_REST_API_URL / KV_REST_API_TOKEN env tanımlı değil!");
  }
  return { url, token };
}

async function kvGetJSON(url, headers) {
  try {
    const r = await fetch(url, { headers });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    console.error("kvGetJSON error:", e);
    return null;
  }
}

function parseNumberLike(v) {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    if (!Number.isNaN(n)) return n;
  }
  if (typeof v === "object" && v !== null) {
    if (v.result != null) return parseNumberLike(v.result);
    if (v.value != null) return parseNumberLike(v.value);
  }
  return 0;
}

function formatDayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function labelFromDayKey(dayKey) {
  const [y, m, d] = dayKey.split("-");
  return `${d}.${m}`;
}

export default async function handler(req, res) {
  const { url: KV_URL, token: KV_TOKEN } = getEnv();
  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ ok: false, error: "KV env eksik" });
  }

  const headers = {
    Authorization: `Bearer ${KV_TOKEN}`,
  };

  const now = Date.now();
  const nowDate = new Date(now);

  const totalJson = await kvGetJSON(`${KV_URL}/get/hits:total`, headers);
  const totalVisitors = parseNumberLike(totalJson);

  const todayKey = formatDayKey(nowDate);
  const todayJson = await kvGetJSON(`${KV_URL}/get/hits:day:${todayKey}`, headers);
  const todayVisitors = parseNumberLike(todayJson);

  const ONLINE_WINDOW = 5 * 60 * 1000;
  try {
    await fetch(`${KV_URL}/zremrangebyscore/online/0/${now - ONLINE_WINDOW}`, {
      method: "POST",
      headers,
    });
  } catch (e) {
    console.error("zremrangebyscore error:", e);
  }

  let onlineIds = [];
  try {
    const onlineJson = await kvGetJSON(`${KV_URL}/zrange/online/0/-1`, headers);
    if (Array.isArray(onlineJson)) {
      onlineIds = onlineJson;
    } else if (onlineJson && Array.isArray(onlineJson.result)) {
      onlineIds = onlineJson.result;
    }
  } catch (e) {
    console.error("online zrange error:", e);
  }

  const onlineNow = onlineIds.length;

  const eventsLimit = 50;
  let eventIds = [];
  try {
    const evJson = await kvGetJSON(`${KV_URL}/zrevrange/events/0/${eventsLimit - 1}`, headers);
    if (Array.isArray(evJson)) {
      eventIds = evJson;
    } else if (evJson && Array.isArray(evJson.result)) {
      eventIds = evJson.result;
    }
  } catch (e) {
    console.error("events zrevrange error:", e);
  }

  const events = [];
  for (const id of eventIds) {
    try {
      const eJson = await kvGetJSON(`${KV_URL}/get/event:${encodeURIComponent(id)}`, headers);
      if (!eJson) continue;
      const ev = typeof eJson === "object" ? eJson : null;
      if (!ev) continue;
      events.push({
        time: ev.time || "",
        ip: ev.ip || "-",
        country: ev.country || "XX",
        page: ev.page || "-",
        referrer: ev.referrer || "",
        device: ev.device || "?",
      });
    } catch (e) {
      console.error("event get error:", e);
    }
  }

  const chartLabels = [];
  const chartValues = [];
  const dayHits = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(nowDate);
    d.setDate(d.getDate() - i);
    const key = formatDayKey(d);
    dayHits[key] = 0;
  }

  const dayKeys = Object.keys(dayHits);
  const promises = dayKeys.map((dk) =>
    kvGetJSON(`${KV_URL}/get/hits:day:${dk}`, headers)
  );
  const results = await Promise.all(promises);
  results.forEach((r, idx) => {
    const dk = dayKeys[idx];
    dayHits[dk] = parseNumberLike(r);
  });

  let bestDayKey = null;
  let bestDayCount = 0;
  for (const dk of dayKeys) {
    const v = dayHits[dk] || 0;
    chartLabels.push(labelFromDayKey(dk));
    chartValues.push(v);
    if (v > bestDayCount) {
      bestDayCount = v;
      bestDayKey = dk;
    }
  }

  let bestDayLabel = "-";
  if (bestDayKey) {
    const [y, m, d] = bestDayKey.split("-");
    bestDayLabel = `${d}.${m}.${y}`;
  }

  const totalHitsInRange = chartValues.reduce((a, b) => a + b, 0);
  const avgSessionPages =
    todayVisitors > 0 ? Math.max(1, (totalHitsInRange / Math.max(todayVisitors, 1)) / 2) : 2.5;
  const bounceRate = 40;
  const bestHour = "21:00 - 23:00";

  const yesterdayKeyDate = new Date(nowDate);
  yesterdayKeyDate.setDate(yesterdayKeyDate.getDate() - 1);
  const yesterdayKey = formatDayKey(yesterdayKeyDate);
  const yesterdayJson = await kvGetJSON(`${KV_URL}/get/hits:day:${yesterdayKey}`, headers);
  const yesterdayVisitors = parseNumberLike(yesterdayJson);
  let totalChangeLabel = "-";
  if (yesterdayVisitors > 0) {
    const diff = todayVisitors - yesterdayVisitors;
    const perc = (diff / yesterdayVisitors) * 100;
    const sign = diff >= 0 ? "+" : "-";
    totalChangeLabel = `${sign}${Math.abs(perc).toFixed(1)}% vs dün`;
  } else if (todayVisitors > 0) {
    totalChangeLabel = "+∞% vs dün";
  }

  return res.status(200).json({
    summary: {
      totalVisitors,
      todayVisitors,
      onlineNow,
      avgSessionPages: Number(avgSessionPages.toFixed(1)),
      bounceRate,
      bestDay: bestDayLabel,
      bestHour,
      totalChangeLabel,
    },
    chart: {
      labels: chartLabels,
      values: chartValues,
    },
    events,
  });
}
