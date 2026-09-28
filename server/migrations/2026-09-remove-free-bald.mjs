#!/usr/bin/env node
/* One-shot data migration — 2026-09 release.
 *
 * Bald used to be a free cut, and free items are written into every pupil's
 * inventory, so most pupils "own" Bald without having bought it. It is now a
 * level-2 purchase (20 coins): take it back from everyone. A pupil who wears
 * it returns to the default cut (boy: Short, girl: Long). Nothing else moves —
 * XP, level, coins, HP, titles and every other item stay exactly as they are.
 *
 * Each changed state gets revision + 1, so a browser still holding the old
 * copy receives a 409 conflict instead of silently re-saving it. The previous
 * state.json is kept in the account's backups/ folder, and a marker file makes
 * a second run a no-op (it would otherwise remove a legitimately bought Bald).
 *
 *   node server/migrations/2026-09-remove-free-bald.mjs            # dry run
 *   node server/migrations/2026-09-remove-free-bald.mjs --apply    # write
 *
 * DATA_DIR defaults to ./data. Stop the server before --apply.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { isStateDocument } from "../../src/state-schema.mjs";

const MIGRATION = "2026-09-remove-free-bald";
const ITEM = "bald";

export function migratePupil(pupil) {
  const owned = Array.isArray(pupil.ownedItems) ? pupil.ownedItems : [];
  const wearing = pupil.hair === ITEM;
  if (!owned.includes(ITEM) && !wearing) return { pupil, changed: false };
  const next = { ...pupil, ownedItems: owned.filter((id) => id !== ITEM) };
  if (wearing) next.hair = pupil.gender === "girl" ? "long" : "short";
  return { pupil: next, changed: true, unequipped: wearing };
}

export function migrateState(state) {
  let pupils = 0, unequipped = 0;
  const classes = state.classes.map((classroom) => ({
    ...classroom,
    pupils: (Array.isArray(classroom.pupils) ? classroom.pupils : []).map((pupil) => {
      const result = migratePupil(pupil);
      if (result.changed) pupils += 1;
      if (result.unequipped) unequipped += 1;
      return result.pupil;
    })
  }));
  if (!pupils) return { state, pupils, unequipped };
  return {
    state: { ...state, classes, revision: (Number.isSafeInteger(state.revision) ? state.revision : 0) + 1, updatedAt: new Date().toISOString() },
    pupils,
    unequipped
  };
}

function writeJsonAtomic(file, data) {
  const tmp = `${file}.tmp-${process.pid}-${crypto.randomBytes(6).toString("hex")}`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmp, file);
}

function run() {
  const apply = process.argv.includes("--apply");
  const dataDir = path.resolve(process.env.DATA_DIR || "data");
  const marker = path.join(dataDir, "migrations", `${MIGRATION}.done`);
  if (fs.existsSync(marker)) {
    console.log(`${MIGRATION}: already applied (${fs.readFileSync(marker, "utf8").trim()}). Nothing to do.`);
    return;
  }
  const accountsDir = path.join(dataDir, "accounts");
  const accounts = fs.existsSync(accountsDir) ? fs.readdirSync(accountsDir).filter((id) => /^[0-9a-f]{24}$/.test(id)) : [];
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  let totalPupils = 0, totalUnequipped = 0, files = 0;
  for (const id of accounts) {
    const file = path.join(accountsDir, id, "state.json");
    if (!fs.existsSync(file)) continue;
    const state = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!isStateDocument(state)) throw new Error(`${file}: not a Class Odyssey state, aborting`);
    const result = migrateState(state);
    if (!result.pupils) continue;
    files += 1; totalPupils += result.pupils; totalUnequipped += result.unequipped;
    console.log(`${id.slice(0, 6)}…  rev ${state.revision ?? 0} → ${result.state.revision}  pupils ${result.pupils}  unequipped ${result.unequipped}`);
    if (!apply) continue;
    const backups = path.join(accountsDir, id, "backups");
    fs.mkdirSync(backups, { recursive: true, mode: 0o700 });
    fs.copyFileSync(file, path.join(backups, `state-${stamp}-pre-${MIGRATION}.json`));
    writeJsonAtomic(file, result.state);
  }
  console.log(`${apply ? "APPLIED" : "DRY RUN"}: ${files} account(s), ${totalPupils} pupil(s) lose Bald, ${totalUnequipped} unequipped.`);
  if (apply) {
    fs.mkdirSync(path.dirname(marker), { recursive: true, mode: 0o700 });
    fs.writeFileSync(marker, `${new Date().toISOString()} ${files} accounts ${totalPupils} pupils\n`, { mode: 0o600 });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) run();
