/*
 * Service layer для кейсів.
 *
 * Режими:
 *  - "supabase" — коли в supabase-config.js заповнені url + anonKey.
 *      Читання на публічній сторінці йде через REST (без SDK),
 *      адмінка використовує повний SDK (auth + storage) з js/vendor/supabase.js.
 *  - "demo" — Supabase не налаштований: дані живуть у localStorage,
 *      файли зберігаються як data:URL. Дозволяє користуватись адмінкою
 *      і бачити результат на сайті в цьому ж браузері.
 *
 * Обидва драйвери реалізують однаковий інтерфейс (window.CasesService).
 */

(function () {
  const cfg = window.SUPABASE_CONFIG || {};
  const configured = !!(cfg.url && cfg.anonKey);

  const BUCKET = "case-media";

  const LIMITS = {
    imageTypes: ["image/jpeg", "image/png", "image/webp"],
    videoTypes: ["video/mp4", "video/webm"],
    imageMaxMB: configured ? 8 : 1.5,
    videoMaxMB: configured ? 60 : 2.5
  };

  /* ---------- Стартові дані (fallback + сід демо-режиму) ---------- */

  const SEED_TIME = "2026-07-20T00:00:00.000Z";
  const FALLBACK_CASES = [
    {
      id: "fuhrmannsoft",
      title: "fuhrmannsoft.com",
      description: "Дизайн і розробка сайту: від структури та макета до анімацій і запуску",
      websiteUrl: "https://www.fuhrmannsoft.com/",
      imageUrl: "/images/fuh-poster.jpg",
      videoUrl: "/media/fuh-demo.mp4",
      category: "websites",
      orderIndex: 1,
      status: "published",
      openInNewTab: true,
      createdAt: SEED_TIME,
      updatedAt: SEED_TIME
    },
    {
      id: "bluepillstudios",
      title: "bluepillstudios.com",
      description: "Дизайн і розробка сайту: від структури та макета до анімацій і запуску",
      websiteUrl: "https://www.bluepillstudios.com/",
      imageUrl: "/images/68971152cba5d4586c0c196a_duccik-image.webp",
      videoUrl: null,
      category: "websites",
      orderIndex: 2,
      status: "published",
      openInNewTab: true,
      createdAt: SEED_TIME,
      updatedAt: SEED_TIME
    },
    {
      id: "europeangranite",
      title: "europeangranitellc.com",
      description: "Дизайн і розробка сайту: від структури та макета до анімацій і запуску",
      websiteUrl: "https://www.europeangranitellc.com/",
      imageUrl: "/images/689711523762f2f611246672_granite-image.webp",
      videoUrl: null,
      category: "websites",
      orderIndex: 3,
      status: "published",
      openInNewTab: true,
      createdAt: SEED_TIME,
      updatedAt: SEED_TIME
    },
    {
      id: "bruitbrothers",
      title: "bruitbrothers.com",
      description: "Дизайн і розробка сайту: від структури та макета до анімацій і запуску",
      websiteUrl: "https://www.bruitbrothers.com/",
      imageUrl: "/images/68971152916faa50ee175c3e_bruit-image.webp",
      videoUrl: null,
      category: "websites",
      orderIndex: 4,
      status: "published",
      openInNewTab: true,
      createdAt: SEED_TIME,
      updatedAt: SEED_TIME
    },
    {
      id: "beyondxp",
      title: "beyondxp.in",
      description: "Дизайн і розробка сайту: від структури та макета до анімацій і запуску",
      websiteUrl: "https://www.beyondxp.in/",
      imageUrl: "/images/68971152ce3c415a9cd461b2_beyond-image.webp",
      videoUrl: null,
      category: "ecommerce",
      orderIndex: 1,
      status: "published",
      openInNewTab: true,
      createdAt: SEED_TIME,
      updatedAt: SEED_TIME
    },
    {
      id: "designer-diary",
      title: "Designer Diary",
      description: "Дизайн і розробка сайту: від структури та макета до анімацій і запуску",
      websiteUrl: "https://community.sivuo.com/dd",
      imageUrl: "/images/68deef74c00b66148e78481a_dd-cover.png",
      videoUrl: null,
      category: "ai-site",
      orderIndex: 1,
      status: "published",
      openInNewTab: true,
      createdAt: SEED_TIME,
      updatedAt: SEED_TIME
    }
  ];

  function validateFile(file, kind) {
    const types = kind === "image" ? LIMITS.imageTypes : LIMITS.videoTypes;
    const maxMB = kind === "image" ? LIMITS.imageMaxMB : LIMITS.videoMaxMB;
    if (!types.includes(file.type)) {
      throw new Error(
        kind === "image"
          ? "Дозволені формати зображення: JPG, PNG, WEBP."
          : "Дозволені формати відео: MP4, WEBM."
      );
    }
    if (file.size > maxMB * 1024 * 1024) {
      throw new Error(
        `Файл завеликий (макс. ${maxMB} МБ${configured ? "" : " у демо-режимі"}).`
      );
    }
  }

  /* ==================== ДЕМО-ДРАЙВЕР (localStorage) ==================== */

  const DEMO_KEY = "dd-cases";
  const DEMO_SESSION_KEY = "dd-admin-session";
  const DEMO_EMAIL = "admin@demo.local";
  const DEMO_PASSWORD = "admin123";

  function demoAll() {
    try {
      const raw = localStorage.getItem(DEMO_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* пошкоджені дані — почнемо з сіда */ }
    return FALLBACK_CASES.map(c => ({ ...c }));
  }

  function demoSave(list) {
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify(list));
    } catch (e) {
      throw new Error("Сховище браузера переповнене. Видаліть великі медіафайли або підключіть Supabase.");
    }
  }

  const demoDriver = {
    mode: "demo",

    async listPublished() {
      return demoAll()
        .filter(c => c.status === "published")
        .sort((a, b) => a.orderIndex - b.orderIndex);
    },

    async listAll() {
      return demoAll().sort((a, b) =>
        a.category === b.category ? a.orderIndex - b.orderIndex : a.category.localeCompare(b.category)
      );
    },

    async getById(id) {
      return demoAll().find(c => c.id === id) || null;
    },

    async create(data) {
      const list = demoAll();
      const now = new Date().toISOString();
      const item = { ...data, id: "case-" + Date.now(), createdAt: now, updatedAt: now };
      list.push(item);
      demoSave(list);
      return item;
    },

    async update(id, patch) {
      const list = demoAll();
      const i = list.findIndex(c => c.id === id);
      if (i === -1) throw new Error("Кейс не знайдено.");
      list[i] = { ...list[i], ...patch, updatedAt: new Date().toISOString() };
      demoSave(list);
      return list[i];
    },

    async remove(id) {
      demoSave(demoAll().filter(c => c.id !== id));
    },

    async saveOrder(pairs) {
      const list = demoAll();
      pairs.forEach(p => {
        const item = list.find(c => c.id === p.id);
        if (item) item.orderIndex = p.orderIndex;
      });
      demoSave(list);
    },

    uploadFile(file, kind, onProgress) {
      return new Promise((resolve, reject) => {
        try { validateFile(file, kind); } catch (e) { return reject(e); }
        const reader = new FileReader();
        reader.onprogress = e => {
          if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
        };
        reader.onerror = () => reject(new Error("Не вдалося прочитати файл."));
        reader.onload = () => {
          if (onProgress) onProgress(100);
          resolve(String(reader.result));
        };
        reader.readAsDataURL(file);
      });
    },

    async deleteFileByUrl() { /* data:URL живуть усередині запису — нічого чистити */ },

    async signIn(email, password) {
      await new Promise(r => setTimeout(r, 300));
      if (password !== DEMO_PASSWORD) throw new Error("Невірний email або пароль.");
      const session = { email: email || DEMO_EMAIL, demo: true };
      localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
      return session;
    },

    async signOut() {
      localStorage.removeItem(DEMO_SESSION_KEY);
    },

    async getSession() {
      try {
        return JSON.parse(localStorage.getItem(DEMO_SESSION_KEY));
      } catch (e) {
        return null;
      }
    },

    onAuthChange() { /* демо-режим: сесія перевіряється при завантаженні */ }
  };

  /* ==================== SUPABASE-ДРАЙВЕР ==================== */

  let client = null;

  function ensureClient() {
    if (client) return client;
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("Supabase SDK не завантажено (js/vendor/supabase.js).");
    }
    client = window.supabase.createClient(cfg.url, cfg.anonKey);
    return client;
  }

  const fromRow = r => ({
    id: r.id,
    title: r.title,
    description: r.description,
    websiteUrl: r.website_url,
    imageUrl: r.image_url,
    videoUrl: r.video_url,
    category: r.category,
    orderIndex: r.order_index,
    status: r.status,
    openInNewTab: r.open_in_new_tab,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  });

  const toRow = c => ({
    title: c.title,
    description: c.description,
    website_url: c.websiteUrl,
    image_url: c.imageUrl,
    video_url: c.videoUrl || null,
    category: c.category,
    order_index: c.orderIndex,
    status: c.status,
    open_in_new_tab: !!c.openInNewTab
  });

  function storagePathFromUrl(url) {
    const marker = "/storage/v1/object/public/" + BUCKET + "/";
    const i = (url || "").indexOf(marker);
    return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length));
  }

  function xhrPut(url, file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.upload.onprogress = e => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error("Помилка завантаження (HTTP " + xhr.status + ")."));
      xhr.onerror = () => reject(new Error("Мережева помилка під час завантаження."));
      xhr.send(file);
    });
  }

  const supabaseDriver = {
    mode: "supabase",

    // Публічне читання без SDK — звичайний REST-запит під RLS-політикою
    async listPublished() {
      const res = await fetch(
        cfg.url + "/rest/v1/cases?select=*&status=eq.published&order=order_index.asc",
        { headers: { apikey: cfg.anonKey, Authorization: "Bearer " + cfg.anonKey } }
      );
      if (!res.ok) throw new Error("HTTP " + res.status);
      return (await res.json()).map(fromRow);
    },

    async listAll() {
      const { data, error } = await ensureClient()
        .from("cases")
        .select("*")
        .order("category", { ascending: true })
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data.map(fromRow);
    },

    async getById(id) {
      const { data, error } = await ensureClient().from("cases").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? fromRow(data) : null;
    },

    async create(data) {
      const { data: row, error } = await ensureClient().from("cases").insert(toRow(data)).select().single();
      if (error) throw error;
      return fromRow(row);
    },

    async update(id, patch) {
      const row = {};
      const full = toRow(patch);
      Object.keys(full).forEach(k => {
        const camel = { website_url: "websiteUrl", image_url: "imageUrl", video_url: "videoUrl", order_index: "orderIndex", open_in_new_tab: "openInNewTab" }[k] || k;
        if (camel in patch) row[k] = full[k];
      });
      const { data: updated, error } = await ensureClient().from("cases").update(row).eq("id", id).select().single();
      if (error) throw error;
      return fromRow(updated);
    },

    async remove(id) {
      const { error } = await ensureClient().from("cases").delete().eq("id", id);
      if (error) throw error;
    },

    async saveOrder(pairs) {
      const c = ensureClient();
      const results = await Promise.all(
        pairs.map(p => c.from("cases").update({ order_index: p.orderIndex }).eq("id", p.id))
      );
      const failed = results.find(r => r.error);
      if (failed) throw failed.error;
    },

    async uploadFile(file, kind, onProgress) {
      validateFile(file, kind);
      const c = ensureClient();
      const safe = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
      const path = kind + "/" + Date.now() + "-" + safe;

      const { data: signed, error: signErr } = await c.storage.from(BUCKET).createSignedUploadUrl(path);
      if (!signErr && signed && signed.signedUrl) {
        await xhrPut(signed.signedUrl, file, onProgress);
      } else {
        const { error } = await c.storage.from(BUCKET).upload(path, file, { contentType: file.type });
        if (error) throw error;
        if (onProgress) onProgress(100);
      }
      const { data: pub } = c.storage.from(BUCKET).getPublicUrl(path);
      return pub.publicUrl;
    },

    async deleteFileByUrl(url) {
      const path = storagePathFromUrl(url);
      if (!path) return; // сторонній або локальний файл — не чіпаємо
      await ensureClient().storage.from(BUCKET).remove([path]);
    },

    async signIn(email, password) {
      const { data, error } = await ensureClient().auth.signInWithPassword({ email, password });
      if (error) throw new Error("Невірний email або пароль.");
      return { email: data.user.email };
    },

    async signOut() {
      await ensureClient().auth.signOut();
    },

    async getSession() {
      const { data } = await ensureClient().auth.getSession();
      return data.session ? { email: data.session.user.email } : null;
    },

    onAuthChange(cb) {
      ensureClient().auth.onAuthStateChange((_e, session) =>
        cb(session ? { email: session.user.email } : null)
      );
    }
  };

  window.CasesService = configured ? supabaseDriver : demoDriver;
  window.CasesService.limits = LIMITS;
  window.CasesService.demoCredentials = configured ? null : { email: DEMO_EMAIL, password: DEMO_PASSWORD };
  window.FALLBACK_CASES = FALLBACK_CASES;
})();
