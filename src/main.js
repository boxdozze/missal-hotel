import "./style.css";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Confirma que o JS está rodando e vai controlar a revelação de
// [data-reveal] (ver src/style.css). Precisa vir antes de qualquer
// IntersectionObserver/classList relacionado a reveal.
document.documentElement.classList.add("js-reveal-ready");

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

/**
 * CTA secundário "Conhecer o hotel": rola até o fim do hero.
 * Rolagem suave nativa do navegador, respeitando prefers-reduced-motion.
 */
document.querySelectorAll("[data-scroll-target]").forEach((trigger) => {
  trigger.addEventListener("click", () => {
    const targetSelector = trigger.getAttribute("data-scroll-target");
    const target = document.querySelector(targetSelector);

    if (!target) return;

    target.scrollIntoView({
      behavior: reduceMotionQuery.matches ? "auto" : "smooth",
      block: "start",
    });
  });
});

/* ==========================================================================
   Animação de scroll do hero (GSAP + ScrollTrigger)
   ========================================================================== */

// Elementos que recebem will-change:transform apenas enquanto o hero está
// em viewport (classe alternada nos callbacks do ScrollTrigger).
const WILL_CHANGE_SELECTORS = [
  ".hero__media",
  ".hero__content",
  ".hero__eyebrow",
  ".hero__title",
  ".hero__surface-rise",
];

function toggleHeroWillChange(active) {
  WILL_CHANGE_SELECTORS.forEach((selector) => {
    document.querySelectorAll(selector).forEach((el) => {
      el.classList.toggle("is-hero-animating", active);
    });
  });
}

// Guarda de foco: durante a Fase C, .hero__surface-rise cobre visualmente os
// CTAs do hero, mas eles continuam focáveis via Tab. Tira-os da ordem de
// tabulação quando o progresso da timeline ultrapassa ~0.90, restaurando
// abaixo disso. Nunca mexe no botão de reserva do cabeçalho.
const HERO_FOCUS_THRESHOLD = 0.9;
let heroCtaFocusLocked = false;

function updateHeroFocusGuard(progress) {
  const shouldLock = progress > HERO_FOCUS_THRESHOLD;
  if (shouldLock === heroCtaFocusLocked) return;
  heroCtaFocusLocked = shouldLock;

  document.querySelectorAll(".hero__ctas .btn").forEach((cta) => {
    if (shouldLock) {
      cta.dataset.originalTabindex = cta.hasAttribute("tabindex") ? cta.getAttribute("tabindex") : "";
      cta.setAttribute("tabindex", "-1");
    } else {
      if (cta.dataset.originalTabindex) {
        cta.setAttribute("tabindex", cta.dataset.originalTabindex);
      } else {
        cta.removeAttribute("tabindex");
      }
      delete cta.dataset.originalTabindex;
    }
  });
}

function resetHeroFocusGuard() {
  if (!heroCtaFocusLocked) return;
  updateHeroFocusGuard(0);
}

/**
 * Monta a timeline do hero para uma faixa de breakpoint (mobile, tablet ou
 * desktop). Os pontos de progresso (posições/durações na timeline) e os
 * valores de deslocamento vêm da especificação do motion designer.
 */
