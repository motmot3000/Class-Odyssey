import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState, getCurrentClass } from "../src/domain.mjs";
import { setLang } from "../src/i18n.mjs";
import { renderWelcome } from "../src/views/welcome.mjs";
import { renderRules } from "../src/views/rules.mjs";
import { renderAdmin } from "../src/views/admin.mjs";
import { renderSheikahShop, renderSheikahStudent } from "../src/views/sheikah.mjs";

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
