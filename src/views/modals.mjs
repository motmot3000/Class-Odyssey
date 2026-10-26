/* Form and product-preview dialogs. app.mjs owns their mounting, event handling
 * and teardown; views only return escaped markup.
 */

import { canBuyItem, cosmeticField, isItemOwned, SKIN_TONES } from "../domain.mjs";
import { renderItemThumbnail } from "../equipment-previews.mjs";
import {
  escapeHtml,
  getItemRarity,
  icon,
} from "../ui.mjs";
import { t, tItem } from "../i18n.mjs";
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from "../password-policy.mjs";

const RULE_SECTION_LABEL = {
  journey: "rules.title.how",
  xp: "rules.title.xp",
  money: "rules.title.money"
};

const TYPE_LABEL = {
  outfit: () => t("modal.type.outfit"),
  hat: () => t("modal.type.hat"),
  weapon: () => t("modal.type.weapon"),
  shield: () => t("modal.type.shield"),
  hair: () => t("modal.type.hair"),
  hairColor: () => t("modal.type.hairColor"),
  eyeColor: () => t("modal.type.eyeColor"),
  accessory: () => t("modal.type.accessory"),
  pet: () => t("modal.type.pet"),
  title: () => t("modal.type.title"),
  tone: () => t("modal.type.tone"),
  bespoke: () => t("modal.type.bespoke")
};

export function renderAddPupilDialog(classroom) {
  return `<dialog class="dialog dialog-add-pupil" aria-labelledby="add-pupil-title">
    <button class="dialog-close" type="button" data-action="close-dialog" aria-label="${t('modal.close')}">${icon('close')}</button>
    <h2 id="add-pupil-title">${t('console.roster.add')}</h2>
    <p class="panel-note">${t('console.roster.joining',{name:escapeHtml(classroom.name)})}</p>
    <form class="add-form" data-action="add-pupil" data-class-id="${escapeHtml(classroom.id)}">
      <label class="field"><span>${t('console.roster.firstName')}</span><input id="pupil-name" name="name" autocomplete="off" required autofocus /></label>
      <div class="field-row">
        <label class="field"><span>${t('console.roster.character')}</span><select name="gender">
          <option value="boy">${t('console.roster.boy')}</option><option value="girl">${t('console.roster.girl')}</option>
        </select></label>
        <label class="field"><span>${t('console.roster.skinTone')}</span><select name="skinTone">
          ${SKIN_TONES.filter(tone=>!tone.price).map(tone=>`<option value="${tone.id}">${escapeHtml(tItem(tone,'name'))}</option>`).join('')}
        </select></label>
      </div>
      <div class="row"><button class="btn btn-primary" type="submit">${icon('plus')}${t('console.roster.addBtn')}</button><button class="btn" type="button" data-action="close-dialog">${t('common.cancel')}</button></div>
    </form>
  </dialog>`;
}

export function renderNewClassDialog() {
  return `<dialog class="dialog dialog-new-class" aria-labelledby="new-class-title">
    <button class="dialog-close" type="button" data-action="close-dialog" aria-label="${t('modal.close')}">${icon('close')}</button>
    <h2 id="new-class-title">${t('class.new.title')}</h2>
    <p class="panel-note">${t('class.new.hint')}</p>
    <form class="add-form" data-action="create-class">
      <label class="field"><span>${t('class.new.name')}</span><input id="new-class-name" name="name" autocomplete="off" required autofocus /></label>
      <div class="row"><button class="btn btn-primary" type="submit">${icon('plus')}${t('class.new.submit')}</button><button class="btn" type="button" data-action="close-dialog">${t('common.cancel')}</button></div>
    </form>
  </dialog>`;
}

export function renderItemDialog(item, pupil) {
  const bespoke = item.type === "bespoke";
  const equipped = !bespoke && pupil[cosmeticField(item.type)] === item.id;
  const owned = isItemOwned(pupil, item.id);
  const locked = pupil.level < item.minLevel;

  const status = bespoke
    ? locked
      ? t("modal.unlocksAt", { level: item.minLevel })
      : canBuyItem(pupil, item)
        ? t("modal.readyOrder")
        : t("modal.costs", { price: item.price, money: pupil.money })
    : equipped
    ? t("modal.worn")
    : owned
      ? t("modal.owned")
      : locked
        ? t("modal.unlocksAt", { level: item.minLevel })
        : t("modal.costs", { price: item.price, money: pupil.money });

  const visual = renderItemThumbnail(item);

  return `
    <dialog class="dialog dialog-item" data-pupil-id="${escapeHtml(pupil.id)}" aria-label="${escapeHtml(tItem(item, "name"))}">
      <button class="dialog-close" type="button" data-action="close-dialog" aria-label="${t("modal.close")}">${icon("close")}</button>
      <div class="dialog-item-art item-only-preview">${visual}</div>
      <h2>${escapeHtml(tItem(item, "name"))}</h2>
      <p class="panel-note item-meta"><span class="rarity-label rarity-${getItemRarity(item)}">${t(`rarity.${getItemRarity(item)}`)}</span>${t("modal.meta", { type: TYPE_LABEL[item.type]?.() || t("modal.type.weapon"), level: item.minLevel, price: item.price ? t("shop.coins", { price: item.price }) : t("shop.free") })}</p>
      ${item.description ? `<p class="dialog-item-description">${escapeHtml(tItem(item, "description"))}</p>` : ""}
      <p class="dialog-status">${status}</p>
      ${bespoke && canBuyItem(pupil, item) ? `
        <form class="bespoke-order-form" data-action="order-bespoke">
          <input type="hidden" name="itemId" value="${escapeHtml(item.id)}" />
          <label class="field">
            <span>${t("modal.describe")}</span>
            <textarea name="note" rows="4" required maxlength="500" placeholder="${t("modal.placeholder")}"></textarea>
          </label>
          <button class="btn btn-primary" type="submit">${t("modal.orderFor", { price: item.price })}</button>
        </form>
      ` : ""}
    </dialog>
  `;
}

