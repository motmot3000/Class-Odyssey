/* Native dialogs provide focus containment, Escape handling and an inert
 * background. app.mjs owns mounting and disposal of their optional 3D viewer.
 */

import { canBuyItem, cosmeticField, getNextReward, isItemOwned, xpProgress, SKIN_TONES } from "../domain.mjs";
import { renderItemThumbnail } from "../equipment-previews.mjs";
import { renderBaseCharacterViewer, baseStageAttributes } from "../characters.mjs";
import {
  escapeHtml,
  getItemRarity,
  gearOf,
  icon,
  renderHearts,
  renderCustomOrders,
  renderLevel,
  renderMoney,
  renderOutBadge,
  renderTitle,
  renderXpBar,
  statusClass,
  translateReward
} from "../ui.mjs";
import { t, tItem } from "../i18n.mjs";

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

export function renderAddClassDialog() {
  return `<dialog class="dialog dialog-add-pupil" aria-labelledby="add-class-title">
    <button class="dialog-close" type="button" data-action="close-dialog" aria-label="${t('modal.close')}">${icon('close')}</button>
    <h2 id="add-class-title">${t('class.add.title')}</h2>
    <form class="add-form" data-action="create-class">
      <label class="field"><span>${t('class.add.name')}</span><input name="name" autocomplete="off" required maxlength="60" placeholder="${t('class.add.placeholder')}" autofocus /></label>
      <div class="row"><button class="btn btn-primary" type="submit">${icon('plus')}${t('class.add.submit')}</button><button class="btn" type="button" data-action="close-dialog">${t('common.cancel')}</button></div>
    </form>
  </dialog>`;
}

export function renderAddPupilDialog(classroom) {  return `<dialog class="dialog dialog-add-pupil" aria-labelledby="add-pupil-title">
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
      <label class="field"><span>${t('class.new.students')}</span><textarea name="students" rows="5" placeholder="${t('class.new.studentsPlaceholder')}"></textarea></label>
      <div class="row"><button class="btn btn-primary" type="submit">${icon('plus')}${t('class.new.submit')}</button><button class="btn" type="button" data-action="close-dialog">${t('common.cancel')}</button></div>
    </form>
  </dialog>`;
}

// Read-only hero details remain safe to display on a classroom touch screen.
export function renderPupilDialog(pupil) {
  const progress = xpProgress(pupil);
  const next = getNextReward(pupil.level);

  return `
    <dialog class="dialog dialog-hero ${statusClass(pupil)}" aria-label="${escapeHtml(pupil.name)}">
      <button class="dialog-close" type="button" data-action="close-dialog" aria-label="${t("modal.close")}">${icon("close")}</button>
      <div class="dialog-hero-art dialog-hero-art-3d" ${baseStageAttributes(pupil)}>
        ${renderBaseCharacterViewer(pupil)}
        ${renderOutBadge(pupil)}
      </div>
      <div class="dialog-hero-facts">
        <header class="locker-name">
          <h2>${escapeHtml(pupil.name)}</h2>
          ${renderLevel(pupil.level)}
        </header>
        ${renderTitle(pupil)}
        ${renderHearts(pupil)}
        ${renderXpBar(pupil)}
        <p class="panel-note">${t("modal.xpToLevel", { n: progress.needed - progress.current, level: pupil.level + 1 })}</p>
        ${renderMoney(pupil.money)}
        <dl class="gear">
          ${gearOf(pupil).map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
        </dl>
        ${renderCustomOrders(pupil)}
        <p class="panel-note">${next
          ? t("modal.levelUnlocks", { level: next.level, rewards: next.rewards.map(translateReward).map(escapeHtml).join(", ") })
          : t("modal.allUnlocked")}</p>
      </div>
    </dialog>
  `;
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
