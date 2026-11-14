import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState, getCurrentClass, rankPupils } from "../src/domain.mjs";
import { BOARD_LAYOUTS, renderOdysseyStudent } from "../src/views/odyssey.mjs";

const hero = (name, level, xp, money = 0) => ({ id: name, name, level, xp, money });

test("ranking groups heroes by level, orders by XP and ignores money", () => {
  const tiers = rankPupils([
    hero("Ada", 2, 100, 999),
    hero("Bob", 3, 10),
    hero("Cleo", 2, 400),
    hero("Dan", 1, 900, 5000),
    hero("Eve", 3, 50)
  ]);
  assert.deepEqual(tiers.map(tier => [tier.rank, tier.level, tier.pupils.map(p => p.name)]), [
    [1, 3, ["Eve", "Bob"]],
    [2, 2, ["Cleo", "Ada"]],
    [3, 1, ["Dan"]]
  ]);
});

test("the class board renders the grid, list and ranking layouts", () => {
  const classroom = getCurrentClass(createInitialState());
  const render = boardLayout => renderOdysseyStudent({ classroom, ui: { boardLayout, query: "" }, pupil: null, classView: true });
  assert.deepEqual(BOARD_LAYOUTS, ["grid", "list", "ranking"]);

  const grid = render("grid");
  assert.match(grid, /class="rune-grid picker-grid"/);
  assert.match(grid, /data-action="board-layout" data-layout="grid" aria-pressed="true"/);

  const list = render("list");
  assert.match(list, /class="hero-list"/);
  assert.equal((list.match(/class="hero-row /g) || []).length, classroom.pupils.length);
  assert.match(list, /data-action="student-pick"/);

  const ranking = render("ranking");
  assert.match(ranking, /class="podium"/);
  const ranked = (ranking.match(/class="(podium-hero|rank-chip) /g) || []).length;
  assert.equal(ranked, classroom.pupils.length);

  assert.match(render("unknown"), /class="rune-grid picker-grid"/);
});
