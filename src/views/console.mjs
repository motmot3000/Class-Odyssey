/* ============================================================
   console.mjs — console de l'enseignant
   Règle de composition : ce qui sert à chaque minute de cours reste
   toujours visible (cible + attribution), le reste se replie.
   ============================================================ */

import { SKIN_TONES, getNextReward, getRewardsForLevel, xpProgress } from "../domain.mjs";
import { renderHero } from "../avatar.mjs";
import { escapeHtml, gearOf, heroStageAttributes, icon, renderCustomOrders, renderHearts, renderLevel, renderMoney } from "../ui.mjs";
import { renderShop } from "./shop.mjs";

const XP_PRESETS = [
  { amount: 100, reason: "Homework" },
  { amount: 150, reason: "Vocabulary" },
  { amount: 50, reason: "Nice" },
  { amount: 500, reason: "Bonus" }
];

const COIN_PRESETS = [10, 20, 30, 50];

export function renderConsole({ classroom, ui, targets, focused, canUndo, events, armedReset = false, unlockedUntil = null, account = null }) {
  const open = (name) => (ui.openPanels.has(name) ? "open" : "");

  return `
    <div class="console-head">
      <h2>Teacher console</h2>
      <button class="btn btn-sm" type="button" data-action="undo" ${canUndo ? "" : "disabled"} title="Undo last change (Ctrl+Z)">
        ${icon("undo")}<span>Undo</span>
      </button>
    </div>

    ${renderTarget(classroom, ui, targets)}
    ${renderAward(ui, targets)}
    ${renderHeroPanel(focused, ui, open)}
    ${renderRosterPanel(classroom, open)}
    ${renderActivityPanel(events, open)}
    ${renderDataPanel(open, armedReset)}
    ${renderAccountPanel(open, unlockedUntil, account)}
  `;
}

function renderAccountPanel(open, unlockedUntil, account) {
  const endsAt = Number.isFinite(unlockedUntil)
    ? new Date(unlockedUntil).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : null;
  return `
    <details class="panel" data-panel="account" ${open("account")}>
      <summary>${icon("lock")}<span>Account</span></summary>
      <p class="account-line"><strong>${escapeHtml(account?.displayName || "")}</strong><span>@${escapeHtml(account?.username || "")}</span></p>
      <p class="panel-note">The account password also unlocks this console.${endsAt ? ` It is open here until ${endsAt}.` : ""}</p>
      <form class="access-form" data-action="change-password">
        <label class="field"><span>Current password</span><input name="current" type="password" autocomplete="current-password" /></label>
        <label class="field"><span>New password</span><input name="next" type="password" autocomplete="new-password" /></label>
        <label class="field"><span>Repeat new password</span><input name="confirm" type="password" autocomplete="new-password" /></label>
        <button class="btn btn-primary btn-sm" type="submit">Change password</button>
      </form>
      <hr class="rule" /><div class="button-row"><button class="btn btn-sm" data-action="lock-adult">${icon("lock")}Lock console</button><button class="btn btn-sm btn-quiet-danger" data-action="sign-out">Sign out</button></div>
    </details>`;
}

/* ---------- Cible ----------
   Le bug d'usage classique : cliquer « +100 XP » sans savoir qui reçoit.
   La cible est donc épinglée en haut, nommée, et l'attribution se
   désactive tant qu'elle est vide. */

function renderTarget(classroom, ui, targets) {
  const selectedCount = ui.scope === "selection" ? targets.length : 0;
  const names = classroom.pupils
    .filter((pupil) => targets.includes(pupil.id))
    .map((pupil) => pupil.name);

  const summary = ui.scope === "class"
    ? `Everyone in ${escapeHtml(classroom.name)} — ${classroom.pupils.length} heroes.`
    : names.length
      ? escapeHtml(names.join(", "))
      : "Tap heroes on the board to pick who gets the reward.";

  return `
    <section class="target ${targets.length ? "" : "is-empty"}">
      <h3 class="section-label">Give to</h3>
      <div class="segmented segmented-lg" role="group" aria-label="Reward target">
        <button type="button" class="${ui.scope === "selection" ? "is-active" : ""}" data-action="scope" data-scope="selection" aria-pressed="${ui.scope === "selection"}">
          Selected<b>${selectedCount}</b>
        </button>
        <button type="button" class="${ui.scope === "class" ? "is-active" : ""}" data-action="scope" data-scope="class" aria-pressed="${ui.scope === "class"}">
          Whole class
        </button>
      </div>
      <p class="target-names">${summary}</p>
      ${ui.scope === "selection" ? `
        <div class="target-actions">
          <button class="btn btn-sm" type="button" data-action="select-all">Select all</button>
          <button class="btn btn-sm" type="button" data-action="clear-selection" ${targets.length ? "" : "disabled"}>Clear selection</button>
        </div>
      ` : ""}
    </section>
  `;
}