function buildHeroTimeline({
  mediaScaleFrom,
  mediaY,
  contentY,
  eyebrowExtraY,
  titleExtraY,
  contentOpacityTo,
  phaseBgDuration,
  phaseContentStart,
  phaseContentDuration,
  highlightsPositions,
  highlightsDuration,
  phaseCStart,
  phaseCDuration,
}) {
  // Estados iniciais (fora da timeline, aplicados antes de o scroll começar).
  gsap.set(".hero__media", { scale: mediaScaleFrom });
  gsap.set(".hero__vignette", { opacity: 0.82 });
  gsap.set(".hero__highlights li", { opacity: 0, y: 16 });
  // "y: 0" é necessário aqui porque o CSS de repouso já define
  // transform: translateY(100%); sem isso o GSAP lê esse valor como um
  // deslocamento fixo em px (calculado uma vez a partir da altura do
  // elemento) e o soma ao yPercent animado, então a superfície nunca sobe
  // por completo. Zerando "y" explicitamente, só o yPercent controla o
  // movimento.
  gsap.set(".hero__surface-rise", { y: 0, yPercent: 100 });
  gsap.set(".hero__ctas .btn--primary", { clearProps: "all" }); // CTA principal sempre visível, nunca anima

  const heroTimeline = gsap.timeline({
    scrollTrigger: {
      trigger: ".hero-frame",
      start: "top top",
      end: "bottom bottom",
      scrub: 0.6,
      invalidateOnRefresh: true,
      onEnter: () => toggleHeroWillChange(true),
      onLeave: () => toggleHeroWillChange(false),
      onEnterBack: () => toggleHeroWillChange(true),
      onLeaveBack: () => toggleHeroWillChange(false),
    },
    onUpdate: function () {
      updateHeroFocusGuard(this.progress());
    },
  });

  heroTimeline
    .to(".hero__media", { scale: 1, y: mediaY, ease: "power1.out", duration: phaseBgDuration }, 0)
    .to(".hero__vignette", { opacity: 1, ease: "sine.inOut", duration: phaseBgDuration }, 0)
    .to(
      ".hero__content",
      { y: contentY, opacity: contentOpacityTo, ease: "power1.out", duration: phaseContentDuration },
      phaseContentStart
    );

  // Mobile não tem deltas extras separados em eyebrow/título — o conteúdo
  // se move como bloco único.
  if (eyebrowExtraY !== 0) {
    heroTimeline.to(
      ".hero__eyebrow",
      { y: eyebrowExtraY, ease: "power1.out", duration: phaseContentDuration },
      phaseContentStart
    );
  }
  if (titleExtraY !== 0) {
    heroTimeline.to(
      ".hero__title",
      { y: titleExtraY, ease: "power1.out", duration: phaseContentDuration },
      phaseContentStart
    );
  }

  highlightsPositions.forEach((position, index) => {
    heroTimeline.to(
      `.hero__highlights li:nth-child(${index + 1})`,
      { opacity: 1, y: 0, ease: "power2.out", duration: highlightsDuration },
      position
    );
  });

  heroTimeline.to(
    ".hero__surface-rise",
    { yPercent: 0, ease: "power1.inOut", duration: phaseCDuration },
    phaseCStart
  );

  return heroTimeline;
}

function initHeroScrollTimeline() {
  ScrollTrigger.matchMedia({
    // Mobile: <768px
    "(max-width: 767px)": () =>
      buildHeroTimeline({
        mediaScaleFrom: 1.02,
        mediaY: -24,
        contentY: -40,
        eyebrowExtraY: 0,
        titleExtraY: 0,
        contentOpacityTo: 0.75,
        phaseBgDuration: 0.3,
        phaseContentStart: 0.2,
        phaseContentDuration: 0.35,
        highlightsPositions: [0.35, 0.44, 0.53],
        highlightsDuration: 0.12,
        phaseCStart: 0.7,
        phaseCDuration: 0.3,
      }),

    // Tablet: 768px–1199px
    "(min-width: 768px) and (max-width: 1199px)": () =>
      buildHeroTimeline({
        mediaScaleFrom: 1.045,
        mediaY: -18,
        contentY: -36,
        eyebrowExtraY: -12,
        titleExtraY: -5,
        contentOpacityTo: 0.7,
        phaseBgDuration: 0.3,
        phaseContentStart: 0.2,
        phaseContentDuration: 0.35,
        highlightsPositions: [0.35, 0.44, 0.53],
        highlightsDuration: 0.12,
        phaseCStart: 0.7,
        phaseCDuration: 0.3,
      }),

    // Desktop: >=1200px (valores exatos da especificação)
    "(min-width: 1200px)": () =>
      buildHeroTimeline({
        mediaScaleFrom: 1.045,
        mediaY: -24,
        contentY: -52,
        eyebrowExtraY: -15,
        titleExtraY: -8,
        contentOpacityTo: 0.7,
        phaseBgDuration: 0.3,
        phaseContentStart: 0.2,
        phaseContentDuration: 0.35,
        highlightsPositions: [0.35, 0.44, 0.53],
        highlightsDuration: 0.12,
        phaseCStart: 0.7,
        phaseCDuration: 0.3,
      }),
  });

  // Resincroniza depois que a fonte Gilda Display carregar (evita medições
  // erradas de altura por causa de reflow tardio da fonte).
  document.fonts.ready.then(() => {
    ScrollTrigger.refresh();
  });
}

