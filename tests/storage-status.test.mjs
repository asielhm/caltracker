import { test } from "node:test";
import assert from "node:assert/strict";
import { createDiaryHandler } from "../diary-api.mjs";
import { createVercelHandler } from "../vercel-api.mjs";
import { emptyState } from "../dist/diary-data.js";
const origin = "https://example.vercel.app";
const request = (headers = {}) =>
  new Request(origin + "/api/storage-status", {
    method: "POST",
    headers: { origin, ...headers },
  });
test("database self-check reads back its own expiring test key without changing diary", async () => {
  const state = emptyState();
  state.days["2026-11-17"] = { entries: [], water: 500, note: "private" };
  const diary = JSON.stringify({
    revision: 4,
    state,
    updatedAt: "2026-11-17T12:00:00Z",
  });
  const memory = new Map([["nutriar:diary:owner:v1", diary]]);
  let options;
  const redis = {
    set: async (k, v, o) => {
      options = o;
      memory.set(k, v);
    },
    get: async (k) => memory.get(k),
    del: async (k) => memory.delete(k),
  };
  const handler = createDiaryHandler({ env: {}, redis });
  const response = await handler(request());
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.days, 1);
  assert.equal(data.revision, 4);
  assert.equal(options.ex, 60);
  assert.equal(memory.size, 1);
  assert.equal(memory.get("nutriar:diary:owner:v1"), diary);
  assert.ok(!JSON.stringify(data).includes("private"));
  assert.match(response.headers.get("cache-control"), /no-store/);
});
test("database self-check reports unreadable writes and always cleans up", async () => {
  let deleted = false;
  const handler = createDiaryHandler({
    env: {},
    redis: {
      set: async () => {},
      get: async () => null,
      del: async () => {
        deleted = true;
      },
    },
  });
  assert.equal((await handler(request())).status, 502);
  assert.equal(deleted, true);
});
test("database self-check requires owner authentication, POST, and same origin", async () => {
  const env = { APP_PASSWORD: "test" };
  const wrapper = createVercelHandler({ env });
  assert.equal((await wrapper(request(), "/api/storage-status")).status, 401);
  const handler = createDiaryHandler({ env: {}, redis: {} });
  assert.equal(
    (await handler(request({ origin: "https://evil.test" }))).status,
    403,
  );
  assert.equal(
    (await handler(new Request(origin + "/api/storage-status"))).status,
    405,
  );
});
