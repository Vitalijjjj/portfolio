# Edge Function `lead` — приховати токен бота

Зараз форма шле заявки **напряму** в Telegram Bot API, тому токен бота видно у коді сторінки (`site/js/leads-config.js`). Це працює, але сторонні можуть узяти токен і слати повідомлення від імені бота у ваш чат.

Ця функція прибирає токен із браузера: сайт шле заявку на функцію, функція — у Telegram.

## Деплой (одноразово, ~5 хв)

```bash
# 1. CLI (якщо ще немає)
brew install supabase/tap/supabase

# 2. Логін і прив'язка до проєкту
supabase login
supabase link --project-ref ivftuywiuaewbkubfhjb

# 3. Секрети (у браузер не потрапляють)
supabase secrets set \
  TELEGRAM_BOT_TOKEN='***REMOVED***' \
  TELEGRAM_CHAT_ID='-5289373638' \
  SITE_NAME='gural.digital' \
  ALLOWED_ORIGINS='https://ваш-домен.com'

# 4. Деплой без перевірки JWT (форму заповнюють неавторизовані відвідувачі)
supabase functions deploy lead --no-verify-jwt
```

## Перемкнути сайт на функцію

У `site/js/leads-config.js` вписати URL функції і **очистити токен**:

```js
window.LEADS_CONFIG = {
  proxyUrl: "https://ivftuywiuaewbkubfhjb.supabase.co/functions/v1/lead",
  botToken: "",
  chatId: "",
  siteName: "gural.digital"
};
```

Коли `proxyUrl` заповнений — використовується він, `botToken` ігнорується.

## Після перемикання

Обов'язково **перевипустіть токен** у [@BotFather](https://t.me/BotFather) (`/revoke` → `/token`) і пропишіть новий у секрети функції — старий токен уже засвітився в публічному коді сайту.

## Перевірка

```bash
curl -X POST https://ivftuywiuaewbkubfhjb.supabase.co/functions/v1/lead \
  -H "Content-Type: application/json" \
  -d '{"name":"Тест","contact":"@test","message":"перевірка","page":"https://ваш-домен.com/"}'
```

У чат «Лід-форма» має прийти повідомлення.