function revertHeroElementsToFinalState() {
  gsap.set(
    [
      ".hero__media",
      ".hero__vignette",
      ".hero__content",
      ".hero__eyebrow",
      ".hero__title",
      ".hero__highlights li",
      ".hero__surface-rise",
      ".hero__ctas .btn--primary",
    ],
    { clearProps: "all" }
  );
}

function setupHeroScrollAnimation() {
  if (reduceMotionQuery.matches) {
    // Não inicializa a timeline nem aplica gsap.set de estado "escondido".
    // O conteúdo permanece 100% visível no estado final definido pelo CSS,
    // e .hero__surface-rise fica com transform: translateY(100%) fixo
    // (fora de tela), deixando #hero-fim + .surface-transition como o
    // mecanismo estático de transição.
    return;
  }

  initHeroScrollTimeline();
}

setupHeroScrollAnimation();

/* ==========================================================================
   Vídeo de fundo do Hero (fachada real)
   Carregado e reproduzido somente em desktop (>=641px) e sem
   prefers-reduced-motion. No celular, apenas a imagem estática
   (hero-fachada-mobile.webp, via <picture>/CSS) é exibida — o <video>
   nunca recebe "src" nesse caso, então o MP4 nunca é baixado.
   ========================================================================== */
const heroMedia = document.querySelector(".hero__media");
const heroVideo = heroMedia ? heroMedia.querySelector(".hero__media-video") : null;
const heroDesktopQuery = window.matchMedia("(min-width: 641px)");

function heroVideoShouldPlay() {
  return Boolean(heroVideo) && heroDesktopQuery.matches && !reduceMotionQuery.matches;
}

function activateHeroVideo() {
  if (!heroVideo) return;
  if (!heroVideo.getAttribute("src")) {
    heroVideo.setAttribute("src", `${import.meta.env.BASE_URL}media/${heroVideo.dataset.src}`);
    heroVideo.load();
  }
  heroMedia.classList.add("hero__media--video-ready");
  heroVideo.play().catch(() => {});
}

function deactivateHeroVideo() {
  if (!heroVideo) return;
  heroMedia.classList.remove("hero__media--video-ready");
  heroVideo.pause();
  if (heroVideo.getAttribute("src")) {
    // Remove o src ao sair das condições (ex.: redimensionar para mobile ou
    // ativar movimento reduzido) para garantir que nenhum byte do MP4
    // continue sendo baixado/reproduzido fora do desktop com motion ativo.
    heroVideo.removeAttribute("src");
    heroVideo.load();
  }
}

function syncHeroVideoState() {
  if (heroVideoShouldPlay()) {
    activateHeroVideo();
  } else {
    deactivateHeroVideo();
  }
}

if (heroVideo) {
  syncHeroVideoState();
  heroDesktopQuery.addEventListener("change", syncHeroVideoState);

  // Pausa o vídeo quando o Hero sai da área visível; retoma ao voltar,
  // sempre respeitando as condições de desktop e movimento reduzido.
  const heroVisibilityObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!heroVideo.getAttribute("src")) return;
        if (entry.isIntersecting && heroVideoShouldPlay()) {
          heroVideo.play().catch(() => {});
        } else {
          heroVideo.pause();
        }
      });
    },
    { threshold: 0.1 }
  );
  const heroFrameEl = document.querySelector(".hero-frame");
  if (heroFrameEl) heroVisibilityObserver.observe(heroFrameEl);
}

