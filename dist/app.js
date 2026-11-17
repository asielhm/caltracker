import {
  icon,
  hydrateIcons,
  initTheme,
  celebrate,
  goalMilestones,
  animateDashboard,
} from "./ui.js";
import {
  scaleFood,
  summarize,
  formatMacro,
  validNutrients,
} from "./nutrition.js";
import { foods } from "./foods.js";
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
let state;
try {
  state = JSON.parse(localStorage.getItem("nutriar-v1"));
} catch {}
state ??= {
  goals: { kcal: 2000, p: 130, c: 230, f: 62, water: 2000 },
  days: {},
  weights: [],
  custom: [],
};
state.custom ??= [];
let date = today(),
  view = "diary",
  category = "All",
  query = "",
  meal = "Breakfast";
const meals = ["Breakfast", "Lunch", "Merienda", "Dinner"];
const icons = ["coffee", "lunch", "snack", "dinner"];
function save() {
  try {
    localStorage.setItem("nutriar-v1", JSON.stringify(state));
  } catch {
    toast("Storage is full. Export your data to keep a backup.");
  }
}
function day() {
  return state.days[date] ?? { entries: [], water: 0, note: "" };
}
function updateDay(d) {
  state.days[date] = d;
  save();
  render();
}
function total(d = day()) {
  return summarize(d.entries);
}
const num = (n) => Math.round(n).toLocaleString("en-US");
let toastTimer;
function toast(s) {
  clearTimeout(toastTimer);
  $("#toast").innerHTML = icon("check") + `<span>${esc(s)}</span>`;
  $("#toast").classList.add("show");
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 3800);
}
function modal(title, html) {
  $("#modalbody").innerHTML =
    `<div class="modal-head"><h2 id="modal-title">${title}</h2><button class="close" aria-label="Close dialog">${icon("close")}</button></div>${html}`;
  $(".close").onclick = () => $("#modal").close();
  $("#modal").showModal();
}
function dateControl() {
  return `<div class="datebox"><button id="prev" aria-label="Previous day">‹</button><input id="date" type="date" value="${date}" aria-label="Diary date"><button id="next" aria-label="Next day">›</button></div>`;
}
function heading(title, sub, control = "") {
  return `<div class="intro"><div><h1>${title}</h1><p>${sub}</p></div>${control}</div>`;
}
function render() {
  document
    .querySelectorAll("nav button")
    .forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  if (view === "diary") renderDiary();
  if (view === "foods") renderFoods();
  if (view === "goals") renderGoals();
  if (view === "progress") renderProgress();
  document.querySelectorAll("nav button").forEach((b) => {
    if (b.dataset.view === view) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
}
function renderDiary() {
  const d = day(),
    t = total(),
    g = state.goals,
    left = g.kcal - t.kcal;
  const dateLabel = new Date(date + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  $("#app").innerHTML =
    heading(
      "Find your <em>daily rhythm.</em>",
      "A little intention. A lot of living.",
      dateControl(),
    ) +
    `
<div class="day-heading"><span>${date === today() ? "TODAY" : esc(dateLabel).toUpperCase()}</span><span class="day-line"></span><span>${d.entries.length} FOODS LOGGED</span></div>
<div class="dashboard-bento">
<section class="energy-card card" aria-label="Daily calorie overview">
<div class="section-head"><span class="eyebrow">${icon("bolt")} YOUR DAILY ENERGY</span><button class="textbtn" id="editgoals">Edit goal ${icon("arrow")}</button></div>
<div class="energy-content"><div class="energy-copy"><span class="energy-label">${left < 0 ? "Above your target" : "Room for good food"}</span><div class="energy-number"><strong data-count="left">${num(Math.abs(left))}</strong><span>kcal ${left < 0 ? "above" : "left"}</span></div><p>Good habits are built<br>one bite at a time.</p><div class="energy-stats"><div><span>Eaten</span><b><span data-count="kcal">${num(t.kcal)}</span> <small>kcal</small></b></div><div><span>Daily target</span><b>${num(g.kcal)} <small>kcal</small></b></div></div></div>
<div class="energy-orbit"><div class="orbit-track"></div><svg class="energy-dial" viewBox="0 0 220 220" role="img" aria-label="${Math.round((t.kcal / g.kcal) * 100)} percent of calorie target logged"><defs><linearGradient id="energy-gradient" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#ffba8c"/><stop offset="1" stop-color="#ff805c"/></linearGradient></defs><circle class="dial-track" cx="110" cy="110" r="96"/><circle class="energy-ring" cx="110" cy="110" r="96" stroke="url(#energy-gradient)" stroke-dasharray="603.19" stroke-dashoffset="${603.19 * (1 - Math.min(1, t.kcal / g.kcal))}"/></svg><div class="dial-core"><span class="dial-spark">✳</span><b>${Math.round((t.kcal / g.kcal) * 100)}<small>%</small></b><span>of your daily target</span></div><span class="orbit-pill">YOUR PACE. YOUR PLATE.</span></div></div>
</section>
<section class="card scan-card" aria-labelledby="scan-heading"><img src="assets/meal.jpg" alt="A colorful bowl of fresh food" class="meal-photo"><div class="scan-shade"></div><div class="scan-top"><span class="glass-badge">${icon("spark")} A LITTLE HELP FROM AI</span><span class="scan-spark">✳</span></div><div class="scan-brackets" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="scan-copy"><h2 id="scan-heading">A photo.<br><em>A starting point.</em></h2><p>Snap your plate. Review your estimate.</p><button class="scan-button" id="photo">${icon("camera")} Scan a meal ${icon("arrow")}</button><small>AI estimates · always review portions</small></div></section>
${[
  ["p", "Protein", "BUILD & REPAIR", "protein"],
  ["c", "Carbs", "YOUR EVERYDAY FUEL", "carbs"],
  ["f", "Fat", "A LITTLE LASTING ENERGY", "fat"],
]
  .map(
    ([k, l, sub, cls]) =>
      `<section class="card macro-tile ${cls}" aria-label="${l} progress"><div class="section-head"><span class="macro-name"><i></i>${l}</span><span class="macro-percent">${t.missing[k] ? "Partial" : Math.round((t[k] / g[k]) * 100) + "%"}</span></div><div class="macro-value"><b data-count="${k}">${Math.round(t[k] * 10) / 10}</b>${t.missing[k] ? '<b class="partial-plus">+</b>' : ""}<span> / ${g[k]} g</span></div><div class="macro-meter" role="progressbar" aria-label="${l}${t.missing[k] ? " (known amounts only)" : ""}" aria-valuemin="0" aria-valuemax="${g[k]}" aria-valuenow="${Math.min(g[k], t[k])}">${Array.from({ length: 24 }, (_, i) => `<i class="${(t[k] / g[k]) * 24 > i ? "filled" : ""}"></i>`).join("")}</div><small class="macro-caption">${sub}${t.missing[k] ? " · INCOMPLETE" : ""}</small></section>`,
  )
  .join("")}
<section class="card water-tile" id="water-tile"><div class="section-head"><span class="macro-name">${icon("drop")} Hydration</span><button id="waterminus" class="water-minus" aria-label="Remove 250 milliliters">−</button></div><div class="water-content"><div class="water-number">${(d.water / 1000).toFixed(2).replace(/0$/, "")}<span> / ${g.water / 1000} L</span></div><button id="water" class="water-add" aria-label="Add 250 milliliters">${icon("plus")}<span>250 ml</span></button></div><div class="water-wave" style="--water-fill:${Math.min(100, (d.water / g.water) * 100)}%"><span></span></div><small class="macro-caption">SIP BY SIP. YOU'VE GOT THIS.</small></section>
</div>
${Object.values(t.missing).some(Boolean) ? '<p class="notice partial-notice">Some logged foods have unknown macros. The macro tiles show known amounts; all calories are included.</p>' : ""}
<div class="lower-grid"><section class="meal-section"><div class="meal-title"><div><span class="eyebrow">THE GOOD STUFF</span><h2>On the <em>menu.</em></h2></div><button class="solid" id="addfood">${icon("plus")} Log food</button></div><div class="meals">${meals
      .map((m, i) => {
        const es = d.entries.filter((e) => e.meal === m);
        return `<article class="card meal meal-${i}"><div class="meal-header"><div class="meal-icon">${icon(icons[i])}</div><div><h3>${m}</h3><small>${["Start a little brighter", "Your midday moment", "An afternoon pause", "End the day your way"][i]}</small></div><span class="count">${num(es.reduce((a, e) => a + e.kcal, 0))}<small> kcal</small></span><button class="plus" data-meal="${m}" aria-label="Add to ${m}">${icon("plus")}</button></div>${es.length ? es.map((e) => `<div class="entry"><span>${esc(e.name)}<small>${e.quantity ? e.quantity + " × " : ""}${esc(e.serving || "Estimated portion")}${[e.p, e.c, e.f].some((v) => v == null) ? " · macros incomplete" : ""}</small></span><b>${num(e.kcal)}</b><button class="remove" data-remove="${e.id}" aria-label="Remove ${esc(e.name)}">${icon("close")}</button></div>`).join("") : `<div class="meal-empty"><span>Something delicious goes here.</span><span class="empty-dash" aria-hidden="true">—</span></div>`}</article>`;
      })
      .join("")}</div></section>
<div class="everyday-stack"><div class="local-card"><div class="section-head"><span class="eyebrow">A LITTLE MORE LOCAL</span><span>↗</span></div><div class="mate-visual" aria-hidden="true">🧉<span>BUEN PROVECHO</span></div><h2>Made for the way<br><em>you actually eat.</em></h2><p>Empanadas. Mate. Sunday asado.<br>Your favorites have a place here.</p><button id="browse-foods" class="textbtn">Explore Argentine foods ${icon("arrow")}</button></div><div class="card notes-card"><div class="section-head"><h2>${icon("note")} A note to yourself</h2><button class="textbtn" id="notes" aria-label="${d.note ? "Edit" : "Add"} daily note">${icon(d.note ? "note" : "plus")}</button></div><p class="note-copy">${d.note ? esc(d.note) : "How did today feel? There’s more to your day than numbers."}</p></div></div></div>`;
  $("#date").onchange = (e) => {
    if (e.target.value) {
      date = e.target.value;
      render();
    }
  };
  for (const [id, n] of [
    ["prev", -1],
    ["next", 1],
  ])
    $("#" + id).onclick = () => {
      const dt = new Date(date + "T12:00:00Z");
      dt.setUTCDate(dt.getUTCDate() + n);
      date = dt.toISOString().slice(0, 10);
      render();
    };
  $("#editgoals").onclick = () => {
    view = "goals";
    render();
  };
  $("#addfood").onclick = () => openFood("Breakfast");
  document
    .querySelectorAll("[data-meal]")
    .forEach((b) => (b.onclick = () => openFood(b.dataset.meal)));
  document
    .querySelectorAll("[data-remove]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          updateDay({
            ...day(),
            entries: day().entries.filter((e) => e.id !== b.dataset.remove),
          })),
    );
  $("#water").onclick = () => {
    const before = day().water;
    updateDay({ ...day(), water: before + 250 });
    $("#water-tile")?.classList.add("just-updated");
    if (before < state.goals.water && day().water >= state.goals.water) {
      celebrate();
      toast("Water goal reached. A little refresh, well earned.");
    } else toast("250 ml added. Sip by sip. ");
  };
  $("#waterminus").onclick = () =>
    updateDay({ ...day(), water: Math.max(0, day().water - 250) });
  $("#photo").onclick = openPhoto;
  $("#browse-foods").onclick = () => {
    view = "foods";
    category = "Argentine";
    render();
    window.scrollTo(0, 0);
  };
  $("#notes").onclick = () => {
    modal(
      "Daily notes",
      `<form id="noteform"><label class="field">How did today feel?<textarea id="note" class="search" rows="5" maxlength="2000">${esc(day().note)}</textarea></label><button class="solid full">Save note</button></form>`,
    );
    $("#noteform").onsubmit = (e) => {
      e.preventDefault();
      updateDay({ ...day(), note: $("#note").value });
      $("#modal").close();
    };
  };
}
function allFoods() {
  return [...foods, ...state.custom];
}
function matching(q, cat = "All") {
  const norm = (s) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  return allFoods().filter(
    (f) =>
      (cat === "All" || f.category === cat) && norm(f.name).includes(norm(q)),
  );
}
function renderFoods() {
  const cats = [
    "All",
    "Argentine",
    "Protein",
    "Everyday",
    "Fruit & veg",
    "Drinks",
    "From your video",
    "My foods",
  ];
  $("#app").innerHTML =
    heading(
      "Good food. <em>Real life.</em>",
      "Your everyday favorites, all in one place.",
      `<button class="solid" id="custom">${icon("plus")} Create food</button>`,
    ) +
    `<input class="search" id="librarysearch" placeholder="Search empanadas, milanesa, mate…" aria-label="Search food library" value="${esc(query)}"><div class="filters">${cats.map((c) => `<button class="chip ${category === c ? "selected" : ""}" aria-pressed="${category === c}" data-cat="${c}">${c}</button>`).join("")}</div><p class="notice">Generic foods use estimated nutrition. “From your video” preserves your saved calorie values and displayed portions; unknown macros are not zero. Check package labels when available.</p><div class="food-grid" id="foodgrid"></div>`;
  $("#librarysearch").oninput = (e) => {
    query = e.target.value;
    drawFoods();
  };
  document.querySelectorAll("[data-cat]").forEach(
    (b) =>
      (b.onclick = () => {
        category = b.dataset.cat;
        renderFoods();
      }),
  );
  $("#custom").onclick = customFood;
  drawFoods();
}
function drawFoods() {
  $("#foodgrid").innerHTML =
    matching(query, category)
      .map(
        (f) =>
          `<article class="card food-item"><span class="emoji">${f.emoji}</span><h3>${esc(f.name)}</h3><p>${esc(f.serving)}</p><p>P ${formatMacro(f.p)} &nbsp; C ${formatMacro(f.c)} &nbsp; F ${formatMacro(f.f)}</p><div class="food-bottom"><strong>${f.kcal} <small>kcal</small></strong><button class="plus" data-food="${f.id}" aria-label="Log ${esc(f.name)}">${icon("plus")}</button></div></article>`,
      )
      .join("") ||
    '<div class="empty-state">No foods found. Try a different search or create your own.</div>';
  document
    .querySelectorAll("[data-food]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          portion(allFoods().find((f) => String(f.id) === b.dataset.food))),
    );
}
function openFood(m) {
  meal = m;
  modal(
    "Log food",
    `<input id="foodsearch" class="search" placeholder="Search Argentine foods…" aria-label="Search foods"><div class="results" id="results"></div><button id="newfood" class="textbtn full">＋ Create a custom food</button>`,
  );
  const draw = () => {
    $("#results").innerHTML =
      matching($("#foodsearch").value)
        .map(
          (f) =>
            `<div class="result"><span>${f.emoji}</span><span class="result-name">${esc(f.name)}<small>${esc(f.serving)} · ${f.kcal} kcal</small></span><button class="plus" data-pick="${f.id}" aria-label="Choose ${esc(f.name)}">${icon("plus")}</button></div>`,
        )
        .join("") || "<p>No foods found.</p>";
    document
      .querySelectorAll("[data-pick]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            portion(allFoods().find((f) => String(f.id) === b.dataset.pick))),
      );
  };
  $("#foodsearch").oninput = draw;
  $("#newfood").onclick = customFood;
  draw();
}
function mealSelect() {
  return `<label class="field">Meal<select id="meal">${meals.map((m) => `<option ${m === meal ? "selected" : ""}>${m}</option>`).join("")}</select></label>`;
}
function portion(f) {
  if ($("#modal").open) $("#modal").close();
  modal(
    f.emoji + " " + esc(f.name),
    `<p>${esc(f.serving)}</p>${f.source ? `<p class="notice">From your video at ${f.sourceSeconds}s. Calories apply to this entire displayed portion. ${f.grams ? "" : "Weight is unspecified; adjust by multiples of the displayed portion."} ${[f.p, f.c, f.f].some((v) => v === null) ? "Some macros are unknown and will be excluded from macro totals." : "Macros transcribed from the detail screen."}</p>` : ""}<form id="portionform">${mealSelect()}<div class="two"><label class="field">${f.source ? "Multiples of this video portion" : "Number of servings"}<input id="quantity" type="number" min="0.01" max="100" step="0.01" value="1" required></label><label class="field">Total weight (g / ml)<input id="grams" type="number" min="1" max="100000" step="1" value="${f.grams ?? ""}" ${f.grams ? "required" : 'disabled placeholder="Unknown"'}></label></div><p class="notice" id="portiontotal"></p><button class="solid full">Add to diary</button></form>`,
  );
  const calc = () => {
    const q = Number($("#quantity").value);
    $("#portiontotal").textContent =
      `${num(f.kcal * q)} kcal · Protein ${formatMacro(f.p, q)} · Carbs ${formatMacro(f.c, q)} · Fat ${formatMacro(f.f, q)}`;
  };
  $("#quantity").oninput = () => {
    if (f.grams)
      $("#grams").value = Math.round(Number($("#quantity").value) * f.grams);
    calc();
  };
  $("#grams").oninput = () => {
    $("#quantity").value = (Number($("#grams").value) / f.grams).toFixed(2);
    calc();
  };
  calc();
  $("#portionform").onsubmit = (e) => {
    e.preventDefault();
    const q = Number($("#quantity").value);
    addEntry({ ...f, quantity: q, ...scaleFood(f, q), meal: $("#meal").value });
    $("#modal").close();
    toast("Meal added to your diary");
  };
}
function addEntry(e) {
  const before = total();
  updateDay({
    ...day(),
    entries: [...day().entries, { ...e, id: crypto.randomUUID() }],
  });
  const after = total();
  if (view === "diary") {
    animateDashboard(before, after, state.goals);
    document
      .querySelector(`[data-meal="${e.meal}"]`)
      ?.closest(".meal")
      ?.classList.add("just-updated");
  }
  const milestones = goalMilestones(before, after, state.goals);
  if (milestones.length) {
    celebrate();
    setTimeout(
      () =>
        toast(
          "Daily " +
            milestones
              .map((k) => ({ p: "protein", c: "carb", f: "fat" })[k])
              .join(" & ") +
            " target reached. Nicely done.",
        ),
      150,
    );
  }
}
function customFood() {
  if ($("#modal").open) $("#modal").close();
  modal(
    "Create a food",
    `<form id="customform"><label class="field">Food name<input id="name" maxlength="100" required></label><label class="field">Serving description<input id="serving" placeholder="1 slice · 50 g" maxlength="100" required></label><div class="two">${[
      ["grams", "Serving weight (g / ml)"],
      ["kcal", "Calories (kcal)"],
      ["p", "Protein (g)"],
      ["c", "Carbohydrate (g)"],
      ["f", "Fat (g)"],
    ]
      .map(
        ([k, l]) =>
          `<label class="field">${l}<input id="${k}" type="number" min="${k === "grams" ? 1 : 0}" max="10000" step="0.1" required></label>`,
      )
      .join("")}</div><button class="solid full">Save food</button></form>`,
  );
  $("#customform").onsubmit = (e) => {
    e.preventDefault();
    const f = {
      id: crypto.randomUUID(),
      name: $("#name").value,
      serving: $("#serving").value,
      emoji: "🍽️",
      category: "My foods",
    };
    for (const k of ["grams", "kcal", "p", "c", "f"])
      f[k] = Number($("#" + k).value);
    state.custom.push(f);
    save();
    $("#modal").close();
    render();
    portion(f);
  };
}
function renderGoals() {
  const g = state.goals;
  $("#app").innerHTML =
    heading(
      "A little <em>direction.</em>",
      "Your goals. Your rhythm. Make it work for you.",
    ) +
    `<div class="card settings-card"><h2>Daily nutrition targets</h2><p style="font-size:12px">Set your own targets, or use values recommended by your nutrition professional.</p><form id="goalsform"><div class="two">${[
      ["kcal", "Calories (kcal)", 500, 10000],
      ["p", "Protein (g)", 1, 1000],
      ["c", "Carbohydrate (g)", 1, 1500],
      ["f", "Fat (g)", 1, 1000],
      ["water", "Water (ml)", 250, 10000],
    ]
      .map(
        ([k, l, min, max]) =>
          `<label class="field">${l}<input id="g-${k}" type="number" min="${min}" max="${max}" step="1" value="${g[k]}" required></label>`,
      )
      .join(
        "",
      )}</div><p id="macroenergy" class="notice">Macro targets provide approximately ${num(g.p * 4 + g.c * 4 + g.f * 9)} kcal. Calories and macros are independently editable.</p><button class="solid">Save my goals</button></form></div><div class="card settings-card" style="margin-top:20px"><h2>Keep your data</h2><p style="font-size:12px">Your diary stays in this browser. Export a backup to move it between devices.</p><button class="solid" id="backup">Export backup</button> <label class="textbtn" style="cursor:pointer">Import backup<input id="import" type="file" accept="application/json" hidden></label></div>`;
  $("#goalsform").onsubmit = (e) => {
    e.preventDefault();
    for (const k of Object.keys(g)) g[k] = Number($("#g-" + k).value);
    save();
    toast("Your goals are saved");
    renderGoals();
  };
  $("#backup").onclick = exportData;
  $("#import").onchange = async (e) => {
    try {
      const data = JSON.parse(await e.target.files[0].text());
      if (data.schema !== 1 || !data.state || !validState(data.state))
        throw Error();
      state = data.state;
      save();
      render();
      toast("Backup imported");
    } catch {
      toast("This backup is invalid or unsupported.");
    }
  };
}
function validState(s) {
  return (
    s.goals &&
    ["kcal", "p", "c", "f", "water"].every(
      (k) => Number.isFinite(s.goals[k]) && s.goals[k] > 0,
    ) &&
    s.days &&
    typeof s.days === "object" &&
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
}
function exportData() {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify({ schema: 1, state }, null, 2)], {
      type: "application/json",
    }),
  );
  a.download = `nutriar-backup-${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function renderProgress() {
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today() + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() - 6 + i);
    return d.toISOString().slice(0, 10);
  });
  const latest = state.weights.at(-1);
  $("#app").innerHTML =
    heading(
      "Look how far <em>you’ve come.</em>",
      "Your habits tell a story. Give them time.",
    ) +
    `<div class="grid"><div class="card"><h2>The last 7 days</h2><p style="font-size:11px">Calories logged · daily target ${num(state.goals.kcal)} kcal</p>${dates
      .map((d) => {
        const val = total(state.days[d] || { entries: [] }).kcal;
        return `<div class="history-row"><span>${new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}</span><div class="bar" style="--color:var(--accent)"><i style="width:${Math.min(100, (val / state.goals.kcal) * 100)}%"></i></div><strong>${num(val)} kcal</strong></div>`;
      })
      .join(
        "",
      )}</div><div class="card"><h2>Body metrics</h2><div class="weight-number">${latest ? latest.kg + " <small>kg</small>" : "— <small>kg</small>"}</div><p style="font-size:11px">${latest ? "Last logged " + esc(latest.date) : "Add your first weight entry."}</p><button class="solid" id="weight">＋ Log weight</button>${state.weights
      .slice(-5)
      .reverse()
      .map(
        (w) =>
          `<p style="font-size:11px">${esc(w.date)} <b style="float:right">${w.kg} kg</b></p>`,
      )
      .join("")}</div></div>`;
  $("#weight").onclick = () => {
    modal(
      "Log your weight",
      `<form id="weightform"><label class="field">Date<input type="date" id="wdate" value="${date}" required></label><label class="field">Weight (kg)<input type="number" id="kg" min="20" max="500" step="0.1" required></label><button class="solid full">Save weight</button></form>`,
    );
    $("#weightform").onsubmit = (e) => {
      e.preventDefault();
      state.weights = state.weights.filter((w) => w.date !== $("#wdate").value);
      state.weights.push({
        date: $("#wdate").value,
        kg: Number($("#kg").value),
      });
      state.weights.sort((a, b) => a.date.localeCompare(b.date));
      save();
      $("#modal").close();
      renderProgress();
    };
  };
}
async function openPhoto() {
  modal(
    "Scan your meal",
    `<p style="font-size:12px">Photograph the whole plate in good light. You'll review and edit the estimate before logging.</p><label class="field">Take or upload a photo<input type="file" id="photofile" accept="image/jpeg,image/png,image/webp" capture="environment"></label><div id="photocontent"></div><p class="notice" id="photostatus">Checking AI availability…</p>`,
  );
  let ready = false;
  try {
    const r = await fetch("/api/config");
    const j = await r.json();
    ready = j.aiEnabled === true;
  } catch {}
  if (!$("#photostatus")) return;
  $("#photostatus").textContent = ready
    ? "AI is ready. Photos are sent to the configured AI provider only when you select Analyze."
    : "AI is not configured on this deployment. You can still upload a photo and enter your own estimate. See the GitHub README to enable server-side AI.";
  $("#photofile").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast("Choose an image smaller than 8 MB");
      return;
    }
    const data = await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(file);
    });
    $("#photocontent").innerHTML =
      `<img class="photo-preview" src="${data}" alt="Your meal"><button class="solid full" id="analyze" ${ready ? "" : "disabled"} style="margin-top:15px;opacity:${ready ? 1 : 0.5}">✧ Analyze photo</button><button class="textbtn full" id="manualestimate">Enter an estimate manually</button><div id="review"></div>`;
    $("#manualestimate").onclick = () =>
      reviewPhoto({ name: "My meal", kcal: 0, p: 0, c: 0, f: 0 }, false);
    $("#analyze").onclick = async () => {
      const b = $("#analyze");
      b.disabled = true;
      b.textContent = "Analyzing your meal…";
      try {
        const r = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: data }),
        });
        const j = await r.json();
        if (!r.ok) throw Error(j.error || "Analysis failed");
        reviewPhoto(j, true);
      } catch (err) {
        toast(err.message);
      } finally {
        if ($("#analyze")) {
          b.disabled = false;
          b.textContent = "✧ Analyze photo";
        }
      }
    };
  };
}
function reviewPhoto(data, ai) {
  $("#review").innerHTML =
    `<p class="notice">${ai ? "AI estimate. Hidden oils and portion sizes can affect accuracy." : "Enter the nutrition for this meal."} Review before adding.</p><form id="reviewform"><label class="field">Meal description<input id="rname" maxlength="100" value="${esc(data.name)}" required></label>${mealSelect()}<div class="two">${[
      ["kcal", "Calories"],
      ["p", "Protein (g)"],
      ["c", "Carbs (g)"],
      ["f", "Fat (g)"],
    ]
      .map(
        ([k, l]) =>
          `<label class="field">${l}<input id="r${k}" type="number" min="0" max="10000" step="0.1" value="${data[k]}" required></label>`,
      )
      .join(
        "",
      )}</div><button class="solid full">Confirm & log meal</button></form>`;
  $("#reviewform").onsubmit = (e) => {
    e.preventDefault();
    const entry = {
      name: $("#rname").value,
      meal: $("#meal").value,
      serving: ai ? "AI estimate, reviewed" : "Manual estimate",
    };
    for (const k of ["kcal", "p", "c", "f"])
      entry[k] = Number($("#r" + k).value);
    addEntry(entry);
    $("#modal").close();
    toast("Meal added to diary");
  };
}
document.querySelectorAll("nav button").forEach(
  (b) =>
    (b.onclick = () => {
      view = b.dataset.view;
      render();
      window.scrollTo(0, 0);
    }),
);
$("#export").onclick = exportData;
$("#modal").addEventListener("click", (e) => {
  if (e.target === $("#modal")) $("#modal").close();
});
hydrateIcons();
initTheme();
render();
