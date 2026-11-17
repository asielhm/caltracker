import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createApi,
  validateImage,
  validAnalysis,
  compatibleGeminiModels,
} from "../api.mjs";
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
const env = { GEMINI_API_KEY: "test-key" };
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
      candidates: [
        {
          finishReason: "STOP",
          content: { parts: [{ text: JSON.stringify(value) }] },
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
test("sends image and notes to Gemini generateContent with inline image data and structured output", async () => {
  let payload;
  const api = createApi({
    fetchImpl: async (url, options) => {
      assert.equal(
        url,
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
      );
      assert.equal(options.headers["x-goog-api-key"], "test-key");
      payload = JSON.parse(options.body);
      return completion(estimate);
    },
  });
  const r = await api(req({ image, notes: "Two empanadas" }), env);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ...estimate, estimated: true });
  assert.equal("apiKey" in payload, false);
  assert.equal(payload.generationConfig.responseMimeType, "application/json");
  assert.equal(
    payload.contents[0].parts[1].inlineData.data,
    image.split(",")[1],
  );
  assert.match(payload.contents[0].parts[0].text, /Two empanadas/);
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
        steps: [
          {
            type: "model_output",
            content: [{ type: "refusal", refusal: "No" }],
          },
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
test("unavailable models are replaced only with models returned by the same key", async () => {
  const calls = [];
  const api = createApi({
    fetchImpl: async (url, options) => {
      calls.push({ url, method: options.method });
      if (options.method === "GET")
        return Response.json({
          models: [
            {
              name: "models/gemini-4-hydrogen",
              supportedGenerationMethods: ["generateContent"],
            },
          ],
        });
      return url.includes("gemini-4-hydrogen")
        ? completion(estimate)
        : Response.json({ error: { status: "NOT_FOUND" } }, { status: 404 });
    },
  });
  const environment = { ...env, GEMINI_MODEL: "gemini-unavailable" };
  assert.equal((await api(req(), environment)).status, 200);
  assert.equal(calls.length, 3);
  assert.equal(calls[1].method, "GET");
  assert.match(calls[2].url, /gemini-4-hydrogen:generateContent$/);
  assert.equal((await api(req(), environment)).status, 200);
  assert.equal(calls.length, 4);
  assert.match(calls[3].url, /gemini-4-hydrogen/);
});
test("catalog selection excludes specialized models and generation-incompatible entries", () => {
  const models = [
    {
      name: "models/gemini-4-hydrogen",
      supportedGenerationMethods: ["generateContent"],
    },
    {
      name: "models/gemini-3.8-flash-tts",
      supportedGenerationMethods: ["generateContent"],
    },
    {
      name: "models/gemini-2.5-flash",
      supportedGenerationMethods: ["countTokens"],
    },
    {
      name: "models/gemini-4-carbon",
      supportedGenerationMethods: ["generateContent"],
      supportedInputModalities: ["TEXT"],
    },
  ];
  assert.deepEqual(compatibleGeminiModels(models), ["gemini-4-hydrogen"]);
});
test("an empty model catalog returns an account-access error instead of another guessed model", async () => {
  const calls = [];
  const api = createApi({
    fetchImpl: async (url, options) => {
      calls.push(url);
      return options.method === "GET"
        ? Response.json({ models: [] })
        : Response.json({ error: { status: "NOT_FOUND" } }, { status: 404 });
    },
  });
  const response = await api(req(), env);
  assert.equal((await response.json()).code, "NO_COMPATIBLE_MODELS");
  assert.equal(calls.length, 2);
});
test("model discovery follows catalog pagination and never retries quota failures", async () => {
  let listings = 0,
    generations = 0;
  const api = createApi({
    fetchImpl: async (url, options) => {
      if (options.method === "GET") {
        listings++;
        if (listings === 1)
          return Response.json({ models: [], nextPageToken: "page two" });
        assert.match(url, /pageToken=page\+two/);
        return Response.json({
          models: [
            {
              name: "models/gemini-4-hydrogen",
              supportedGenerationMethods: ["generateContent"],
            },
          ],
        });
      }
      generations++;
      return Response.json(
        {
          error: {
            status: generations === 1 ? "NOT_FOUND" : "RESOURCE_EXHAUSTED",
          },
        },
        { status: generations === 1 ? 404 : 429 },
      );
    },
  });
  assert.equal((await api(req(), env)).status, 429);
  assert.equal(listings, 2);
  assert.equal(generations, 2);
});
test("unsupported schema options fall back to JSON prompting with server validation", async () => {
  const bodies = [];
  const api = createApi({
    fetchImpl: async (_url, options) => {
      bodies.push(JSON.parse(options.body));
      return bodies.length === 1
        ? new Response(
            JSON.stringify({
              error: {
                message: "Unknown name responseJsonSchema in generationConfig",
              },
            }),
            { status: 400 },
          )
        : completion(estimate);
    },
  });
  assert.equal((await api(req(), env)).status, 200);
  assert.equal(bodies.length, 2);
  assert.equal(bodies[1].generationConfig.responseJsonSchema, undefined);
  assert.match(bodies[1].systemInstruction.parts[0].text, /JSON object/);
});
test("invalid keys produce an actionable error with no provider message or secret", async () => {
  const api = createApi({
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          error: {
            message: "bad key test-key",
            details: [{ reason: "API_KEY_INVALID" }],
          },
        }),
        { status: 400 },
      ),
  });
  const response = await api(req(), env);
  const data = await response.json();
  assert.equal(data.code, "INVALID_API_KEY");
  assert.equal(data.providerStatus, 400);
  assert.ok(!JSON.stringify(data).includes("test-key"));
});