/* ==========================================================================
   Revelação de entrada das seções pós-hero (fade + translateY)
   Dispara uma vez por elemento, via IntersectionObserver. Sem GSAP.
   ========================================================================== */
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-inview");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.2, rootMargin: "0px 0px -10% 0px" }
);

function initSectionReveals() {
  const revealEls = document.querySelectorAll("[data-reveal]");
  if (reduceMotionQuery.matches) {
    revealEls.forEach((el) => el.classList.add("is-inview"));
    return;
  }
  revealEls.forEach((el) => revealObserver.observe(el));
}
initSectionReveals();

/* ==========================================================================
   Parallax discreto das mídias placeholder (seções 2 e 4)
   Um único loop requestAnimationFrame compartilhado; participação dos
   elementos controlada por um IntersectionObserver secundário.
   ========================================================================== */
const PARALLAX_RANGE_DESKTOP = 8;
const PARALLAX_RANGE_MOBILE = 4;
const PARALLAX_MOBILE_BREAKPOINT = 768;

const activeParallaxEls = new Set();
let parallaxRafId = null;

function applyParallax(el) {
  const rect = el.getBoundingClientRect();
  const viewportCenter = window.innerHeight / 2;
  const elementCenter = rect.top + rect.height / 2;
  const distance = elementCenter - viewportCenter;
  const maxRange =
    window.innerWidth < PARALLAX_MOBILE_BREAKPOINT ? PARALLAX_RANGE_MOBILE : PARALLAX_RANGE_DESKTOP;
  const factor = Math.max(-1, Math.min(1, distance / viewportCenter));
  el.style.transform = `translateY(${(factor * maxRange).toFixed(2)}px)`;
}

function parallaxLoop() {
  activeParallaxEls.forEach((el) => applyParallax(el));
  parallaxRafId = activeParallaxEls.size > 0 ? requestAnimationFrame(parallaxLoop) : null;
}

function startParallaxLoop() {
  if (parallaxRafId === null) {
    parallaxRafId = requestAnimationFrame(parallaxLoop);
  }
}

function stopParallaxLoop() {
  if (parallaxRafId !== null) {
    cancelAnimationFrame(parallaxRafId);
    parallaxRafId = null;
  }
}

const parallaxVisibilityObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const el = entry.target;
      if (entry.isIntersecting) {
        activeParallaxEls.add(el);
        el.classList.add("is-parallax-active");
        startParallaxLoop();
      } else {
        activeParallaxEls.delete(el);
        el.classList.remove("is-parallax-active");
      }
    });
  },
  { rootMargin: "20% 0px" }
);

function initParallax() {
  if (reduceMotionQuery.matches) return;
  document.querySelectorAll("[data-parallax]").forEach((el) => parallaxVisibilityObserver.observe(el));
}

function teardownParallax() {
  parallaxVisibilityObserver.disconnect();
  stopParallaxLoop();
  activeParallaxEls.forEach((el) => {
    el.classList.remove("is-parallax-active");
    el.style.transform = "";
  });
  activeParallaxEls.clear();
}
initParallax();

// Reage em tempo real a mudanças na preferência de movimento reduzido.
reduceMotionQuery.addEventListener("change", (event) => {
  if (event.matches) {
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    revertHeroElementsToFinalState();
    toggleHeroWillChange(false);
    resetHeroFocusGuard();

    revealObserver.disconnect();
    document.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("is-inview"));
    teardownParallax();
  } else {
    setupHeroScrollAnimation();

    document.querySelectorAll("[data-reveal]:not(.is-inview)").forEach((el) => revealObserver.observe(el));
    initParallax();
  }

  syncHeroVideoState();
});
