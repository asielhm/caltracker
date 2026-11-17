import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
execFileSync(process.execPath, ["scripts/build-worker.mjs"]);
const { default: worker } = await import("../dist/server/index.js");
test("built Worker serves app assets and a real API config route", async () => {
  for (const path of ["/", "/app.js", "/ui.js", "/foods.js", "/style.css"]) {
    const r = await worker.fetch(
      new Request("https://site.example" + path),
      {},
    );
    assert.equal(r.status, 200);
    assert.ok((await r.text()).length > 50);
  }
  const r = await worker.fetch(
    new Request("https://site.example/api/config"),
    {},
  );
  assert.equal(r.status, 200);
  assert.equal((await r.json()).aiEnabled, false);
});
test("built Worker rejects anonymous paid requests and does not expose server source", async () => {
  const r = await worker.fetch(
    new Request("https://site.example/api/analyze", { method: "POST" }),
    { OPENAI_API_KEY: "test-key" },
  );
  assert.equal(r.status, 401);
  for (const path of [
    "/api.mjs",
    "/server.mjs",
    "/.env",
    "/.openai/hosting.json",
  ])
    assert.equal(
      (await worker.fetch(new Request("https://site.example" + path), {}))
        .status,
      404,
    );
});
