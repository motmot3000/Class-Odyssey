import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState, getCurrentClass } from "../src/domain.mjs";
import { setLang } from "../src/i18n.mjs";
import { renderWelcome } from "../src/views/welcome.mjs";
import { renderConsent } from "../src/views/consent.mjs";
import { renderConsole } from "../src/views/console.mjs";
import { renderAddPupilDialog, renderHelpDialog, renderPasswordResetDialog } from "../src/views/modals.mjs";
import { renderRules } from "../src/views/rules.mjs";
import { renderMentions, renderPrivacy, renderTerms } from "../src/views/legal.mjs";
import { renderAppFooter } from "../src/views/footer.mjs";
import { renderAdmin } from "../src/views/admin.mjs";
import { renderOdysseyShop, renderOdysseyStudent, renderOdysseyTopbar, renderOdysseySheet, renderOdysseyPersonalize } from "../src/views/odyssey.mjs";

test("Students cards expose the full hero stats and direct Dressing/Shop actions", () => {
  const classroom = getCurrentClass(createInitialState());
  const pupil = { ...classroom.pupils[0], xp: 250, hp: 3, money: 42 };
  const html = renderOdysseyStudent({ classroom: { ...classroom, pupils: [pupil] }, ui: {}, pupil: null });
  assert.match(html, /class="rune-card student-card/);
  assert.match(html, /aria-valuenow="250"/);
  assert.match(html, /3 of 5 hit points/);
  assert.match(html, /42 coins/);
  assert.match(html, /data-action="student-pick"/);
  assert.match(html, /data-action="odyssey-personalize"[^>]*data-pupil-id=/);
  assert.match(html, /data-action="odyssey-shop"[^>]*data-pupil-id=/);
  assert.match(html, />Dressing</);
  assert.doesNotMatch(html, /data-action="award-xp"|data-action="toggle-pupil"/);
});

test("the public entry omits heroes, animated canvases and the removed footer", () => {
  try {
    for (const lang of ["fr", "en"]) {
      setLang(lang);
      const html = renderWelcome();
      assert.doesNotMatch(html, /<canvas|welcome-company|data-welcome-hero|data-welcome-3d|welcome-footer|data-welcome-motion/);
      assert.doesNotMatch(html, /Learn English\. Build confidence\. Go further together\.|Animations/);
      assert.match(html, /data-action="sign-in"/);
      assert.match(html, /welcome-valley\.webp/);
    }
  } finally { setLang("en"); }
});

test("teacher console adds pupils through a named dialog and uses a single target picker", () => {
  const classroom=getCurrentClass(createInitialState());
  const ui={scope:'selection',openPanels:new Set(),xpAmount:100,coinAmount:20,shopCategory:'outfit'};
  const html=renderConsole({classroom,ui,targets:[],focused:null,canUndo:false,events:[],armedReset:false});
  assert.match(html,/data-action="focus-add"/);
  assert.ok(html.indexOf('data-action="focus-add"')<html.indexOf('class="target'));
  assert.match(html,/data-action="teacher-target"/);
  assert.doesNotMatch(html,/data-action="select-all"|data-panel="add"/);
  const dialog=renderAddPupilDialog(classroom);
  assert.match(dialog,/<dialog[^>]*aria-labelledby="add-pupil-title"/);
  assert.match(dialog,/data-action="add-pupil" data-class-id="7p"/);
  assert.match(dialog,/name="gender"/);
  assert.match(dialog,/name="skinTone"/);
});

test("Class navigation has no separate teacher/student views and exposes a protected edge tab", () => {
  const previousDocument = globalThis.document;
  globalThis.document = { documentElement:{dataset:{theme:'light'}} };
  try {
    const html=renderOdysseyTopbar({view:'class',state:createInitialState(),account:{username:'teacher',displayName:'Test'},unlocked:false});
    assert.doesNotMatch(html,/data-action="show-board"|data-action="show-student"/);
    assert.match(html,/data-action="show-class"/);
    assert.match(html,/data-action="teacher-console"/);
    assert.match(html,/class="teacher-console-tab"/);
    assert.match(html,/aria-haspopup="dialog"/);
    assert.match(html,/data-class-id="7p"/);
    assert.match(html,/data-class-id="8p"/);
    assert.match(html,/aria-label="[^"]*"[^>]*title="[^"]*"[^>]*>\s*<svg class="ic "[^>]*viewBox="0 0 24 24"/);
    assert.doesNotMatch(html,/M4 5h12M4 10h12M4 15h12/);
  } finally { globalThis.document=previousDocument; }
});

test("an open teacher panel enables single-card selection and hero navigation stays neutral", () => {
  const classroom=getCurrentClass(createInitialState());
  const pupil=classroom.pupils[0];
  const html=renderOdysseyStudent({classroom,ui:{},pupil:null,classView:true,selectionMode:true,selectedIds:[pupil.id]});
  assert.match(html,/data-action="toggle-pupil"/);
  assert.equal((html.match(/aria-pressed="true"/g)||[]).length,1);
  const sheet=renderOdysseySheet(pupil,{}, {student:true});
  const dressing=sheet.match(/<button[^>]+data-action="odyssey-personalize"[^>]*>/)[0];
  assert.doesNotMatch(dressing,/btn-primary|aria-pressed="true"|is-active/);
  assert.doesNotMatch(sheet,/equipment-details|Hero equipment/);
  assert.match(sheet,/hero-class-return/);
  assert.doesNotMatch(sheet,/data-action="hero-back"/);
});

test("Dressing and Shop both return to the hero from the same header control", () => {
  const classroom=getCurrentClass(createInitialState());
  const pupil=classroom.pupils[0];
  const dressing=renderOdysseyPersonalize(pupil,{angle:'quarter'});
  const shop=renderOdysseyShop(pupil,{shopCategory:'outfit'});
  for (const html of [dressing,shop]) {
    const header=html.match(/<header class="sheet-heading">[\s\S]*?<\/header>/)[0];
    assert.match(header,/class="btn btn-back"/);
    assert.ok(header.indexOf('btn-back')<header.indexOf('<h1>'));
    assert.match(header,/data-action="hero-back"/);
  }
  assert.doesNotMatch(dressing,/data-action="odyssey-back"|data-action="show-class"/);
  assert.doesNotMatch(shop,/data-action="shop-back"/);
});

test("pupil search filters names, escapes user content and offers a recovery action", () => {
  const classroom = { pupils: [
    { ...getCurrentClass(createInitialState()).pupils[0], name: "Élodie <script>", id: "elodie" },
    { ...getCurrentClass(createInitialState()).pupils[1], name: "Alex", id: "alex" }
  ] };
  const html = renderOdysseyStudent({ classroom, ui: { query: "élo" }, pupil: null });
  assert.match(html, /data-pupil-id="elodie"/);
  assert.doesNotMatch(html, /data-pupil-id="alex"|<script>/);
  assert.match(html, /Élodie &lt;script&gt;/);
  const empty = renderOdysseyStudent({ classroom, ui: { query: "missing" }, pupil: null });
  assert.match(empty, /data-action="clear-search"/);
  assert.doesNotMatch(empty, /data-action="student-pick"/);
});

test("the shop names its pupil and returns to the hero without switching roles", () => {
  const pupil = { ...getCurrentClass(createInitialState()).pupils[0], name: "Mila & Noa", money: 73 };
  const html = renderOdysseyShop(pupil, { shopCategory: "outfit" });
  assert.match(html, /Mila &amp; Noa/);
  assert.match(html, /data-action="hero-back"/);
  assert.match(html, /<strong>73<\/strong>/);
  assert.doesNotMatch(html, /data-action="show-student"|data-action="change-hero"/);
  assert.match(html, /data-category="outfit"\s+aria-pressed="true"/);
});

test("the shop previews each title on its own tier backdrop", () => {
  const pupil = getCurrentClass(createInitialState()).pupils[0];
  const html = renderOdysseyShop(pupil, { shopCategory: "title", shopPreview: "class-legend" });
  assert.match(html, /class="dais dais-lg title-stage" data-title-tier="5" data-title-id="class-legend"/);
  assert.match(html, /title-emblem/);
  assert.match(html, /data-title-labelled/);
  // Every title thumbnail is styled individually, never the same plain chip.
  const ids = [...html.matchAll(/data-title-id="([^"]+)"/g)].map(match => match[1]);
  assert.ok(ids.includes("perfect-pupil") && ids.includes("grammar-master") && ids.includes("rookie"));
  assert.ok(new Set(ids).size >= 8);
  assert.doesNotMatch(html, /angle-bar/);
});

test("item previews in the shop never sit on a title backdrop", () => {
  const pupil = { ...getCurrentClass(createInitialState()).pupils[0], title: "class-legend" };
  const outfit = renderOdysseyShop(pupil, { shopCategory: "outfit" });
  assert.match(outfit, /data-viewer-host/);
  assert.doesNotMatch(outfit, /data-viewer-host[^>]*data-title-tier/);
  assert.doesNotMatch(outfit, /title-halo|title-emblem|title-frame/);
  // The title category keeps its dedicated backdrop so pupils still see it.
  const title = renderOdysseyShop(pupil, { shopCategory: "title", shopPreview: "class-legend" });
  assert.match(title, /title-stage" data-title-tier="5" data-title-id="class-legend"/);
  assert.match(title, /title-emblem/);
});

test("locked pupils can return from the rules without hitting the teacher gate", () => {
  assert.match(renderRules({ unlocked: false }), /data-action="show-student"/);
  assert.doesNotMatch(renderRules({ unlocked: false }), /data-action="show-board"/);
  assert.match(renderRules({ unlocked: true }), /data-action="show-board"/);
});

test("the teacher console links to the rules page after the hero details", () => {
  const classroom = getCurrentClass(createInitialState());
  const ui = { openPanels: new Set(), xpAmount: 100, coinAmount: 20, shopCategory: "outfit" };
  const html = renderConsole({ classroom, ui, targets: [], focused: null, canUndo: false, events: [], armedReset: false });
  assert.match(html, /data-panel="rules"/);
  assert.match(html, /data-action="show-rules"/);
  assert.ok(html.indexOf('data-panel="hero"') < html.indexOf('data-panel="rules"'));
});

test("teachers edit rules through a dialog while pupils only read them", () => {
  const rules = { journey: [{ fr: "Une règle", en: "One rule" }], xp: [], money: [] };
  const reading = renderRules({ unlocked: true, rules, editing: false });
  assert.match(reading, /data-action="rules-edit"/);
  assert.doesNotMatch(reading, /data-action="rule-add"|data-action="rule-edit"|data-action="rule-remove"/);

  const editing = renderRules({ unlocked: true, rules, editing: true });
  assert.match(editing, /data-action="rules-done"/);
  assert.match(editing, /data-action="rule-add" data-section="xp"/);
  assert.match(editing, /data-action="rule-edit" data-section="journey" data-index="0"/);
  assert.match(editing, /data-action="rule-remove" data-section="journey" data-index="0"/);

  // A locked viewer never enters edit mode, even if the flag is set.
  const locked = renderRules({ unlocked: false, rules, editing: true });
  assert.doesNotMatch(locked, /data-action="rule-add"|data-action="rules-done"/);
  assert.match(locked, /data-action="rules-edit"/);
});

test("signup asks for email and password without a username or class name", () => {
  const html = renderWelcome({ tab: "signup" });
  assert.match(html, /name="email"[^>]*type="email"/);
  assert.match(html, /name="password"/);
  assert.match(html, /name="terms"[^>]*value="accepted"[^>]*required/);
  assert.match(html, /href="#conditions-utilisation"/);
  assert.match(html, /href="#politique-de-confidentialite"/);
  assert.doesNotMatch(html, /name="username"|name="displayName"|welcome\.field\.class/);
});

test("a pending account request prevents changing form modes and retains safe identity fields", () => {
  const html = renderWelcome({ tab: "signup", pending: true, values: { email: '"><script>', displayName: "7P" } });
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /data-tab="signin"[^>]*disabled/);
  assert.match(html, /data-tab="signup"[^>]*disabled/);
  assert.match(html, /&quot;&gt;&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test("the gate offers Google sign-in only when the server advertises it", () => {
  assert.doesNotMatch(renderWelcome(), /data-action="google-signin"/);
  for (const lang of ["fr", "en"]) {
    try {
      setLang(lang);
      const html = renderWelcome({ google: true });
      assert.match(html, /data-action="google-signin"/);
      assert.match(html, /href="api\/auth\/google"/);
      assert.match(html, /class="google-mark"/);
      assert.doesNotMatch(html, /welcome\.google|welcome\.or/);
    } finally { setLang("en"); }
  }
});

test("the legal consent panel is translated and links both documents", () => {
  for (const lang of ["fr", "en"]) {
    try {
      setLang(lang);
      const html = renderConsent();
      assert.match(html, /data-action="accept-consent"/);
      assert.match(html, /name="terms"[^>]*required/);
      assert.match(html, /href="#conditions-utilisation"/);
      assert.match(html, /href="#politique-de-confidentialite"/);
      assert.doesNotMatch(html, /consent\.(lead|terms|and|privacy|title|body|submit|pending)/);
    } finally { setLang("en"); }
  }
});

test("account management connects own-account settings and labels other-account reset inputs", () => {
  const html = renderAdmin({ currentAccountId: "self", accounts: [
    { id: "self", username: "teacher", role: "admin", activeSessionCount: 1, pupilCount: 24 },
    { id: "other", username: "another", role: "teacher", activeSessionCount: 0, pupilCount: 0 }
  ] });
  assert.match(html, /data-action="account-settings"/);
  assert.doesNotMatch(html, /data-action="admin-reset" data-account-id="self"/);
  assert.match(html, /data-action="admin-reset" data-account-id="other"/);
  assert.match(html, /type="password"[^>]*required[^>]*aria-label=/);
});

test("account settings expose profile, password recovery and help in both languages", () => {
  const account = { username: "__VG_EMAIL_58bef97775b0__", email: "__VG_EMAIL_58bef97775b0__", displayName: "thomas.vunch" };
  try {
    for (const lang of ["fr", "en"]) {
      setLang(lang);
      const settings = renderConsole({ classroom: null, ui: { openPanels: new Set(["account"]) }, targets: [], focused: null, canUndo: false, events: [], unlockedUntil: null, account });
      assert.match(settings, /data-action="update-profile"/);
      assert.match(settings, /data-action="change-password"/);
      assert.match(settings, /data-action="request-password-reset"/);
      assert.match(settings, /data-action="confirm-password-reset"/);
      assert.match(settings, /data-action="open-help"/);
      assert.doesNotMatch(settings, /settings\.(title|profile|password|help|reset)/);

      const help = renderHelpDialog({ email: account.email });
      assert.match(help, /data-action="send-support"/);
      assert.match(help, /name="message"/);
      assert.match(help, /name="category"/);
      assert.doesNotMatch(help, /settings\.help\./);

      const reset = renderPasswordResetDialog();
      assert.match(reset, /data-action="request-password-reset"/);
      assert.match(reset, /data-action="confirm-password-reset"/);
      assert.match(renderWelcome(), /data-action="forgot-password"/);
    }
  } finally { setLang("en"); }
});

test("new public, pupil and recovery copy renders in both application languages", () => {
  const pupil = getCurrentClass(createInitialState()).pupils[0];
  try {
    for (const lang of ["fr", "en"]) {
      setLang(lang);
      const html = renderWelcome() + renderOdysseyStudent({ pupil, ui: {} });
      assert.doesNotMatch(html, /welcome\.adventure|view\.simplified|view\.retry|odyssey\.equipment/);
      assert.match(html, /data-action="retry-viewer"/);
      assert.match(html, /class="viewer-fallback"/);
    }
  } finally { setLang("en"); }
});

test("legal pages and the footer carry the publisher, cookie notice and current year", () => {
  const year = String(new Date().getFullYear());
  try {
    for (const lang of ["fr", "en"]) {
      setLang(lang);
      const mentions = renderMentions();
      const privacy = renderPrivacy();
      const terms = renderTerms();
      assert.match(mentions, lang === "fr" ? /Éditeur de l'application/ : /Publisher/);
      assert.match(privacy, lang === "fr" ? /Cookies et technologies de suivi/ : /Cookies and tracking technologies/);
      assert.match(terms, lang === "fr" ? /Conditions d'utilisation/ : /Terms of use/);
      assert.match(mentions, /class="legal-section"/);
      assert.match(privacy, /class="legal-section"/);
      assert.match(terms, /class="legal-section"/);
      assert.doesNotMatch(mentions + privacy + terms, /VG_EMAIL|undefined/);
      const footer = renderAppFooter();
      assert.ok(footer.includes(year), `footer shows ${year}`);
      assert.match(footer, /#mentions-legales/);
      assert.match(footer, /#conditions-utilisation/);
      assert.match(footer, /#politique-de-confidentialite/);
      assert.match(footer, /data-action="manage-cookies"[^>]*hidden/);
    }
  } finally { setLang("en"); }
});
