import { test } from "node:test";
import assert from "node:assert/strict";
import { goalMilestones, initTheme, animateDashboard } from "../dist/ui.js";
const g = { kcal: 2000, p: 130, c: 230, f: 62 };
const totals = (p, c, f, missing = { p: 0, c: 0, f: 0 }) => ({
  kcal: 1000,
  p,
  c,
  f,
  missing,
});
test("goal feedback fires only when a known macro crosses its target", () => {
  assert.deepEqual(
    goalMilestones(totals(120, 200, 50), totals(130, 200, 62), g),
    ["p", "f"],
  );
  assert.deepEqual(
    goalMilestones(totals(130, 230, 62), totals(150, 250, 70), g),
    [],
  );
  assert.deepEqual(
    goalMilestones(
      totals(120, 200, 50),
      totals(150, 250, 70, { p: 1, c: 1, f: 1 }),
      g,
    ),
    [],
  );
});
test("theme toggle synchronizes persistent preference, browser chrome and accessible label", () => {
  const button = {
    setAttribute(k, v) {
      this[k] = v;
    },
  };
  const meta = {};
  const values = new Map();
  globalThis.document = {
    documentElement: { dataset: { theme: "light" } },
    querySelector(s) {
      return s === "#theme-toggle" ? button : meta;
    },
  };
  globalThis.localStorage = {
    setItem(k, v) {
      values.set(k, v);
    },
  };
  initTheme();
  assert.equal(button["aria-pressed"], "false");
  assert.equal(button["aria-label"], "Switch to dark mode");
  button.onclick();
  assert.equal(document.documentElement.dataset.theme, "dark");
  assert.equal(values.get("nutriar-theme"), "dark");
  assert.equal(meta.content, "#17151d");
  assert.equal(button["aria-label"], "Switch to light mode");
  button.onclick();
  assert.equal(document.documentElement.dataset.theme, "light");
  assert.equal(values.get("nutriar-theme"), "light");
  delete globalThis.document;
  delete globalThis.localStorage;
});
test("counter animation honors reduced motion without scheduling frames", () => {
  globalThis.matchMedia = () => ({ matches: true });
  globalThis.requestAnimationFrame = () => {
    throw new Error("Must not animate");
  };
  animateDashboard(totals(1, 2, 3), totals(2, 3, 4), 2000);
  delete globalThis.matchMedia;
  delete globalThis.requestAnimationFrame;
});
