/* ============ Project cases: tabs, render, video control ============
 * Дані приходять із window.CasesService (js/cases-service.js):
 * Supabase (тільки status=published, orderIndex ASC) або демо-режим.
 * При помилці запиту сайт відмальовує вбудований FALLBACK_CASES.
 */

(function () {
  const ARROW_SVG =
    '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    "</svg>";

  const LEAVE_MS = 250; // must stay <= the CSS card transition duration
  const ENTER_STAGGER_MS = 40;
  const SKELETON_COUNT = 4;

  const CATEGORIES = [
    { value: "websites", label: "Сайти" },
    { value: "ecommerce", label: "Інтернет-магазини" },
    { value: "ai-site", label: "Сайти за 200€" }
  ];
  const DEFAULT_CATEGORY = "websites";

  const grid = document.getElementById("projects-grid");
  const tabsEl = document.getElementById("works-tabs");
  const tabsWrapper = document.getElementById("works-tabs-wrapper");
  const listAnchor = document.getElementById("featured-works-list-start");
  if (!grid || !tabsEl || !tabsWrapper || !listAnchor) return;

  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const cleanupFns = [];
  let medias = [];
  let activeMedia = null;
  let activeCategory = null;
  let switching = false;
  let allCases = null; // null = ще завантажується

  /* ---------- video / hover state ---------- */

  function stopVideo(media) {
    const video = media.querySelector(".project-card__video");
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
  }

  // Single entry point for state: at most one card active / one video playing
  function setActive(media) {
    if (activeMedia === media) return;
    if (activeMedia) {
      activeMedia.classList.remove("is-active");
      stopVideo(activeMedia);
    }
    activeMedia = media;
    if (media) {
      media.classList.add("is-active");
      const video = media.querySelector(".project-card__video");
      if (video) video.play().catch(() => {});
    }
  }

  /* ---------- card rendering ---------- */

  function createCard(project) {
    const card = document.createElement("article");
    card.className = "project-card";

    const media = document.createElement("a");
    media.className = "project-card__media";
    media.href = project.websiteUrl;
    media.setAttribute("aria-label", project.title);
    if (project.openInNewTab) {
      media.target = "_blank";
      media.rel = "noopener noreferrer";
    }

    const img = document.createElement("img");
    img.className = "project-card__image";
    img.src = project.imageUrl;
    img.alt = project.title;
    img.loading = "lazy";
    media.appendChild(img);

    if (project.videoUrl) {
      const video = document.createElement("video");
      video.className = "project-card__video";
      video.src = project.videoUrl;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      // On touch devices nothing loads until the card is activated near
      // the viewport center — offscreen videos never download
      video.preload = canHover ? "metadata" : "none";
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      media.appendChild(video);
    }

    if (canHover) {
      media.addEventListener("mouseenter", () => setActive(media));
      media.addEventListener("mouseleave", () => {
        if (activeMedia === media) setActive(null);
      });
    }

    const arrow = document.createElement("span");
    arrow.className = "project-card__arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.innerHTML = ARROW_SVG;
    media.appendChild(arrow);

    const content = document.createElement("div");
    content.className = "project-card__content";

    const title = document.createElement("h3");
    title.className = "project-card__title dd-text-24px";
    title.textContent = project.title;

    const description = document.createElement("p");
    description.className = "project-card__description";
    description.textContent = project.description;

    content.appendChild(title);
    content.appendChild(description);

    card.appendChild(media);
    card.appendChild(content);
    return card;
  }

  function createSkeleton() {
    const card = document.createElement("article");
    card.className = "project-card project-card--skeleton";
    card.innerHTML =
      '<div class="sk sk-media"></div>' +
      '<div class="project-card__content">' +
      '<div class="sk sk-line sk-line--title"></div>' +
      '<div class="sk sk-line"></div>' +
      '<div class="sk sk-line sk-line--short"></div>' +
      "</div>";
    return card;
  }

  // Заглушка для категорій, у які ще не додали кейси
  function createSoonBlock() {
    const box = document.createElement("div");
    box.className = "works-soon";

    const video = document.createElement("video");
    video.className = "works-soon__media";
    video.src = "media/coming-soon.mp4";
    video.poster = "media/coming-soon-poster.jpg";
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("aria-hidden", "true");
    if (!reducedMotion) {
      video.autoplay = true;
      const play = () => { const r = video.play(); if (r && r.catch) r.catch(() => {}); };
      video.addEventListener("canplay", play, { once: true });
      play();
    } else {
      video.controls = true;
    }

    const text = document.createElement("p");
    text.className = "works-soon__text";
    text.textContent =
      "Ми поки займаємось наповненням — найближчим часом додамо кейси. " +
      "Або напишіть у Telegram, і ми одразу надішлемо посилання.";

    const link = document.createElement("a");
    link.className = "works-soon__btn";
    link.href = "https://telegram.me/guraldigital/";
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Написати в Telegram";

    box.appendChild(video);
    box.appendChild(text);
    box.appendChild(link);
    return box;
  }

  // Єдине джерело даних: фільтр за категорією і статусом, сортування за orderIndex
  function casesFor(category) {
    return (allCases || [])
      .filter(p => p.status === "published" && p.category === category)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }

  function renderCards(category, animateIn) {
    grid.innerHTML = "";
    medias = [];

    if (allCases === null) {
      for (let i = 0; i < SKELETON_COUNT; i++) grid.appendChild(createSkeleton());
      return;
    }

    const cases = casesFor(category);
    if (!cases.length) {
      grid.appendChild(createSoonBlock());
      return;
    }

    cases.forEach((project, i) => {
      const card = createCard(project);
      if (animateIn && !reducedMotion) {
        card.classList.add("is-entering");
        card.style.transitionDelay = i * ENTER_STAGGER_MS + "ms";
      }
      grid.appendChild(card);
      medias.push(card.querySelector(".project-card__media"));
    });

    if (animateIn && !reducedMotion) {
      // double rAF: let the entering styles paint, then transition to visible
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          grid.querySelectorAll(".project-card").forEach(card => {
            card.classList.remove("is-entering");
            card.addEventListener(
              "transitionend",
              () => { card.style.transitionDelay = ""; },
              { once: true }
            );
          });
        });
      });
    }
  }

  /* ---------- touch devices: activation from scroll position ---------- */

  let observer = null;
  const intersecting = new Set();

  function updateActiveFromScroll() {
    if (!intersecting.size) {
      setActive(null);
      return;
    }
    const centerY = window.innerHeight / 2;
    let best = null;
    let bestDist = Infinity;
    intersecting.forEach(media => {
      const rect = media.getBoundingClientRect();
      const dist = Math.abs(rect.top + rect.height / 2 - centerY);
      if (dist < bestDist) {
        bestDist = dist;
        best = media;
      }
    });
    setActive(best);
  }

  function disconnectObserver() {
    if (observer) observer.disconnect();
    intersecting.clear();
  }

  function observeCards() {
    if (canHover || !("IntersectionObserver" in window)) return;
    if (!observer) {
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) intersecting.add(entry.target);
          else intersecting.delete(entry.target);
        });
        updateActiveFromScroll();
      }, {
        // central band of the viewport
        rootMargin: "-35% 0px -35% 0px",
        threshold: 0
      });
    }
    intersecting.clear();
    medias.forEach(media => observer.observe(media));
  }

  if (!canHover) {
    let rafId = 0;
    const onScroll = () => {
      if (intersecting.size < 2 || rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        updateActiveFromScroll();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    cleanupFns.push(() => {
      window.removeEventListener("scroll", onScroll);
      if (rafId) cancelAnimationFrame(rafId);
      disconnectObserver();
    });
  }

  /* ---------- tabs ---------- */

  const tabButtons = new Map();

  CATEGORIES.forEach(cat => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "featured-works__tab";
    btn.id = "works-tab-" + cat.value;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-controls", "projects-grid");
    btn.textContent = cat.label;
    btn.addEventListener("click", () => selectCategory(cat.value));
    tabsEl.appendChild(btn);
    tabButtons.set(cat.value, btn);
  });

  // Arrow Left / Right switch tabs (activation follows focus)
  tabsEl.addEventListener("keydown", e => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const idx = CATEGORIES.findIndex(c => c.value === activeCategory);
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const next = CATEGORIES[(idx + dir + CATEGORIES.length) % CATEGORIES.length];
    tabButtons.get(next.value).focus();
    selectCategory(next.value);
  });

  function updateTabsUI() {
    tabButtons.forEach((btn, value) => {
      const isActive = value === activeCategory;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
      btn.tabIndex = isActive ? 0 : -1;
    });
    grid.setAttribute("aria-labelledby", "works-tab-" + activeCategory);
  }

  /* ---------- підказка «стрічку можна гортати» ---------- */

  const HINT_KEY = "dd-tabs-hinted";

  function overflows() {
    return tabsEl.scrollWidth - tabsEl.clientWidth > 4;
  }

  // Згасання країв показує, з якого боку є ще таби
  function updateEdges() {
    const max = tabsEl.scrollWidth - tabsEl.clientWidth;
    tabsEl.classList.toggle("has-start", max > 4 && tabsEl.scrollLeft > 4);
    tabsEl.classList.toggle("has-end", max > 4 && tabsEl.scrollLeft < max - 4);
  }

  tabsEl.addEventListener("scroll", updateEdges, { passive: true });
  window.addEventListener("resize", updateEdges, { passive: true });
  cleanupFns.push(() => {
    tabsEl.removeEventListener("scroll", updateEdges);
    window.removeEventListener("resize", updateEdges);
  });

  // Короткий «поштовх»: стрічка від'їжджає й повертається — жест зрозумілий
  // без тексту. Один раз за сесію, тільки якщо таби справді не влазять.
  function nudgeOnce() {
    if (!overflows() || reducedMotion || !window.gsap) return;
    try {
      if (sessionStorage.getItem(HINT_KEY) === "1") return;
      sessionStorage.setItem(HINT_KEY, "1");
    } catch (e) { /* приватний режим — покажемо підказку, це не критично */ }

    const proxy = { x: tabsEl.scrollLeft };
    const apply = () => { tabsEl.scrollLeft = proxy.x; };

    window.gsap.timeline({ delay: 0.35 })
      .to(proxy, { x: proxy.x + 52, duration: 0.55, ease: "power2.inOut", onUpdate: apply })
      .to(proxy, { x: proxy.x, duration: 0.7, ease: "power2.inOut", onUpdate: apply }, "+=0.12");
  }

  // Чекаємо, доки таби реально потраплять на екран
  function watchForHint() {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        io.disconnect();
        nudgeOnce();
      }
    }, { threshold: 0.9 });
    io.observe(tabsEl);
    cleanupFns.push(() => io.disconnect());
  }

  // Horizontal-only scroll of the tab strip (never scrolls the page vertically)
  function revealActiveTab() {
    const btn = tabButtons.get(activeCategory);
    if (!btn || tabsEl.scrollWidth <= tabsEl.clientWidth) return;
    const target = btn.offsetLeft - (tabsEl.clientWidth - btn.offsetWidth) / 2;
    tabsEl.scrollTo({
      left: Math.max(0, target),
      behavior: reducedMotion ? "auto" : "smooth"
    });
    updateEdges();
  }

  /* ---------- scroll to the start of the list ---------- */

  function scrollToListStart() {
    const header = document.querySelector("[data-site-header]");
    const headerHeight = header instanceof HTMLElement ? header.offsetHeight : 0;
    const targetY =
      window.scrollY +
      listAnchor.getBoundingClientRect().top -
      headerHeight -
      tabsWrapper.offsetHeight -
      16;
    const top = Math.max(0, targetY);
    if (Math.abs(window.scrollY - top) <= 24) return; // already at the top of the list
    if (window.lenis && !reducedMotion) {
      window.lenis.scrollTo(top);
    } else {
      window.scrollTo({ top, behavior: reducedMotion ? "auto" : "smooth" });
    }
  }

  /* ---------- category switching ---------- */

  function syncUrl(category) {
    if (!window.history || !history.replaceState) return;
    const url = new URL(window.location.href);
    url.searchParams.set("category", category);
    history.replaceState(history.state, "", url);
  }

  function selectCategory(next) {
    if (next === activeCategory || switching) return;
    switching = true;

    // 1-2. stop active video, reset hover/mobile state, detach observer
    setActive(null);
    disconnectObserver();

    // 3. switch category
    activeCategory = next;
    updateTabsUI();
    revealActiveTab();
    syncUrl(next);

    const swap = () => {
      grid.classList.remove("is-leaving");
      // 4. render the new list
      renderCards(next, true);
      // 5. reconnect the observer to the new cards
      observeCards();
      // 6. smooth-scroll to the start of the new list (after DOM update)
      requestAnimationFrame(scrollToListStart);
      switching = false;
    };

    if (reducedMotion || allCases === null) {
      swap();
    } else {
      grid.classList.add("is-leaving");
      setTimeout(swap, LEAVE_MS);
    }
  }

  /* ---------- initial render (no auto-scroll) ---------- */

  const urlCategory = new URL(window.location.href).searchParams.get("category");
  activeCategory = CATEGORIES.some(c => c.value === urlCategory)
    ? urlCategory
    : DEFAULT_CATEGORY;

  updateTabsUI();
  revealActiveTab();
  updateEdges();
  // Підказку показуємо після прелоадера — інакше вона програється «в нікуди»
  if (document.documentElement.classList.contains("pl-active")) {
    document.addEventListener("preloader:complete", watchForHint, { once: true });
  } else {
    watchForHint();
  }
  renderCards(activeCategory, false); // skeleton, поки їдуть дані

  const applyCases = list => {
    allCases = list;
    renderCards(activeCategory, false);
    observeCards();
    // висота сітки змінилась — перерахувати позиції скрол-тригерів
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  };

  const fallbackCases = () => window.FALLBACK_CASES.filter(c => c.status === "published");

  window.CasesService.listPublished()
    // база ще порожня (нічого не додано через адмінку) — показуємо вбудовані кейси,
    // щойно з'явиться перший опублікований кейс, вони зникають
    .then(list => applyCases(list && list.length ? list : fallbackCases()))
    // бекенд недоступний — теж показуємо вбудовані
    .catch(() => applyCases(fallbackCases()));

  // Teardown: disconnect observers, remove listeners, stop playback
  window.destroyProjectCases = window.destroyProjectCards = function () {
    cleanupFns.forEach(fn => fn());
    cleanupFns.length = 0;
    setActive(null);
    medias.forEach(stopVideo);
  };
})();
