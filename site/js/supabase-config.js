/*
 * Публічні налаштування Supabase.
 * Значення беруться з Supabase Dashboard → Settings → API
 * (див. .env.example у корені репозиторію).
 *
 * anon key — публічний ключ за дизайном: доступ до даних обмежують
 * RLS-політики на боці Supabase (див. supabase/schema.sql).
 * Секретні ключі (service_role) сюди класти НЕ МОЖНА.
 *
 * Якщо залишити поля порожніми — сайт і адмінка працюють у демо-режимі:
 * дані зберігаються в localStorage браузера.
 */
window.SUPABASE_CONFIG = {
  url: "https://ivftuywiuaewbkubfhjb.supabase.co",
  anonKey: "sb_publishable_f-OR26qWhxW2pg6PRj_frQ_mN3AEUgP"
};
