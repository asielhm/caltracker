export const macroKeys = ["p", "c", "f"];
export function scaleFood(food, quantity) {
  return Object.fromEntries(
    ["kcal", ...macroKeys].map((k) => [
      k,
      food[k] == null ? null : Math.round(food[k] * quantity * 1000) / 1000,
    ]),
  );
}
export function summarize(entries) {
  const result = { kcal: 0, p: 0, c: 0, f: 0, missing: { p: 0, c: 0, f: 0 } };
  for (const entry of entries)
    for (const k of ["kcal", ...macroKeys]) {
      if (Number.isFinite(entry[k])) result[k] += entry[k];
      else if (k !== "kcal") result.missing[k]++;
    }
  return result;
}
export function formatMacro(value, quantity = 1) {
  return value == null
    ? "Unknown"
    : `${Math.round(value * quantity * 10) / 10} g`;
}
export function validNutrients(entry) {
  return (
    Number.isFinite(entry.kcal) &&
    entry.kcal >= 0 &&
    macroKeys.every(
      (k) => entry[k] === null || (Number.isFinite(entry[k]) && entry[k] >= 0),
    )
  );
}

// Activity calories are manually logged and add to the daily energy budget.
export function calorieBalance(goal, eaten, burned = 0) {
  const activity = Number.isFinite(burned) && burned >= 0 ? burned : 0;
  const budget = goal + activity;
  return {
    burned: activity,
    budget,
    left: budget - eaten,
    progress: Math.min(1, Math.max(0, eaten / budget)),
  };
}

// Health active energy is an alternative to manual activity, never an extra allowance.
export function activityForDay(day) {
  return day.activitySource !== "manual" &&
    Number.isFinite(day.health?.activeKcal)
    ? day.health.activeKcal
    : day.burned;
}
