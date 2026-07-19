/* ============ Lead modal: open/close + form submit ============ */

(function () {
  // Форма надсилається на email через FormSubmit (formsubmit.co).
  // Перший лист попросить підтвердити адресу — після підтвердження
  // заявки приходитимуть на пошту.
  const FORM_ENDPOINT = "https://formsubmit.co/ajax/guraldesign@gmail.com";

  const modal = document.getElementById("lead-modal");
  const openBtn = document.getElementById("lead-open");
  const form = document.getElementById("lead-form");
  if (!modal || !openBtn || !form) return;

  const card = modal.querySelector(".dd-modal__card");
  const status = modal.querySelector(".dd-modal__status");
  let lastFocused = null;

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

  form.addEventListener("submit", async e => {
    e.preventDefault();

    const name = form.elements.name.value.trim();
    const contact = form.elements.contact.value.trim();
    if (!name || !contact) {
      status.classList.add("is-error");
      status.textContent = "Заповніть ім'я та контакт, будь ласка.";
      return;
    }

    const submitBtn = form.querySelector(".dd-modal__submit");
    submitBtn.disabled = true;
    status.classList.remove("is-error");
    status.textContent = "Надсилаємо…";

    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name,
          contact,
          message: form.elements.message.value.trim(),
          _subject: "Нова заявка з сайту-портфоліо"
        })
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      status.textContent = "Дякуємо! Заявку надіслано — ми на зв'язку.";
      form.reset();
    } catch (err) {
      status.classList.add("is-error");
      status.textContent = "Не вдалося надіслати. Напишіть нам у Telegram, будь ласка.";
    } finally {
      submitBtn.disabled = false;
    }
  });
})();
