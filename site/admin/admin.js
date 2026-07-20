/* ============ Адмінка кейсів ============ */

(function () {
  const S = window.CasesService;

  const CATEGORY_LABELS = {
    websites: "Сайти",
    ecommerce: "Інтернет-магазини",
    "ai-site": "Сайти за 200€"
  };

  const $ = id => document.getElementById(id);

  const views = {
    login: $("view-login"),
    list: $("view-list"),
    editor: $("view-editor")
  };

  let cases = [];
  let editingId = null;
  let formMedia = { imageUrl: "", videoUrl: "" };
  let originalMedia = { imageUrl: "", videoUrl: "" };
  let pendingUploads = [];
  let saving = false;

  /* ---------- дрібні компоненти ---------- */

  function toast(message, type) {
    const el = document.createElement("div");
    el.className = "adm-toast" + (type === "error" ? " adm-toast--error" : "");
    el.textContent = message;
    $("toasts").appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  function confirmDialog(text) {
    return new Promise(resolve => {
      const modal = $("confirm-modal");
      $("confirm-text").textContent = text;
      modal.hidden = false;
      const done = result => {
        modal.hidden = true;
        yes.removeEventListener("click", onYes);
        no.removeEventListener("click", onNo);
        document.removeEventListener("keydown", onKey);
        resolve(result);
      };
      const yes = $("confirm-yes");
      const no = $("confirm-no");
      const onYes = () => done(true);
      const onNo = () => done(false);
      const onKey = e => e.key === "Escape" && done(false);
      yes.addEventListener("click", onYes);
      no.addEventListener("click", onNo);
      document.addEventListener("keydown", onKey);
      modal.querySelector(".adm-modal__backdrop").onclick = onNo;
      no.focus();
    });
  }

  function showView(name) {
    Object.keys(views).forEach(k => { views[k].hidden = k !== name; });
  }

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleString("uk-UA", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
      });
    } catch (e) { return ""; }
  }

  /* ---------- авторизація ---------- */

  async function enter(session) {
    $("user-email").textContent = session.email;
    $("user-email").hidden = false;
    $("logout-btn").hidden = false;
    showView("list");
    await refreshList();
  }

  function toLogin() {
    $("user-email").hidden = true;
    $("logout-btn").hidden = true;
    showView("login");
  }

  $("login-form").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = $("login-submit");
    const errEl = $("login-error");
    errEl.hidden = true;
    btn.disabled = true;
    btn.textContent = "Входимо…";
    try {
      const session = await S.signIn($("login-email").value.trim(), $("login-password").value);
      await enter(session);
    } catch (err) {
      errEl.textContent = err.message || "Не вдалося увійти.";
      errEl.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = "Увійти";
    }
  });

  $("logout-btn").addEventListener("click", async () => {
    await S.signOut();
    toLogin();
  });

  /* ---------- список ---------- */

  async function refreshList() {
    const stateEl = $("list-state");
    const groupsEl = $("case-groups");
    groupsEl.innerHTML = "";
    stateEl.hidden = false;
    stateEl.textContent = "Завантаження…";
    try {
      cases = await S.listAll();
      if (!cases.length) {
        stateEl.textContent = "Кейсів поки немає. Додайте перший!";
        return;
      }
      stateEl.hidden = true;
      renderGroups();
    } catch (err) {
      stateEl.textContent = "Не вдалося завантажити кейси. Оновіть сторінку або перевірте підключення.";
    }
  }

  function renderGroups() {
    const groupsEl = $("case-groups");
    groupsEl.innerHTML = "";
    Object.keys(CATEGORY_LABELS).forEach(cat => {
      const items = cases
        .filter(c => c.category === cat)
        .sort((a, b) => a.orderIndex - b.orderIndex);
      if (!items.length) return;

      const group = document.createElement("div");
      group.className = "adm-group";
      group.innerHTML = `<h2 class="adm-group__title">${CATEGORY_LABELS[cat]} · ${items.length}</h2>`;
      const rows = document.createElement("div");
      rows.className = "adm-rows";
      rows.dataset.category = cat;
      items.forEach((c, i) => rows.appendChild(renderRow(c, i, items.length)));
      group.appendChild(rows);
      groupsEl.appendChild(group);
    });
  }

  function renderRow(c, index, total) {
    const row = document.createElement("div");
    row.className = "adm-row-case";
    row.draggable = true;
    row.dataset.id = c.id;

    const isVideo = (c.imageUrl || "").startsWith("data:video");
    row.innerHTML = `
      <span class="adm-drag" title="Перетягніть, щоб змінити порядок">⠿</span>
      <img class="adm-thumb" src="${isVideo ? "" : c.imageUrl}" alt="" loading="lazy">
      <div class="adm-case-info">
        <p class="adm-case-title"></p>
        <p class="adm-case-desc"></p>
        <p class="adm-case-meta">#${c.orderIndex} · ${c.status === "published" ? "опубліковано" : "чернетка"} · оновлено ${fmtDate(c.updatedAt)}</p>
      </div>
      <div class="adm-controls">
        <span class="adm-order">
          <button type="button" class="adm-icon-btn" data-act="up" title="Вгору" ${index === 0 ? "disabled" : ""}>↑</button>
          <button type="button" class="adm-icon-btn" data-act="down" title="Вниз" ${index === total - 1 ? "disabled" : ""}>↓</button>
        </span>
        <button type="button" class="adm-switch ${c.status === "published" ? "is-on" : ""}" role="switch"
          aria-checked="${c.status === "published"}" title="${c.status === "published" ? "Приховати" : "Опублікувати"}"></button>
        <span class="adm-actions">
          <button type="button" class="adm-btn adm-btn--small" data-act="edit">Редагувати</button>
          <button type="button" class="adm-btn adm-btn--small adm-btn--danger" data-act="delete">Видалити</button>
        </span>
      </div>`;

    row.querySelector(".adm-case-title").textContent = c.title;
    row.querySelector(".adm-case-desc").textContent = c.description;

    row.querySelector('[data-act="edit"]').addEventListener("click", () => openEditor(c.id));
    row.querySelector('[data-act="delete"]').addEventListener("click", () => deleteCase(c));
    row.querySelector('[data-act="up"]').addEventListener("click", () => moveCase(c, -1));
    row.querySelector('[data-act="down"]').addEventListener("click", () => moveCase(c, 1));
    row.querySelector(".adm-switch").addEventListener("click", () => toggleStatus(c));

    // drag & drop у межах категорії
    row.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text/plain", c.id);
      e.dataTransfer.effectAllowed = "move";
      row.classList.add("is-dragging");
    });
    row.addEventListener("dragend", () => row.classList.remove("is-dragging"));
    row.addEventListener("dragover", e => {
      const draggedId = document.querySelector(".adm-row-case.is-dragging")?.dataset.id;
      const dragged = cases.find(x => x.id === draggedId);
      if (!dragged || dragged.category !== c.category) return;
      e.preventDefault();
      row.classList.add("is-drop-target");
    });
    row.addEventListener("dragleave", () => row.classList.remove("is-drop-target"));
    row.addEventListener("drop", async e => {
      e.preventDefault();
      row.classList.remove("is-drop-target");
      const draggedId = e.dataTransfer.getData("text/plain");
      if (!draggedId || draggedId === c.id) return;
      await reorderWithin(c.category, draggedId, c.id);
    });

    return row;
  }

  async function reorderWithin(category, draggedId, targetId) {
    const items = cases
      .filter(x => x.category === category)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const from = items.findIndex(x => x.id === draggedId);
    const to = items.findIndex(x => x.id === targetId);
    if (from === -1 || to === -1) return;
    items.splice(to, 0, items.splice(from, 1)[0]);
    await persistOrder(items);
  }

  async function moveCase(c, dir) {
    const items = cases
      .filter(x => x.category === c.category)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const i = items.findIndex(x => x.id === c.id);
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    await persistOrder(items);
  }

  async function persistOrder(items) {
    const pairs = items.map((x, i) => ({ id: x.id, orderIndex: i + 1 }));
    try {
      await S.saveOrder(pairs);
      pairs.forEach(p => {
        const item = cases.find(x => x.id === p.id);
        if (item) item.orderIndex = p.orderIndex;
      });
      renderGroups();
      toast("Порядок збережено.");
    } catch (err) {
      toast("Не вдалося зберегти порядок.", "error");
    }
  }

  async function toggleStatus(c) {
    const next = c.status === "published" ? "draft" : "published";
    try {
      await S.update(c.id, { status: next });
      c.status = next;
      renderGroups();
      toast(next === "published" ? "Кейс опубліковано." : "Кейс приховано.");
    } catch (err) {
      toast("Не вдалося змінити статус.", "error");
    }
  }

  async function deleteCase(c) {
    const ok = await confirmDialog(`Видалити кейс «${c.title}»? Цю дію не можна скасувати.`);
    if (!ok) return;
    try {
      await S.remove(c.id);
      // чистимо файли зі Storage, щоб не накопичувались
      if (c.imageUrl) await S.deleteFileByUrl(c.imageUrl).catch(() => {});
      if (c.videoUrl) await S.deleteFileByUrl(c.videoUrl).catch(() => {});
      cases = cases.filter(x => x.id !== c.id);
      renderGroups();
      if (!cases.length) refreshList();
      toast("Кейс видалено.");
    } catch (err) {
      toast("Не вдалося видалити кейс.", "error");
    }
  }

  $("add-case-btn").addEventListener("click", () => openEditor(null));

  /* ---------- дропзони ---------- */

  function setupDropzone(zoneId, inputId, kind) {
    const zone = $(zoneId);
    const input = $(inputId);
    const empty = zone.querySelector(".adm-drop__empty");
    const progress = zone.querySelector(".adm-drop__progress");
    const bar = zone.querySelector(".adm-drop__bar");
    const pct = zone.querySelector(".adm-drop__pct");
    const preview = zone.querySelector(".adm-drop__preview");
    const mediaEl = preview.querySelector(kind === "image" ? "img" : "video");

    function setState(state) {
      empty.hidden = state !== "empty";
      progress.hidden = state !== "uploading";
      preview.hidden = state !== "filled";
    }

    function showValue(url) {
      formMedia[kind === "image" ? "imageUrl" : "videoUrl"] = url || "";
      if (url) {
        mediaEl.src = url;
        setState("filled");
      } else {
        mediaEl.removeAttribute("src");
        if (kind === "video") mediaEl.load();
        setState("empty");
      }
      updatePreview();
    }

    async function handleFile(file) {
      if (!file) return;
      setErr(kind === "image" ? "imageUrl" : "videoUrl", "");
      setState("uploading");
      bar.style.setProperty("--p", "0%");
      pct.textContent = "0%";
      try {
        const url = await S.uploadFile(file, kind, p => {
          bar.style.setProperty("--p", p + "%");
          pct.textContent = p + "%";
        });
        pendingUploads.push(url);
        showValue(url);
      } catch (err) {
        setState(formMedia[kind === "image" ? "imageUrl" : "videoUrl"] ? "filled" : "empty");
        setErr(kind === "image" ? "imageUrl" : "videoUrl", err.message || "Не вдалося завантажити файл.");
      }
      input.value = "";
    }

    zone.addEventListener("click", e => {
      if (e.target.closest("[data-act]")) return;
      input.click();
    });
    zone.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); }
    });
    input.addEventListener("change", () => handleFile(input.files[0]));

    ["dragover", "dragenter"].forEach(ev =>
      zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add("is-over"); })
    );
    ["dragleave", "drop"].forEach(ev =>
      zone.addEventListener(ev, () => zone.classList.remove("is-over"))
    );
    zone.addEventListener("drop", e => {
      e.preventDefault();
      handleFile(e.dataTransfer.files[0]);
    });

    preview.querySelector('[data-act="replace"]').addEventListener("click", () => input.click());
    preview.querySelector('[data-act="remove"]').addEventListener("click", () => showValue(""));

    return { showValue };
  }

  const imageZone = setupDropzone("drop-image", "file-image", "image");
  const videoZone = setupDropzone("drop-video", "file-video", "video");

  /* ---------- попередній перегляд ---------- */

  function updatePreview() {
    const title = $("f-title").value.trim() || "Назва проєкту";
    const desc = $("f-description").value.trim() || "Короткий опис";
    $("pv-title").textContent = title;
    $("pv-desc").textContent = desc;

    const link = $("pv-link");
    try {
      link.href = new URL($("f-url").value.trim()).href;
    } catch (e) {
      link.removeAttribute("href");
    }
    if ($("f-newtab").checked) {
      link.target = "_blank";
    } else {
      link.removeAttribute("target");
    }

    const img = $("pv-image");
    const video = $("pv-video");
    const placeholder = $("pv-placeholder");
    if (formMedia.imageUrl) {
      img.src = formMedia.imageUrl;
      img.hidden = false;
      placeholder.hidden = true;
    } else {
      img.hidden = true;
      placeholder.hidden = false;
    }
    if (formMedia.videoUrl) {
      if (video.getAttribute("src") !== formMedia.videoUrl) video.src = formMedia.videoUrl;
      video.hidden = false;
      link.classList.remove("no-video");
    } else {
      video.removeAttribute("src");
      video.hidden = true;
      link.classList.add("no-video");
    }
  }

  ["f-title", "f-description", "f-url"].forEach(id =>
    $(id).addEventListener("input", updatePreview)
  );
  $("f-newtab").addEventListener("change", updatePreview);

  const pvLink = $("pv-link");
  pvLink.addEventListener("mouseenter", () => {
    const v = $("pv-video");
    if (!v.hidden && v.src) v.play().catch(() => {});
  });
  pvLink.addEventListener("mouseleave", () => {
    const v = $("pv-video");
    if (v.src) { v.pause(); v.currentTime = 0; }
  });

  /* ---------- редактор ---------- */

  function setErr(field, message) {
    const el = document.querySelector(`[data-err="${field}"]`);
    if (!el) return;
    el.textContent = message;
    el.hidden = !message;
  }

  function clearErrors() {
    document.querySelectorAll(".adm-error[data-err]").forEach(el => { el.hidden = true; });
  }

  async function openEditor(id) {
    editingId = id;
    pendingUploads = [];
    clearErrors();
    $("editor-title").textContent = id ? "Редагувати кейс" : "Новий кейс";

    let c = null;
    if (id) c = cases.find(x => x.id === id) || (await S.getById(id).catch(() => null));

    $("f-title").value = c ? c.title : "";
    $("f-description").value = c ? c.description : "";
    $("f-url").value = c ? c.websiteUrl : "";
    $("f-category").value = c ? c.category : "websites";
    $("f-status").value = c ? c.status : "draft";
    $("f-newtab").checked = c ? !!c.openInNewTab : true;
    $("f-order").value = c
      ? c.orderIndex
      : cases.filter(x => x.category === "websites").length + 1;

    originalMedia = { imageUrl: c ? c.imageUrl : "", videoUrl: c ? c.videoUrl || "" : "" };
    imageZone.showValue(originalMedia.imageUrl);
    videoZone.showValue(originalMedia.videoUrl);
    updatePreview();
    showView("editor");
    window.scrollTo(0, 0);
  }

  function validateForm() {
    clearErrors();
    let ok = true;
    if (!$("f-title").value.trim()) { setErr("title", "Вкажіть назву проєкту."); ok = false; }
    if (!$("f-description").value.trim()) { setErr("description", "Додайте короткий опис."); ok = false; }
    try {
      const u = new URL($("f-url").value.trim());
      if (!/^https?:$/.test(u.protocol)) throw new Error();
    } catch (e) {
      setErr("websiteUrl", "Введіть коректне посилання (https://…).");
      ok = false;
    }
    if (!formMedia.imageUrl) { setErr("imageUrl", "Додайте статичне зображення."); ok = false; }
    const order = Number($("f-order").value);
    if (!Number.isInteger(order) || order < 1) {
      setErr("orderIndex", "Порядок — ціле число від 1.");
      ok = false;
    }
    return ok;
  }

  $("case-form").addEventListener("submit", async e => {
    e.preventDefault();
    if (saving) return; // захист від повторного натискання
    if (!validateForm()) return;

    saving = true;
    const btn = $("save-btn");
    btn.disabled = true;
    btn.textContent = "Зберігаємо…";

    const payload = {
      title: $("f-title").value.trim(),
      description: $("f-description").value.trim(),
      websiteUrl: $("f-url").value.trim(),
      imageUrl: formMedia.imageUrl,
      videoUrl: formMedia.videoUrl || null,
      category: $("f-category").value,
      orderIndex: Number($("f-order").value),
      status: $("f-status").value,
      openInNewTab: $("f-newtab").checked
    };

    try {
      if (editingId) {
        await S.update(editingId, payload);
      } else {
        await S.create(payload);
      }
      // видаляємо замінені файли зі Storage
      if (originalMedia.imageUrl && originalMedia.imageUrl !== payload.imageUrl) {
        await S.deleteFileByUrl(originalMedia.imageUrl).catch(() => {});
      }
      if (originalMedia.videoUrl && originalMedia.videoUrl !== (payload.videoUrl || "")) {
        await S.deleteFileByUrl(originalMedia.videoUrl).catch(() => {});
      }
      pendingUploads = [];
      toast(editingId ? "Зміни збережено." : "Кейс створено.");
      showView("list");
      await refreshList();
    } catch (err) {
      toast("Не вдалося зберегти. Спробуйте ще раз.", "error");
    } finally {
      saving = false;
      btn.disabled = false;
      btn.textContent = "Зберегти";
    }
  });

  async function leaveEditor() {
    // файли, завантажені але не збережені — чистимо
    const used = [originalMedia.imageUrl, originalMedia.videoUrl];
    for (const url of pendingUploads) {
      if (!used.includes(url)) await S.deleteFileByUrl(url).catch(() => {});
    }
    pendingUploads = [];
    showView("list");
  }

  $("back-btn").addEventListener("click", leaveEditor);
  $("cancel-btn").addEventListener("click", leaveEditor);

  /* ---------- старт ---------- */

  (async function init() {
    $("mode-badge").textContent = S.mode === "demo" ? "demo · localStorage" : "supabase";

    if (S.demoCredentials) {
      const hint = $("demo-hint");
      hint.innerHTML = `Supabase не налаштований — адмінка працює в демо-режимі.<br>
        Вхід: <b>${S.demoCredentials.email}</b> / <b>${S.demoCredentials.password}</b>`;
      hint.hidden = false;
    }

    try {
      const session = await S.getSession();
      if (session) await enter(session);
      else toLogin();
    } catch (e) {
      toLogin();
    }

    S.onAuthChange(session => {
      if (!session) toLogin();
    });
  })();
})();
