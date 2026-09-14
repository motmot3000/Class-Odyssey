/* Teacher controls: frequent rewards stay visible; administration is folded
 * into details panels. All state changes are dispatched through app.mjs.
 */

import { getNextReward, getRewardsForLevel, xpProgress } from "../domain.mjs";
import { baseStageAttributes as heroStageAttributes } from "../characters.mjs";
import { renderEquippedCharacter as renderHero } from "../equipment-previews.mjs";
import { escapeHtml, gearOf, icon, renderCustomOrders, renderHearts, renderLevel, renderMoney, translateReward } from "../ui.mjs";
import { renderShop } from "./shop.mjs";
import { getLang, t, tItem, translateMessage } from "../i18n.mjs";

const XP_PRESETS = [
  { amount: 100, reason: "console.preset.homework" },
  { amount: 150, reason: "console.preset.vocabulary" },
  { amount: 50, reason: "console.preset.nice" },
  { amount: 500, reason: "console.preset.bonus" }
];

const COIN_PRESETS = [10, 20, 30, 50];

export function renderConsole({ classroom, ui, targets, focused, canUndo, events, armedReset = false, unlockedUntil = null, account = null }) {
  const open = (name) => (ui.openPanels.has(name) ? "open" : "");

  return `
    <div class="console-head">
      <h2>${t("console.title")}</h2>
      <button class="btn btn-primary btn-sm" type="button" data-action="focus-add">${icon('plus')}<span>${t('console.roster.add')}</span></button>
    </div>
    <div class="console-history">
      <button class="btn btn-sm" type="button" data-action="undo" ${canUndo ? "" : "disabled"} title="${t("console.undoHint")}">
        ${icon("undo")}<span>${t("console.undo")}</span>
      </button>
    </div>

    ${renderTarget(classroom, ui, targets)}
    ${renderAward(ui, targets)}
    ${renderHeroPanel(focused, ui, open)}
    ${renderActivityPanel(events, open)}
    ${renderDataPanel(open, armedReset)}
    ${renderAccountPanel(open, unlockedUntil, account)}
  `;
}

function renderAccountPanel(open, unlockedUntil, account) {
  const locale = getLang() === "fr" ? "fr-FR" : "en-GB";
  const endsAt = Number.isFinite(unlockedUntil)
    ? new Date(unlockedUntil).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
    : null;
  return `
    <details class="panel" data-panel="account" ${open("account")}>
      <summary>${icon("lock")}<span>${t("console.account")}</span></summary>
      <p class="account-line"><strong>${escapeHtml(account?.displayName || "")}</strong><span>@${escapeHtml(account?.username || "")}</span></p>
      <p class="panel-note">${t("console.account.note")}${endsAt ? t("console.account.openUntil", { time: endsAt }) : ""}</p>
      <form class="access-form" data-action="change-password">
        <label class="field"><span>${t("console.account.current")}</span><input name="current" type="password" autocomplete="current-password" /></label>
        <label class="field"><span>${t("console.account.new")}</span><input name="next" type="password" autocomplete="new-password" /></label>
        <label class="field"><span>${t("console.account.repeat")}</span><input name="confirm" type="password" autocomplete="new-password" /></label>
        <button class="btn btn-primary btn-sm" type="submit">${t("console.account.change")}</button>
      </form>
       <hr class="rule" /><div class="button-row"><button class="btn btn-sm" data-action="lock-adult">${icon("lock")}${t("console.account.lock")}</button><button class="btn btn-sm btn-quiet-danger" data-action="sign-out">${t("console.account.signout")}</button><a class="btn btn-sm" href="./assets/labs/index.html">${t("app.labs")}</a></div>
    </details>`;
}

/* Reward targets stay named and pinned above the controls. Empty targets
 * disable awards so the teacher always knows who will receive the change.
 */

