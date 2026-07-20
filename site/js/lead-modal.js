/* ============ Lead modal: open/close + Telegram submit ============ */

(function () {
  const cfg = window.LEADS_CONFIG || {};

  const modal = document.getElementById("lead-modal");
  const openBtn = document.getElementById("lead-open");
  const form = document.getElementById("lead-form");
  if (!modal || !openBtn || !form) return;

  const status = modal.querySelector(".dd-modal__status");
  let lastFocused = null;

  /* ---------- open / close ---------- */

  function openModal() {
    lastFocused = document.activeElement;
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add("is-open"));
    if (window.lenis) window.lenis.stop();
    document.addEventListener("keydown", onKeydown);
    const firstField = form.querySelector(".dd-modal__field");
    if (firstField) firstField.focus({ preventScroll: true });
  }

  function closeModal() {
    modal.classList.remove("is-open");
    document.removeEventListener("keydown", onKeydown);
    if (window.lenis) window.lenis.start();
    setTimeout(() => {
      modal.hidden = true;
      if (lastFocused) lastFocused.focus({ preventScroll: true });
    }, 250);
  }

  function onKeydown(e) {
    if (e.key === "Escape") closeModal();
  }

  openBtn.addEventListener("click", openModal);
  modal.querySelectorAll("[data-modal-close]").forEach(el =>
    el.addEventListener("click", closeModal)
  );

  /* ---------- Telegram message ---------- */

  // Екрануємо все, що вводить користувач: parse_mode=HTML інакше зламається
  const esc = s =>
    String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  function buildMessage(lead) {
    const site = cfg.siteName || location.hostname || "портфоліо";
    const when = new Date().toLocaleString("uk-UA", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
      timeZone: "Europe/Kyiv"
    });

    const lines = [
      "🟢 <b>НОВА ЗАЯВКА З САЙТУ</b>",
      "🌐 Портфоліо · <b>" + esc(site) + "</b>",
      "━━━━━━━━━━━━━━━━━━━━",
      "",
      "👤 <b>Ім'я</b>",
      esc(lead.name),
      "",
      "📞 <b>Контакт</b>",
      esc(lead.contact)
    ];

    if (lead.message) {
      lines.push("", "💬 <b>Про проєкт</b>", esc(lead.message));
    }

    lines.push(
      "",
      "━━━━━━━━━━━━━━━━━━━━",
      "🕒 " + esc(when) + " (Київ)",
      "🔗 <a href=\"" + esc(lead.page) + "\">Сторінка заявки</a>"
    );

    return lines.join("\n");
  }

  async function sendLead(lead) {
    const text = buildMessage(lead);

    // Варіант A: через Edge Function (токен на сервері)
    if (cfg.proxyUrl) {
      const res = await fetch(cfg.proxyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...lead, text })
      });
      if (!res.ok) throw new Error("proxy HTTP " + res.status);
      return;
    }

    // Варіант B: напряму в Telegram Bot API
    if (!cfg.botToken || !cfg.chatId) throw new Error("Telegram не налаштований.");
    const res = await fetch("https://api.telegram.org/bot" + cfg.botToken + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: cfg.chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.description || "HTTP " + res.status);
  }

  /* ---------- submit ---------- */

  let sending = false;

  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (sending) return;

    const name = form.elements.name.value.trim();
    const contact = form.elements.contact.value.trim();
    if (!name || !contact) {
      status.classList.add("is-error");
      status.textContent = "Заповніть ім'я та контакт, будь ласка.";
      return;
    }

    sending = true;
    const submitBtn = form.querySelector(".dd-modal__submit");
    submitBtn.disabled = true;
    status.classList.remove("is-error");
    status.textContent = "Надсилаємо…";

    try {
      await sendLead({
        name,
        contact,
        message: form.elements.message.value.trim(),
        page: location.href
      });
      status.textContent = "Дякуємо! Заявку надіслано — ми на зв'язку.";
      form.reset();
      setTimeout(() => {
        if (!modal.hidden) closeModal();
        status.textContent = "";
      }, 2500);
    } catch (err) {
      status.classList.add("is-error");
      status.textContent = "Не вдалося надіслати. Напишіть нам у Telegram, будь ласка.";
    } finally {
      sending = false;
      submitBtn.disabled = false;
    }
  });
})();
