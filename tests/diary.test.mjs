import { test } from "node:test";
import assert from "node:assert/strict";
import { createDiaryHandler } from "../diary-api.mjs";
import { emptyState, mergeDiary } from "../dist/diary-data.js";
import { createDiarySync } from "../dist/diary-sync.js";
import { createVercelHandler } from "../vercel-api.mjs";
const origin = "https://diary.test";
const entry = (id) => ({
  id,
  name: "Empanada",
  meal: "Lunch",
  kcal: 220,
  p: null,
  c: null,
  f: null,
});
const day = (entries) => ({ entries, water: 500, note: "", burned: 100 });
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
const request = (method = "GET", data, headers = {}) =>
  new Request(origin + "/api/diary", {
    method,
    headers: { origin, "content-type": "application/json", ...headers },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
test("diary storage survives handler restarts and preserves unknown macros", async () => {
  const redis = database();
  const state = emptyState();
  state.days["2026-11-17"] = day([entry("a")]);
  let handler = createDiaryHandler({ env: {}, redis });
  assert.equal(
    (await handler(request("PUT", { revision: 0, state }))).status,
    200,
  );
  handler = createDiaryHandler({ env: {}, redis });
  const data = await (await handler(request())).json();
  assert.deepEqual(data.state, state);
  assert.equal(data.revision, 1);
});
test("atomic revision check refuses stale device writes", async () => {
  const handler = createDiaryHandler({ env: {}, redis: database() });
  await handler(request("PUT", { revision: 0, state: emptyState() }));
  const stale = await handler(
    request("PUT", {
      revision: 0,
      state: { ...emptyState(), days: { "2026-11-16": day([]) } },
    }),
  );
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).revision, 1);
});
test("cloud diary is protected by the existing password", async () => {
  const handler = createVercelHandler({ env: { APP_PASSWORD: "test" } });
  assert.equal((await handler(request(), "/api/diary")).status, 401);
  assert.equal(
    (
      await handler(
        request("GET", null, {
          authorization:
            "Basic " + Buffer.from("nutriar:test").toString("base64"),
        }),
        "/api/diary",
      )
    ).status,
    503,
  );
});
test("storage validates diary, limits payloads and blocks cross-origin writes", async () => {
  const handler = createDiaryHandler({ env: {}, redis: database() });
  assert.equal(
    (
      await handler(
        request(
          "PUT",
          { revision: 0, state: emptyState() },
          { origin: "https://evil.test" },
        ),
      )
    ).status,
    403,
  );
  assert.equal(
    (await handler(request("PUT", { revision: 0, state: {} }))).status,
    400,
  );
  assert.equal(
    (
      await handler(
        request("PUT", {
          revision: 0,
          state: { ...emptyState(), custom: [null] },
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await handler(
        request("PUT", {
          revision: 0,
          state: { ...emptyState(), padding: "x".repeat(2 * 1024 * 1024) },
        }),
      )
    ).status,
    413,
  );
});
test("three-way merge combines dates and entries while preserving deletion", () => {
  const base = emptyState();
  base.days["2026-11-17"] = day([entry("a"), entry("b")]);
  const local = structuredClone(base),
    remote = structuredClone(base);
  local.days["2026-11-17"].entries = [entry("b"), entry("c")];
  remote.days["2026-11-17"].entries.push(entry("d"));
  remote.days["2026-11-16"] = day([]);
  const result = mergeDiary(base, local, remote);
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(
    result.state.days["2026-11-17"].entries.map((e) => e.id),
    ["b", "c", "d"],
  );
  assert.ok(result.state.days["2026-11-16"]);
});
test("same item edits and deletion-versus-edit require review", () => {
  const base = emptyState();
  base.days["2026-11-17"] = day([entry("a")]);
  const local = structuredClone(base),
    remote = structuredClone(base);
  local.days["2026-11-17"].water = 1000;
  remote.days["2026-11-17"].water = 1500;
  assert.ok(mergeDiary(base, local, remote).conflicts.length);
  local.days["2026-11-17"].water = 500;
  remote.days["2026-11-17"].water = 500;
  local.days["2026-11-17"].entries = [];
  remote.days["2026-11-17"].entries[0].kcal = 300;
  assert.ok(mergeDiary(base, local, remote).conflicts.length);
});
function device(handler, initial = emptyState(), cached = null) {
  let state = structuredClone(initial),
    status;
  const memory = new Map(
    cached ? [["nutriar-cloud-v1", JSON.stringify(cached)]] : [],
  );
  const sync = createDiarySync({
    getState: () => state,
    applyState: (value) => {
      state = value;
    },
    onStatus: (kind) => {
      status = kind;
    },
    storage: {
      getItem: (key) => memory.get(key),
      setItem: (k, v) => memory.set(k, v),
    },
    fetchImpl: (_, options) =>
      handler(
        new Request(origin + "/api/diary", {
          ...options,
          headers: { ...options.headers, origin },
        }),
      ),
  });
  return { sync, state: () => state, status: () => status };
}
test("two devices import local history and sync meals, notes, water, goals and weights", async () => {
  const handler = createDiaryHandler({ env: {}, redis: database() });
  const initial = emptyState();
  initial.days["2026-11-17"] = day([entry("a")]);
  initial.weights = [{ date: "2026-11-17", kg: 90 }];
  initial.goals.kcal = 1800;
  const first = device(handler, initial);
  await first.sync.sync();
  assert.equal(first.status(), "saved");
  const second = device(handler);
  await second.sync.sync();
  assert.deepEqual(second.state(), first.state());
  first.state().days["2026-11-17"].note = "Feeling good";
  second.state().days["2026-11-17"].water = 1200;
  await first.sync.sync();
  await second.sync.sync();
  await first.sync.sync();
  assert.deepEqual(first.state(), second.state());
  assert.equal(first.state().days["2026-11-17"].note, "Feeling good");
  assert.equal(first.state().days["2026-11-17"].water, 1200);
});
test("offline changes remain local and sync when service recovers", async () => {
  const actual = createDiaryHandler({ env: {}, redis: database() });
  let offline = true;
  const d = device((req) => {
    if (offline) throw Error("offline");
    return actual(req);
  });
  d.state().days["2026-11-17"] = day([entry("offline")]);
  await d.sync.sync();
  assert.equal(d.status(), "offline");
  assert.equal(d.state().days["2026-11-17"].entries[0].id, "offline");
  offline = false;
  await d.sync.sync();
  assert.equal(d.status(), "saved");
});
test("conflicting devices do not overwrite cloud until explicit review", async () => {
  const handler = createDiaryHandler({ env: {}, redis: database() });
  const first = device(handler),
    second = device(handler);
  await first.sync.sync();
  await second.sync.sync();
  first.state().goals.kcal = 1800;
  second.state().goals.kcal = 2200;
  await first.sync.sync();
  await second.sync.sync();
  assert.equal(second.status(), "conflict");
  const cloud = await (await handler(request())).json();
  assert.equal(cloud.state.goals.kcal, 1800);
  second.sync.resolve("cloud");
  await second.sync.sync();
  assert.equal(second.state().goals.kcal, 1800);
});
