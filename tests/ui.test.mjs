import { test } from "node:test";
import assert from "node:assert/strict";
import {
  goalMilestones,
  initTheme,
  animateDashboard,
  dateOptions,
  shiftDate,
} from "../dist/ui.js";
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
  assert.equal(values.get("nutriar-neon-theme"), "dark");
  assert.equal(meta.content, "#0c0f13");
  assert.equal(button["aria-label"], "Switch to light mode");
  button.onclick();
  assert.equal(document.documentElement.dataset.theme, "light");
  assert.equal(values.get("nutriar-neon-theme"), "light");
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

test("date capsules cross month and year boundaries without timezone drift", () => {
  assert.equal(shiftDate("2026-12-31", 1), "2027-01-01");
  assert.equal(shiftDate("2028-03-01", -1), "2028-02-29");
  assert.deepEqual(
    dateOptions("2026-11-17", "2026-11-17").map((d) => d.label),
    ["Yesterday", "Today", "Tomorrow"],
  );
  assert.equal(dateOptions("2026-12-31", "2026-11-17")[1].selected, true);
});
test("animated remaining calories and both ring layers finish at the real activity-adjusted budget", () => {
  const left = { dataset: { count: "left" } },
    eaten = { dataset: { count: "kcal" } },
    ring = { style: {} },
    glow = { style: {} };
  let frame;
  globalThis.document = {
    querySelectorAll(s) {
      return s === "[data-count]" ? [left, eaten] : [ring, glow];
    },
  };
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.requestAnimationFrame = (fn) => {
    frame = fn;
  };
  animateDashboard({ kcal: 0 }, { kcal: 500 }, 2200);
  frame(performance.now() + 1000);
  assert.equal(left.textContent, "1,700");
  assert.equal(eaten.textContent, "500");
  assert.ok(Number.isFinite(Number(ring.style.strokeDashoffset)));
  assert.equal(ring.style.strokeDashoffset, glow.style.strokeDashoffset);
  delete globalThis.document;
  delete globalThis.matchMedia;
  delete globalThis.requestAnimationFrame;
});
test("fresh visits start dark and an explicit light preference is respected", async () => {
  const { readFile } = await import("node:fs/promises");
  const vm = await import("node:vm");
  const html = await readFile(
    new URL("../dist/index.html", import.meta.url),
    "utf8",
  );
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const [stored, expected] of [
    [null, "dark"],
    ["light", "light"],
    ["dark", "dark"],
  ]) {
    const document = { documentElement: { dataset: {} } };
    vm.runInNewContext(script, {
      document,
      localStorage: { getItem: () => stored },
    });
    assert.equal(document.documentElement.dataset.theme, expected);
  }
});
