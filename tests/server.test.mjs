import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, validEstimate } from "../server.mjs";
import { foods } from "../dist/foods.js";
const server = createServer();
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}`;
after(() => server.close());
test("serves app and rejects unlisted paths", async () => {
  assert.equal((await fetch(url)).status, 200);
  for (const path of [
    "/foods.js",
    "/video-foods.js",
    "/nutrition.js",
    "/ui.js",
    "/camera.js",
    "/assets/meal.jpg",
  ])
    assert.equal((await fetch(url + path)).status, 200);
  assert.equal((await fetch(url + "/.env")).status, 404);
});
test("AI is clearly unavailable without credentials", async () => {
  assert.equal(
    (await (await fetch(url + "/api/config")).json()).aiEnabled,
    false,
  );
  assert.equal(
    (
      await fetch(url + "/api/analyze", {
        method: "POST",
        headers: { Origin: url, "Content-Type": "application/json" },
      })
    ).status,
    503,
  );
});
test("AI output rejects malformed or negative nutrition", () => {
  assert.equal(
    validEstimate({ name: "Meal", kcal: 300, p: 20, c: 30, f: 11 }),
    true,
  );
  assert.equal(
    validEstimate({ name: "Meal", kcal: -1, p: 20, c: 30, f: 11 }),
    false,
  );
  assert.equal(
    validEstimate({ name: "Meal", kcal: "300", p: 20, c: 30, f: 11 }),
    false,
  );
});
test("food catalog has unique IDs and finite nonnegative nutrients", () => {
  assert.ok(foods.length >= 35);
  assert.equal(new Set(foods.map((f) => f.id)).size, foods.length);
  for (const f of foods) {
    assert.ok(f.grams === null || f.grams > 0);
    assert.ok(Number.isFinite(f.kcal) && f.kcal >= 0);
    for (const k of ["p", "c", "f"])
      assert.ok(f[k] === null || (Number.isFinite(f[k]) && f[k] >= 0));
  }
});
