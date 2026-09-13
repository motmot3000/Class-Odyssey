import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState, getCurrentClass, SHOP_ITEMS } from "../src/domain.mjs";
import { setLang, t } from "../src/i18n.mjs";
import { renderWelcome } from "../src/views/welcome.mjs";
import { renderRules } from "../src/views/rules.mjs";
import { renderShop } from "../src/views/shop.mjs";
import { renderItemDialog, renderPupilDialog } from "../src/views/modals.mjs";

test("FR/EN views retain all merged shop categories and 3D previews", () => {
  const pupil = { ...getCurrentClass(createInitialState()).pupils[0], name: '<img onerror="bad">' };
  try {
    for (const lang of ["fr", "en"]) {
      setLang(lang);
      assert.match(renderWelcome({ tab: "signin" }), new RegExp(t("welcome.title.welcome")));
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
