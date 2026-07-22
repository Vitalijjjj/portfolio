/* ============================================================
   Автономний квіз — логіка. Один крок на екран.
   Нічого не імпортує з основного сайту.
   ============================================================ */

(function () {
  "use strict";

  /* ---- Питання ---- */
  // type: "text" | "textarea" | "tel" | "choice" | "rating"
  // Усі кроки обовʼязкові — пропустити не можна.
  const STEPS = [
    {
      key: "likes",
      type: "textarea",
      q: "Що вам подобається у моєму профілі?",
      hint: "Пишіть чесно — і в двох словах, і докладно.",
      placeholder: "Наприклад: подача, візуал, користь…"
    },
    {
      key: "dislikes",
      type: "textarea",
      q: "А що не подобається?",
      hint: "Це найцінніше — так я знатиму, що покращити.",
      placeholder: "Не соромтесь, критика допомагає"
    },
    {
      key: "stories_interest",
      type: "rating",
      q: "Наскільки цікаво дивитися мої сторіс?",
      lowLabel: "Зовсім ні",
      highLabel: "Дуже цікаво"
    },
    {
      key: "stories_wish",
      type: "textarea",
      q: "Що ви б хотіли частіше бачити в сторіс?",
      placeholder: "Теми, формати, закулісся, кейси…"
    },
    {
      key: "source",
      type: "choice",
      q: "Звідки ви дізнались про мене?",
      options: [
        "Reels / рекомендації Instagram",
        "Від друзів чи знайомих",
        "TikTok",
        "Google / пошук",
        "Реклама",
        { label: "Інше", other: true, otherPlaceholder: "Звідки саме?" }
      ]
    },
    {
      key: "why_follow",
      type: "textarea",
      q: "Чому ви слідкуєте за мною?",
      placeholder: "Що вас тримає у підписці"
    },
    {
      key: "collab_offer",
      type: "textarea",
      q: "Що треба вам запропонувати, щоб ви 100% погодились на співпрацю?",
      placeholder: "Що стало б вирішальним аргументом"
    },
    {
      key: "seen_offer",
      type: "choice",
      q: "Чи бачили ви наш оффер «сайт за 200 €»?",
      options: ["Так, бачив(-ла)", "Ні, вперше чую"]
    },
    {
      key: "offer_doubts",
      type: "textarea",
      q: "Що зупиняло замовити його?",
      hint: "Можливо, були сумніви чи запитання — розкажіть.",
      placeholder: "Ціна, довіра, не на часі, немає потреби…"
    },
    {
      key: "name",
      type: "text",
      q: "Як вас звати?",
      required: true,
      placeholder: "Ваше ім'я",
      autocomplete: "name"
    },
    {
      key: "phone",
      type: "tel",
      q: "Номер телефону",
      hint: "Щоб мати змогу зв'язатися, якщо буде потрібно.",
      required: true,
      placeholder: "+380 __ ___ __ __",
      autocomplete: "tel"
    },
    {
      key: "telegram",
      type: "text",
      q: "Ваш Телеграм",
      hint: "Необов'язково, але так найзручніше написати.",
      placeholder: "@username"
    },
    {
      key: "business",
      type: "text",
      q: "Чим ви займаєтесь? Ваш бізнес або ніша",
      placeholder: "Наприклад: кав'ярня, магазин, послуги…"
    }
  ];

  /* ---- Стан ---- */
  const answers = {};      // key -> значення
  const otherText = {};    // key -> текст поля «Інше»
  let index = 0;
  const startedAt = Date.now();

  /* ---- Прогресивний запис у Google-таблицю ---- */
  const SESSION_ID = (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : "s-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  const startedAtISO = new Date().toISOString();
  const STATUS_PARTIAL = "В процесі";
  const STATUS_DONE = "Завершено";
  const CONTACT_KEYS = ["name", "phone", "telegram", "business"];
  let finished = false;
  let lastSent = "";
  let trackTimer = null;

  function currentRecord(status) {
    const rec = { session: SESSION_ID, startedAt: startedAtISO, status: status };
    STEPS.forEach(s => {
      const val = formatAnswer(s);
      if (val) rec[s.key] = val;
    });
    return rec;
  }

  function hasAnyAnswer(rec) {
    return Object.keys(rec).some(k => k !== "session" && k !== "startedAt" && k !== "status");
  }

  // status: STATUS_PARTIAL | STATUS_DONE; useBeacon — під час закриття вкладки
  function track(status, useBeacon) {
    if (finished && status !== STATUS_DONE) return; // не перетираємо «Завершено»
    const rec = currentRecord(status);
    if (!hasAnyAnswer(rec) && status !== STATUS_DONE) return; // порожнє не шлемо
    const body = JSON.stringify(rec);
    if (body === lastSent && !useBeacon) return; // без змін — не дублюємо
    lastSent = body;
    try {
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
        return;
      }
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body,
        keepalive: true
      }).catch(() => { });
    } catch (e) { /* мовчки — автозбереження не має ламати квіз */ }
  }

  function scheduleTrack() {
    clearTimeout(trackTimer);
    trackTimer = setTimeout(() => track(STATUS_PARTIAL, false), 700);
  }

  function flushTrack() {
    clearTimeout(trackTimer);
    track(STATUS_PARTIAL, false);
  }

  // Закриття / згортання вкладки — зберігаємо останній стан «маячком»
  window.addEventListener("pagehide", () => track(STATUS_PARTIAL, true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") track(STATUS_PARTIAL, true);
  });

  /* ---- Елементи ---- */
  const stage = document.getElementById("stage");
  const nextBtn = document.getElementById("next");
  const backBtn = document.getElementById("back");
  const fill = document.querySelector(".quiz__progress-fill");
  const progressEl = document.querySelector(".quiz__progress");
  const countCur = document.querySelector(".quiz__count b");
  const countTot = document.querySelector(".quiz__count i");
  const hp = document.getElementById("hp");
  const doneScreen = document.getElementById("done");

  countTot.textContent = STEPS.length;

  /* ---- Рендер кроку ---- */
  function render() {
    const step = STEPS[index];
    const el = document.createElement("div");
    el.className = "step is-entering";

    const kicker = document.createElement("div");
    kicker.className = "step__kicker";
    kicker.textContent = "Питання " + (index + 1);
    el.appendChild(kicker);

    const q = document.createElement("h2");
    q.className = "step__q";
    q.textContent = step.q;
    el.appendChild(q);

    if (step.hint) {
      const hint = document.createElement("p");
      hint.className = "step__hint";
      hint.textContent = step.hint;
      el.appendChild(hint);
    }

    el.appendChild(buildControl(step));
    stage.appendChild(el);

    // прибираємо попередній крок
    const prev = stage.querySelector(".step:not(.is-entering)");
    if (prev) prev.remove();

    syncUI();
    focusFirst(el, step);
  }

  /* ---- Маска телефону: +380 XX XXX XX XX ---- */
  function phoneNational(raw) {
    let d = String(raw || "").replace(/\D/g, "");
    if (d.startsWith("380")) d = d.slice(3);
    else if (d.startsWith("0")) d = d.slice(1);
    return d.slice(0, 9);
  }
  function formatUAPhone(raw) {
    const d = phoneNational(raw);
    let out = "+380";
    if (d.length) out += " " + d.slice(0, 2);
    if (d.length > 2) out += " " + d.slice(2, 5);
    if (d.length > 5) out += " " + d.slice(5, 7);
    if (d.length > 7) out += " " + d.slice(7, 9);
    else if (!d.length) out += " "; // тримаємо префікс як «підлогу»
    return out;
  }
  function phoneComplete(raw) {
    return phoneNational(raw).length === 9;
  }

  function buildControl(step) {
    if (step.type === "tel") {
      const input = document.createElement("input");
      input.className = "field";
      input.type = "tel";
      input.inputMode = "tel";
      input.autocomplete = "tel";
      input.placeholder = step.placeholder || "";
      input.value = answers[step.key] ? formatUAPhone(answers[step.key]) : "";
      const apply = () => {
        const f = formatUAPhone(input.value);
        input.value = f;
        try { input.setSelectionRange(f.length, f.length); } catch (e) { }
        answers[step.key] = f;
        syncUI();
      };
      input.addEventListener("focus", () => {
        if (!input.value) { input.value = "+380 "; answers[step.key] = "+380 "; try { input.setSelectionRange(5, 5); } catch (e) { } }
      });
      input.addEventListener("input", apply);
      input.addEventListener("keydown", e => {
        if (e.key === "Enter") { e.preventDefault(); goNext(); }
      });
      return input;
    }

    if (step.type === "text" || step.type === "textarea") {
      const input = document.createElement(step.type === "textarea" ? "textarea" : "input");
      input.className = "field";
      if (step.type !== "textarea") input.type = "text";
      input.placeholder = step.placeholder || "";
      if (step.autocomplete) input.autocomplete = step.autocomplete;
      input.value = answers[step.key] || "";
      input.addEventListener("input", () => {
        answers[step.key] = input.value.trim();
        syncUI();
      });
      input.addEventListener("keydown", e => {
        if (e.key === "Enter" && step.type !== "textarea") { e.preventDefault(); goNext(); }
      });
      return input;
    }

    if (step.type === "rating") {
      const wrap = document.createElement("div");

      const grid = document.createElement("div");
      grid.className = "rating";
      for (let n = 1; n <= 10; n++) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "rating__btn";
        b.textContent = n;
        if (String(answers[step.key]) === String(n)) b.classList.add("is-selected");
        b.addEventListener("click", () => {
          answers[step.key] = n;
          grid.querySelectorAll(".rating__btn").forEach(x => x.classList.remove("is-selected"));
          b.classList.add("is-selected");
          syncUI();
          autoAdvance();
        });
        grid.appendChild(b);
      }
      wrap.appendChild(grid);

      const scale = document.createElement("div");
      scale.className = "rating__scale";
      scale.innerHTML = "<span>" + esc(step.lowLabel || "1") + "</span><span>" + esc(step.highLabel || "10") + "</span>";
      wrap.appendChild(scale);
      return wrap;
    }

    if (step.type === "choice") {
      const wrap = document.createElement("div");
      wrap.className = "choices";
      let otherInput = null;

      step.options.forEach(opt => {
        const label = typeof opt === "string" ? opt : opt.label;
        const isOther = typeof opt === "object" && opt.other;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "choice";
        if (answers[step.key] === label) btn.classList.add("is-selected");
        btn.innerHTML =
          '<span class="choice__mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></span>' +
          '<span>' + esc(label) + '</span>';

        btn.addEventListener("click", () => {
          answers[step.key] = label;
          wrap.querySelectorAll(".choice").forEach(x => x.classList.remove("is-selected"));
          btn.classList.add("is-selected");
          if (otherInput) {
            otherInput.parentElement.classList.toggle("is-open", isOther);
            if (isOther) setTimeout(() => otherInput.focus(), 120);
          }
          syncUI();
          if (!isOther) autoAdvance();
        });
        wrap.appendChild(btn);

        if (isOther) {
          const box = document.createElement("div");
          box.className = "choice-other";
          otherInput = document.createElement("input");
          otherInput.type = "text";
          otherInput.className = "field";
          otherInput.placeholder = opt.otherPlaceholder || "Ваш варіант";
          otherInput.value = otherText[step.key] || "";
          otherInput.addEventListener("input", () => {
            otherText[step.key] = otherInput.value.trim();
            syncUI();
          });
          box.appendChild(otherInput);
          wrap.appendChild(box);
          if (answers[step.key] === label) box.classList.add("is-open");
        }
      });
      return wrap;
    }

    return document.createElement("div");
  }

  function focusFirst(el, step) {
    if (step.type === "text" || step.type === "tel" || step.type === "textarea") {
      const f = el.querySelector(".field");
      // На мобільних не форсуємо клавіатуру одразу — лишаємо м'яко
      if (f && window.matchMedia("(min-width: 48rem)").matches) f.focus();
    }
  }

  /* ---- Валідність / перехід ---- */
  function isAnswered(step) {
    const v = answers[step.key];
    if (step.type === "rating") return v != null;
    if (step.type === "tel") return phoneComplete(v);
    if (step.type === "choice") {
      if (!v) return false;
      const opt = step.options.find(o => (typeof o === "object" ? o.label : o) === v);
      if (opt && typeof opt === "object" && opt.other) return !!otherText[step.key];
      return true;
    }
    return typeof v === "string" && v.length > 0;
  }

  // Усі кроки обовʼязкові — пропустити не можна.
  function canProceed(step) {
    return isAnswered(step);
  }

  function syncUI() {
    const step = STEPS[index];
    const pct = Math.round((index / STEPS.length) * 100);
    fill.style.width = pct + "%";
    progressEl.setAttribute("aria-valuenow", String(pct));
    countCur.textContent = index + 1;
    backBtn.hidden = index === 0;

    const last = index === STEPS.length - 1;
    nextBtn.querySelector("span").textContent = last ? "Надіслати" : "Далі";
    nextBtn.disabled = !canProceed(step);

    scheduleTrack(); // автозбереження змін (debounce)
  }

  let advancing = false;
  function autoAdvance() {
    // для rating / choice — плавно перейти далі
    if (!isAnswered(STEPS[index])) return;
    if (advancing) return;
    advancing = true;
    setTimeout(() => { advancing = false; goNext(); }, 320);
  }

  function transition(dir, mutate) {
    const cur = stage.querySelector(".step");
    if (cur) {
      cur.classList.remove("is-entering");
      cur.classList.add("is-leaving");
    }
    mutate();
    setTimeout(render, cur ? 180 : 0);
    void dir;
  }

  function goNext() {
    const step = STEPS[index];
    if (!canProceed(step)) { nudge(); return; }
    flushTrack(); // кожну завершену відповідь пишемо одразу
    if (index === STEPS.length - 1) { submit(); return; }
    transition(1, () => { index++; });
  }

  function goBack() {
    if (index === 0) return;
    transition(-1, () => { index--; });
  }

  function nudge() {
    nextBtn.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }],
      { duration: 260, easing: "ease-in-out" }
    );
  }

  /* ---- Надсилання ---- */
  async function submit() {
    if (hp.value) { showDone(); return; } // бот

    // Позначаємо запис у таблиці як завершений (одразу, до Telegram)
    track(STATUS_DONE, false);

    const payload = {
      website: hp.value,
      elapsed: Date.now() - startedAt,
      contact: {
        name: answers.name || "",
        phone: answers.phone || "",
        telegram: answers.telegram || "",
        business: answers.business || ""
      },
      answers: STEPS
        .filter(s => !["name", "phone", "telegram", "business"].includes(s.key))
        .map(s => ({ q: s.q, a: formatAnswer(s) }))
        .filter(a => a.a)
    };

    nextBtn.classList.add("is-busy");
    nextBtn.querySelector("span").textContent = "Надсилаємо…";

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("bad status " + res.status);
      showDone();
    } catch (err) {
      nextBtn.classList.remove("is-busy");
      nextBtn.querySelector("span").textContent = "Спробувати ще раз";
      nextBtn.disabled = false;
      showError("Не вдалося надіслати. Перевірте зв'язок і спробуйте ще раз.");
    }
  }

  function formatAnswer(step) {
    const v = answers[step.key];
    if (v == null || v === "") return "";
    if (step.type === "rating") return v + " / 10";
    if (step.type === "choice") {
      const opt = step.options.find(o => (typeof o === "object" ? o.label : o) === v);
      if (opt && typeof opt === "object" && opt.other && otherText[step.key]) {
        return v + ": " + otherText[step.key];
      }
      return v;
    }
    return String(v);
  }

  function showError(msg) {
    let box = document.querySelector(".quiz__error");
    if (!box) {
      box = document.createElement("p");
      box.className = "quiz__error";
      box.setAttribute("role", "alert");
      stage.querySelector(".step").appendChild(box);
    }
    box.textContent = msg;
  }

  function showDone() {
    finished = true;
    document.getElementById("quiz").style.display = "none";
    doneScreen.hidden = false;
  }

  /* ---- Утиліти ---- */
  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  /* ---- Події ---- */
  nextBtn.addEventListener("click", goNext);
  backBtn.addEventListener("click", goBack);

  render();
})();