function renderTarget(classroom, ui, targets) {
  const selectedCount = ui.scope === "selection" ? targets.length : 0;
  const names = classroom.pupils
    .filter((pupil) => targets.includes(pupil.id))
    .map((pupil) => pupil.name);

  const summary = ui.scope === "class"
    ? t("console.target.everyone", { name: escapeHtml(classroom.name), count: classroom.pupils.length })
    : names.length
      ? escapeHtml(names.join(", "))
      : t("console.target.tap");

  return `
    <section class="target ${targets.length ? "" : "is-empty"}">
      <h3 class="section-label">${t("console.target.giveTo")}</h3>
      <div class="segmented segmented-lg" role="group" aria-label="${t("console.target.aria")}">
        <button type="button" class="${ui.scope === "selection" ? "is-active" : ""}" data-action="scope" data-scope="selection" aria-pressed="${ui.scope === "selection"}">
          ${t("console.target.selected")}<b>${selectedCount}</b>
        </button>
        <button type="button" class="${ui.scope === "class" ? "is-active" : ""}" data-action="scope" data-scope="class" aria-pressed="${ui.scope === "class"}">
          ${t("console.target.whole")}
        </button>
      </div>
      <p class="target-names">${summary}</p>
      ${ui.scope === "selection" ? `
        <label class="field teacher-target"><span>${t('console.target.choose')}</span><select id="teacher-target" data-action="teacher-target">
          <option value="">${t('console.target.none')}</option>
          ${classroom.pupils.map(pupil=>`<option value="${escapeHtml(pupil.id)}" ${targets.includes(pupil.id)?'selected':''}>${escapeHtml(pupil.name)}</option>`).join('')}
        </select></label>
        <div class="target-actions">
          <button class="btn btn-sm" type="button" data-action="clear-selection" ${targets.length ? "" : "disabled"}>${t("console.target.clear")}</button>
        </div>
      ` : ""}
    </section>
  `;
}

function renderAward(ui, targets) {
  const off = targets.length ? "" : "disabled";

  return `
    <section class="award">
      <h3 class="section-label">${t("console.award.experience")}</h3>
      <div class="award-grid">
        ${XP_PRESETS.map((preset) => `
          <button class="award-btn" type="button" data-action="award-xp" data-amount="${preset.amount}" data-reason="${escapeHtml(t(preset.reason))}" ${off}>
            <strong>+${preset.amount}</strong>
            <span>${t(preset.reason)}</span>
          </button>
        `).join("")}
      </div>
      <form class="stepper-row stepper-xp" data-action="custom-xp">
        <div class="stepper">
          <button class="stepper-btn" type="button" data-action="step" data-field="xp-amount" data-step="-50" aria-label="${t("console.award.lowerXp")}">${icon("minus")}</button>
          <input id="xp-amount" name="amount" type="number" min="1" step="1" value="${ui.xpAmount}" aria-label="${t("console.award.customXp")}" />
          <button class="stepper-btn" type="button" data-action="step" data-field="xp-amount" data-step="50" aria-label="${t("console.award.raiseXp")}">${icon("plus")}</button>
        </div>
        <button class="btn btn-primary" type="submit" ${off}>${t("console.award.giveXp")}</button>
      </form>

      <h3 class="section-label">${t("console.award.hitPoints")}</h3>
      <div class="hp-row">
        <button class="btn btn-danger" type="button" data-action="hp-minus" ${off}>${t("console.award.minusHp")}</button>
        <button class="btn btn-ok" type="button" data-action="hp-plus" ${off}>${t("console.award.plusHp")}</button>
        <button class="btn" type="button" data-action="heal-all">${t("console.award.restore")}</button>
      </div>

      <h3 class="section-label">${t("console.award.coins")}</h3>
      <form class="coin-row" data-action="custom-money">
        ${COIN_PRESETS.map((amount) => `
          <button class="btn btn-coin" type="button" data-action="award-money" data-amount="${amount}" ${off}>+${amount}</button>
        `).join("")}
        <div class="stepper">
          <button class="stepper-btn" type="button" data-action="step" data-field="coin-amount" data-step="-10" aria-label="${t("console.award.lowerCoin")}">${icon("minus")}</button>
          <input id="coin-amount" name="amount" type="number" min="1" step="1" value="${ui.coinAmount}" aria-label="${t("console.award.customCoin")}" />
          <button class="stepper-btn" type="button" data-action="step" data-field="coin-amount" data-step="10" aria-label="${t("console.award.raiseCoin")}">${icon("plus")}</button>
        </div>
        <button class="btn btn-primary" type="submit" ${off}>${t("console.award.giveCoins")}</button>
      </form>

      ${targets.length ? "" : `<p class="award-hint">${t("console.award.hint")}</p>`}
    </section>
  `;
}

/* Focus is independent from reward selection: a group may receive an award
 * while the most recently selected pupil keeps its details panel open.
 */

