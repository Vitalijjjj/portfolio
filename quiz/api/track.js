/*
 * Vercel Serverless Function: /api/track  (піддомен квізу)
 *
 * Прогресивне автозбереження відповідей у Google-таблицю.
 * Викликається на КОЖНУ відповідь (навіть якщо людина не завершила квіз)
 * та «маячком» під час закриття вкладки.
 *
 * Пересилає запис у Google Apps Script web app, який пише рядок у таблицю
 * (upsert за полем session). URL веб-застосунку — у змінній середовища,
 * у браузер не потрапляє.
 *
 * Змінна (Vercel → Settings → Environment Variables):
 *   GOOGLE_SHEET_WEBAPP_URL — /exec-URL розгорнутого Apps Script
 */

const recent = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 60; // автозбереження шле часто — ліміт вищий

function rateLimited(ip) {
  const now = Date.now();
  const hits = (recent.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);
  if (recent.size > 1000) recent.clear();
  return hits.length > RATE_MAX;
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const url = process.env.GOOGLE_SHEET_WEBAPP_URL;
  // Ще не налаштовано — тихо ігноруємо, щоб квіз працював без помилок
  if (!url) return res.status(200).json({ ok: true, skipped: "not configured" });

  // Лише зі свого піддомену
  const host = req.headers.host || "";
  const origin = req.headers.origin || "";
  if (origin && host && !origin.endsWith(host)) {
    return res.status(403).json({ error: "forbidden origin" });
  }

  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  if (rateLimited(ip)) return res.status(429).json({ error: "too many requests" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    if (!body || !body.session) return res.status(400).json({ error: "session required" });

    // Обрізаємо значення, щоб не залити таблицю сміттям
    const clean = { session: String(body.session).slice(0, 80) };
    Object.keys(body).forEach(k => {
      if (k === "session") return;
      clean[k] = typeof body[k] === "string" ? body[k].slice(0, 2000) : body[k];
    });

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    let ok = false;
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clean),
        redirect: "follow",
        signal: controller.signal
      });
      ok = r.ok;
    } finally {
      clearTimeout(t);
    }

    return res.status(200).json({ ok });
  } catch (err) {
    // Не валимо автозбереження — повертаємо 200, щоб клієнт не спамив ретраями
    return res.status(200).json({ ok: false });
  }
};
