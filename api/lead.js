/*
 * Vercel Serverless Function: /api/lead
 *
 * Приймає заявку з форми і надсилає її в Telegram.
 * Токен бота живе в змінних середовища Vercel — у браузер не потрапляє.
 *
 * Змінні (Vercel → Settings → Environment Variables):
 *   TELEGRAM_BOT_TOKEN  — токен від @BotFather
 *   TELEGRAM_CHAT_ID    — id чату (у нас -5289373638)
 *   SITE_NAME           — необов'язково, підпис у повідомленні
 */

const esc = s =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// Проста пам'ять між викликами одного інстансу: гальмує потоковий спам.
const recent = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 3;

function rateLimited(ip) {
  const now = Date.now();
  const hits = (recent.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);
  if (recent.size > 500) recent.clear(); // не даємо мапі рости нескінченно
  return hits.length > RATE_MAX;
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return res.status(500).json({ error: "not configured" });

  // Приймаємо запити лише зі свого сайту — чужі сторінки не зможуть слати заявки
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

    // Пастка для ботів: поле сховане від людей, автозаповнювачі його заповнюють
    if (body.website) return res.status(200).json({ ok: true });

    // Людина не заповнить форму за 2 секунди
    if (typeof body.elapsed === "number" && body.elapsed < 2000) {
      return res.status(200).json({ ok: true });
    }

    const name = String(body.name || "").trim().slice(0, 200);
    const contact = String(body.contact || "").trim().slice(0, 200);
    const message = String(body.message || "").trim().slice(0, 2000);
    const page = String(body.page || "").trim().slice(0, 500);
    if (!name || !contact) return res.status(400).json({ error: "name and contact required" });

    const siteName = process.env.SITE_NAME || host || "портфоліо";
    const when = new Date().toLocaleString("uk-UA", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
      timeZone: "Europe/Kyiv"
    });

    const lines = [
      "🟢 <b>НОВА ЗАЯВКА З САЙТУ</b>",
      "🌐 Портфоліо · <b>" + esc(siteName) + "</b>",
      "━━━━━━━━━━━━━━━━━━━━",
      "",
      "👤 <b>Ім'я</b>",
      esc(name),
      "",
      "📞 <b>Контакт</b>",
      esc(contact)
    ];
    if (message) lines.push("", "💬 <b>Про проєкт</b>", esc(message));
    lines.push("", "━━━━━━━━━━━━━━━━━━━━", "🕒 " + esc(when) + " (Київ)");
    if (page) lines.push('🔗 <a href="' + esc(page) + '">Сторінка заявки</a>');

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
