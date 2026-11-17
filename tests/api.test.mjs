import { test } from "node:test";
import assert from "node:assert/strict";
import { createApi, validateImage, validAnalysis } from "../api.mjs";
const image =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
const estimate = {
  foodDetected: true,
  name: "Empanadas de carne",
  kcal: 500,
  p: 24,
  c: 56,
  f: 20,
  confidence: "medium",
  assumptions: ["Two baked empanadas, about 100 g each."],
};
const env = { OPENAI_API_KEY: "test-key" };
function req(body = { image }, headers = {}) {
  return new Request("https://nutriar.example/api/analyze", {
    method: "POST",
    headers: {
      Origin: "https://nutriar.example",
      "Content-Type": "application/json",
      "oai-authenticated-user-id": "user-1",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
const completion = (value) =>
  new Response(
    JSON.stringify({
      status: "completed",
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: JSON.stringify(value) }],
        },
      ],
    }),
    { headers: { "Content-Type": "application/json" } },
  );
test("validates image format and magic bytes rather than trusting a MIME label", () => {
  assert.ok(validateImage(image));
  assert.equal(
    validateImage("data:image/png;base64," + btoa("this is not a valid photo")),
    false,
  );
  assert.equal(validateImage(image.replace("png", "jpeg")), false);
  assert.equal(validateImage("https://example.com/photo.jpg"), false);
});
test("config exposes readiness, never the API key", async () => {
  const r = await createApi()(
    new Request("https://nutriar.example/api/config"),
    env,
  );
  const body = await r.text();
  assert.match(body, /"aiEnabled":true/);
  assert.ok(!body.includes("test-key"));
  assert.equal(r.headers.get("Cache-Control"), "no-store");
});
test("hosted analysis requires identity and same-origin JSON", async () => {
  const api = createApi({ requireIdentity: true });
  assert.equal(
    (await api(req({}, { "oai-authenticated-user-id": "" }), env)).status,
    401,
  );
  assert.equal(
    (await api(req({ image }, { Origin: "https://evil.example" }), env)).status,
    403,
  );
  assert.equal(
    (await api(req({ image }, { "Content-Type": "text/plain" }), env)).status,
    415,
  );
});
test("missing configuration and oversized payloads return actionable errors", async () => {
  const api = createApi();
  assert.equal((await api(req(), {})).status, 503);
  assert.equal(
    (await api(req({ image }, { "content-length": "20000000" }), env)).status,
    413,
  );
  assert.equal(
    (await api(req({ image, notes: "x".repeat(501) }), env)).status,
    400,
  );
});
test("sends image and notes to Responses API with structured output and storage disabled", async () => {
  let payload;
  const api = createApi({
    fetchImpl: async (url, options) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      assert.equal(options.headers.Authorization, "Bearer test-key");
      payload = JSON.parse(options.body);
      return completion(estimate);
    },
  });
  const r = await api(req({ image, notes: "Two empanadas" }), env);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ...estimate, estimated: true });
  assert.equal(payload.store, false);
  assert.equal(payload.text.format.strict, true);
  assert.equal(payload.input[0].content[1].image_url, image);
  assert.match(payload.input[0].content[0].text, /Two empanadas/);
});
test("non-food photos are rejected rather than logged as zero-calorie meals", async () => {
  const api = createApi({
    fetchImpl: async () =>
      completion({
        ...estimate,
        foodDetected: false,
        kcal: 0,
        p: 0,
        c: 0,
        f: 0,
      }),
  });
  const r = await api(req(), env);
  assert.equal(r.status, 422);
  assert.equal((await r.json()).code, "NO_FOOD");
});
test("invalid numbers, unfinished outputs and refusals never reach the diary", async () => {
  assert.equal(validAnalysis({ ...estimate, p: -1 }), false);
  for (const response of [
    completion({ ...estimate, kcal: "500" }),
    new Response(JSON.stringify({ status: "incomplete" })),
    new Response(
      JSON.stringify({
        status: "completed",
        output: [
          { type: "message", content: [{ type: "refusal", refusal: "No" }] },
        ],
      }),
    ),
  ]) {
    const api = createApi({ fetchImpl: async () => response });
    assert.ok((await api(req(), env)).status >= 400);
  }
});
test("provider errors do not expose sensitive provider output", async () => {
  const api = createApi({
    fetchImpl: async () =>
      new Response("secret upstream diagnostic test-key", { status: 401 }),
  });
  const r = await api(req(), env);
  assert.equal(r.status, 502);
  assert.ok(!(await r.text()).includes("test-key"));
});
test("provider timeouts become retryable failures", async () => {
  const api = createApi({
    fetchImpl: async () => {
      throw new DOMException("Timed out", "TimeoutError");
    },
  });
  assert.equal((await api(req(), env)).status, 504);
});
test("limits per actor and expires the hourly window", async () => {
  let now = 1000,
    calls = 0;
  const api = createApi({
    now: () => now,
    fetchImpl: async () => {
      calls++;
      return completion(estimate);
    },
  });
  for (let i = 0; i < 20; i++)
    assert.equal((await api(req(), env)).status, 200);
  const limited = await api(req(), env);
  assert.equal(limited.status, 429);
  assert.equal(calls, 20);
  now += 3600001;
  assert.equal((await api(req(), env)).status, 200);
});
test("rejects concurrent analyses for the same actor", async () => {
  let finish;
  const api = createApi({
    fetchImpl: () =>
      new Promise((resolve) => (finish = () => resolve(completion(estimate)))),
  });
  const pending = api(req(), env);
  while (!finish) await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal((await api(req(), env)).status, 429);
  finish();
  assert.equal((await pending).status, 200);
});
