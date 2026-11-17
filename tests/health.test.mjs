import { test } from "node:test";
import assert from "node:assert/strict";
import { issueHealthToken, validHealthToken } from "../health-auth.mjs";
import { validHealthImport, applyHealthImport } from "../health-data.mjs";
import { createDiaryHandler } from "../diary-api.mjs";
import { createVercelHandler } from "../vercel-api.mjs";
import { emptyState, validState, mergeDiary } from "../dist/diary-data.js";
import { activityForDay, calorieBalance } from "../dist/nutrition.js";
const now = new Date("2026-11-17T16:00:00Z");
const password = "test-password";
function database() {
  let raw = null;
  return {
    get: async () => raw,
    eval: async (_, keys, [revision, next]) => {
      if ((raw ? JSON.parse(raw).revision : 0) !== revision)
        return raw || '{"revision":0,"state":null}';
      raw = next;
      return raw;
    },
  };
}
const healthRequest = (body, authorization) =>
  new Request("https://diary.test/api/health", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authorization ? { authorization } : {}),
    },
    body: JSON.stringify(body),
  });
test("Health tokens expire, revoke on password change and reject forgery", () => {
  const { token } = issueHealthToken(password, now.getTime());
  assert.ok(validHealthToken(token, password, now.getTime()));
  assert.ok(!validHealthToken(token, "another-password", now.getTime()));
  assert.ok(!validHealthToken(token, password, now.getTime() + 91 * 86400000));
  assert.ok(!validHealthToken(token + "x", password, now.getTime()));
  assert.ok(!validHealthToken("v1.9999999999.x.y", password, now.getTime()));
});
test("import validates dates, bounds and numeric Health values without inventing zeros", () => {
  assert.ok(
    validHealthImport(
      { date: "2026-11-17", steps: 5000, activeKcal: 300 },
      now,
    ),
  );
  assert.ok(validHealthImport({ date: "2026-11-17", activeKcal: 0 }, now));
  for (const body of [
    { date: "2026-11-17" },
    { date: "2026-11-17", steps: null },
    { date: "2026-11-17", steps: -1 },
    { date: "2026-11-17", steps: 1.5 },
    { date: "2026-11-17", activeKcal: "300" },
    { date: "2026-11-18", steps: 100 },
    { date: "2026-02-30", steps: 100 },
    { date: "2026-01-01", steps: 100 },
    { date: "2026-11-17", activeKcal: 10001 },
  ])
    assert.ok(!validHealthImport(body, now));
});
test("imports replace daily totals and retain meals, notes, water and manual activity", () => {
  const state = emptyState();
  state.days["2026-11-17"] = {
    entries: [
      {
        id: "meal",
        name: "Empanada",
        meal: "Lunch",
        kcal: 220,
        p: null,
        c: null,
        f: null,
      },
    ],
    water: 1000,
    note: "note",
    burned: 150,
  };
  let doc = { revision: 3, state };
  doc = applyHealthImport(
    doc,
    { date: "2026-11-17", steps: 5000, activeKcal: 300 },
    now.toISOString(),
  );
  doc = applyHealthImport(
    doc,
    { date: "2026-11-17", steps: 6000, activeKcal: 350 },
    now.toISOString(),
  );
  assert.ok(validState(doc.state));
  const day = doc.state.days["2026-11-17"];
  assert.equal(day.health.steps, 6000);
  assert.equal(day.health.activeKcal, 350);
  assert.equal(day.entries.length, 1);
  assert.equal(day.water, 1000);
  assert.equal(day.note, "note");
  assert.equal(day.burned, 150);
  assert.equal(activityForDay(day), 350);
  assert.equal(calorieBalance(2000, 1000, activityForDay(day)).budget, 2350);
  assert.equal(activityForDay({ ...day, activitySource: "manual" }), 150);
});
test("health-only token cannot access diary or issue more tokens", async () => {
  const handler = createVercelHandler({
    env: { APP_PASSWORD: password },
    redis: database(),
  });
  const { token } = issueHealthToken(password);
  for (const path of ["/api/diary", "/api/health-token"]) {
    const response = await handler(
      new Request("https://diary.test" + path, {
        headers: { authorization: "Bearer " + token },
      }),
      path,
    );
    assert.equal(response.status, 401);
  }
  assert.equal(
    (
      await handler(
        healthRequest(
          {},
          "Basic " + Buffer.from("nutriar:" + password).toString("base64"),
        ),
        "/api/health",
      )
    ).status,
    401,
  );
});
test("token creation needs authenticated same-origin POST", async () => {
  const handler = createVercelHandler({ env: { APP_PASSWORD: password } });
  const authorization =
    "Basic " + Buffer.from("nutriar:" + password).toString("base64");
  const req = (origin) =>
    new Request("https://diary.test/api/health-token", {
      method: "POST",
      headers: { authorization, origin },
    });
  assert.equal(
    (await handler(req("https://evil.test"), "/api/health-token")).status,
    403,
  );
  const response = await handler(
    req("https://diary.test"),
    "/api/health-token",
  );
  assert.equal(response.status, 200);
  assert.ok(validHealthToken((await response.json()).token, password));
});
test("Shortcut POST succeeds without a browser Origin and writes only allowed health fields", async () => {
  const redis = database();
  const handler = createVercelHandler({
    env: { APP_PASSWORD: password },
    redis,
  });
  const { token } = issueHealthToken(password);
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const r = await handler(
    healthRequest(
      { date, steps: 8000, activeKcal: 420, goals: { kcal: 9000 } },
      "Bearer " + token,
    ),
    "/api/health",
  );
  assert.equal(r.status, 200);
  assert.equal((await r.json()).ok, true);
  const saved = JSON.parse(await redis.get());
  assert.equal(saved.state.days[date].health.steps, 8000);
  assert.equal(saved.state.goals.kcal, 2000);
});
test("browser offline meals merge with a cloud Apple Health import", () => {
  const base = emptyState();
  base.days["2026-11-17"] = { entries: [], water: 0, note: "" };
  const local = structuredClone(base);
  local.days["2026-11-17"].note = "local note";
  const remote = applyHealthImport(
    { revision: 1, state: base },
    { date: "2026-11-17", steps: 3000 },
    now.toISOString(),
  ).state;
  const result = mergeDiary(base, local, remote);
  assert.deepEqual(result.conflicts, []);
  assert.equal(result.state.days["2026-11-17"].note, "local note");
  assert.equal(result.state.days["2026-11-17"].health.steps, 3000);
});
test("Vercel Marketplace KV-prefixed credentials initialize Redis correctly", async () => {
  let options;
  const handler = createDiaryHandler({
    env: {
      KV_REST_API_URL: "https://test.upstash.io",
      KV_REST_API_TOKEN: "secret",
    },
    redisFactory: (value) => {
      options = value;
      return database();
    },
  });
  assert.equal(
    (await handler(new Request("https://diary.test/api/diary"))).status,
    200,
  );
  assert.equal(options.url, "https://test.upstash.io");
  assert.equal(options.token, "secret");
});
test("Health storage retries a racing web save and preserves that save", async () => {
  const redis = database();
  let race = true;
  const original = redis.eval;
  redis.eval = async (...args) => {
    if (race) {
      race = false;
      const state = emptyState();
      state.days["2026-11-17"] = { entries: [], water: 500, note: "web edit" };
      await original("", [], [0, JSON.stringify({ revision: 1, state })]);
    }
    return original(...args);
  };
  const handler = createDiaryHandler({
    env: {},
    redis,
    now: () => now.toISOString(),
  });
  assert.equal(
    (await handler(healthRequest({ date: "2026-11-17", steps: 1200 }))).status,
    200,
  );
  const doc = JSON.parse(await redis.get());
  assert.equal(doc.state.days["2026-11-17"].note, "web edit");
  assert.equal(doc.state.days["2026-11-17"].health.steps, 1200);
});
