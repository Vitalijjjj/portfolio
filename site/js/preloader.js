/* ============================================================
   Преміальний 3D-прелоадер: презентація кейсів у просторі.

   Композиція (за референсом): три площини утворюють розгорнуту
   конструкцію — центральна вертикальна, нижня горизонтальна,
   верхня, що нависає. На них демонструються скриншоти кейсів.

   Модулі: CASES → loadTextures → buildScene → buildTimeline → cleanup
   ============================================================ */

import * as THREE from "./vendor/three.module.min.js";

/* ------------------------------------------------------------
   1. Конфігурація кейсів
   Щоб додати власні скриншоти — покладіть файли в assets/cases/
   і вкажіть шляхи тут. `secondary` необов'язковий: якщо його
   немає, на бічних площинах показується кадрований фрагмент
   основного зображення.
   ------------------------------------------------------------ */

const CASES = [
  {
    title: "Fuhrmannsoft",
    desktop: "images/fuh-poster.jpg",
    secondary: null
  },
  {
    title: "Bluepill Studios",
    desktop: "images/68971152cba5d4586c0c196a_duccik-image.webp",
    secondary: null
  },
  {
    title: "European Granite",
    desktop: "images/689711523762f2f611246672_granite-image.webp",
    secondary: null
  },
  {
    title: "Bruit Brothers",
    desktop: "images/68971152916faa50ee175c3e_bruit-image.webp",
    secondary: null
  },
  {
    title: "Beyond XP",
    desktop: "images/68971152ce3c415a9cd461b2_beyond-image.webp",
    secondary: null
  },
  {
    title: "Designer Diary",
    desktop: "images/68deef74c00b66148e78481a_dd-cover.png",
    secondary: null
  }
];

const SESSION_KEY = "dd-preloader-shown";

/* Тривалості (с) — сумарно ≈ 6.5–7 с на десктопі, ≈ 5.5 с на мобільному */
const T = {
  assemble: 0.95,
  perCase: 0.62,
  collapse: 1.1,
  hold: 0.35,
  reveal: 0.8
};

/* ------------------------------------------------------------
   2. Середовище
   ------------------------------------------------------------ */

const root = document.querySelector(".pl");
const html = document.documentElement;

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobile = window.matchMedia("(max-width: 767px)").matches;

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch (e) {
    return false;
  }
}

/* Слабкий пристрій — спрощуємо або йдемо у CSS-fallback */
const lowPower =
  (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4 && isMobile) ||
  (navigator.deviceMemory && navigator.deviceMemory <= 2);

const activeCases = CASES.slice(0, isMobile ? 4 : CASES.length);

/* ------------------------------------------------------------
   3. Завершення: віддаємо сторінку користувачу
   ------------------------------------------------------------ */

let finished = false;

function finish(cleanupFn) {
  if (finished) return;
  finished = true;

  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch (e) {
    /* приватний режим — просто покажемо ще раз наступного разу */
  }

  html.classList.remove("pl-active", "pl-revealing");
  if (root && root.parentNode) root.parentNode.removeChild(root);
  if (typeof cleanupFn === "function") cleanupFn();

  // Скрол повертаємо і оновлюємо позиції скрол-тригерів
  if (window.lenis) {
    window.lenis.start();
    window.lenis.resize();
  }
  if (window.ScrollTrigger) window.ScrollTrigger.refresh();

  // Запуск hero-анімації основної сторінки
  document.dispatchEvent(new CustomEvent("preloader:complete"));
}

/* Прелоадер уже показували в цій сесії — нічого не робимо */
function skip() {
  html.classList.remove("pl-active", "pl-revealing");
  if (root && root.parentNode) root.parentNode.removeChild(root);
  document.dispatchEvent(new CustomEvent("preloader:complete"));
}

/* ------------------------------------------------------------
   4. Завантаження текстур (анімація не стартує, поки не готові)
   ------------------------------------------------------------ */

function loadTextures(renderer, list) {
  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const one = url =>
    new Promise(resolve => {
      loader.load(
        url,
        tex => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = Math.min(8, maxAniso);
          tex.generateMipmaps = true;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.magFilter = THREE.LinearFilter;
          resolve(tex);
        },
        undefined,
        () => resolve(null) // не валимо прелоадер через одне зображення
      );
    });

  return Promise.all(
    list.map(async c => ({
      title: c.title,
      main: await one(c.desktop),
      secondary: c.secondary ? await one(c.secondary) : null
    }))
  );
}

