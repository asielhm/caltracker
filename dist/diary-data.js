import { validNutrients } from "./nutrition.js";
const meals = ["Breakfast", "Lunch", "Merienda", "Dinner"];
export function validState(s) {
  try {
    return (
      s &&
      typeof s === "object" &&
      !Array.isArray(s) &&
      s.goals &&
      ["kcal", "p", "c", "f", "water"].every(
        (k) => Number.isFinite(s.goals[k]) && s.goals[k] > 0,
      ) &&
      s.days &&
      typeof s.days === "object" &&
      !Array.isArray(s.days) &&
      Object.entries(s.days).every(
        ([d, v]) =>
          /^\d{4}-\d{2}-\d{2}$/.test(d) &&
          Array.isArray(v.entries) &&
          v.entries.every(
            (e) =>
              typeof e.id === "string" &&
              typeof e.name === "string" &&
              meals.includes(e.meal) &&
              validNutrients(e),
          ) &&
          (v.burned === undefined ||
            (Number.isFinite(v.burned) &&
              v.burned >= 0 &&
              v.burned <= 10000)) &&
          Number.isFinite(v.water) &&
          v.water >= 0 &&
          typeof v.note === "string",
      ) &&
      Array.isArray(s.weights) &&
      s.weights.every(
        (w) => typeof w.date === "string" && Number.isFinite(w.kg) && w.kg > 0,
      ) &&
      Array.isArray(s.custom) &&
      s.custom.every(
        (f) =>
          typeof f.name === "string" &&
          typeof f.serving === "string" &&
          f.grams > 0 &&
          ["kcal", "p", "c", "f"].every(
            (k) => Number.isFinite(f[k]) && f[k] >= 0,
          ),
      )
    );
  } catch {
    return false;
  }
}

export function emptyState() {
  return {
    goals: { kcal: 2000, p: 130, c: 230, f: 62, water: 2000 },
    days: {},
    weights: [],
    custom: [],
  };
}
// Three-way merge: disjoint dates, foods and entries sync without losing deletions.
export function mergeDiary(base, local, remote) {
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const conflicts = [];
  function merge(b, l, r, path) {
    if (equal(l, r) || equal(b, r)) return l;
    if (equal(b, l)) return r;
    const objects = [l, r].every(
      (v) => v && typeof v === "object" && !Array.isArray(v),
    );
    if (objects && (b === undefined || (b && !Array.isArray(b)))) {
      const out = {};
      for (const k of new Set([
        ...Object.keys(b || {}),
        ...Object.keys(l),
        ...Object.keys(r),
      ])) {
        if (["__proto__", "constructor", "prototype"].includes(k)) {
          conflicts.push(path);
          continue;
        }
        const v = merge(b?.[k], l[k], r[k], path + "." + k);
        if (v !== undefined) out[k] = v;
      }
      return out;
    }
    if (
      Array.isArray(l) &&
      Array.isArray(r) &&
      (b === undefined || Array.isArray(b))
    ) {
      const all = [...(b || []), ...l, ...r];
      const key = path === "diary.weights" ? "date" : "id";
      if (
        all.every((v) => v && typeof v[key] === "string") &&
        [b || [], l, r].every(
          (a) => new Set(a.map((v) => v[key])).size === a.length,
        )
      ) {
        const index = (a) => new Map((a || []).map((v) => [v[key], v]));
        const bi = index(b),
          li = index(l),
          ri = index(r),
          out = [];
        for (const id of new Set([...bi.keys(), ...li.keys(), ...ri.keys()])) {
          const v = merge(bi.get(id), li.get(id), ri.get(id), path + "." + id);
          if (v !== undefined) out.push(v);
        }
        return out;
      }
    }
    conflicts.push(path);
    return l;
  }
  return { state: merge(base, local, remote, "diary"), conflicts };
}
