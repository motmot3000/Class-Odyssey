import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState, getCurrentClass } from "../src/domain.mjs";
import { setLang } from "../src/i18n.mjs";
import { renderWelcome } from "../src/views/welcome.mjs";
import { renderConsole } from "../src/views/console.mjs";
import { renderAddPupilDialog } from "../src/views/modals.mjs";
import { renderRules } from "../src/views/rules.mjs";
import { renderAdmin } from "../src/views/admin.mjs";
import { renderSheikahShop, renderSheikahStudent, renderSheikahTopbar } from "../src/views/sheikah.mjs";

test("Students cards expose the full hero stats and direct Dressing/Shop actions", () => {
  const classroom = getCurrentClass(createInitialState());
  const pupil = { ...classroom.pupils[0], xp: 250, hp: 3, money: 42 };
  const html = renderSheikahStudent({ classroom: { ...classroom, pupils: [pupil] }, ui: {}, pupil: null });
  assert.match(html, /class="rune-card student-card/);
  assert.match(html, /aria-valuenow="250"/);
  assert.match(html, /3 of 5 hit points/);
  assert.match(html, /42 coins/);
  assert.match(html, /data-action="student-pick"/);
  assert.match(html, /data-action="sheikah-personalize"[^>]*data-pupil-id=/);
  assert.match(html, /data-action="sheikah-shop"[^>]*data-pupil-id=/);
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

test("Class navigation has no separate teacher/student views and exposes the protected console in options", () => {
  const previousDocument = globalThis.document;
  globalThis.document = { documentElement:{dataset:{theme:'light'}} };
  try {
    const html=renderSheikahTopbar({view:'class',state:createInitialState(),account:{username:'teacher',displayName:'Test'},unlocked:false});
    assert.doesNotMatch(html,/data-action="show-board"|data-action="show-student"/);
    assert.match(html,/data-action="show-class"/);
    assert.match(html,/data-action="teacher-console"/);
    assert.match(html,/data-class-id="7p"/);
    assert.match(html,/data-class-id="8p"/);
  } finally { globalThis.document=previousDocument; }
});

test("pupil search filters names, escapes user content and offers a recovery action", () => {
  const classroom = { pupils: [
    { ...getCurrentClass(createInitialState()).pupils[0], name: "Élodie <script>", id: "elodie" },
    { ...getCurrentClass(createInitialState()).pupils[1], name: "Alex", id: "alex" }
  ] };
  const html = renderSheikahStudent({ classroom, ui: { query: "élo" }, pupil: null });
  assert.match(html, /data-pupil-id="elodie"/);
  assert.doesNotMatch(html, /data-pupil-id="alex"|<script>/);
  assert.match(html, /Élodie &lt;script&gt;/);
  const empty = renderSheikahStudent({ classroom, ui: { query: "missing" }, pupil: null });
  assert.match(empty, /data-action="clear-search"/);
  assert.doesNotMatch(empty, /data-action="student-pick"/);
});

test("the shop names its pupil and returns to the hero without switching roles", () => {
  const pupil = { ...getCurrentClass(createInitialState()).pupils[0], name: "Mila & Noa", money: 73 };
  const html = renderSheikahShop(pupil, { shopCategory: "outfit" });
  assert.match(html, /Mila &amp; Noa/);
  assert.match(html, /data-action="shop-back"/);
  assert.match(html, /<strong>73<\/strong>/);
  assert.doesNotMatch(html, /data-action="show-student"|data-action="change-hero"/);
  assert.match(html, /data-category="outfit"\s+aria-pressed="true"/);
});

test("locked pupils can return from the rules without hitting the teacher gate", () => {
  assert.match(renderRules({ unlocked: false }), /data-action="show-student"/);
  assert.doesNotMatch(renderRules({ unlocked: false }), /data-action="show-board"/);
  assert.match(renderRules({ unlocked: true }), /data-action="show-board"/);
});

test("a pending account request prevents changing form modes and retains safe identity fields", () => {
  const html = renderWelcome({ tab: "signup", pending: true, values: { username: '"><script>', displayName: "7P" } });
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /data-tab="signin"[^>]*disabled/);
  assert.match(html, /data-tab="signup"[^>]*disabled/);
  assert.match(html, /&quot;&gt;&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
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

test("new public, pupil and recovery copy renders in both application languages", () => {
  const pupil = getCurrentClass(createInitialState()).pupils[0];
  try {
    for (const lang of ["fr", "en"]) {
      setLang(lang);
      const html = renderWelcome() + renderSheikahStudent({ pupil, ui: {} });
      assert.doesNotMatch(html, /welcome\.adventure|view\.simplified|view\.retry|sheikah\.equipment/);
      assert.match(html, /data-action="retry-viewer"/);
      assert.match(html, /class="viewer-fallback"/);
    }
  } finally { setLang("en"); }
});