/* М'яка контактна тінь — радіальний градієнт на canvas */
function makeShadowTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(0,0,0,0.42)");
  g.addColorStop(0.45, "rgba(0,0,0,0.16)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------
   5. Матеріал площини
   Кросфейд між кейсами + десатурація/затемнення у фіналі
   + cover-fit (щоб квадратні скриншоти не розтягувались)
   ------------------------------------------------------------ */

const VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = `
  precision highp float;
  varying vec2 vUv;

  uniform sampler2D uTexA;
  uniform sampler2D uTexB;
  uniform float uMix;        // 0 = A, 1 = B
  uniform float uHasB;
  uniform float uSat;        // 1 = колір, 0 = монохром
  uniform float uBright;
  uniform float uOpacity;
  uniform float uSlide;      // легкий зсув текстури під час зміни
  uniform vec2  uCoverA;     // cover-fit масштаб
  uniform vec2  uCoverB;
  uniform vec2  uCropA;      // зум для вторинних площин
  uniform vec2  uCropB;
  uniform vec3  uFlat;       // колір суцільної картки у фіналі
  uniform float uFlatMix;

  vec4 sampleCover(sampler2D tex, vec2 uv, vec2 cover, vec2 crop, float slide) {
    vec2 p = (uv - 0.5) * cover * crop + 0.5;
    p.x += slide;
    p = clamp(p, 0.001, 0.999);
    return texture2D(tex, p);
  }

  void main() {
    vec4 a = sampleCover(uTexA, vUv, uCoverA, uCropA, uSlide);
    vec4 b = uHasB > 0.5 ? sampleCover(uTexB, vUv, uCoverB, uCropB, uSlide - 0.03) : a;
    vec3 col = mix(a.rgb, b.rgb, uMix);

    // десатурація
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(lum), col, uSat);
    col *= uBright;

    // перехід у брендовану картку
    col = mix(col, uFlat, uFlatMix);

    gl_FragColor = vec4(col, uOpacity);
  }
`;

function makeMaterial(planeAspect) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    uniforms: {
      uTexA: { value: null },
      uTexB: { value: null },
      uMix: { value: 0 },
      uHasB: { value: 0 },
      uSat: { value: 1 },
      uBright: { value: 1 },
      uOpacity: { value: 1 },
      uSlide: { value: 0 },
      uCoverA: { value: new THREE.Vector2(1, 1) },
      uCoverB: { value: new THREE.Vector2(1, 1) },
      uCropA: { value: new THREE.Vector2(1, 1) },
      uCropB: { value: new THREE.Vector2(1, 1) },
      uFlat: { value: new THREE.Color(0x0a0a0a) },
      uFlatMix: { value: 0 }
    },
    userData: { planeAspect }
  });
}

/* cover-fit: скільки UV займає зображення, щоб заповнити площину */
function coverScale(planeAspect, texture) {
  if (!texture || !texture.image) return new THREE.Vector2(1, 1);
  const texAspect = texture.image.width / texture.image.height;
  return planeAspect > texAspect
    ? new THREE.Vector2(1, texAspect / planeAspect)
    : new THREE.Vector2(planeAspect / texAspect, 1);
}

/* ------------------------------------------------------------
   6. Сцена
   ------------------------------------------------------------ */

function buildScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 2 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();

  // Мінімальна перспектива — архітектурний, не «риб'яче око»
  // Один fov для всіх екранів — характер перспективи однаковий скрізь,
  // а різницю пропорцій компенсує автоматичне кадрування (frameDistance).
  const FOV = 28;

  const camera = new THREE.PerspectiveCamera(
    FOV,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );

  const group = new THREE.Group();
  scene.add(group);

  // Розміри площин однакові на всіх екранах — композиція має читатися
  // так само; під розмір екрана підлаштовується лише камера.
  const W = 3;
  const H = 3;
  const D_BOTTOM = 2.6;
  const D_TOP = 2.2;

  const planes = [];

  function makePlane(w, h, parent, localPos) {
    const geo = new THREE.PlaneGeometry(w, h, 1, 1);
    const mat = makeMaterial(w / h);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(localPos);
    parent.add(mesh);

    // Тонке ребро — архітектурний акцент
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 })
    );
    edges.position.copy(localPos);
    parent.add(edges);

    planes.push({ mesh, mat, geo, edges });
    return mesh;
  }

  // Центральна вертикальна площина
  const centerHinge = new THREE.Group();
  group.add(centerHinge);
  const center = makePlane(W, H, centerHinge, new THREE.Vector3(0, 0, 0));

  // Нижня — шарнір по нижньому ребру центральної, розкладається вперед
  const bottomHinge = new THREE.Group();
  bottomHinge.position.set(0, -H / 2, 0);
  group.add(bottomHinge);
  makePlane(W, D_BOTTOM, bottomHinge, new THREE.Vector3(0, -D_BOTTOM / 2, 0));

  // Верхня — шарнір по верхньому ребру, нависає вперед-угору
  const topHinge = new THREE.Group();
  topHinge.position.set(0, H / 2, 0);
  group.add(topHinge);
  makePlane(W, D_TOP, topHinge, new THREE.Vector3(0, D_TOP / 2, 0));

  // Контактна тінь під конструкцією
  const shadowTex = makeShadowTexture();
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 2.6, D_BOTTOM * 2.6),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, -H / 2 - 0.02, D_BOTTOM * 0.35);
  group.add(shadow);

  /* Автоматичне кадрування.
     Габарити розгорнутої конструкції у світових одиницях:
       по висоті — від підлоги (-H/2) до верхнього краю нахиленої верхньої площини;
       по ширині — W плюс приріст від повороту камери та винесеної вперед підлоги.
     Дистанція береться як максимум із двох вимог (вписати по висоті / по ширині),
     тож на портретному екрані камера від'їжджає рівно настільки, скільки треба. */
  const OPEN_TOP_ANGLE = 0.70;
  const compTop = H / 2 + D_TOP * Math.cos(OPEN_TOP_ANGLE);
  const compBottom = -H / 2;
  const compH = compTop - compBottom;
  const compW = W * Math.cos(0.34) + D_BOTTOM * Math.sin(0.34); // з урахуванням оберту
  const compCenterY = (compTop + compBottom) / 2;

  const FILL_V = 0.55; // яку частку висоти кадру займає композиція
  const FILL_H = 0.70; // ...і ширини

  function frameDistance() {
    const aspect = window.innerWidth / window.innerHeight;
    const k = 2 * Math.tan((FOV * Math.PI) / 180 / 2);
    return Math.max(compH / (k * FILL_V), compW / (k * aspect * FILL_H));
  }

  // Камера на сфері навколо композиції
  const cam = {
    radius: frameDistance(),
    theta: -0.34,
    phi: 0.30,
    targetY: compCenterY * 0.8 // трохи нижче геометричного центру: підлога «важча»
  };

  function updateCamera() {
    camera.position.set(
      cam.radius * Math.sin(cam.theta) * Math.cos(cam.phi),
      cam.radius * Math.sin(cam.phi) + cam.targetY,
      cam.radius * Math.cos(cam.theta) * Math.cos(cam.phi)
    );
    camera.lookAt(0, cam.targetY, 0);
  }
  updateCamera();

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    updateCamera();
  }
  window.addEventListener("resize", resize, { passive: true });

  return {
    renderer, scene, camera, group, planes, shadow, shadowTex,
    hinges: { center: centerHinge, bottom: bottomHinge, top: topHinge },
    cam, updateCamera, resize,
    dims: { W, H, D_BOTTOM, D_TOP }
  };
}

/* ------------------------------------------------------------
   7. Таймлайн
   ------------------------------------------------------------ */

