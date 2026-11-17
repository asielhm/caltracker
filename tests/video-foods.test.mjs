import { test } from "node:test";
import assert from "node:assert/strict";
import { videoFoods } from "../dist/video-foods.js";
import {
  scaleFood,
  summarize,
  formatMacro,
  validNutrients,
} from "../dist/nutrition.js";
test("preserves all video rows and the two visible macro panels", () => {
  assert.equal(videoFoods.length, 52);
  const iso = videoFoods.find((f) => f.name === "Iso GOLD");
  assert.deepEqual(scaleFood(iso, 1), { kcal: 121, p: 29, c: 1.9, f: 0.8 });
  const mil = videoFoods.find(
    (f) => f.name === "Milanesa de nalga Union Ganadera",
  );
  assert.deepEqual(scaleFood(mil, 1), { kcal: 246, p: 21, c: 30, f: 5 });
  assert.equal(videoFoods.filter((f) => f.p !== null).length, 2);
});
test("displayed multi-serving calories are preserved without inventing weights", () => {
  const chipa = videoFoods.find((f) => f.name === "Chipa Dia");
  assert.equal(chipa.kcal, 106);
  assert.match(chipa.serving, /2½/);
  assert.equal(chipa.grams, null);
  const leche = videoFoods.find((f) => f.name === "Leche protein 46g");
  assert.equal(leche.grams, null);
  assert.equal(leche.p, null);
  assert.equal(
    videoFoods.find((f) => f.name === "Pastafrola 100g 1 slice").grams,
    100,
  );
});
test("portion scaling and JSON backups preserve unknown macros", () => {
  const prota = videoFoods.find((f) => f.name === "Prota");
  const portion = scaleFood(prota, 2);
  assert.deepEqual(portion, { kcal: 394, p: null, c: null, f: null });
  assert.ok(validNutrients(JSON.parse(JSON.stringify(portion))));
  assert.equal(formatMacro(null, 2), "Unknown");
  assert.equal(formatMacro(0, 2), "0 g");
});
test("daily calories include calorie-only foods, with explicit incomplete macro counts", () => {
  const iso = videoFoods.find((f) => f.name === "Iso GOLD");
  const prota = videoFoods.find((f) => f.name === "Prota");
  const totals = summarize([scaleFood(iso, 1), scaleFood(prota, 1)]);
  assert.equal(totals.kcal, 318);
  assert.equal(totals.p, 29);
  assert.deepEqual(totals.missing, { p: 1, c: 1, f: 1 });
  assert.deepEqual(summarize([]).missing, { p: 0, c: 0, f: 0 });
});

test("calorie budget includes logged activity and safely supports legacy days", async () => {
  const { calorieBalance } = await import("../dist/nutrition.js");
  assert.deepEqual(calorieBalance(1800, 468), {
    burned: 0,
    budget: 1800,
    left: 1332,
    progress: 468 / 1800,
  });
  assert.equal(calorieBalance(1800, 468, 200).left, 1532);
  assert.equal(calorieBalance(1800, 2300, 200).left, -300);
  assert.equal(calorieBalance(1800, 2300, 200).progress, 1);
  assert.equal(calorieBalance(1800, 468, -10).burned, 0);
});
