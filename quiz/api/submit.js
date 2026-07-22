/*
 * Vercel Serverless Function: /api/submit  (піддомен квізу)
 *
 * Приймає відповіді опитування і надсилає їх у Telegram.
 * Повністю автономна від основного сайту: власний проєкт Vercel,
 * власні змінні середовища. Токен бота в браузер не потрапляє.
 *
 * Змінні (Vercel → Settings → Environment Variables):
 *   TELEGRAM_BOT_TOKEN  — токен від @BotFather
 *   TELEGRAM_CHAT_ID    — id чату для заявок
 *   QUIZ_NAME           — необов'язково, підпис у повідомленні
 */

const esc = s =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const recent = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 4;

function rateLimited(ip) {
  const now = Date.now();
  const hits = (recent.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);
  if (recent.size > 500) recent.clear();
  return hits.length > RATE_MAX;
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return res.status(500).json({ error: "not configured" });

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

    // Пастка для ботів + мінімальний час заповнення
    if (body.website) return res.status(200).json({ ok: true });
    if (typeof body.elapsed === "number" && body.elapsed < 3000) {
      return res.status(200).json({ ok: true });
    }

    const c = body.contact || {};
    const name = String(c.name || "").trim().slice(0, 200);
    const phone = String(c.phone || "").trim().slice(0, 100);
    const telegram = String(c.telegram || "").trim().slice(0, 100);
    const business = String(c.business || "").trim().slice(0, 200);
    if (!name || !phone) return res.status(400).json({ error: "name and phone required" });

    const answers = Array.isArray(body.answers) ? body.answers.slice(0, 30) : [];

    const quizName = process.env.QUIZ_NAME || "Опитування підписників";
    const when = new Date().toLocaleString("uk-UA", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
      timeZone: "Europe/Kyiv"
    });

    const lines = [
      "📋 <b>НОВЕ ОПИТУВАННЯ</b>",
      "🎯 <b>" + esc(quizName) + "</b>",
      "━━━━━━━━━━━━━━━━━━━━",
      "",
      "👤 <b>Контакт</b>",
      "• Ім'я: " + esc(name),
      "• Телефон: " + esc(phone)
    ];
    if (telegram) lines.push("• Telegram: " + esc(telegram));
    if (business) lines.push("• Бізнес: " + esc(business));

    if (answers.length) {
      lines.push("", "━━━━━━━━━━━━━━━━━━━━", "📝 <b>Відповіді</b>", "");
      answers.forEach((item, i) => {
        const q = String(item && item.q || "").trim().slice(0, 300);
        const a = String(item && item.a || "").trim().slice(0, 1500);
        if (!q || !a) return;
        lines.push("<b>" + (i + 1) + ". " + esc(q) + "</b>", esc(a), "");
      });
    }

    lines.push("━━━━━━━━━━━━━━━━━━━━", "🕒 " + esc(when) + " (Київ)");

    const tg = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join("\n"),
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });
    const data = await tg.json();
    if (!data.ok) throw new Error(data.description || "telegram error");

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "failed to send" });
  }
};
