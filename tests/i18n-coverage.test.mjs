import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hasTranslation } from "../src/i18n.mjs";
import { messages } from "../src/i18n-extra.mjs";
import { SHOP_ITEMS } from "../src/domain.mjs";

/* The whole UI is keyed through i18n. These checks keep the FR/EN dictionary
 * honest: every key used in the source must exist in both languages, every
 * extra message must ship both copies, and every shop item must have French
 * copy (English stays canonical on the domain objects). */

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(here, "..", "src");

function sourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (entry.name.endsWith(".mjs")) out.push(full);
  }
  return out;
}

function literalKeys() {
  const keys = new Map();
  for (const file of sourceFiles(srcDir)) {
    const text = fs.readFileSync(file, "utf8");
    const re = /\b(?:t|hasTranslation)\(\s*["'`]([^"'`$]+)["'`]/g;
    let match;
    while ((match = re.exec(text))) {
      if (!keys.has(match[1])) keys.set(match[1], path.relative(srcDir, file));
    }
  }
  return keys;
}

test("every translation key used in the UI exists in French and English", () => {
  const keys = literalKeys();
  assert.ok(keys.size > 200, `expected a large dictionary, found ${keys.size}`);
  const missing = [...keys].filter(([key]) => !hasTranslation(key, "fr") || !hasTranslation(key, "en"));
  assert.deepEqual(missing, [], `missing translations: ${missing.map(([key, file]) => `${key} (${file})`).join(", ")}`);
});

test("extra message pairs always provide both languages", () => {
  for (const [key, value] of Object.entries(messages)) {
    assert.ok(Array.isArray(value) && value.length === 2, `${key} must be a [fr, en] pair`);
    assert.equal(typeof value[0], "string", `${key} French copy must be a string`);
    assert.equal(typeof value[1], "string", `${key} English copy must be a string`);
    assert.ok(value[0].trim() && value[1].trim(), `${key} must not be empty`);
  }
});

test("every shop item field is translated in French", () => {
  const missing = [];
  for (const item of SHOP_ITEMS) {
    for (const field of ["name", "description", "reward"]) {
      if (item[field] === undefined) continue;
      if (!hasTranslation(`domain.${item.id}.${field}`, "fr")) missing.push(`domain.${item.id}.${field}`);
    }
  }
  assert.deepEqual(missing, [], `missing French domain copy: ${missing.join(", ")}`);
});
