import { test } from "node:test";
import assert from "node:assert/strict";
import { createVercelHandler } from "../vercel-api.mjs";
const authorization =
  "Basic " + Buffer.from("nutriar:private-test-password").toString("base64");
test("Vercel API fails closed until the owner configures authentication", async () => {
  const handler = createVercelHandler({ env: { GEMINI_API_KEY: "test-key" } });
  assert.equal(
    (
      await handler(
        new Request("https://example.vercel.app/api/config"),
        "/api/config",
      )
    ).status,
    503,
  );
});
test("Vercel API requires the app password on every session and works from another device", async () => {
  const handler = createVercelHandler({
    env: { APP_PASSWORD: "private-test-password", GEMINI_API_KEY: "test-key" },
  });
  const anonymous = await handler(
    new Request("https://example.vercel.app/api/config"),
    "/api/config",
  );
  assert.equal(anonymous.status, 401);
  assert.match(anonymous.headers.get("WWW-Authenticate"), /Basic/);
  for (let device = 0; device < 2; device++) {
    const response = await handler(
      new Request("https://example.vercel.app/api/config", {
        headers: { authorization },
      }),
      "/api/config",
    );
    assert.equal(response.status, 200);
    const config = await response.json();
    assert.equal(config.aiEnabled, true);
    assert.equal(config.provider, "Gemini");
    assert.ok(!JSON.stringify(config).includes("test-key"));
  }
});
test("successful browser sign-in redirects back to the app", async () => {
  const handler = createVercelHandler({
    env: { APP_PASSWORD: "private-test-password" },
  });
  const r = await handler(
    new Request("https://example.vercel.app/api/auth", {
      headers: { authorization },
    }),
    "/api/auth",
  );
  assert.equal(r.status, 303);
  assert.equal(r.headers.get("Location"), "/");
});
