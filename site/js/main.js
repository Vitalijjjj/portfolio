gsap.registerPlugin(ScrollTrigger, SplitText);

/* ============ CTA title: line-mask reveal, scrubbed by scroll ============ */

function splitWithMasks(container) {
  const split = new SplitText(container, { type: "lines, words" });
  const masks = [];

  split.lines.forEach(line => {
    line.style.position = "relative";
    line.style.overflow = "hidden";

    const m = document.createElement("div");
    m.className = "line-mask";
    line.appendChild(m);
    masks.push(m);
  });

  return { split, masks, container };
}

function animateGroup({ masks, container }) {
  gsap.to(masks, {
    width: "0%",
    duration: 1.2,
    ease: "power2.out",
    stagger: { each: 0.08, from: 0 },
    scrollTrigger: {
      trigger: container,
      start: "top 80%",
      end: "bottom 20%",
      scrub: 0.8
    }
  });
}

function initSplit() {
  document.querySelectorAll("[dd-el='cta-title']").forEach(block => {
    const group = splitWithMasks(block);
    animateGroup(group);
  });
}

document.addEventListener("DOMContentLoaded", function () {

  // Split after fonts load so line breaks are measured correctly
  if (document.fonts) {
    document.fonts.ready.then(initSplit);
  } else {
    window.addEventListener("load", initSplit);
  }

  /* ============ CTA section reveal ============ */

  const ctaTrigger = document.querySelector(".dd-cta-anchor");
  const ctaSection = document.querySelector(".dd-cta");

  const ctaTl = gsap.timeline({
    paused: true,
    onReverseComplete: () => {
      ctaSection.style.visibility = "hidden";
      ctaSection.style.pointerEvents = "none";
    }
  });

  ctaTl.to(".dd-cta__bg-box", {
    clipPath: "polygon(0% 0%, 102% 0%, 102% 102%, 0% 102%)",
    stagger: 0.075,
    ease: "power3.inOut"
  });
  ctaTl.to('[dd-el="cta-el"]', {
    duration: 0.3,
    opacity: 1,
    stagger: 0.05,
    ease: "power1.inOut"
  }, "-=0.5");

  ScrollTrigger.create({
    trigger: ctaTrigger,
    start: "center center",
    end: "bottom top",
    onEnter: () => {
      ctaSection.style.visibility = "visible";
      ctaSection.style.pointerEvents = "auto";
      ctaTl.play();
    },
    onLeaveBack: () => {
      ctaTl.reverse();
    }
  });
});
