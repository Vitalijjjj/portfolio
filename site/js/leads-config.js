/*
 * Куди надсилати заявки з форми.
 *
 * Заявки йдуть на серверну функцію /api/lead (Vercel), яка вже сама
 * звертається до Telegram. Токен бота зберігається у змінних середовища
 * Vercel і в браузер не потрапляє — з коду сайту його не видно.
 *
 * Налаштування токена: Vercel → Settings → Environment Variables
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, SITE_NAME
 *
 * Локально (python -m http.server) функції немає, тому форма покаже помилку —
 * це нормально, перевіряти відправку треба на задеплоєному сайті або через
 * `vercel dev`.
 */
window.LEADS_CONFIG = {
  endpoint: "/api/lead"
};
