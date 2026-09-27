/* Teacher controls: frequent rewards stay visible; administration is folded
 * into details panels. All state changes are dispatched through app.mjs.
 */

import { getNextReward, getRewardsForLevel, xpProgress } from "../domain.mjs";
import { baseStageAttributes as heroStageAttributes } from "../characters.mjs";
import { renderEquippedCharacter as renderHero } from "../equipment-previews.mjs";
import { escapeHtml, gearOf, icon, renderCustomOrders, renderHearts, renderLevel, renderMoney, translateReward } from "../ui.mjs";
import { renderShop } from "./shop.mjs";
import { getLang, t, tItem, translateMessage } from "../i18n.mjs";

const XP_PRESETS = [50, 100, 200, 500, 1000];

const COIN_PRESETS = [10, 20, 50, 100];

export function renderConsole({ classroom, ui, targets, focused, canUndo, events, armedReset = false, unlockedUntil = null, account = null }) {
  const open = (name) => (ui.openPanels.has(name) ? "open" : "");

  return `
    <div class="console-head">
      <h2>${t("console.title")}</h2>
      <button class="btn btn-primary btn-sm" type="button" data-action="focus-add" ${classroom ? "" : "disabled"} title="${classroom ? "" : t("console.target.noClass")}">${icon('plus')}<span>${t('console.roster.add')}</span></button>
    </div>
    ${unlockedUntil ? `<div class="teacher-session-lock">
      <button class="btn btn-sm" type="button" data-action="lock-adult">${icon('lock')}<span>${t('console.account.lock')}</span></button>
      <span class="teacher-session-status" role="timer" aria-live="off" data-teacher-time data-until="${Number(unlockedUntil)}"></span>
    </div>` : ''}
    <div class="console-history">
      <button class="btn btn-sm" type="button" data-action="undo" ${canUndo ? "" : "disabled"} title="${t("console.undoHint")}">
        ${icon("undo")}<span>${t("console.undo")}</span>
      </button>
    </div>

    ${renderTarget(classroom, ui, targets)}
    ${renderAward(ui, targets)}
    ${renderHeroPanel(focused, ui, open)}
    ${renderRulesPanel(open)}
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
  const email = account?.email || "";
  return `
    <details class="panel" data-panel="account" ${open("account")}>
      <summary>${icon("lock")}<span>${t("settings.title")}</span></summary>
      <p class="account-line"><strong>${escapeHtml(account?.displayName || "")}</strong><span>@${escapeHtml(account?.username || "")}</span></p>
      <p class="panel-note">${t("console.account.note")}${endsAt ? t("console.account.openUntil", { time: endsAt }) : ""}</p>
      <p class="section-label">${t("console.account.language")}</p>
      <div class="onboarding-choices">
        <button class="btn btn-sm${getLang() === "fr" ? " is-active" : ""}" type="button" data-action="set-language" data-lang="fr" aria-pressed="${getLang() === "fr"}">Français</button>
        <button class="btn btn-sm${getLang() === "en" ? " is-active" : ""}" type="button" data-action="set-language" data-lang="en" aria-pressed="${getLang() === "en"}">English</button>
      </div>

      <p class="section-label">${t("settings.profile")}</p>
      <form class="access-form" data-action="update-profile">
        <label class="field"><span>${t("settings.displayName")}</span><input name="displayName" autocomplete="nickname" maxlength="60" value="${escapeHtml(account?.displayName || "")}" required /></label>
        <label class="field"><span>${t("settings.email")}</span><input name="email" type="email" autocomplete="email" maxlength="160" value="${escapeHtml(email)}" required /></label>
        <p class="field-hint">${t("settings.emailHint")}</p>
        <button class="btn btn-primary btn-sm" type="submit">${t("settings.saveProfile")}</button>
      </form>

      <hr class="rule" />
      <p class="section-label">${t("settings.password")}</p>
      <form class="access-form" data-action="change-password">
        <label class="field"><span>${t("console.account.current")}</span><input name="current" type="password" autocomplete="current-password" /></label>
        <label class="field"><span>${t("console.account.new")}</span><input name="next" type="password" autocomplete="new-password" /></label>
        <label class="field"><span>${t("console.account.repeat")}</span><input name="confirm" type="password" autocomplete="new-password" /></label>
        <button class="btn btn-primary btn-sm" type="submit">${t("console.account.change")}</button>
      </form>

      <details class="account-reset">
        <summary>${t("settings.reset")}</summary>
        <p class="panel-note">${t("settings.reset.hint", { email: escapeHtml(email) })}</p>
        <form class="inline-form" data-action="request-password-reset">
          <button class="btn btn-sm" type="submit">${t("settings.reset.send")}</button>
        </form>
        <form class="access-form" data-action="confirm-password-reset">
          <label class="field"><span>${t("settings.reset.code")}</span><input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required /></label>
          <label class="field"><span>${t("settings.reset.next")}</span><input name="next" type="password" autocomplete="new-password" required minlength="6" maxlength="128" /></label>
          <label class="field"><span>${t("console.account.repeat")}</span><input name="confirm" type="password" autocomplete="new-password" required maxlength="128" /></label>
          <button class="btn btn-primary btn-sm" type="submit">${t("settings.reset.confirm")}</button>
        </form>
      </details>

      <hr class="rule" />
      <p class="section-label">${t("settings.help")}</p>
      <button class="btn btn-sm" type="button" data-action="open-help">${icon("book")}<span>${t("settings.help.open")}</span></button>

      <hr class="rule" />
      <div class="button-row"><button class="btn btn-sm btn-quiet-danger" data-action="sign-out">${t("console.account.signout")}</button><a class="btn btn-sm" href="./assets/labs/index.html">${t("app.labs")}</a></div>
    </details>`;
}

/* "Whole class" is a real, reversible selection: the button selects every
 * pupil and pressing it again clears the selection. The pupil picker covers
 * the single-target case, so the console has no hidden scope mode. */
function renderTarget(classroom, ui, targets) {
  if (!classroom) {
    return `
      <section class="target is-empty">
        <h3 class="section-label">${t("console.target.giveTo")}</h3>
        <p class="panel-note">${t("console.target.noClass")}</p>
      </section>`;
  }
  const allIds = classroom.pupils.map((pupil) => pupil.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => targets.includes(id));
  const names = classroom.pupils.filter((pupil) => targets.includes(pupil.id)).map((pupil) => pupil.name);

  const summary = allSelected
    ? t("console.target.everyone", { name: escapeHtml(classroom.name), count: classroom.pupils.length })
    : names.length
      ? escapeHtml(names.join(", "))
      : t("console.target.tap");

  return `
    <section class="target ${targets.length ? "" : "is-empty"}">
      <h3 class="section-label">${t("console.target.giveTo")}</h3>
      <div class="target-actions">
        <button class="btn btn-sm ${allSelected ? "is-active" : ""}" type="button" data-action="toggle-class-selection" aria-pressed="${allSelected}">
          ${icon("heroes")}<span>${t("console.target.whole")}</span>
        </button>
        <button class="btn btn-sm" type="button" data-action="clear-selection" ${targets.length ? "" : "disabled"}>${t("console.target.clear")}</button>
      </div>
      <label class="field teacher-target"><span>${t('console.target.choose')}</span><select id="teacher-target" data-action="teacher-target">
        <option value="">${t('console.target.none')}</option>
        ${classroom.pupils.map(pupil=>`<option value="${escapeHtml(pupil.id)}" ${targets.includes(pupil.id)&&!allSelected?'selected':''}>${escapeHtml(pupil.name)}</option>`).join('')}
      </select></label>
      <p class="target-names">${summary}</p>
    </section>
  `;
}

function renderAward(ui, targets) {
  const off = targets.length ? "" : "disabled";

  return `
    <section class="award">
      <h3 class="section-label">${t("console.award.experience")}</h3>
      <div class="award-grid">
        ${XP_PRESETS.map((amount) => `
          <button class="award-btn" type="button" data-action="award-xp" data-amount="${amount}" ${off}>
            <strong>+${amount}</strong>
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

function renderRulesPanel(open) {
  return `
    <details class="panel" data-panel="rules" ${open("rules")}>
      <summary>${icon("book")}<span>${t("console.rules.summary")}</span></summary>
      <p class="panel-note">${t("console.rules.note")}</p>
      <button class="btn btn-primary btn-sm" type="button" data-action="show-rules">${icon("book")}<span>${t("console.rules.change")}</span></button>
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
