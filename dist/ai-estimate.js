import { validNutrients } from "./nutrition.js";
export async function fetchMealEstimate(
  description,
  { language = "en", signal, fetchImpl = globalThis.fetch } = {},
) {
  const response = await fetchImpl("/api/estimate", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description, language }),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(55000)])
      : AbortSignal.timeout(55000),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw Error("The server did not return an estimate. Please try again.");
  }
  if (!response.ok) {
    const error = new Error(
      response.status === 401
        ? "Sign in to use meal estimates."
        : data.error ||
          "The meal could not be estimated. You can enter its nutrition manually.",
    );
    error.status = response.status;
    throw error;
  }
  if (
    !data ||
    !validNutrients(data) ||
    !["kcal", "p", "c", "f"].every(
      (k) => Number.isFinite(data[k]) && data[k] >= 0 && data[k] <= 10000,
    ) ||
    typeof data.name !== "string" ||
    !["low", "medium", "high"].includes(data.confidence) ||
    !Array.isArray(data.assumptions) ||
    !data.assumptions.every((v) => typeof v === "string")
  )
    throw Error("The estimate was incomplete. Please try again.");
  return data;
}
