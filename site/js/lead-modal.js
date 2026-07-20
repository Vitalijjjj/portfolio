/* ============ Lead modal: open/close + Telegram submit ============ */

(function () {
  const cfg = window.LEADS_CONFIG || {};

  const modal = document.getElementById("lead-modal");
  const openBtn = document.getElementById("lead-open");
  const form = document.getElementById("lead-form");
  if (!modal || !openBtn || !form) return;

  const status = modal.querySelector(".dd-modal__status");
  let lastFocused = null;
  let openedAt = 0;

  /* ---------- open / close ---------- */

  function openModal() {
    lastFocused = document.activeElement;
    openedAt = Date.now();
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

  /* ---------- відправка ---------- */

  // Повідомлення формує сервер (/api/lead) — токен бота у браузер не потрапляє
  async function sendLead(lead) {
    const res = await fetch(cfg.endpoint || "/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lead)
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
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
        page: location.href,
        // антиспам: пастка для ботів + час заповнення форми
        website: form.elements.website.value,
        elapsed: Date.now() - openedAt
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
