import { initLanguage, currentLocale, localize } from "./i18n.js";
import { openHealthSetup } from "./health-shortcut.js";
import { validState, emptyState } from "./diary-data.js";
import { createDiarySync } from "./diary-sync.js";
import { openRearCamera, stopCamera, captureCameraPhoto } from "./camera.js";
import {
  icon,
  foodIcon,
  hydrateIcons,
  initTheme,
  celebrate,
  goalMilestones,
  animateDashboard,
  dateOptions,
  shiftDate,
} from "./ui.js";
import {
  scaleFood,
  summarize,
  formatMacro,
  validNutrients,
  calorieBalance,
  activityForDay,
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
state ??= emptyState();
state.custom ??= [];
let date = today(),
  view = "diary",
  category = "All",
  query = "",
  meal = "Breakfast";
const meals = ["Breakfast", "Lunch", "Merienda", "Dinner"];
const icons = ["coffee", "lunch", "snack", "dinner"];
let diarySync;
function save() {
  try {
    localStorage.setItem("nutriar-v1", JSON.stringify(state));
  } catch {
    toast("Storage is full. Export your data to keep a backup.");
  }
  diarySync?.changed();
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
const num = (n) => Math.round(n).toLocaleString(currentLocale());
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
  return `<div class="date-navigation"><button class="date-arrow" id="prev" aria-label="Previous day">‹</button><div class="date-capsules">${dateOptions(
    date,
    today(),
    currentLocale(),
  )
    .map(
      (d) =>
        `<button class="date-pill ${d.selected ? "selected" : ""}" data-day="${d.date}" aria-pressed="${d.selected}">${d.label}${d.selected ? '<span aria-hidden="true">›</span>' : ""}</button>`,
    )
    .join(
      "",
    )}</div><button class="date-arrow" id="next" aria-label="Next day">›</button></div><div class="date-caption"><span>${new Date(date + "T12:00:00Z").toLocaleDateString(currentLocale(), { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })}</span><label class="date-picker">Choose date<input id="date" type="date" value="${date}" aria-label="Choose diary date"></label></div>`;
}
function heading(title, sub, control = "") {
  return `<div class="intro"><div><h1>${title}</h1><p>${sub}</p></div>${control}</div>`;
}
function render() {
  document.body.dataset.view = view;
  document
    .querySelectorAll("nav [data-view]")
    .forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  if (view === "diary") renderDiary();
  if (view === "foods") renderFoods();
  if (view === "goals") renderGoals();
  if (view === "progress") renderProgress();
  document.querySelectorAll("nav [data-view]").forEach((b) => {
    if (b.dataset.view === view) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
}
function renderDiary() {
  const d = day(),
    t = total(),
    g = state.goals,
    balance = calorieBalance(g.kcal, t.kcal, activityForDay(d));
  $("#app").innerHTML =
    '<h1 class="sr-only">My diary</h1><div class="diary-date-tools">' +
    dateControl() +
    "</div>" +
    `
<div class="diary-composition">
<section class="energy-overview" aria-labelledby="calories-heading">
<div class="overview-heading"><div><span class="eyebrow">YOUR ENERGY, IN BALANCE</span><h2 id="calories-heading">Calories<span class="heading-dot">.</span></h2></div><button class="goal-edit" id="editgoals"><span>Daily goal</span><b>${num(g.kcal)} <small>kcal</small></b>${icon("note")}</button></div>
<div class="meter-stage">
<div class="meter-axis" aria-hidden="true"></div>
<div class="flank-stat eaten-stat"><span>Eaten</span><b data-count="kcal">${num(t.kcal)}</b><small>kcal logged</small></div>
<div class="meter-orb"><div class="orb-aura"></div><svg class="energy-dial" viewBox="0 0 250 250" role="img" aria-label="${Math.round(balance.progress * 100)} percent of daily energy budget logged"><defs><linearGradient id="neon-energy" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#36e7ec"/><stop offset=".5" stop-color="#41f6af"/><stop offset="1" stop-color="#a0ff68"/></linearGradient><filter id="ring-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter></defs><circle class="orbit-line orbit-outer" cx="125" cy="125" r="121"/><circle class="orbit-line orbit-fragment" cx="125" cy="125" r="113" stroke-dasharray="255 455"/><circle class="dial-track" cx="125" cy="125" r="96"/><circle class="energy-glow" cx="125" cy="125" r="96" stroke="url(#neon-energy)" stroke-dasharray="603.19" stroke-dashoffset="${603.19 * (1 - balance.progress)}" filter="url(#ring-glow)"/><circle class="energy-ring" cx="125" cy="125" r="96" stroke="url(#neon-energy)" stroke-dasharray="603.19" stroke-dashoffset="${603.19 * (1 - balance.progress)}"/></svg><div class="orb-center"><span class="cal-left-label">${icon("bolt")} ${balance.left < 0 ? "Above budget" : "Cal left"}</span><strong data-count="left">${num(Math.abs(balance.left))}</strong><span class="orb-unit">KILOCALORIES</span></div><span class="meter-readout">${Math.round(balance.progress * 100)}% OF DAILY BUDGET</span></div>
<button class="flank-stat burned-stat" id="burned" aria-label="Edit calories burned"><span>Burned ${icon("plus")}</span><b>${num(balance.burned)}</b><small>${d.health?.activeKcal !== undefined && d.activitySource !== "manual" ? "active kcal · Apple Health" : "kcal · manual activity"}</small></button>
</div>
<div class="macro-strip">${[
      ["c", "Carbs", "carbs"],
      ["p", "Protein", "protein"],
      ["f", "Fat", "fat"],
    ]
      .map(
        ([k, l, cls]) =>
          `<section class="macro-readout ${cls}" aria-label="${l} progress"><div class="section-head"><span>${icon({ c: "grain", p: "protein", f: "drop" }[k])} ${l}</span><span class="macro-percent">${t.missing[k] ? "Partial" : Math.round((t[k] / g[k]) * 100) + "%"}</span></div><div class="macro-line" role="progressbar" aria-label="${l}${t.missing[k] ? " (known amounts only)" : ""}" aria-valuemin="0" aria-valuemax="${g[k]}" aria-valuenow="${Math.min(g[k], t[k])}"><i style="width:${Math.min(100, (t[k] / g[k]) * 100)}%"></i></div><div class="macro-data"><b data-count="${k}">${Math.round(t[k] * 10) / 10}</b><b>${t.missing[k] ? "+" : ""}<small>g</small></b><span>/ ${g[k]} g</span></div></section>`,
      )
      .join("")}</div>
${Object.values(t.missing).some(Boolean) ? '<p class="partial-notice">Macro values are partial: some logged foods have unknown macros. All calories are included.</p>' : ""}
<div class="health-readout"><span>${icon("steps")} Steps <b>${Number.isFinite(d.health?.steps) ? num(d.health.steps) : "—"}</b></span><span>${d.health ? "Apple Health · received " + esc(new Date(d.health.syncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })) : "Connect your iPhone"}</span><button class="textbtn" id="health-connect">${d.health ? "Connection" : "Connect Apple Health"}</button></div>
<div class="energy-footnote"><span class="status-pulse"></span><span>Your rhythm. Your targets.<small>${num(balance.budget)} kcal budget${balance.burned ? " · includes logged activity" : ""}</small></span><span class="footnote-icon">${icon("goals")}</span></div>
</section>
<section class="meal-section" aria-labelledby="meals-heading"><div class="meal-title"><div><span class="eyebrow">ON YOUR PLATE</span><h2 id="meals-heading">Eaten</h2></div><button class="analyze-trigger" id="analyze-meals">${icon("spark")} Analyze ${icon("arrow")}</button></div><div class="meals">${meals
      .map((m, i) => {
        const es = d.entries.filter((e) => e.meal === m);
        return `<article class="meal meal-${i}"><div class="meal-header"><span class="meal-icon">${icon(icons[i])}</span><div><h3>${m}</h3><small>${es.length ? es.length + " food" + (es.length === 1 ? "" : "s") + " logged" : ["Start your day", "Your midday moment", "An afternoon pause", "End the day your way"][i]}</small></div><span class="count">${num(es.reduce((a, e) => a + e.kcal, 0))}<small> kcal</small></span><button class="plus" data-meal="${m}" aria-label="Add to ${m}">${icon("plus")}</button></div>${es.length ? es.map((e) => `<div class="entry"><span>${esc(e.name)}<small>${e.quantity ? e.quantity + " × " : ""}${esc(e.serving || "Estimated portion")}${[e.p, e.c, e.f].some((v) => v == null) ? " · macros incomplete" : ""}</small></span><b>${num(e.kcal)}</b><button class="remove" data-remove="${e.id}" aria-label="Remove ${esc(e.name)}">${icon("close")}</button></div>`).join("") : ""}</article>`;
      })
      .join(
        "",
      )}</div><button class="log-food-row" id="addfood">${icon("plus")} Log something delicious <span>↗</span></button><div class="scan-inline"><div class="scan-inline-symbol">${icon("camera")}</div><div><b>A photo. A starting point.</b><p>AI estimates, reviewed by you.</p></div><button class="textbtn" id="photo" aria-label="Scan meal photo">Scan ${icon("arrow")}</button></div></section>
</div>
<div class="support-strip"><section class="hydration-module" id="water-tile"><span class="support-icon">${icon("drop")}</span><div><h2>Stay in your flow.</h2><p><b>${(d.water / 1000).toFixed(2).replace(/0$/, "")} L</b> / ${g.water / 1000} L of water</p></div><div class="water-controls"><button id="waterminus" aria-label="Remove 250 milliliters">−</button><button id="water">${icon("plus")} 250 ml</button></div><div class="water-wave" style="--water-fill:${Math.min(100, (d.water / g.water) * 100)}%"><span></span></div></section><section class="notes-module"><div class="section-head"><h2>${icon("note")} Daily notes</h2><button id="notes" class="textbtn" aria-label="${d.note ? "Edit" : "Add"} daily note">${icon("plus")}</button></div><p ${d.note ? "data-no-translate" : ""}>${d.note ? esc(d.note) : "How did today feel? Every detail counts."}</p></section><button class="local-module" id="browse-foods"><span class="eyebrow">A LITTLE MORE LOCAL</span><b>From mate to milanesa.</b><span>Explore Argentine foods ${icon("arrow")}</span></button></div>`;
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
      date = shiftDate(date, n);
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
  document.querySelectorAll("[data-remove]").forEach(
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
  $("#analyze-meals").onclick = openPhoto;
  $("#burned").onclick = logActivity;
  $("#health-connect").onclick = () => openHealthSetup({ modal, toast });
  document.querySelectorAll("[data-day]").forEach(
    (b) =>
      (b.onclick = () => {
        date = b.dataset.day;
        render();
      }),
  );
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
function logActivity() {
  modal(
    "Activity calories",
    `<p class="notice">Enter your total calories burned from activity for ${esc(date)}. Use an estimate from your watch or activity log. Saving selects manual activity for this day. Apple Health active calories replace manual calories; the two are never added together.</p><form id="activityform"><label class="field">Calories burned (kcal)<input id="activity-kcal" type="number" min="0" max="10000" step="1" value="${day().burned || 0}" required></label><button class="solid full">Use manual activity</button></form>${Number.isFinite(day().health?.activeKcal) ? '<button class="textbtn" id="use-health-activity">Use Apple Health active calories</button>' : ""}`,
  );
  $("#activityform").onsubmit = (e) => {
    e.preventDefault();
    updateDay({
      ...day(),
      burned: Number($("#activity-kcal").value),
      activitySource: "manual",
    });
    $("#modal").close();
    toast("Activity updated. Your energy budget is in sync.");
  };
  if ($("#use-health-activity"))
    $("#use-health-activity").onclick = () => {
      updateDay({ ...day(), activitySource: "health" });
      $("#modal").close();
      toast("Using Apple Health active calories for this day");
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
      "Food <span>library.</span>",
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
          `<article class="card food-item"><span class="emoji">${icon(foodIcon(f))}</span><h3>${esc(f.name)}</h3><p>${esc(f.serving)}</p><p>P ${formatMacro(f.p)} &nbsp; C ${formatMacro(f.c)} &nbsp; F ${formatMacro(f.f)}</p><div class="food-bottom"><strong>${f.kcal} <small>kcal</small></strong><button class="plus" data-food="${f.id}" aria-label="Log ${esc(f.name)}">${icon("plus")}</button></div></article>`,
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
            `<div class="result"><span>${icon(foodIcon(f))}</span><span class="result-name">${esc(f.name)}<small>${esc(f.serving)} · ${f.kcal} kcal</small></span><button class="plus" data-pick="${f.id}" aria-label="Choose ${esc(f.name)}">${icon("plus")}</button></div>`,
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
  return `<label class="field">Meal<select id="meal">${meals.map((m) => `<option value="${m}" ${m === meal ? "selected" : ""}>${m}</option>`).join("")}</select></label>`;
}
function portion(f) {
  if ($("#modal").open) $("#modal").close();
  modal(
    icon(foodIcon(f)) + " <span data-no-translate>" + esc(f.name) + "</span>",
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
    animateDashboard(
      before,
      after,
      calorieBalance(state.goals.kcal, after.kcal, activityForDay(day()))
        .budget,
    );
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
      "Your <span>goals.</span>",
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
      )}</div><p id="macroenergy" class="notice">Macro targets provide approximately ${num(g.p * 4 + g.c * 4 + g.f * 9)} kcal. Calories and macros are independently editable.</p><button class="solid">Save my goals</button></form></div><div class="card settings-card" style="margin-top:20px"><h2>Keep your data</h2><p style="font-size:12px">Daily meals, water, activity, notes, weight and goals save on this device. Connect cloud saving to keep them available across devices. Check the saving status above; export a backup anytime.</p><button class="solid" id="backup">Export backup</button> <label class="textbtn" style="cursor:pointer">Import backup<input id="import" type="file" accept="application/json" hidden></label></div>`;
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
      "Your <span>progress.</span>",
      "Your habits tell a story. Give them time.",
    ) +
    `<div class="grid"><div class="card"><h2>The last 7 days</h2><p style="font-size:11px">Calories logged · daily target ${num(state.goals.kcal)} kcal</p>${dates
      .map((d) => {
        const val = total(state.days[d] || { entries: [] }).kcal;
        return `<div class="history-row"><span>${new Date(d + "T12:00:00Z").toLocaleDateString(currentLocale(), { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}</span><div class="bar" style="--color:var(--accent)"><i style="width:${Math.min(100, (val / state.goals.kcal) * 100)}%"></i></div><strong>${num(val)} kcal</strong></div>`;
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
async function prepareMealPhoto(file) {
  if (
    ![
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ].includes(file.type)
  )
    throw Error(
      "Choose a JPEG, PNG or WebP photo. Convert HEIC photos to JPEG first.",
    );
  if (file.size > 8 * 1024 * 1024)
    throw Error("Choose a photo smaller than 8 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight)
      throw Error("This image could not be opened.");
    const scale = Math.min(
      1,
      1600 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("Photo preparation is unavailable in this browser.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    let prepared = canvas.toDataURL("image/jpeg", 0.88);
    if (prepared.length > 4 * 1024 * 1024)
      prepared = canvas.toDataURL("image/jpeg", 0.7);
    if (prepared.length > 4 * 1024 * 1024)
      throw Error(
        "The prepared photo is too large. Crop it or choose a smaller photo.",
      );
    return prepared;
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function openPhoto() {
  modal(
    "Scan your meal",
    `<p style="font-size:12px">Photograph the whole plate in good light. Add portion details for a better estimate, then review before logging.</p><div class="photo-actions"><button class="solid" id="takephoto" type="button">${icon("camera")} Take photo</button><button class="upload-photo" id="uploadphoto" type="button">${icon("plus")} Upload photo</button></div><input type="file" id="photofile" accept="image/jpeg,image/png,image/webp" hidden><input type="file" id="camerafile" accept="image/*" capture="environment" hidden><section id="camera-preview" class="camera-preview" hidden><video id="camera-video" autoplay muted playsinline aria-label="Rear camera preview"></video><p id="camera-status" role="status">Opening your camera…</p><div class="camera-controls"><button class="solid" id="capturephoto" type="button">Take this photo</button><button id="closecamera" class="textbtn" type="button">Close camera</button></div></section><button id="nativecamera" type="button" class="textbtn" hidden>Use phone camera instead</button><label class="field">Meal details (optional)<textarea id="photonotes" class="search" rows="2" maxlength="500" placeholder="For example: 2 baked beef empanadas, about 100 g each"></textarea></label><p class="notice" id="photostatus" role="status">Checking photo analysis…</p><div id="photocontent"></div><p id="photoerror" role="alert" class="photo-error" hidden></p>`,
  );
  const dialog = $("#modal");
  let alive = true,
    ready = false,
    imageData = null,
    version = 0,
    controller;
  let cameraStream = null,
    cameraRun = 0;
  const closeCamera = () => {
    cameraRun++;
    stopCamera(cameraStream);
    cameraStream = null;
    const video = $("#camera-video");
    if (video) video.srcObject = null;
    const preview = $("#camera-preview");
    if (preview) preview.hidden = true;
    const button = $("#takephoto");
    if (button) {
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
  };
  dialog.addEventListener(
    "close",
    () => {
      alive = false;
      controller?.abort();
      closeCamera();
    },
    { once: true },
  );
  const error = (message) => {
    if (!alive) return;
    $("#photoerror").textContent = message;
    $("#photoerror").hidden = !message;
  };
  const refresh = () => {
    if (!alive || !imageData) return;
    $("#photocontent").innerHTML =
      `<img class="photo-preview" src="${imageData}" alt="Your meal, prepared for analysis"><button class="solid full" id="analyze" ${ready ? "" : "disabled"} style="margin-top:15px">${icon("spark")} Analyze photo</button><p class="photo-privacy">Only Analyze sends your photo and meal details to Google Gemini. This app does not save the photo.</p><button class="textbtn full" id="manualestimate">Enter an estimate manually</button><div id="review"></div>`;
    $("#manualestimate").onclick = () => {
      version++;
      controller?.abort();
      controller = null;
      const button = $("#analyze");
      button.disabled = !ready;
      button.removeAttribute("aria-busy");
      button.innerHTML = icon("spark") + " Analyze photo";
      error("");
      reviewPhoto({ name: "My meal", kcal: 0, p: 0, c: 0, f: 0 }, false);
    };
    $("#analyze").onclick = async () => {
      if (!ready || !imageData) return;
      controller?.abort();
      controller = new AbortController();
      const current = controller,
        currentVersion = version,
        b = $("#analyze");
      b.disabled = true;
      b.setAttribute("aria-busy", "true");
      b.textContent = "Analyzing your meal…";
      error("");
      $("#review").replaceChildren();
      const timer = setTimeout(() => current.abort(), 55000);
      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: imageData,
            notes: $("#photonotes").value,
          }),
          signal: current.signal,
        });
        let result;
        try {
          result = await response.json();
        } catch {
          throw Error(
            "The server did not return an estimate. Please try again.",
          );
        }
        if (!alive || currentVersion !== version || current !== controller)
          return;
        if (!response.ok) {
          const details = [
            typeof result.code === "string" ? result.code : null,
            Number.isInteger(result.providerStatus)
              ? "Gemini HTTP " + result.providerStatus
              : "App HTTP " + response.status,
            typeof result.providerCode === "string"
              ? result.providerCode
              : null,
            typeof result.stage === "string" ? "step: " + result.stage : null,
          ]
            .filter(Boolean)
            .join(" · ");
          throw Error(
            (result.error || "Photo analysis failed. Please try again.") +
              " [" +
              details +
              "]",
          );
        }
        if (!validNutrients(result) || typeof result.name !== "string")
          throw Error("The estimate was incomplete. Please try again.");
        reviewPhoto(result, true);
      } catch (err) {
        if (alive && currentVersion === version && current === controller)
          error(
            err.name === "AbortError"
              ? "Analysis was canceled or timed out. You can try again."
              : err.message,
          );
      } finally {
        clearTimeout(timer);
        if (
          alive &&
          currentVersion === version &&
          current === controller &&
          b.isConnected
        ) {
          b.disabled = !ready;
          b.removeAttribute("aria-busy");
          b.innerHTML = icon("spark") + " Analyze again";
        }
      }
    };
  };
  const handleSelectedPhoto = async (file) => {
    if (!file) return;
    controller?.abort();
    const currentVersion = ++version;
    imageData = null;
    error("");
    $("#photocontent").textContent = "Preparing your photo…";
    try {
      const image = await prepareMealPhoto(file);
      if (!alive || currentVersion !== version) return;
      imageData = image;
      refresh();
    } catch (err) {
      if (alive && currentVersion === version) {
        $("#photocontent").replaceChildren();
        error(err.message || "This photo could not be opened.");
      }
    }
  };
  $("#photofile").onchange = (event) =>
    handleSelectedPhoto(event.target.files[0]);
  $("#camerafile").onchange = (event) =>
    handleSelectedPhoto(event.target.files[0]);
  $("#uploadphoto").onclick = () => {
    closeCamera();
    $("#photofile").value = "";
    $("#photofile").click();
  };
  $("#nativecamera").onclick = () => {
    closeCamera();
    $("#camerafile").value = "";
    $("#camerafile").click();
  };
  $("#closecamera").onclick = closeCamera;
  $("#takephoto").onclick = async () => {
    error("");
    closeCamera();
    if (!navigator.mediaDevices?.getUserMedia) {
      $("#camerafile").value = "";
      $("#camerafile").click();
      return;
    }
    const run = ++cameraRun,
      button = $("#takephoto");
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    $("#camera-preview").hidden = false;
    $("#camera-status").textContent =
      "Allow camera access to photograph your meal.";
    $("#capturephoto").disabled = true;
    try {
      const stream = await openRearCamera();
      if (!alive || run !== cameraRun) {
        stopCamera(stream);
        return;
      }
      cameraStream = stream;
      const video = $("#camera-video");
      video.srcObject = stream;
      await video.play();
      if (!alive || run !== cameraRun) {
        stopCamera(stream);
        return;
      }
      $("#capturephoto").disabled = false;
      $("#camera-status").textContent =
        "Frame your whole plate, then take the photo.";
      $("#nativecamera").hidden = false;
    } catch (err) {
      if (!alive || run !== cameraRun) return;
      closeCamera();
      $("#nativecamera").hidden = false;
      error(
        err.name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access in your browser settings, or select “Use phone camera instead”."
          : "The live camera could not open. Select “Use phone camera instead” or upload a photo.",
      );
    }
  };
  $("#capturephoto").onclick = async () => {
    const button = $("#capturephoto");
    button.disabled = true;
    try {
      const file = await captureCameraPhoto($("#camera-video"));
      if (!alive) return;
      closeCamera();
      await handleSelectedPhoto(file);
    } catch (err) {
      if (alive) {
        error(err.message);
        button.disabled = false;
      }
    }
  };
  try {
    const response = await fetch("/api/config", {
      signal: AbortSignal.timeout(10000),
    });
    const config = await response.json();
    if (!alive) return;
    ready = response.ok && config.aiEnabled === true;
    if (response.status === 401) {
      $("#photostatus").innerHTML =
        'Sign in once on this device to use photo analysis. <a href="/api/auth">Sign in</a>';
      if (imageData) refresh();
      return;
    }
    $("#photostatus").textContent = ready
      ? "Gemini photo analysis is ready. Review the calories, macros and portions before logging."
      : response.status === 401
        ? "Sign in to use photo analysis."
        : "Photo analysis needs GEMINI_API_KEY configured once in the server environment. Manual entry is available.";
  } catch {
    if (alive)
      $("#photostatus").textContent =
        "Photo analysis is temporarily unavailable. You can enter your meal manually.";
  }
  if (alive && imageData) refresh();
}
function reviewPhoto(data, ai) {
  $("#review").innerHTML =
    `<p class="notice">${ai ? "AI estimate. Hidden oils and portion sizes can affect accuracy." : "Enter the nutrition for this meal."} Review before adding.</p>${ai && data.confidence ? `<div class="estimate-details"><b>Confidence: ${esc(data.confidence)}</b>${Array.isArray(data.assumptions) && data.assumptions.length ? `<ul>${data.assumptions.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : ""}</div>` : ""}<form id="reviewform"><label class="field">Meal description<input id="rname" maxlength="100" value="${esc(data.name)}" required></label>${mealSelect()}<div class="two">${[
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
document.querySelectorAll("nav [data-view]").forEach(
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
$("#dock-log").onclick = () => openFood("Breakfast");
$(".brand").onclick = (e) => {
  e.preventDefault();
  view = "diary";
  render();
  window.scrollTo(0, 0);
};
hydrateIcons();
initTheme();
initLanguage(() => render());
render();

diarySync = createDiarySync({
  getState: () => state,
  canApply: () =>
    !$("#modal").open &&
    !document.activeElement?.matches("input, textarea, select"),
  applyState: (next) => {
    if (JSON.stringify(state) === JSON.stringify(next)) return;
    state = next;
    try {
      localStorage.setItem("nutriar-v1", JSON.stringify(state));
    } catch {
      toast("Device storage is full. Export a backup.");
    }
    if (
      !$("#modal").open &&
      !document.activeElement?.matches("input, textarea, select")
    )
      render();
  },
  onStatus: (kind, message) => {
    const bar = $("#save-status");
    bar.dataset.status = kind;
    $("#save-message").textContent = message;
    $("#sync-signin").hidden = kind !== "auth";
    $("#sync-conflict").hidden = kind !== "conflict";
  },
});
$("#sync-now").onclick = () => diarySync.sync();
$("#sync-conflict").onclick = () => {
  modal(
    "Choose your diary copy",
    `<p>Both devices changed the same data. Export a backup before choosing. The other copy will be replaced.</p><button class="textbtn" id="conflict-backup">Export this device’s backup</button><div class="two"><button class="solid" id="use-cloud">Use cloud copy</button><button class="solid" id="use-local">Use this device’s copy</button></div>`,
  );
  $("#conflict-backup").onclick = exportData;
  for (const source of ["cloud", "local"])
    $("#use-" + source).onclick = () => {
      exportData();
      diarySync.resolve(source);
      $("#modal").close();
      render();
    };
};
window.addEventListener("online", () => diarySync.sync());
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) diarySync.sync();
});
setInterval(() => {
  if (!document.hidden) diarySync.sync();
}, 60000);
diarySync.sync();

$("#modal").addEventListener("close", () => diarySync.sync());

document.addEventListener("focusout", () => {
  setTimeout(() => {
    if (
      !$("#modal").open &&
      !document.activeElement?.matches("input, textarea, select")
    )
      diarySync.sync();
  }, 0);
});

$("#check-storage").onclick = async () => {
  modal(
    "Cloud connection",
    `<p id="storage-report" role="status">Checking database read and write access…</p><p class="notice">This check uses a temporary test key. Your diary entries are not changed.</p>`,
  );
  try {
    const response = await fetch("/api/storage-status", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
    });
    const data = await response.json();
    const target = $("#storage-report");
    if (!target) return;
    if (response.status === 401) {
      target.innerHTML = `<a href="/api/auth">Sign in to sync</a>`;
      return;
    }
    if (response.status === 503) {
      target.textContent =
        "Cloud database is not configured. Connect Upstash to Production and redeploy.";
      return;
    }
    if (!response.ok || !data.ok) {
      target.textContent = `Database check failed (HTTP ${response.status}). Check the Upstash connection and server credentials in Vercel.`;
      return;
    }
    target.textContent = `Database read and write: OK. Saved days: ${data.days}. Revision: ${data.revision}.`;
  } catch {
    if ($("#storage-report"))
      $("#storage-report").textContent =
        "Could not reach the database check. Retry when connected.";
  }
};
