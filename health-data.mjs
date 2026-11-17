import { emptyState, validState } from "./dist/diary-data.js";
export function validHealthImport(value, now = new Date()) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.date)
  )
    return false;
  const stamp = new Date(value.date + "T12:00:00Z");
  if (
    !Number.isFinite(stamp.getTime()) ||
    stamp.toISOString().slice(0, 10) !== value.date
  )
    return false;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  if (value.date > today || stamp < new Date(now.getTime() - 91 * 86400000))
    return false;
  const hasSteps = Object.hasOwn(value, "steps"),
    hasEnergy = Object.hasOwn(value, "activeKcal");
  return (
    (hasSteps || hasEnergy) &&
    (!hasSteps ||
      (Number.isSafeInteger(value.steps) &&
        value.steps >= 0 &&
        value.steps <= 200000)) &&
    (!hasEnergy ||
      (Number.isFinite(value.activeKcal) &&
        value.activeKcal >= 0 &&
        value.activeKcal <= 10000))
  );
}
export function applyHealthImport(document, value, syncedAt) {
  const state = structuredClone(document.state || emptyState());
  if (!validState(state)) throw Error("Invalid stored diary");
  const day = (state.days[value.date] ||= { entries: [], water: 0, note: "" });
  day.health = {
    ...day.health,
    source: "apple-health",
    syncedAt,
    ...(Object.hasOwn(value, "steps") ? { steps: value.steps } : {}),
    ...(Object.hasOwn(value, "activeKcal")
      ? { activeKcal: value.activeKcal }
      : {}),
  };
  return { revision: document.revision + 1, state, updatedAt: syncedAt };
}
