import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState, getCurrentClass, SHOP_ITEMS, getRewardsForLevel } from "../src/domain.mjs";
import { setLang, t, tItem, hasTranslation, translateMessage } from "../src/i18n.mjs";
import { renderWelcome } from "../src/views/welcome.mjs";
import { renderRules } from "../src/views/rules.mjs";
import { renderShop } from "../src/views/shop.mjs";
import { renderItemDialog, renderPupilDialog } from "../src/views/modals.mjs";
import { renderAdmin } from "../src/views/admin.mjs";
import { renderOdysseySheet, renderOdysseyPersonalize } from "../src/views/odyssey.mjs";
import { translateReward } from "../src/ui.mjs";

test("FR/EN views retain all merged shop categories and 3D previews", () => {
  const pupil = { ...getCurrentClass(createInitialState()).pupils[0], name: '<img onerror="bad">' };
  try {
    for (const lang of ["fr", "en"]) {
      setLang(lang);
      assert.ok(renderWelcome({ tab: "signin" }).includes(t("welcome.formTitle")));
      assert.match(renderRules(), new RegExp(t("rules.title.how").replace("?", "\\?")));
      const shop = renderShop(pupil, "hairColor");
      assert.match(shop, /data-category="hairColor"/);
      assert.ok(shop.includes(t("shop.cat.hairColor")));
      for (const item of SHOP_ITEMS) {
        const html = renderItemDialog(item, pupil);
        assert.doesNotMatch(html, /modal\.type\.|shop\.cat\./);
        assert.doesNotMatch(html, /<img onerror=/);
      }
      assert.match(renderPupilDialog(pupil), /data-base-character-viewer/);
    }
  } finally { setLang("en"); }
});

test("every active catalogue item has French copy and English preserves domain data", () => {
  try {
    for (const item of SHOP_ITEMS) for (const field of ["name", "description"]) {
      if (!item[field]) continue;
      assert.ok(hasTranslation(`domain.${item.id}.${field}`, "fr"), `${item.id}.${field}`);
      setLang("fr");
      assert.ok(tItem(item, field).length > 0);
      setLang("en");
      assert.equal(tItem(item, field), item[field]);
    }
  } finally { setLang("en"); }
});

test("Odyssey, admin, validation errors and rewards follow the chosen language", () => {
  const pupil = { ...getCurrentClass(createInitialState()).pupils[0], name: 'Alex <img onerror="bad">' };
  try {
    setLang("fr");
    const sheet = renderOdysseySheet(pupil, { angle: "back" }, { student: true });
    const workshop = renderOdysseyPersonalize(pupil, { draft: null });
    assert.ok(sheet.includes("Retour à la classe"));
    assert.ok(workshop.includes("Enregistrer la tenue"));
    assert.doesNotMatch(sheet + workshop, /Hair color|Scout|Brown|HP restored|<img onerror=/);
    assert.match(renderAdmin({ error: "Could not load accounts." }), /Impossible de charger les comptes/);
    assert.match(renderWelcome({ error: "Wrong username or password." }), /incorrect/);
    assert.equal(translateMessage("The password needs at least 4 characters."), "Le mot de passe doit contenir au moins 4 caractères.");
    assert.doesNotMatch(getRewardsForLevel(3).map(translateReward).join(", "), /HP restored|hair color| title/);
    // Parameters are replaced once: user data resembling a placeholder is kept.
    assert.equal(t("notice.joined", { name: "{classroom}", classroom: "7P" }), "{classroom} a rejoint 7P.");
    setLang("en");
    assert.match(renderOdysseyPersonalize(pupil, {}), /Save outfit/);
    assert.doesNotMatch(renderOdysseySheet(pupil, {}, { student: true }), /Mon héros|pièces|Trois quarts|Tenue/);
    assert.equal(translateMessage("Wrong username or password."), "Wrong username or password.");
  } finally { setLang("en"); }
});
