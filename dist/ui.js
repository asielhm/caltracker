const paths = {
  diary:
    '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 3v18M12 8h4M12 12h4"/>',
  foods: '<path d="M4 3v7a3 3 0 0 0 6 0V3M7 3v18M19 21V3c-4 2-4 9 0 10"/>',
  progress: '<path d="M4 4v16h17M7 14l5-5 4 3 5-7"/>',
  goals:
    '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="m12 12 8-8m-3 0h3v3"/>',
  moon: '<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  camera:
    '<path d="m8 5 2-2h4l2 2h4a1 1 0 0 1 1 1v13H3V6a1 1 0 0 1 1-1Z"/><circle cx="12" cy="12" r="4"/>',
  drop: '<path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z"/><path d="M8 15a4 4 0 0 0 4 4"/>',
  spark:
    '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  coffee:
    '<path d="M4 9h12v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Zm12 1h2a3 3 0 0 1 0 6h-2M7 3v2m5-2v2"/>',
  lunch: '<path d="M3 13h18M5 13a7 7 0 0 1 14 0M12 4v2M4 17h16M7 21h10"/>',
  snack:
    '<path d="M5 10a7 7 0 0 1 14 0v8H5Zm-1 8h16v3H4Z"/><path d="m10 10 4 4m-4 0 4-4"/>',
  dinner: '<path d="M18 3a9 9 0 1 0 3 15A9 9 0 0 1 18 3Z"/>',
  note: '<path d="M14 3H4v18h16V9ZM14 3v6h6M8 13h8M8 17h5"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7Z"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
};
export function icon(name, cls = "") {
  return `<svg class="svg-icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.spark}</svg>`;
}
export function hydrateIcons(root = document) {
  root
    .querySelectorAll("[data-icon]")
    .forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
}
export function goalMilestones(before, after, goals) {
  return ["p", "c", "f"].filter(
    (k) => !after.missing[k] && before[k] < goals[k] && after[k] >= goals[k],
  );
}
export function initTheme() {
  const button = document.querySelector("#theme-toggle");
  const sync = () => {
    const dark = document.documentElement.dataset.theme === "dark";
    button.innerHTML = icon(dark ? "sun" : "moon");
    button.setAttribute(
      "aria-label",
      `Switch to ${dark ? "light" : "dark"} mode`,
    );
    button.setAttribute("aria-pressed", String(dark));
    document.querySelector('meta[name="theme-color"]').content = dark
      ? "#0c0f13"
      : "#edf2f4";
  };
  sync();
  button.onclick = () => {
    const theme =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("nutriar-neon-theme", theme);
    } catch {}
    sync();
  };
}
export function celebrate() {
  const meter = document.querySelector(".meter-stage");
  if (meter && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    meter.classList.remove("goal-hit");
    requestAnimationFrame(() => meter.classList.add("goal-hit"));
    setTimeout(() => meter.classList.remove("goal-hit"), 1000);
  }
}
export function shiftDate(date, delta) {
  const value = new Date(date + "T12:00:00Z");
  value.setUTCDate(value.getUTCDate() + delta);
  return value.toISOString().slice(0, 10);
}
export function dateOptions(selected, today) {
  return [-1, 0, 1].map((offset) => {
    const date = shiftDate(selected, offset);
    const label =
      date === today
        ? "Today"
        : date === shiftDate(today, -1)
          ? "Yesterday"
          : date === shiftDate(today, 1)
            ? "Tomorrow"
            : new Date(date + "T12:00:00Z").toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              });
    return { date, label, selected: date === selected };
  });
}
export function animateDashboard(before, after, goal) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const start = performance.now(),
    duration = 650;
  const rings = document.querySelectorAll(".energy-ring, .energy-glow");
  const counters = document.querySelectorAll("[data-count]");
  function tick(now) {
    const progress = Math.min(1, (now - start) / duration),
      ease = 1 - Math.pow(1 - progress, 3);
    counters.forEach((el) => {
      const key = el.dataset.count;
      const from = key === "left" ? Math.abs(goal - before.kcal) : before[key];
      const to = key === "left" ? Math.abs(goal - after.kcal) : after[key];
      const value = from + (to - from) * ease;
      el.textContent =
        key === "left" || key === "kcal"
          ? Math.round(value).toLocaleString("en-US")
          : String(Math.round(value * 10) / 10);
    });
    rings.forEach(
      (ring) =>
        (ring.style.strokeDashoffset = String(
          603.19 *
            (1 -
              Math.min(
                1,
                (before.kcal + (after.kcal - before.kcal) * ease) / goal,
              )),
        )),
    );
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
