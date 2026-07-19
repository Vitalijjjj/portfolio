/* ============ Project cards: data ============ */

const PROJECTS = [
  {
    title: "fuhrmannsoft.com",
    description: "Дизайн і розробка сайту: від структури та макета до анімацій і запуску",
    image: "images/fuh-poster.jpg",
    video: "media/fuh-demo.mp4",
    url: "https://www.fuhrmannsoft.com/"
  },
  {
    title: "bluepillstudios.com",
    description: "Дизайн і розробка сайту: від структури та макета до анімацій і запуску",
    image: "images/68971152cba5d4586c0c196a_duccik-image.webp",
    video: null,
    url: "https://www.bluepillstudios.com/"
  },
  {
    title: "Designer Diary",
    description: "Дизайн і розробка сайту: від структури та макета до анімацій і запуску",
    image: "images/68deef74c00b66148e78481a_dd-cover.png",
    srcset: "images/68deef74c00b66148e78481a_dd-cover-p-500.png 500w, images/68deef74c00b66148e78481a_dd-cover-p-800.png 800w, images/68deef74c00b66148e78481a_dd-cover.png 1080w",
    sizes: "(max-width: 767px) 100vw, 30vw",
    video: null,
    url: "https://community.sivuo.com/dd"
  },
  {
    title: "europeangranitellc.com",
    description: "Дизайн і розробка сайту: від структури та макета до анімацій і запуску",
    image: "images/689711523762f2f611246672_granite-image.webp",
    video: null,
    url: "https://www.europeangranitellc.com/"
  },
  {
    title: "bruitbrothers.com",
    description: "Дизайн і розробка сайту: від структури та макета до анімацій і запуску",
    image: "images/68971152916faa50ee175c3e_bruit-image.webp",
    video: null,
    url: "https://www.bruitbrothers.com/"
  },
  {
    title: "beyondxp.in",
    description: "Дизайн і розробка сайту: від структури та макета до анімацій і запуску",
    image: "images/68971152ce3c415a9cd461b2_beyond-image.webp",
    video: null,
    url: "https://www.beyondxp.in/"
  }
];

/* ============ Project cards: render + video control ============ */

(function () {
  const ARROW_SVG =
    '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    "</svg>";

  const grid = document.getElementById("projects-grid");
  if (!grid) return;

  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const medias = [];
  const cleanupFns = [];
  let activeMedia = null;

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

  function createCard(project) {
    const card = document.createElement("article");
    card.className = "project-card";

    const media = document.createElement("a");
    media.className = "project-card__media";
    media.href = project.url;
    media.setAttribute("aria-label", project.title);
    if (/^https?:\/\//.test(project.url)) {
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
      const onEnter = () => setActive(media);
      const onLeave = () => {
        if (activeMedia === media) setActive(null);
      };
      media.addEventListener("mouseenter", onEnter);
      media.addEventListener("mouseleave", onLeave);
      cleanupFns.push(() => {
        media.removeEventListener("mouseenter", onEnter);
        media.removeEventListener("mouseleave", onLeave);
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
    medias.push(media);
    return card;
  }

  PROJECTS.forEach(project => grid.appendChild(createCard(project)));

  /* Touch devices: the card nearest to the viewport center becomes active */
  if (!canHover && "IntersectionObserver" in window) {
    const intersecting = new Set();

    const updateActive = () => {
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
    };

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) intersecting.add(entry.target);
        else intersecting.delete(entry.target);
      });
      updateActive();
    }, {
      // central band of the viewport
      rootMargin: "-35% 0px -35% 0px",
      threshold: 0
    });

    medias.forEach(media => observer.observe(media));

    // While two cards overlap the central band, re-pick the closest one on scroll
    let rafId = 0;
    const onScroll = () => {
      if (intersecting.size < 2 || rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        updateActive();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    cleanupFns.push(() => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (rafId) cancelAnimationFrame(rafId);
      intersecting.clear();
    });
  }

  // Teardown: disconnect observers, remove listeners, stop playback
  window.destroyProjectCards = function () {
    cleanupFns.forEach(fn => fn());
    cleanupFns.length = 0;
    setActive(null);
    medias.forEach(stopVideo);
  };
})();
