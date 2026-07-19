/* ============ Project cases: data ============ */

/*
 * ProjectCase:
 * { id, title, description, url, image, srcset?, sizes?, video,
 *   category: "websites" | "ecommerce" | "ai-site",
 *   orderIndex, status: "draft" | "published", openInNewTab }
 *
 * Category assignment below is placeholder — edit per real case.
 */

const CATEGORIES = [
  { value: "websites", label: "Сайти" },
  { value: "ecommerce", label: "Інтернет-магазини" },
  { value: "ai-site", label: "Сайти за 200€" }
];

const DEFAULT_CATEGORY = "websites";

const PROJECTS = [
  {
    id: "fuhrmannsoft",
    title: "fuhrmannsoft.com",
    description: "Дизайн і розробка сайту: від структури та макета до анімацій і запуску",
    image: "images/fuh-poster.jpg",
    video: "media/fuh-demo.mp4",
    url: "https://www.fuhrmannsoft.com/",
    category: "websites",
    orderIndex: 1,
    status: "published",
    openInNewTab: true
  },
  {
    id: "bluepillstudios",
    title: "bluepillstudios.com",
    description: "Дизайн і розробка сайту: від структури та макета до анімацій і запуску",
    image: "images/68971152cba5d4586c0c196a_duccik-image.webp",
    video: null,
    url: "https://www.bluepillstudios.com/",
    category: "websites",
    orderIndex: 2,
    status: "published",
    openInNewTab: true
  },
  {
    id: "europeangranite",
    title: "europeangranitellc.com",
    description: "Дизайн і розробка сайту: від структури та макета до анімацій і запуску",
    image: "images/689711523762f2f611246672_granite-image.webp",
    video: null,
    url: "https://www.europeangranitellc.com/",
    category: "websites",
    orderIndex: 3,
    status: "published",
    openInNewTab: true
  },
  {
    id: "bruitbrothers",
    title: "bruitbrothers.com",
    description: "Дизайн і розробка сайту: від структури та макета до анімацій і запуску",
    image: "images/68971152916faa50ee175c3e_bruit-image.webp",
    video: null,
    url: "https://www.bruitbrothers.com/",
    category: "websites",
    orderIndex: 4,
    status: "published",
    openInNewTab: true
  },
  {
    id: "beyondxp",
    title: "beyondxp.in",
    description: "Дизайн і розробка сайту: від структури та макета до анімацій і запуску",
    image: "images/68971152ce3c415a9cd461b2_beyond-image.webp",
    video: null,
    url: "https://www.beyondxp.in/",
    category: "ecommerce",
    orderIndex: 1,
    status: "published",
    openInNewTab: true
  },
  {
    id: "designer-diary",
    title: "Designer Diary",
    description: "Дизайн і розробка сайту: від структури та макета до анімацій і запуску",
    image: "images/68deef74c00b66148e78481a_dd-cover.png",
    srcset: "images/68deef74c00b66148e78481a_dd-cover-p-500.png 500w, images/68deef74c00b66148e78481a_dd-cover-p-800.png 800w, images/68deef74c00b66148e78481a_dd-cover.png 1080w",
    sizes: "(max-width: 767px) 100vw, 30vw",
    video: null,
    url: "https://community.sivuo.com/dd",
    category: "ai-site",
    orderIndex: 1,
    status: "published",
    openInNewTab: true
  }
];

/* ============ Project cases: tabs, render, video control ============ */

(function () {
  const ARROW_SVG =
    '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    "</svg>";

  const LEAVE_MS = 250; // must stay <= the CSS card transition duration
  const ENTER_STAGGER_MS = 40;

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
    media.href = project.url;
    media.setAttribute("aria-label", project.title);
    if (project.openInNewTab) {
      media.target = "_blank";
      media.rel = "noopener noreferrer";
    }

    const img = document.createElement("img");
    img.className = "project-card__image";
    img.src = project.image;
    img.alt = project.title;
    img.loading = "lazy";
    if (project.srcset) img.srcset = project.srcset;
    if (project.sizes) img.sizes = project.sizes;
    media.appendChild(img);

    if (project.video) {
      const video = document.createElement("video");
      video.className = "project-card__video";
      video.src = project.video;
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

  // Single data source: filter by category + published, sort by orderIndex
  function casesFor(category) {
    return PROJECTS
      .filter(p => p.status === "published" && p.category === category)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }

  function renderCards(category, animateIn) {
    grid.innerHTML = "";
    medias = [];

    const cases = casesFor(category);
    if (!cases.length) {
      const empty = document.createElement("p");
      empty.className = "featured-works__empty";
      empty.textContent = "У цій категорії поки немає кейсів.";
      grid.appendChild(empty);
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

  // Horizontal-only scroll of the tab strip (never scrolls the page vertically)
  function revealActiveTab() {
    const btn = tabButtons.get(activeCategory);
    if (!btn || tabsEl.scrollWidth <= tabsEl.clientWidth) return;
    const target = btn.offsetLeft - (tabsEl.clientWidth - btn.offsetWidth) / 2;
    tabsEl.scrollTo({
      left: Math.max(0, target),
      behavior: reducedMotion ? "auto" : "smooth"
    });
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

    if (reducedMotion) {
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
  renderCards(activeCategory, false);
  observeCards();

  // Teardown: disconnect observers, remove listeners, stop playback
  window.destroyProjectCards = function () {
    cleanupFns.forEach(fn => fn());
    cleanupFns.length = 0;
    setActive(null);
    medias.forEach(stopVideo);
  };
})();