/* Help request: the message is delivered to the admin console inbox, the
 * reply address is the account email shown in the panel. */
export function renderHelpDialog({ email = "" } = {}) {
  const categories = ["bug", "class", "account", "billing", "other"];
  return `<dialog class="dialog dialog-help" aria-labelledby="help-dialog-title">
    <button class="dialog-close" type="button" data-action="close-dialog" aria-label="${t('modal.close')}">${icon('close')}</button>
    <h2 id="help-dialog-title">${t('settings.help.title')}</h2>
    <p class="panel-note">${t('settings.help.body', { email: escapeHtml(email || '—') })}</p>
    <form class="help-form" data-action="send-support">
      <label class="field"><span>${t('settings.help.category')}</span><select name="category">
        ${categories.map((category) => `<option value="${category}">${t(`settings.help.cat.${category}`)}</option>`).join("")}
      </select></label>
      <label class="field"><span>${t('settings.help.subject')}</span><input name="subject" maxlength="120" /></label>
      <label class="field"><span>${t('settings.help.message')}</span><textarea name="message" rows="5" maxlength="2000" required autofocus placeholder="${t('settings.help.placeholder')}"></textarea></label>
      <div class="row"><button class="btn btn-primary" type="submit">${icon('book')}${t('settings.help.send')}</button><button class="btn" type="button" data-action="close-dialog">${t('common.cancel')}</button></div>
    </form>
  </dialog>`;
}

/* Signed-out recovery: request a code by email, then set a new password. */
export function renderPasswordResetDialog() {
  return `<dialog class="dialog dialog-reset" aria-labelledby="reset-dialog-title">
    <button class="dialog-close" type="button" data-action="close-dialog" aria-label="${t('modal.close')}">${icon('close')}</button>
    <h2 id="reset-dialog-title">${t('settings.reset')}</h2>
    <p class="panel-note">${t('settings.reset.dialogHint')}</p>
    <form class="access-form" data-action="confirm-password-reset">
      <label class="field"><span>${t('welcome.field.email')}</span><input name="email" type="email" autocomplete="email" maxlength="160" required autofocus /></label>
      <button class="btn btn-sm" type="button" data-action="request-password-reset">${t('settings.reset.send')}</button>
      <label class="field"><span>${t('settings.reset.code')}</span><input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required /></label>
      <label class="field"><span>${t('settings.reset.next')}</span><input name="next" type="password" autocomplete="new-password" required minlength="${MIN_PASSWORD_LENGTH}" maxlength="${MAX_PASSWORD_LENGTH}" /></label>
      <label class="field"><span>${t('console.account.repeat')}</span><input name="confirm" type="password" autocomplete="new-password" required maxlength="${MAX_PASSWORD_LENGTH}" /></label>
      <button class="btn btn-primary" type="submit">${t('settings.reset.confirm')}</button>
    </form>
  </dialog>`;
}

/* One rule is a bilingual pair: the French text is required, the English one
 * falls back to it. Editing reuses the same dialog as adding, with the index
 * telling app.mjs which list entry to replace. */
export function renderRuleDialog({ section, index = null, rule = null } = {}) {
  const editing = index !== null && index !== undefined;
  return `<dialog class="dialog dialog-rule" aria-labelledby="rule-dialog-title">
    <button class="dialog-close" type="button" data-action="close-dialog" aria-label="${t('modal.close')}">${icon('close')}</button>
    <h2 id="rule-dialog-title">${editing ? t("rules.edit.title") : t("rules.edit.new")}</h2>
    <p class="panel-note">${t(RULE_SECTION_LABEL[section] || "rules.title.how")}</p>
    <form class="rule-form" data-action="save-rule" data-section="${escapeHtml(section)}" data-index="${editing ? Number(index) : ""}">
      <label class="field"><span>${t("rules.edit.fr")}</span><textarea name="fr" rows="3" maxlength="240" required autofocus>${escapeHtml(rule?.fr || "")}</textarea></label>
      <label class="field"><span>${t("rules.edit.en")}</span><textarea name="en" rows="3" maxlength="240" placeholder="${t("rules.edit.enFallback")}">${escapeHtml(rule?.en || "")}</textarea></label>
      <div class="row"><button class="btn btn-primary" type="submit">${t("common.save")}</button><button class="btn" type="button" data-action="close-dialog">${t("common.cancel")}</button></div>
    </form>
  </dialog>`;
}