function buildTimeline(ctx, textures) {
  const gsap = window.gsap;
  const { planes, hinges, shadow, cam, updateCamera } = ctx;

  const centerMat = planes[0].mat;
  const bottomMat = planes[1].mat;
  const topMat = planes[2].mat;
  const sideMats = [bottomMat, topMat];

  const counterEl = root.querySelector(".pl__counter b");
  const totalEl = root.querySelector(".pl__counter i");
  const titleEl = root.querySelector(".pl__title");
  const progressBar = root.querySelector(".pl__progress i");

  const pad = n => String(n).padStart(2, "0");
  totalEl.textContent = pad(textures.length);

  /* Початковий кейс */
  function applyCase(index, slot) {
    const t = textures[index];
    if (!t || !t.main) return;

    const setOn = (mat, tex, crop) => {
      const key = slot === "A" ? "uTexA" : "uTexB";
      const coverKey = slot === "A" ? "uCoverA" : "uCoverB";
      const cropKey = slot === "A" ? "uCropA" : "uCropB";
      mat.uniforms[key].value = tex;
      mat.uniforms[coverKey].value = coverScale(mat.userData.planeAspect, tex);
      mat.uniforms[cropKey].value = crop;
      if (slot === "B") mat.uniforms.uHasB.value = 1;
    };

    // Центральна — головний екран сайту
    setOn(centerMat, t.main, new THREE.Vector2(1, 1));
    // Бічні — окреме зображення або кадрований фрагмент того самого
    const secondary = t.secondary || t.main;
    setOn(bottomMat, secondary, new THREE.Vector2(0.62, 0.62));
    setOn(topMat, secondary, new THREE.Vector2(0.78, 0.78));
  }

  applyCase(0, "A");

  function setMeta(index) {
    counterEl.textContent = pad(index + 1);
    titleEl.textContent = textures[index].title;
  }
  setMeta(0);

  /* Стартовий (складений) стан */
  gsap.set(hinges.bottom.rotation, { x: 0 });
  gsap.set(hinges.top.rotation, { x: 0 });
  gsap.set(hinges.center.scale, { y: 0.001 });
  gsap.set([centerMat.uniforms.uOpacity, bottomMat.uniforms.uOpacity, topMat.uniforms.uOpacity], { value: 0 });
  planes.forEach(p => gsap.set(p.edges.material, { opacity: 0 }));

  const OPEN_BOTTOM = -Math.PI / 2;   // нижня лягає вперед
  const OPEN_TOP = 0.70;              // верхня нависає вперед-угору (≈40°), збігається з OPEN_TOP_ANGLE у buildScene

  const tl = gsap.timeline({
    defaults: { ease: "power3.out" },
    onUpdate: updateCamera
  });

  /* ---- Етап 1: поява конструкції ---- */

  tl.to(centerMat.uniforms.uOpacity, { value: 1, duration: 0.5 }, 0)
    .to(hinges.center.scale, { y: 1, duration: T.assemble, ease: "power3.out" }, 0)
    .to(hinges.bottom.rotation, { x: OPEN_BOTTOM, duration: T.assemble, ease: "power3.inOut" }, 0.18)
    .to(bottomMat.uniforms.uOpacity, { value: 1, duration: 0.5 }, 0.18)
    .to(hinges.top.rotation, { x: OPEN_TOP, duration: T.assemble, ease: "power3.inOut" }, 0.30)
    .to(topMat.uniforms.uOpacity, { value: 1, duration: 0.5 }, 0.30)
    .to(shadow.material, { opacity: 1, duration: 0.8 }, 0.35)
    .to(planes.map(p => p.edges.material), { opacity: 0.18, duration: 0.6, stagger: 0.06 }, 0.3)
    // делікатний zoom-in камери
    .to(cam, { radius: cam.radius * 0.93, duration: T.assemble + 0.4, ease: "power2.out" }, 0)
    .to(".pl__meta", { opacity: 1, duration: 0.5 }, 0.55)
    .to(".pl__progress", { opacity: 1, duration: 0.5 }, 0.55);

  /* ---- Етап 2: демонстрація кейсів ---- */

  const showStart = T.assemble * 0.75;
  const total = textures.length;

  // прогрес-лінія на весь показ
  tl.to(progressBar, {
    scaleX: 1,
    duration: T.perCase * total,
    ease: "none"
  }, showStart);

  for (let i = 1; i < total; i++) {
    const at = showStart + i * T.perCase;

    tl.call(() => applyCase(i, "B"), null, at)
      // crossfade + легкий slide текстури
      .fromTo([centerMat.uniforms.uMix, bottomMat.uniforms.uMix, topMat.uniforms.uMix],
        { value: 0 },
        { value: 1, duration: T.perCase * 0.62, ease: "power2.inOut" }, at)
      .fromTo([centerMat.uniforms.uSlide, bottomMat.uniforms.uSlide, topMat.uniforms.uSlide],
        { value: 0.02 },
        { value: 0, duration: T.perCase * 0.8, ease: "power2.out" }, at)
      // короткий flip площин (≈12°) — «жива» інсталяція
      .to(hinges.top.rotation, {
        x: OPEN_TOP + (i % 2 ? 0.2 : -0.14),
        duration: T.perCase, ease: "power2.inOut"
      }, at)
      .to(hinges.bottom.rotation, {
        x: OPEN_BOTTOM + (i % 2 ? -0.1 : 0.16),
        duration: T.perCase, ease: "power2.inOut"
      }, at)
      .call(() => {
        setMeta(i);
        // B стає A, готуємось до наступного переходу
        [centerMat, bottomMat, topMat].forEach(m => {
          m.uniforms.uTexA.value = m.uniforms.uTexB.value;
          m.uniforms.uCoverA.value = m.uniforms.uCoverB.value;
          m.uniforms.uCropA.value = m.uniforms.uCropB.value;
          m.uniforms.uMix.value = 0;
        });
      }, null, at + T.perCase * 0.62);
  }

  // Повільний оберт камери протягом усього показу
  tl.to(cam, {
    theta: 0.30,
    phi: 0.20,
    duration: T.assemble + T.perCase * total,
    ease: "sine.inOut"
  }, 0);

  /* ---- Етап 3: фінальна трансформація ---- */

  const collapseAt = showStart + total * T.perCase;

  tl.to([centerMat.uniforms.uSat, bottomMat.uniforms.uSat, topMat.uniforms.uSat],
      { value: 0, duration: T.collapse * 0.55, ease: "power2.inOut" }, collapseAt)
    .to([centerMat.uniforms.uBright, bottomMat.uniforms.uBright, topMat.uniforms.uBright],
      { value: 0.25, duration: T.collapse * 0.7, ease: "power2.inOut" }, collapseAt)
    // бічні площини складаються до центральної і втягуються у ребро
    .to([hinges.bottom.rotation, hinges.top.rotation],
      { x: 0, duration: T.collapse * 0.75, ease: "power3.inOut" }, collapseAt + 0.1)
    .to([hinges.bottom.scale, hinges.top.scale],
      { y: 0.001, duration: T.collapse * 0.6, ease: "power3.in" }, collapseAt + 0.35)
    .to(sideMats.map(m => m.uniforms.uOpacity),
      { value: 0, duration: T.collapse * 0.4 }, collapseAt + 0.5)
    // центральна стає компактною брендованою карткою
    .to(centerMat.uniforms.uFlatMix,
      { value: 1, duration: T.collapse * 0.5, ease: "power2.inOut" }, collapseAt + 0.35)
    .to(hinges.center.scale,
      { x: 0.82, y: 0.56, duration: T.collapse * 0.7, ease: "power3.inOut" }, collapseAt + 0.3)
    // камера вирівнюється фронтально
    .to(cam,
      { theta: 0, phi: 0.02, radius: cam.radius * 0.78, targetY: 0, duration: T.collapse, ease: "power3.inOut" }, collapseAt)
    .to(planes.map(p => p.edges.material), { opacity: 0, duration: 0.4 }, collapseAt + 0.3)
    .to(shadow.material, { opacity: 0.55, duration: 0.6 }, collapseAt + 0.4)
    .to([".pl__meta", ".pl__progress"], { opacity: 0, duration: 0.35 }, collapseAt);

  /* ---- Логотип ---- */

  const logoAt = collapseAt + T.collapse * 0.62;

  tl.set(".pl__brand", { opacity: 1 }, logoAt)
    .fromTo(".pl__logo",
      { opacity: 0, scale: 0.94, filter: "blur(10px)" },
      { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.75, ease: "power2.out" }, logoAt)
    .fromTo(".pl__tagline",
      { opacity: 0, clipPath: "inset(0 0 100% 0)" },
      { opacity: 1, clipPath: "inset(0 0 0% 0)", duration: 0.6, ease: "power2.out" }, logoAt + 0.22);

  /* ---- Етап 4: відкриття сайту ---- */

  const revealAt = logoAt + 0.75 + T.hold;

  tl.to(".pl__logo", { scale: 1.06, duration: T.reveal, ease: "power2.in" }, revealAt)
    .to(".pl__tagline", { opacity: 0, duration: 0.3 }, revealAt)
    .to(root, {
      yPercent: -100,
      duration: T.reveal,
      ease: "power3.inOut",
      onStart: () => {
        // Контент показуємо саме тут — «завіса» відкриває готову сторінку
        html.classList.add("pl-revealing");
      }
    }, revealAt + 0.05);

  return tl;
}

