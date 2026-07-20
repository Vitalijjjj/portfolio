// Supabase Edge Function: приймає заявку з сайту і шле її в Telegram.
// Токен бота живе в секретах функції, у браузер не потрапляє.
//
// Деплой і налаштування — див. supabase/functions/README.md

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";
const SITE_NAME = Deno.env.get("SITE_NAME") ?? "gural.digital";
// Кому дозволено викликати функцію (через кому). "*" — усім.
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "*").split(",").map(s => s.trim());

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function corsHeaders(origin: string | null) {
  const allow = ALLOWED_ORIGINS.includes("*")
    ? "*"
    : (origin && ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] ?? ""));
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "content-type, authorization, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}

Deno.serve(async req => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" }
    });
  }

  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim().slice(0, 200);
    const contact = String(body.contact ?? "").trim().slice(0, 200);
    const message = String(body.message ?? "").trim().slice(0, 2000);
    const page = String(body.page ?? "").trim().slice(0, 500);

    if (!name || !contact) {
      return new Response(JSON.stringify({ error: "name and contact are required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    const when = new Date().toLocaleString("uk-UA", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
      timeZone: "Europe/Kyiv"
    });

    const lines = [
      "🟢 <b>НОВА ЗАЯВКА З САЙТУ</b>",
      `🌐 Портфоліо · <b>${esc(SITE_NAME)}</b>`,
      "━━━━━━━━━━━━━━━━━━━━",
      "",
      "👤 <b>Ім'я</b>",
      esc(name),
      "",
      "📞 <b>Контакт</b>",
      esc(contact)
    ];
    if (message) lines.push("", "💬 <b>Про проєкт</b>", esc(message));
    lines.push("", "━━━━━━━━━━━━━━━━━━━━", `🕒 ${esc(when)} (Київ)`);
    if (page) lines.push(`🔗 <a href="${esc(page)}">Сторінка заявки</a>`);

    const tg = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: lines.join("\n"),
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });
    const data = await tg.json();
    if (!data.ok) throw new Error(data.description ?? "telegram error");

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });
  } catch (_err) {
    return new Response(JSON.stringify({ error: "failed to send" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" }
    });
  }
});
