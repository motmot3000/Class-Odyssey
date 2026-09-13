/* ============================================================
   i18n.mjs — bascule FR / EN légère
   Le dictionnaire (translations.json) associe un texte français à sa
   traduction anglaise. On traduit les nœuds texte visibles à partir de
   leur valeur d'origine, sans toucher aux scripts ni aux styles.
   ============================================================ */

const STORAGE_KEY = "classquest.lang";
const DICTIONARY_URL = new URL("./translations.json", import.meta.url);
const originals = new WeakMap();

function loadDictionary() {
  return fetch(DICTIONARY_URL).then((response) => {
    if (!response.ok) throw new Error(`translations.json returned ${response.status}`);
    return response.json();
  });
}

function eligible(node) {
  const parent = node.parentElement;
  if (!parent) return false;
  return !["SCRIPT", "STYLE", "TEXTAREA"].includes(parent.tagName);
}

function translateNode(node, dictionary) {
  if (!originals.has(node)) originals.set(node, node.nodeValue);
  const original = originals.get(node);
  const trimmed = original.trim();
  if (!trimmed) return;
  const replacement = dictionary[trimmed];
  node.nodeValue = replacement ? original.replace(trimmed, replacement) : original;
}

function translate(root, dictionary) {
  if (!root) return;
  if (root.nodeType === Node.TEXT_NODE) {
    if (eligible(root)) translateNode(root, dictionary);
    return;
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (eligible(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT)
  });
  let node = walker.nextNode();
  while (node) {
    translateNode(node, dictionary);
    node = walker.nextNode();
  }
}

async function main() {
  const toggle = document.getElementById("lang-toggle");
  const label = document.getElementById("current-lang");
  if (!toggle || !label) return;

  let dictionary;
  try {
    const map = await loadDictionary();
    dictionary = {
      fr: Object.fromEntries(Object.entries(map).map(([fr, en]) => [en, fr])),
      en: map
    };
  } catch (error) {
    console.warn("i18n:", error);
    toggle.disabled = true;
    return;
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  let lang = stored === "en" || stored === "fr" ? stored : document.documentElement.lang || "fr";

  function apply(next) {
    lang = next;
    document.documentElement.lang = lang;
    label.textContent = lang.toUpperCase();
    translate(document.body, dictionary[lang]);
    localStorage.setItem(STORAGE_KEY, lang);
  }

  toggle.addEventListener("click", () => apply(lang === "fr" ? "en" : "fr"));
  apply(lang);
}

main();