/* ------------------------------------------------------------
   8. CSS-fallback (без WebGL / дуже слабкий пристрій)
   ------------------------------------------------------------ */

function runFallback() {
  const gsap = window.gsap;
  root.classList.add("pl--fallback");

  const stage = root.querySelector(".pl__fb-stage");
  const list = activeCases.slice(0, 4);

  const cards = list.map((c, i) => {
    const el = document.createElement("div");
    el.className = "pl__fb-card";
    el.style.backgroundImage = `url("${c.desktop}")`;
    el.style.transform = `translateZ(${-i * 26}px)`;
    stage.appendChild(el);
    return el;
  });

  const tl = gsap.timeline({
    onComplete: () => finish(null)
  });

  cards.forEach((card, i) => {
    tl.to(card, { opacity: 1, duration: 0.45, ease: "power2.out" }, i * 0.7)
      .to(card, { opacity: 0, duration: 0.4 }, i * 0.7 + 0.7);
  });

  const end = cards.length * 0.7;
  tl.to(".pl__meta", { opacity: 0, duration: 0.3 }, end)
    .set(".pl__brand", { opacity: 1 }, end)
    .fromTo(".pl__logo",
      { opacity: 0, scale: 0.94, filter: "blur(8px)" },
      { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.7, ease: "power2.out" }, end)
    .to(root, {
      yPercent: -100, duration: 0.8, ease: "power3.inOut",
      onStart: () => html.classList.add("pl-revealing")
    }, end + 1.1);

  // У fallback логотип лягає на світлий фон
  root.querySelector(".pl__logo").style.backgroundColor = "#000";
}

