import { test } from "node:test";
import assert from "node:assert/strict";
import { createApi } from "../api.mjs";
import { createVercelHandler } from "../vercel-api.mjs";
import { fetchMealEstimate } from "../dist/ai-estimate.js";
import { suggestedMeal } from "../dist/nutrition.js";
const estimate = {
  foodDetected: true,
  name: "Empanadas de carne",
  kcal: 500,
  p: 24,
  c: 56,
  f: 20,
  confidence: "medium",
  assumptions: ["Two baked empanadas, 100 g each."],
};
const env = { GEMINI_API_KEY: "test-key" };
const request = (body, extra = {}) =>
  new Request("https://example.test/api/estimate", {
    method: "POST",
    headers: {
      origin: "https://example.test",
      "content-type": "application/json",
      ...extra,
    },
    body: JSON.stringify(body),
  });
const completion = (value) =>
  Response.json({
    candidates: [
      {
        finishReason: "STOP",
        content: { parts: [{ text: JSON.stringify(value) }] },
      },
    ],
  });
test("text meal estimates reuse the Gemini schema without sending a fake image", async () => {
  let payload;
  const api = createApi({
    fetchImpl: async (url, options) => {
      payload = JSON.parse(options.body);
      assert.match(url, /:generateContent$/);
      return completion(estimate);
    },
  });
  const response = await api(
    request({
      description: "2 baked beef empanadas, 100 g each",
      language: "es",
    }),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).estimated, true);
  assert.equal(payload.contents[0].parts.length, 1);
  assert.equal(payload.contents[0].parts[0].inlineData, undefined);
  assert.match(payload.systemInstruction.parts[0].text, /no photograph/);
  assert.match(payload.systemInstruction.parts[0].text, /Spanish/);
});
test("text estimates validate description and never call Gemini on invalid input", async () => {
  let calls = 0;
  const api = createApi({
    fetchImpl: async () => {
      calls++;
      return completion(estimate);
    },
  });
  for (const body of [
    {},
    { description: "" },
    { description: "x".repeat(501) },
    { description: "rice", language: "xx" },
  ])
    assert.equal((await api(request(body), env)).status, 400);
  assert.equal(
    (
      await api(
        request({ description: "rice" }, { origin: "https://evil.test" }),
        env,
      )
    ).status,
    403,
  );
  assert.equal(calls, 0);
});
test("text estimates require app sign-in and hosted visitor identity", async () => {
  const handler = createVercelHandler({
    env: { APP_PASSWORD: "private", ...env },
  });
  assert.equal(
    (await handler(request({ description: "rice" }), "/api/estimate")).status,
    401,
  );
  const api = createApi({ requireIdentity: true });
  assert.equal((await api(request({ description: "rice" }), env)).status, 401);
});
test("non-food and malformed model estimates remain review-blocking failures", async () => {
  const nonFood = createApi({
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
  assert.equal(
    (await nonFood(request({ description: "a chair" }), env)).status,
    422,
  );
  const invalid = createApi({
    fetchImpl: async () => completion({ ...estimate, kcal: -1 }),
  });
  assert.equal(
    (await invalid(request({ description: "rice" }), env)).status,
    502,
  );
});
test("the client requests a suggestion only and refuses unknown nutrition as zero", async () => {
  let body;
  const result = await fetchMealEstimate("one empanada", {
    language: "es",
    fetchImpl: async (url, options) => {
      assert.equal(url, "/api/estimate");
      body = JSON.parse(options.body);
      return Response.json(estimate);
    },
  });
  assert.equal(result.kcal, 500);
  assert.equal(body.language, "es");
  assert.ok(!("image" in body));
  await assert.rejects(
    fetchMealEstimate("rice", {
      fetchImpl: async () => Response.json({ ...estimate, p: null }),
    }),
    /incomplete/,
  );
  await assert.rejects(
    fetchMealEstimate("rice", {
      fetchImpl: async () =>
        Response.json({ error: "sign in" }, { status: 401 }),
    }),
    /Sign in/,
  );
});
test("meal defaults follow Argentina time at each boundary and over midnight", () => {
  const date = (hour) =>
    new Date(`2026-11-17T${String(hour).padStart(2, "0")}:00:00-03:00`);
  for (const [hour, meal] of [
    [0, "Dinner"],
    [4, "Dinner"],
    [5, "Breakfast"],
    [10, "Breakfast"],
    [11, "Lunch"],
    [14, "Lunch"],
    [15, "Merienda"],
    [18, "Merienda"],
    [19, "Dinner"],
    [23, "Dinner"],
  ])
    assert.equal(suggestedMeal(date(hour)), meal);
});