function renderHeroPanel(pupil, ui, open) {
  if (!pupil) {
    return `
      <details class="panel" data-panel="hero" ${open("hero")}>
        <summary>${icon("user")}<span>${t("console.hero.details")}</span></summary>
        <p class="panel-note">${t("console.hero.hint")}</p>
      </details>
    `;
  }

  const progress = xpProgress(pupil);
  // Level one unlocks are only the starter catalogue, not a useful reward list.
  const unlocked = pupil.level > 1 ? getRewardsForLevel(pupil.level) : [];
  const next = getNextReward(pupil.level);

  return `
    <details class="panel" data-panel="hero" ${open("hero")}>
      <summary>${icon("user")}<span>${escapeHtml(pupil.name)}</span></summary>

      <div class="hero-sheet">
        <button class="hero-sheet-art" type="button" data-action="zoom-pupil" data-pupil-id="${escapeHtml(pupil.id)}" aria-label="${t("console.hero.zoom", { name: escapeHtml(pupil.name) })}" ${heroStageAttributes(pupil)}>
          ${renderHero(pupil)}
        </button>
        <div class="hero-sheet-facts">
          <div class="hero-sheet-top">
            ${renderLevel(pupil.level)}
            ${renderMoney(pupil.money)}
          </div>
          ${renderHearts(pupil)}
          <p class="hero-sheet-xp">${t("console.hero.xp", { current: `<strong>${progress.current}</strong>`, needed: progress.needed, next: pupil.level + 1 })}</p>
        </div>
      </div>

      <dl class="gear">
        ${gearOf(pupil).map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
      </dl>
      ${renderCustomOrders(pupil)}

      <div class="rewards">
        ${unlocked.length ? unlocked.map((reward) => `<span class="reward-tag">${escapeHtml(translateReward(reward))}</span>`).join("") : ""}
        <p class="panel-note">${next
          ? t("console.hero.unlocks", { next: next.level, rewards: next.rewards.map(translateReward).map(escapeHtml).join(", ") })
          : t("console.hero.allUnlocked")}</p>
      </div>

      <form class="inline-form" data-action="rename-pupil">
        <input name="name" value="${escapeHtml(pupil.name)}" aria-label="${t("console.hero.renameAria", { name: escapeHtml(pupil.name) })}" />
        <button class="btn btn-sm" type="submit">${t("console.hero.rename")}</button>
      </form>

      <button class="btn btn-sm btn-quiet-danger" type="button" data-action="remove-pupil" data-pupil-id="${escapeHtml(pupil.id)}">
        ${icon("trash")}<span>${t("console.hero.remove", { name: escapeHtml(pupil.name) })}</span>
      </button>
    </details>

    <details class="panel" data-panel="shop" ${open("shop")}>
      <summary>${icon("shop")}<span>${t("console.shop.summary", { name: escapeHtml(pupil.name) })}</span></summary>
      ${renderShop(pupil, ui.shopCategory)}
    </details>
  `;
}

function renderActivityPanel(events, open) {
  return `
    <details class="panel" data-panel="activity" ${open("activity")}>
      <summary>${icon("clock")}<span>${t("console.activity")}</span></summary>
      ${events.length ? `
        <ol class="events">
          ${events.slice(0, 8).map(renderEvent).join("")}
        </ol>
      ` : `<p class="panel-note">${t("console.activity.empty")}</p>`}
    </details>
  `;
}

function renderEvent(event) {
  const locale = getLang() === "fr" ? "fr-FR" : "en-GB";
  const time = new Date(event.at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const amount = Number(event.amount) || 0;
  const positive = amount > 0;
  return `
    <li class="event">
      <time>${time}</time>
      <span>${escapeHtml(translateMessage(event.reason))}</span>
      <b class="${positive ? "is-gain" : "is-loss"}">${positive ? "+" : ""}${amount}</b>
    </li>
  `;
}

function renderDataPanel(open, armedReset) {
  return `
    <details class="panel" data-panel="data" ${open("data")}>
      <summary>${icon("download")}<span>${t("console.data")}</span></summary>
      <p class="panel-note">${t("console.data.note")}</p>
      <div class="button-row">
        <button class="btn btn-sm" type="button" data-action="export">${icon("download")}<span>${t("console.data.export")}</span></button>
        <button class="btn btn-sm" type="button" data-action="import">${icon("upload")}<span>${t("console.data.import")}</span></button>
      </div>
      <hr class="rule" />
      <button class="btn btn-sm btn-quiet-danger ${armedReset ? "is-armed" : ""}" type="button" data-action="reset-all">${icon("trash")}<span>${armedReset ? t("console.data.armed") : t("console.data.erase")}</span></button>
    </details>
  `;
}
