import { t } from './i18n.mjs';
import { CATALOGUE_URL, CATALOGUE_REVISION } from './items-3d-model.mjs';

export const WELCOME_HEROES = {
  ranger: { persona:'male', skin:'vocab-ranger', hat:'explorer-cap', weapon:'lore-lantern', hair:'short', hairColor:'brown-hair' },
  mage: { persona:'female', skin:'grammar-mage', hat:'no-hat', weapon:'word-wand', hair:'long', hairColor:'red-hair' },
  knight: { persona:'male', skin:'honor-knight', hat:'no-hat', weapon:'star-shield', hair:'short', hairColor:'black-hair' }
};
export const welcomeSceneState = { hero:'ranger', paused:null };

// The illustrated entry is immediate. The real game renderer loads only on request.
export function mountWelcomeScene(root) {
  const page = root.querySelector('.welcome-page');
  if (!page) return () => {};
  const abort = new AbortController();
  const { signal } = abort;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const company = page.querySelector('.welcome-company');
  const canvas = page.querySelector('.welcome-atmosphere');
  const ctx = canvas.getContext('2d');
  const motion = page.querySelector('[data-welcome-motion]');
  const live = page.querySelector('.welcome-live');
  const previewButton = page.querySelector('[data-welcome-3d]');
  const status = page.querySelector('.welcome-3d-status');
  let viewer, loading = false, inView = true, frame, pointerFrame;
  let width = 0, height = 0, time = 0, previous = 0;
  const particles = Array.from({ length:28 }, (_, i) => ({
    x: ((i * 71) % 101) / 101, y: ((i * 43) % 97) / 97,
    radius: .8 + (i % 3) * .6, speed: .012 + (i % 5) * .003
  }));
  const paused = () => welcomeSceneState.paused ?? reduced.matches;
  const moving = () => !paused() && inView && !document.hidden;

  function draw(now) {
    frame = undefined;
    if (!moving() || !ctx) return;
    time += previous ? Math.min((now - previous) / 1000, .05) : 0;
    previous = now;
    ctx.clearRect(0, 0, width, height);
    for (const p of particles) {
      const x = ((p.x + time * p.speed * .12) % 1) * width;
      const y = (1 - ((p.y + time * p.speed) % 1)) * height;
      const alpha = Math.sin(Math.PI * y / height) * .58;
      ctx.fillStyle = `rgba(255,244,189,${alpha})`;
      ctx.beginPath(); ctx.arc(x + Math.sin(time * .4 + p.x * 10) * 18, y, p.radius, 0, Math.PI * 2); ctx.fill();
    }
    frame = requestAnimationFrame(draw);
  }
  function syncMotion() {
    page.classList.toggle('is-paused', paused());
    page.classList.toggle('is-inactive', !moving());
    motion.setAttribute('aria-pressed', String(!paused()));
    motion.setAttribute('aria-label', t(paused() ? 'welcome.motionPlay' : 'welcome.motionPause'));
    viewer?.setVisible(inView && !document.hidden);
    viewer?.setRotation(moving());
    if (frame) cancelAnimationFrame(frame);
    frame = undefined; previous = 0;
    if (moving() && ctx) frame = requestAnimationFrame(draw);
    else {
      page.style.removeProperty('--pointer-x');
      page.style.removeProperty('--pointer-y');
    }
  }
  function resize() {
    const box = canvas.getBoundingClientRect();
    width = box.width; height = box.height;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting; syncMotion();
  });
  visibilityObserver.observe(company);
  document.addEventListener('visibilitychange', syncMotion, { signal });
  reduced.addEventListener('change', syncMotion, { signal });
  motion.addEventListener('click', () => {
    welcomeSceneState.paused = !paused(); syncMotion();
  }, { signal });

  page.addEventListener('pointermove', event => {
    if (!moving() || event.pointerType !== 'mouse' || pointerFrame) return;
    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = undefined;
      if (!moving()) return;
      const box = page.getBoundingClientRect();
      page.style.setProperty('--pointer-x', `${((event.clientX - box.left) / box.width - .5) * 12}px`);
      page.style.setProperty('--pointer-y', `${((event.clientY - box.top) / box.height - .5) * 7}px`);
    });
  }, { signal });
  page.addEventListener('pointerleave', () => {
    page.style.removeProperty('--pointer-x'); page.style.removeProperty('--pointer-y');
  }, { signal });

  root.querySelectorAll('[data-welcome-enter]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    const input = page.querySelector('#gate-username');
    input.focus({ preventScroll:true });
    page.querySelector('.welcome-gate').scrollIntoView({ behavior:paused() ? 'instant' : 'smooth', block:'center' });
  }, { signal }));

  page.querySelectorAll('[data-welcome-hero]').forEach(button => button.addEventListener('click', () => {
    welcomeSceneState.hero = button.dataset.welcomeHero;
    company.dataset.hero = welcomeSceneState.hero;
    page.querySelectorAll('[data-welcome-hero]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    page.querySelector('.welcome-hero-caption').textContent = t(`welcome.${welcomeSceneState.hero}Hint`);
    viewer?.applyState(WELCOME_HEROES[welcomeSceneState.hero]);
  }, { signal }));

  function close3d() {
    viewer?.destroy(); viewer = undefined;
    live.hidden = true; company.classList.remove('is-3d');
    previewButton.querySelector('span').textContent = t('welcome.view3d');
    previewButton.setAttribute('aria-expanded', 'false');
    status.hidden = true;
  }
  previewButton.setAttribute('aria-expanded', 'false');
  previewButton.addEventListener('click', async () => {
    if (loading) return;
    if (viewer) { close3d(); return; }
    loading = true; previewButton.disabled = true;
    status.hidden = false; status.textContent = t('view.loading');
    let created;
    try {
      const { createHeroViewer } = await import(new URL(`../assets/sheikah/viewer.js?v=${CATALOGUE_REVISION}`, import.meta.url).href);
      if (signal.aborted) return;
      live.hidden = false;
      created = await createHeroViewer(live, CATALOGUE_URL, WELCOME_HEROES[welcomeSceneState.hero], {
        theme:'light',
        onError() { close3d(); status.hidden = false; status.textContent = t('view.unavailable'); }
      });
      if (signal.aborted) { created.destroy(); return; }
      viewer = created;
      // Selection may change while the catalogue is loading.
      viewer.applyState(WELCOME_HEROES[welcomeSceneState.hero]);
      company.classList.add('is-3d');
      previewButton.querySelector('span').textContent = t('welcome.close3d');
      previewButton.setAttribute('aria-expanded', 'true');
      status.textContent = t('welcome.drag3d');
      viewer.resize(); syncMotion();
    } catch {
      if (signal.aborted) return;
      created?.destroy(); close3d();
      status.hidden = false; status.textContent = t('view.unavailable');
    } finally {
      loading = false;
      if (!signal.aborted) previewButton.disabled = false;
    }
  }, { signal });
  let angle = 0;
  live.addEventListener('keydown', event => {
    if (!viewer || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault(); angle += event.key === 'ArrowRight' ? 1 : -1;
    const angles = ['front', 'quarter', 'back'];
    viewer.setAngle(angles[((angle % angles.length) + angles.length) % angles.length]);
  }, { signal });
  resize(); syncMotion();
  return () => {
    abort.abort(); cancelAnimationFrame(frame); cancelAnimationFrame(pointerFrame);
    resizeObserver.disconnect(); visibilityObserver.disconnect(); viewer?.destroy();
  };
}
