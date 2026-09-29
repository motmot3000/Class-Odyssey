/* Guided tour engine: theme-aware coach marks anchored to live DOM.
 * The app rebuilds whole views on render, so the engine re-resolves the
 * target every frame and eases the spotlight toward it. That keeps the tour
 * glued to the control through re-renders, scrolls, resizes and theme
 * changes without rebuilding the tour. */

const HOLE_PAD = 8;
const HOLE_RADIUS = 12;
const CARD_GAP = 18;
const VIEW_MARGIN = 12;
const EASE_RATE = 16;
const EPSILON = 0.25;

const CLOSE_MARK = '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/></svg>';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export function createGuidedTour({ steps = [], labels = {}, onFinish, onExit, onStepChange } = {}) {
  const reducedMotion = typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let running = false;
  let index = 0;
  let lost = false;

  const spot = { x: 0, y: 0, w: 0, h: 0 };
  const goal = { x: 0, y: 0, w: 0, h: 0 };
  const cardAt = { x: 0, y: 0 };
  const cardGoal = { x: 0, y: 0 };

  let cardW = 0;
  let cardH = 0;
  let lastWidth = 0;
  let lastHeight = 0;
  let frameId = 0;
  let lastTime = 0;

  let root = null;
  let shade = null;
  let ring = null;
  let cardEl = null;
  let titleEl = null;
  let bodyEl = null;
  let dotsEl = null;
  let counterEl = null;
  let liveEl = null;
  let prevBtn = null;
  let nextBtn = null;
  let skipBtn = null;
  let closeBtn = null;

  function stepTarget(step) {
    const target = step?.target;
    return typeof target === "function" ? target() : target;
  }

  function stepBody(step) {
    const body = step?.body;
    return typeof body === "function" ? body() : (body || "");
  }

  function anchorFor() {
    const target = stepTarget(steps[index]);
    if (!target) return null;
    try { return document.querySelector(target); } catch { return null; }
  }

  function buildDom() {
    root = document.createElement("div");
    root.className = "tour";
    root.dataset.lost = "false";

    shade = document.createElement("div");
    shade.className = "tour-shade";
    shade.setAttribute("aria-hidden", "true");
    for (const side of ["t", "r", "b", "l", "tl", "tr", "br", "bl"]) {
      const panel = document.createElement("i");
      panel.className = side.length === 2 ? `c ${side}` : side;
      shade.append(panel);
    }

    ring = document.createElement("div");
    ring.className = "tour-ring";
    ring.setAttribute("aria-hidden", "true");

    cardEl = document.createElement("section");
    cardEl.className = "tour-card";
    cardEl.tabIndex = -1;
    cardEl.setAttribute("role", "dialog");
    cardEl.setAttribute("aria-modal", "false");
    cardEl.setAttribute("aria-labelledby", "tour-title");
    cardEl.setAttribute("aria-describedby", "tour-body");

    const head = document.createElement("header");
    head.className = "tour-head";
    titleEl = document.createElement("h2");
    titleEl.className = "tour-title";
    titleEl.id = "tour-title";
    closeBtn = document.createElement("button");
    closeBtn.className = "tour-close";
    closeBtn.type = "button";
    closeBtn.innerHTML = CLOSE_MARK;
    closeBtn.addEventListener("click", () => exit("close"));
    head.append(titleEl, closeBtn);

    bodyEl = document.createElement("p");
    bodyEl.className = "tour-body";
    bodyEl.id = "tour-body";

    const foot = document.createElement("footer");
    foot.className = "tour-foot";
    skipBtn = document.createElement("button");
    skipBtn.className = "btn btn-ghost btn-sm tour-skip";
    skipBtn.type = "button";
    skipBtn.addEventListener("click", () => exit("skip"));

    const meta = document.createElement("div");
    meta.className = "tour-meta";
    dotsEl = document.createElement("div");
    dotsEl.className = "tour-dots";
    dotsEl.setAttribute("aria-hidden", "true");
    counterEl = document.createElement("span");
    counterEl.className = "tour-counter";
    counterEl.setAttribute("aria-hidden", "true");
    meta.append(dotsEl, counterEl);

    const nav = document.createElement("div");
    nav.className = "tour-nav";
    prevBtn = document.createElement("button");
    prevBtn.className = "btn btn-sm tour-prev";
    prevBtn.type = "button";
    prevBtn.addEventListener("click", prev);
    nextBtn = document.createElement("button");
    nextBtn.className = "btn btn-sm btn-primary tour-next";
    nextBtn.type = "button";
    nextBtn.addEventListener("click", next);
    nav.append(prevBtn, nextBtn);

    foot.append(skipBtn, meta, nav);
    cardEl.append(head, bodyEl, foot);

    liveEl = document.createElement("p");
    liveEl.className = "tour-live";
    liveEl.setAttribute("aria-live", "polite");

    root.append(shade, ring, cardEl, liveEl);
  }

  function renderStep({ focus = false } = {}) {
    const step = steps[index] || {};
    const total = steps.length;

    titleEl.textContent = step.title || "";
    bodyEl.textContent = stepBody(step);
    root.dataset.preview = step.preview ? "true" : "false";

    dotsEl.replaceChildren(...steps.map((_, dotIndex) => {
      const dot = document.createElement("span");
      dot.className = dotIndex === index ? "tour-dot on" : "tour-dot";
      return dot;
    }));

    counterEl.textContent = `${index + 1}/${total}`;
    prevBtn.textContent = labels.prev || "";
    prevBtn.disabled = index === 0;
    nextBtn.textContent = index === total - 1 ? (labels.finish || "") : (labels.next || "");
    skipBtn.textContent = labels.skip || "";
    skipBtn.hidden = index === total - 1;
    closeBtn.setAttribute("aria-label", labels.close || "");
    const spoken = labels.progress ? labels.progress(index + 1, total) : counterEl.textContent;
    liveEl.textContent = `${spoken} · ${step.title || ""}`;

    measure();
    if (focus) cardEl.focus({ preventScroll: true });

    if (!reducedMotion && cardEl.animate) {
      cardEl.animate(
        [{ opacity: 0.5, filter: "blur(2px)" }, { opacity: 1, filter: "blur(0px)" }],
        { duration: 260, easing: "cubic-bezier(0.22, 0.75, 0.25, 1)" }
      );
    }
    onStepChange?.(index, step);
  }

  function measure() {
    cardW = cardEl?.offsetWidth || 0;
    cardH = cardEl?.offsetHeight || 0;
    lastWidth = window.innerWidth;
    lastHeight = window.innerHeight;
  }

  function resolve() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const step = steps[index] || {};
    const anchor = anchorFor();
    const rect = anchor?.getBoundingClientRect();
    lost = !rect || (rect.width === 0 && rect.height === 0);
    root.dataset.lost = lost ? "true" : "false";

    if (!lost) {
      const pad = step.padding ?? HOLE_PAD;
      const w = Math.min(rect.width + pad * 2, vw - 8);
      const h = Math.min(rect.height + pad * 2, vh - 8);
      goal.w = w;
      goal.h = h;
      goal.x = clamp(rect.left + rect.width / 2, 0, vw) - w / 2;
      goal.y = clamp(rect.top + rect.height / 2, 0, vh) - h / 2;
    } else {
      goal.w = 0;
      goal.h = 0;
      goal.x = vw / 2;
      goal.y = vh / 2;
    }

    if (lost) {
      cardGoal.x = (vw - cardW) / 2;
      cardGoal.y = (vh - cardH) / 2;
      return;
    }

    const spaceBelow = vh - (goal.y + goal.h);
    const spaceAbove = goal.y;
    const spaceRight = vw - (goal.x + goal.w);
    const spaceLeft = goal.x;
    let placement = step.placement && step.placement !== "auto" ? step.placement : null;
    if (!placement) {
      if (spaceBelow >= cardH + CARD_GAP + VIEW_MARGIN) placement = "bottom";
      else if (spaceAbove >= cardH + CARD_GAP + VIEW_MARGIN) placement = "top";
      else if (spaceRight >= cardW + CARD_GAP + VIEW_MARGIN) placement = "right";
      else if (spaceLeft >= cardW + CARD_GAP + VIEW_MARGIN) placement = "left";
      else placement = spaceBelow >= spaceAbove ? "bottom" : "top";
    }

    if (placement === "bottom") {
      cardGoal.x = goal.x + goal.w / 2 - cardW / 2;
      cardGoal.y = goal.y + goal.h + CARD_GAP;
    } else if (placement === "top") {
      cardGoal.x = goal.x + goal.w / 2 - cardW / 2;
      cardGoal.y = goal.y - CARD_GAP - cardH;
    } else if (placement === "right") {
      cardGoal.x = goal.x + goal.w + CARD_GAP;
      cardGoal.y = goal.y + goal.h / 2 - cardH / 2;
    } else {
      cardGoal.x = goal.x - CARD_GAP - cardW;
      cardGoal.y = goal.y + goal.h / 2 - cardH / 2;
    }

    cardGoal.x = clamp(cardGoal.x, VIEW_MARGIN, Math.max(VIEW_MARGIN, vw - VIEW_MARGIN - cardW));
    cardGoal.y = clamp(cardGoal.y, VIEW_MARGIN, Math.max(VIEW_MARGIN, vh - VIEW_MARGIN - cardH));
  }

  function apply() {
    const vh = window.innerHeight;
    const right = spot.x + spot.w;
    const bottom = spot.y + spot.h;
    const [top, sideRight, sideBottom, left, topLeft, topRight, bottomRight, bottomLeft] = shade.children;

    top.style.height = `${Math.max(0, spot.y)}px`;

    sideBottom.style.top = `${bottom}px`;
    sideBottom.style.height = `${Math.max(0, vh - bottom)}px`;

    left.style.top = `${Math.max(0, spot.y)}px`;
    left.style.width = `${Math.max(0, spot.x)}px`;
    left.style.height = `${Math.max(0, spot.h)}px`;

    sideRight.style.top = `${Math.max(0, spot.y)}px`;
    sideRight.style.left = `${right}px`;
    sideRight.style.height = `${Math.max(0, spot.h)}px`;

    const corner = (element, x, y) => {
      element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    corner(topLeft, spot.x, spot.y);
    corner(topRight, spot.x + spot.w - HOLE_RADIUS, spot.y);
    corner(bottomRight, spot.x + spot.w - HOLE_RADIUS, spot.y + spot.h - HOLE_RADIUS);
    corner(bottomLeft, spot.x, spot.y + spot.h - HOLE_RADIUS);

    ring.style.transform = `translate3d(${spot.x}px, ${spot.y}px, 0)`;
    ring.style.width = `${spot.w}px`;
    ring.style.height = `${spot.h}px`;

    cardEl.style.transform = `translate3d(${cardAt.x}px, ${cardAt.y}px, 0)`;
  }

  function ease(target, towards, alpha, keys) {
    let moved = false;
    for (const key of keys) {
      const delta = towards[key] - target[key];
      if (Math.abs(delta) > EPSILON) {
        target[key] += delta * alpha;
        moved = true;
      } else if (delta !== 0) {
        target[key] = towards[key];
      }
    }
    return moved;
  }

  function easeRect(target, towards, alpha) {
    return ease(target, towards, alpha, ["x", "y", "w", "h"]);
  }

  function tick(now) {
    if (!running) return;
    frameId = requestAnimationFrame(tick);
    const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0.016;
    lastTime = now;

    if (window.innerWidth !== lastWidth || window.innerHeight !== lastHeight) measure();
    resolve();

    const alpha = reducedMotion ? 1 : 1 - Math.exp(-EASE_RATE * dt);
    const movedSpot = easeRect(spot, goal, alpha);
    const movedCard = ease(cardAt, cardGoal, alpha, ["x", "y"]);
    if (movedSpot || movedCard || alpha === 1) apply();
  }

  function goTo(nextIndex) {
    index = clamp(nextIndex, 0, steps.length - 1);
    renderStep();
    resolve();
    apply();
    const anchor = anchorFor();
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      if (rect.top < 8 || rect.bottom > window.innerHeight - 8) {
        anchor.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center", inline: "nearest" });
      }
    }
  }

  function next() {
    if (index >= steps.length - 1) exit("finish");
    else goTo(index + 1);
  }

  function prev() {
    if (index > 0) goTo(index - 1);
  }

  function onKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      exit("escape");
      return;
    }
    const tag = event.target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      next();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      prev();
    }
  }

  function onResize() {
    measure();
    resolve();
    apply();
  }

  function start(startIndex = 0) {
    if (running || !steps.length) return;
    running = true;
    buildDom();
    document.body.append(root);
    window.addEventListener("keydown", onKeydown);
    window.addEventListener("resize", onResize);
    index = clamp(startIndex, 0, steps.length - 1);
    renderStep({ focus: true });
    resolve();
    spot.x = goal.x;
    spot.y = goal.y;
    spot.w = goal.w;
    spot.h = goal.h;
    cardAt.x = cardGoal.x;
    cardAt.y = cardGoal.y;
    apply();
    lastTime = 0;
    frameId = requestAnimationFrame(tick);
    requestAnimationFrame(() => root?.classList.add("is-open"));
    const anchor = anchorFor();
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      if (rect.top < 8 || rect.bottom > window.innerHeight - 8) {
        anchor.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center", inline: "nearest" });
      }
    }
  }

  function exit(reason = "exit") {
    if (!running) return;
    running = false;
    cancelAnimationFrame(frameId);
    window.removeEventListener("keydown", onKeydown);
    window.removeEventListener("resize", onResize);
    const focusWasInside = root?.contains(document.activeElement);
    const anchor = anchorFor();
    root?.remove();
    root = null;
    if (focusWasInside) anchor?.focus?.({ preventScroll: true });
    onExit?.(reason);
    if (reason === "finish") onFinish?.();
  }

  function refresh() {
    if (!running) return;
    const step = steps[index] || {};
    if (typeof step.body === "function") bodyEl.textContent = stepBody(step);
    measure();
    resolve();
    apply();
  }

  return { start, next, prev, exit, refresh, get index() { return index; } };
}
