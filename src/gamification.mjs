/* Interactions du dossier « La gamification en classe ».
   Progressive enhancement : la page reste complète sans ce script. */

const doc = document.documentElement;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Progression de lecture ---------- */
const progress = document.getElementById("reading-progress");
const toTop = document.getElementById("to-top");

let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const scrollTop = window.scrollY || doc.scrollTop;
    const height = doc.scrollHeight - window.innerHeight;
    if (progress) {
      const ratio = height > 0 ? Math.min(1, Math.max(0, scrollTop / height)) : 0;
      progress.style.transform = `scaleX(${ratio})`;
    }
    if (toTop) toTop.classList.toggle("is-visible", scrollTop > 700);
    ticking = false;
  });
}
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

if (toTop) {
  toTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  });
}

/* ---------- Diagramme : une seule animation, à l’entrée dans le champ ---------- */
const chart = document.querySelector(".chart");
if (chart) {
  if (reduceMotion || !("IntersectionObserver" in window)) {
    chart.classList.add("is-drawn");
  } else {
    const chartObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          chart.classList.add("is-drawn");
          chartObserver.disconnect();
        }
      });
    }, { threshold: 0.35 });
    chartObserver.observe(chart);
  }
}

/* ---------- Sommaire : mise en évidence de la section courante ---------- */
const sections = [...document.querySelectorAll("main .chapter[id]")];
const tocLinks = [...document.querySelectorAll(".toc-link")];
const navLinks = [...document.querySelectorAll(".site-nav a")];

function setCurrent(id) {
  tocLinks.forEach((link) => link.classList.toggle("is-current", link.getAttribute("href") === `#${id}`));
  navLinks.forEach((link) => link.classList.toggle("is-current", link.getAttribute("href") === `#${id}`));
}

function updateCurrent() {
  const offset = (document.querySelector(".topbar")?.offsetHeight || 64) + 90;
  let current = sections[0]?.id;
  for (const section of sections) {
    if (section.getBoundingClientRect().top <= offset) current = section.id;
  }
  if (current) setCurrent(current);
}

let spyTicking = false;
window.addEventListener("scroll", () => {
  if (spyTicking) return;
  spyTicking = true;
  requestAnimationFrame(() => {
    updateCurrent();
    spyTicking = false;
  });
}, { passive: true });
updateCurrent();