function renderAward(ui, targets) {
  const off = targets.length ? "" : "disabled";

  return `
    <section class="award">
      <h3 class="section-label">Experience</h3>
      <div class="award-grid">
        ${XP_PRESETS.map((preset) => `
          <button class="award-btn" type="button" data-action="award-xp" data-amount="${preset.amount}" data-reason="${preset.reason}" ${off}>
            <strong>+${preset.amount}</strong>
            <span>${preset.reason}</span>
          </button>
        `).join("")}
      </div>
      <form class="stepper-row stepper-xp" data-action="custom-xp">
        <div class="stepper">
          <button class="stepper-btn" type="button" data-action="step" data-field="xp-amount" data-step="-50" aria-label="Lower XP amount">${icon("minus")}</button>
          <input id="xp-amount" name="amount" type="number" min="1" step="1" value="${ui.xpAmount}" aria-label="Custom XP amount" />
          <button class="stepper-btn" type="button" data-action="step" data-field="xp-amount" data-step="50" aria-label="Raise XP amount">${icon("plus")}</button>
        </div>
        <button class="btn btn-primary" type="submit" ${off}>Give XP</button>
      </form>

      <h3 class="section-label">Hit points</h3>
      <div class="hp-row">
        <button class="btn btn-danger" type="button" data-action="hp-minus" ${off}>&minus;1 HP</button>
        <button class="btn btn-ok" type="button" data-action="hp-plus" ${off}>+1 HP</button>
        <button class="btn" type="button" data-action="heal-all">Restore class</button>
      </div>

      <h3 class="section-label">Coins</h3>
      <form class="coin-row" data-action="custom-money">
        ${COIN_PRESETS.map((amount) => `
          <button class="btn btn-coin" type="button" data-action="award-money" data-amount="${amount}" ${off}>+${amount}</button>
        `).join("")}
        <div class="stepper">
          <button class="stepper-btn" type="button" data-action="step" data-field="coin-amount" data-step="-10" aria-label="Lower coin amount">${icon("minus")}</button>
          <input id="coin-amount" name="amount" type="number" min="1" step="1" value="${ui.coinAmount}" aria-label="Custom coin amount" />
          <button class="stepper-btn" type="button" data-action="step" data-field="coin-amount" data-step="10" aria-label="Raise coin amount">${icon("plus")}</button>
        </div>
        <button class="btn btn-primary" type="submit" ${off}>Give coins</button>
      </form>

      ${targets.length ? "" : `<p class="award-hint">Pick a target above to unlock these buttons.</p>`}
    </section>
  `;
}

/* ---------- Héros au point ----------
   Distinct de la cible : on peut récompenser six élèves tout en gardant
   la fiche d'un seul ouverte. Le dernier héros touché est celui qu'on lit. */

