export const macroKeys = ['p','c','f'];
export function scaleFood(food, quantity) {
  return Object.fromEntries(['kcal', ...macroKeys].map(k => [k, food[k] == null ? null : Math.round(food[k] * quantity * 1000) / 1000]));
}
export function summarize(entries) {
  const result = {kcal: 0, p: 0, c: 0, f: 0, missing: {p: 0, c: 0, f: 0}};
  for (const entry of entries) for (const k of ['kcal', ...macroKeys]) {
    if (Number.isFinite(entry[k])) result[k] += entry[k];
    else if (k !== 'kcal') result.missing[k]++;
  }
  return result;
}
export function formatMacro(value, quantity = 1) {
  return value == null ? 'Unknown' : `${Math.round(value * quantity * 10) / 10} g`;
}
export function validNutrients(entry) {
  return Number.isFinite(entry.kcal) && entry.kcal >= 0 && macroKeys.every(k => entry[k] === null || (Number.isFinite(entry[k]) && entry[k] >= 0));
}