/* ------------------------------------------------------------
   9. reduced-motion: коротка поява логотипа і одразу сайт
   ------------------------------------------------------------ */

function runReduced() {
  const gsap = window.gsap;
  root.querySelector(".pl__logo").style.backgroundColor = "#000";
  gsap.set(".pl__brand", { opacity: 1 });
  gsap.timeline({ onComplete: () => finish(null) })
    .to(".pl__logo", { opacity: 1, duration: 0.35 })
    .to(root, { opacity: 0, duration: 0.35, delay: 0.35, onStart: () => html.classList.add("pl-revealing") });
}

/* ------------------------------------------------------------
   10. Старт
   ------------------------------------------------------------ */

function boot() {
  if (!root) return;

  // Показуємо один раз за сесію
  let seen = false;
  try {
    seen = sessionStorage.getItem(SESSION_KEY) === "1";
  } catch (e) { /* ignore */ }

  if (seen) {
    skip();
    return;
  }

  if (!window.gsap) {
    // Без GSAP анімувати нічим — не тримаємо користувача
    finish(null);
    return;
  }

  // Скрол заблокований класом на <html>; Lenis теж зупиняємо
  if (window.lenis) window.lenis.stop();

  if (reducedMotion) {
    runReduced();
    return;
  }

  if (!hasWebGL() || lowPower) {
    runFallback();
    return;
  }

  const canvas = root.querySelector(".pl__canvas");
  let ctx;
  try {
    ctx = buildScene(canvas);
  } catch (e) {
    runFallback();
    return;
  }

  let rafId = 0;
  let tl = null;

  const cleanup = () => {
    if (rafId) cancelAnimationFrame(rafId);
    if (tl) tl.kill();
    window.removeEventListener("resize", ctx.resize);
    ctx.planes.forEach(p => {
      p.geo.dispose();
      p.mat.dispose();
      p.edges.geometry.dispose();
      p.edges.material.dispose();
    });
    ctx.shadow.geometry.dispose();
    ctx.shadow.material.dispose();
    ctx.shadowTex.dispose();
    textures.forEach(t => {
      if (t.main) t.main.dispose();
      if (t.secondary) t.secondary.dispose();
    });
    ctx.renderer.dispose();
    ctx.scene.clear();
  };

  let textures = [];

  // Анімація стартує лише після завантаження всіх текстур
  loadTextures(ctx.renderer, activeCases).then(loaded => {
    textures = loaded.filter(t => t.main);

    if (!textures.length) {
      cleanup();
      runFallback();
      return;
    }

    const render = () => {
      ctx.renderer.render(ctx.scene, ctx.camera);
      rafId = requestAnimationFrame(render);
    };
    render();

    tl = buildTimeline(ctx, textures);
    tl.eventCallback("onComplete", () => finish(cleanup));
  });

  // Страховка: якщо щось піде не так — сайт відкриється попри все
  setTimeout(() => finish(cleanup), 14000);
}

boot();