function renderHeroPanel(pupil, ui, open) {
  if (!pupil) {
    return `
      <details class="panel" data-panel="hero" ${open("hero")}>
        <summary>${icon("user")}<span>Hero details</span></summary>
        <p class="panel-note">Tap a hero on the board to read their sheet, rename them or open their shop.</p>
      </details>
    `;
  }

  const progress = xpProgress(pupil);
  // Au niveau 1, « débloqué » listerait tout le catalogue de départ : sans
  // information, donc masqué.
  const unlocked = pupil.level > 1 ? getRewardsForLevel(pupil.level) : [];
  const next = getNextReward(pupil.level);

  return `
    <details class="panel" data-panel="hero" ${open("hero")}>
      <summary>${icon("user")}<span>${escapeHtml(pupil.name)}</span></summary>

      <div class="hero-sheet">
        <button class="hero-sheet-art" type="button" data-action="zoom-pupil" data-pupil-id="${escapeHtml(pupil.id)}" aria-label="Show ${escapeHtml(pupil.name)} full size" ${heroStageAttributes(pupil)}>
          ${renderHero(pupil)}
        </button>
        <div class="hero-sheet-facts">
          <div class="hero-sheet-top">
            ${renderLevel(pupil.level)}
            ${renderMoney(pupil.money)}
          </div>
          ${renderHearts(pupil)}
          <p class="hero-sheet-xp"><strong>${progress.current}</strong>/${progress.needed} XP to level ${pupil.level + 1}</p>
        </div>
      </div>

      <dl class="gear">
        ${gearOf(pupil).map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
      </dl>
      ${renderCustomOrders(pupil)}

      <div class="rewards">
        ${unlocked.length ? unlocked.map((reward) => `<span class="reward-tag">${escapeHtml(reward)}</span>`).join("") : ""}
        <p class="panel-note">${next
          ? `Level ${next.level} unlocks ${next.rewards.map(escapeHtml).join(", ")}.`
          : "Every reward is unlocked."}</p>
      </div>

      <form class="inline-form" data-action="rename-pupil">
        <input name="name" value="${escapeHtml(pupil.name)}" aria-label="Rename ${escapeHtml(pupil.name)}" />
        <button class="btn btn-sm" type="submit">Rename</button>
      </form>

      <button class="btn btn-sm btn-quiet-danger" type="button" data-action="remove-pupil" data-pupil-id="${escapeHtml(pupil.id)}">
        ${icon("trash")}<span>Remove ${escapeHtml(pupil.name)}</span>
      </button>
    </details>

    <details class="panel" data-panel="shop" ${open("shop")}>
      <summary>${icon("shop")}<span>Shop — ${escapeHtml(pupil.name)}</span></summary>
      ${renderShop(pupil, ui.shopCategory)}
    </details>
  `;
}

function renderRosterPanel(classroom, open) {
  return `
    <details class="panel" data-panel="add" ${open("add")}>
      <summary>${icon("plus")}<span>Add student</span></summary>
      <form class="add-form" data-action="add-pupil">
        <div class="inline-form">
          <input id="pupil-name" name="name" autocomplete="off" placeholder="First name" aria-label="First name" />
          <button class="btn btn-primary btn-sm" type="submit">Add</button>
        </div>
        <div class="field-row">
          <label class="field">
            <span>Character</span>
            <select name="gender">
              <option value="boy">Boy</option>
              <option value="girl">Girl</option>
            </select>
          </label>
          <label class="field">
            <span>Skin tone</span>
            <select name="skinTone">
              ${SKIN_TONES.filter((tone) => !tone.price).map((tone) => `<option value="${tone.id}">${tone.name}</option>`).join("")}
            </select>
          </label>
        </div>
        <p class="panel-note">Joining ${escapeHtml(classroom.name)}. Everything can be changed later.</p>
      </form>
    </details>
  `;
}

function renderActivityPanel(events, open) {
  return `
    <details class="panel" data-panel="activity" ${open("activity")}>
      <summary>${icon("clock")}<span>Activity</span></summary>
      ${events.length ? `
        <ol class="events">
          ${events.slice(0, 8).map(renderEvent).join("")}
        </ol>
      ` : `<p class="panel-note">Rewards you hand out show up here.</p>`}
    </details>
  `;
}

function renderEvent(event) {
  const time = new Date(event.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const amount = Number(event.amount) || 0;
  const positive = amount > 0;
  return `
    <li class="event">
      <time>${time}</time>
      <span>${escapeHtml(event.reason)}</span>
      <b class="${positive ? "is-gain" : "is-loss"}">${positive ? "+" : ""}${amount}</b>
    </li>
  `;
}

function renderDataPanel(open, armedReset) {
  return `
    <details class="panel" data-panel="data" ${open("data")}>
      <summary>${icon("download")}<span>Data</span></summary>
      <p class="panel-note">The class is saved on the server. Export a copy before a holiday, or import one to restore it.</p>
      <div class="button-row">
        <button class="btn btn-sm" type="button" data-action="export">${icon("download")}<span>Export</span></button>
        <button class="btn btn-sm" type="button" data-action="import">${icon("upload")}<span>Import</span></button>
      </div>
      <hr class="rule" />
      <button class="btn btn-sm btn-quiet-danger ${armedReset ? "is-armed" : ""}" type="button" data-action="reset-all">${icon("trash")}<span>${armedReset ? "Tap again to erase everything" : "Erase every class"}</span></button>
    </details>
  `;
}
