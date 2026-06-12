// All paths are RELATIVE (no leading slash) so the app works behind the
// Home Assistant Ingress path prefix.
const api = async (path, opts = {}) => {
  const res = await fetch("api/" + path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || res.statusText);
  return res.status === 204 ? null : res.json();
};

let RECIPES = [];
let AISLES = ["Sonstiges"];
let MEALS = [];
let DAYS = [];
let FOOD_GROUPS = [];
let ALLERGENS = [];
let SEVERITIES = [];
let REOFFER_DAYS = 3;
let FOODS = [];
let LANG = "de";            // single display language (Mehrsprachigkeit später, Phase B)
let editingId = null;
let editingFood = null;     // food being edited in the food modal

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("show"), 1800);
}

// ---------------- i18n helpers ----------------
// Names are bilingual: `name` is canonical (IT), `name_de` is the optional
// German variant. We fall back to the canonical name when a translation is
// missing, so user-created (single-language) recipes always render.
function tName(obj) {
  if (!obj) return "";
  return LANG === "de" && obj.name_de ? obj.name_de : obj.name;
}
function tNotes(obj) {
  if (!obj) return "";
  return LANG === "de" && obj.notes_de ? obj.notes_de : (obj.notes || "");
}
function tInstr(obj) {
  if (!obj) return "";
  return LANG === "de" && obj.instructions_de ? obj.instructions_de : (obj.instructions || "");
}
function dayLabel(d, short) {
  if (short) return LANG === "de" ? d.short_de : d.short_it;
  return LANG === "de" ? d.de : d.it;
}
function mealLabel(m) { return LANG === "de" ? m.de : m.it; }
function fgLabel(g) { return LANG === "de" ? g.de : g.it; }
function fg(key) { return FOOD_GROUPS.find((g) => g.key === key); }

// ---------------- Tabs ----------------
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => switchView(tab.dataset.view));
});
function switchView(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === name));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + name));
  if (name === "plan") renderDay();
  if (name === "shopping") renderShopping();
  if (name === "allergens") loadFoods();
}

// NOTE: Die App ist vorerst einsprachig (Deutsch). Der Sprach-Umschalter und die
// IT/DE-Doppelfelder wurden entfernt; LANG steht fest auf "de", sodass tName/tNotes/tInstr
// die deutsche Übersetzung (sonst den kanonischen Namen) zeigen. Die zweisprachigen
// DB-Spalten (name_de …) und Atlas-Übersetzungen bleiben für die spätere echte
// Mehrsprachigkeit (Phase B) erhalten – beim Speichern werden die *_de-Felder nur geleert.

// ---------------- Recipes ----------------
async function loadRecipes() {
  RECIPES = await api("recipes");
  renderRecipes();
  fillIngredientDatalist();
}

function fillIngredientDatalist() {
  const dl = $("#ingredient-names");
  if (!dl) return;
  const names = new Set();
  RECIPES.forEach((r) => r.ingredients.forEach((i) => { if (i.name) names.add(i.name); }));
  dl.innerHTML = "";
  [...names].sort().forEach((n) => { const o = el("option"); o.value = n; dl.appendChild(o); });
}

// Fixed display order of recipe categories; "" (none) renders last as "Sonstige".
const CATEGORY_ORDER = ["Frühstück", "Mittag", "Abend", "Snack", ""];

function categoryGroups(recipes) {
  // -> [ [label, sortedRecipes], ... ] in CATEGORY_ORDER, skipping empty groups.
  const byCat = new Map(CATEGORY_ORDER.map((c) => [c, []]));
  recipes.forEach((r) => {
    const cat = byCat.has(r.category) ? r.category : "";
    byCat.get(cat).push(r);
  });
  const out = [];
  byCat.forEach((items, cat) => {
    if (!items.length) return;
    items.sort((a, b) => tName(a).localeCompare(tName(b), "de"));
    out.push([cat || "Sonstige", items]);
  });
  return out;
}

function renderRecipes() {
  const wrap = $("#recipe-list");
  wrap.innerHTML = "";
  if (!RECIPES.length) {
    wrap.appendChild(el("div", "empty", "Noch keine Rezepte. Tippe auf „+ Neu“."));
    return;
  }
  categoryGroups(RECIPES).forEach(([label, items]) => {
    wrap.appendChild(el("div", "recipe-group-title", esc(label)));
    const grid = el("div", "card-grid");
    items.forEach((r) => {
      const card = el("div", "recipe-card");
      const g = fg(r.food_group);
      const badge = g ? `<span class="badge fg" style="--fg:${g.color}">${esc(fgLabel(g))}</span> ` : "";
      card.innerHTML = `${badge ? `<div class="badges">${badge}</div>` : ""}<h3>${esc(tName(r))}</h3>
        <div class="meta">${r.ingredients.length} Zutaten · ${fmt(r.servings)} Portion(en)</div>`;
      card.addEventListener("click", () => openRecipeView(r));
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
  });
}

// Which recipe category belongs to which meal slot (used to sort the picker).
const MEAL_TO_CATEGORY = { colazione: "Frühstück", pranzo: "Mittag", merenda: "Snack", cena: "Abend" };

function renderCellList() {
  const wrap = $("#cell-recipe-list");
  if (!wrap || !slotCtx) return;
  wrap.innerHTML = "";
  const q = ($("#cell-search").value || "").trim().toLowerCase();
  const filtered = q ? RECIPES.filter((r) => tName(r).toLowerCase().includes(q)) : RECIPES;
  if (!filtered.length) {
    wrap.appendChild(el("div", "empty small", "Kein Rezept gefunden"));
    return;
  }
  // Matching category first, rest in CATEGORY_ORDER.
  const preferred = MEAL_TO_CATEGORY[slotCtx.meal] || "";
  const groups = categoryGroups(filtered).sort((a, b) =>
    (a[0] === preferred ? -1 : 0) - (b[0] === preferred ? -1 : 0));
  const selectedId = slotCtx.entry && !slotCtx.entry.manual ? slotCtx.entry.recipe_id : null;
  groups.forEach(([label, items]) => {
    wrap.appendChild(el("div", "cell-group-title", esc(label)));
    items.forEach((r) => {
      const row = el("button", "cell-row" + (r.id === selectedId ? " selected" : ""));
      const g = fg(r.food_group);
      row.innerHTML = `${g ? `<span class="fg-dot" style="--fg:${g.color}"></span>` : ""}<span>${esc(tName(r))}</span>`;
      // One tap = pick & save with the current portions value.
      row.addEventListener("click", () => setSlot({
        day: slotCtx.day, meal: slotCtx.meal,
        portions: parseFloat($("#cell-portions").value) || 1,
        recipe_id: r.id,
      }));
      wrap.appendChild(row);
    });
  });
}

function fillFoodGroupSelect() {
  const sel = $("#r-food-group");
  sel.innerHTML = "";
  const auto = el("option"); auto.value = "__auto__"; auto.textContent = "Automatisch"; sel.appendChild(auto);
  const none = el("option"); none.value = ""; none.textContent = "—"; sel.appendChild(none);
  FOOD_GROUPS.forEach((g) => {
    const o = el("option"); o.value = g.key; o.textContent = g.de; sel.appendChild(o);
  });
  fillCellFoodGroupSelect();
}

// Häufigkeits-Tag-Auswahl für Freitext-Plan-Einträge (kein "Automatisch").
function fillCellFoodGroupSelect() {
  const sel = $("#cell-food-group");
  if (!sel) return;
  sel.innerHTML = "";
  const none = el("option"); none.value = ""; none.textContent = "—"; sel.appendChild(none);
  FOOD_GROUPS.forEach((g) => {
    const o = el("option"); o.value = g.key; o.textContent = g.de; o.style.color = g.color; sel.appendChild(o);
  });
  updateCellFoodGroupDot();
}

// Färbt den Punkt vor dem Häufigkeits-Tag-Dropdown passend zur gewählten Gruppe.
function updateCellFoodGroupDot() {
  const sel = $("#cell-food-group");
  const dot = $("#cell-food-group-dot");
  if (!sel || !dot) return;
  const g = fg(sel.value);
  dot.style.setProperty("--fg", g ? g.color : "var(--line)");
}

// Shows what "Automatisch" currently resolves to (e.g. "→ Gemüse") next to the select.
function updateFoodGroupHint(recipe) {
  const hint = $("#r-food-group-hint");
  if ($("#r-food-group").value !== "__auto__") { hint.textContent = ""; return; }
  const g = recipe ? fg(recipe.food_group) : null;
  hint.textContent = recipe ? (g ? `→ ${fgLabel(g)}` : "→ –") : "";
}

// ---------------- Recipe modal ----------------
function openModal(recipe) {
  editingId = recipe ? recipe.id : null;
  $("#modal-title").textContent = recipe ? "Rezept bearbeiten" : "Neues Rezept";
  $("#r-name").value = recipe ? tName(recipe) : "";
  $("#r-category").value = recipe ? recipe.category : "Mittag";
  $("#r-food-group").value = (recipe && !recipe.food_group_auto) ? (recipe.food_group || "") : "__auto__";
  updateFoodGroupHint(recipe);
  $("#r-servings").value = recipe ? recipe.servings : 1;
  $("#r-notes").value = recipe ? tNotes(recipe) : "";
  $("#r-instructions").value = recipe ? tInstr(recipe) : "";
  $("#btn-delete-recipe").style.display = recipe ? "" : "none";
  $("#ing-rows").innerHTML = "";
  const ings = recipe && recipe.ingredients.length ? recipe.ingredients : [{ name: "", amount: "", unit: "", aisle: "Obst & Gemüse" }];
  ings.forEach(addIngRow);
  $("#modal").classList.add("open");
}
function closeModal() { $("#modal").classList.remove("open"); }

function addIngRow(ing = {}) {
  const wrap = el("div", "ing-row-wrap");
  const top = el("div", "ing-row-top");
  const name = el("input"); name.placeholder = "Zutat"; name.value = ing.name_de || ing.name || ""; name.dataset.k = "name";
  const amount = el("input"); amount.type = "number"; amount.step = "any"; amount.placeholder = "Menge";
  amount.value = ing.amount ?? ""; amount.dataset.k = "amount";
  const unit = el("input"); unit.placeholder = "Einheit"; unit.value = ing.unit || ""; unit.dataset.k = "unit";
  const del = el("button", "icon-btn", "✕");
  del.addEventListener("click", () => wrap.remove());
  top.append(name, amount, unit, del);
  const aisle = el("select", "aisle-select"); aisle.dataset.k = "aisle";
  AISLES.forEach((a) => { const o = el("option"); o.textContent = a; aisle.appendChild(o); });
  aisle.value = ing.aisle || "Sonstiges";
  wrap.append(top, aisle);
  $("#ing-rows").appendChild(wrap);
}

function collectIngredients() {
  return [...$("#ing-rows").children].map((w) => {
    const get = (k) => w.querySelector(`[data-k="${k}"]`).value;
    const amt = get("amount");
    return {
      name: get("name"), name_de: "",
      amount: amt === "" ? null : parseFloat(amt), unit: get("unit"), aisle: get("aisle"),
    };
  }).filter((i) => i.name.trim());
}

async function saveRecipe() {
  // Single-language (Deutsch): das eine Feld füllt den kanonischen Wert; die *_de-Felder
  // werden geleert (Phase-B-Daten unangetastet, bis ein Eintrag bewusst bearbeitet wird).
  const body = {
    name: $("#r-name").value.trim(),
    name_de: "",
    category: $("#r-category").value,
    food_group: $("#r-food-group").value === "__auto__" ? "" : $("#r-food-group").value,
    food_group_auto: $("#r-food-group").value === "__auto__",
    servings: parseFloat($("#r-servings").value) || 1,
    notes: $("#r-notes").value.trim(),
    notes_de: "",
    instructions: $("#r-instructions").value.trim(),
    instructions_de: "",
    ingredients: collectIngredients(),
  };
  if (!body.name) { toast("Name fehlt"); return; }
  try {
    let saved;
    if (editingId) saved = await api("recipes/" + editingId, { method: "PUT", body: JSON.stringify(body) });
    else saved = await api("recipes", { method: "POST", body: JSON.stringify(body) });
    closeModal();
    await loadRecipes();
    // If the detail view is open, refresh it with the updated recipe.
    if (saved && $("#recipe-view").classList.contains("open")) {
      const fresh = RECIPES.find((r) => r.id === saved.id);
      if (fresh) openRecipeView(fresh);
    }
    toast("Gespeichert ✓");
  } catch (e) { toast("Fehler: " + e.message); }
}

async function deleteRecipe() {
  if (!editingId) return;
  if (!confirm("Rezept wirklich löschen?")) return;
  await api("recipes/" + editingId, { method: "DELETE" });
  closeModal();
  closeRecipeView();
  await loadRecipes();
  toast("Gelöscht");
}

$("#btn-new-recipe").addEventListener("click", () => openModal(null));
$("#btn-add-ing").addEventListener("click", () => addIngRow());
$("#r-food-group").addEventListener("change", () => updateFoodGroupHint(editingId ? RECIPES.find((r) => r.id === editingId) : null));
$("#btn-save-recipe").addEventListener("click", saveRecipe);
$("#btn-delete-recipe").addEventListener("click", deleteRecipe);
$("#modal-close").addEventListener("click", closeModal);
$("#btn-cancel").addEventListener("click", closeModal);
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });

// ---------------- Recipe detail view ----------------
let currentViewRecipe = null;
function openRecipeView(recipe) {
  currentViewRecipe = recipe;
  const g = fg(recipe.food_group);
  const badges = [];
  if (g) badges.push(`<span class="badge fg" style="--fg:${g.color}">${esc(fgLabel(g))}</span>`);
  if (recipe.category) badges.push(`<span class="badge">${esc(recipe.category)}</span>`);
  $("#rv-badges").innerHTML = badges.join("");
  $("#rv-title").textContent = tName(recipe);
  $("#rv-meta").textContent = `${fmt(recipe.servings)} Portion(en)`;

  const ul = $("#rv-ingredients");
  ul.innerHTML = "";
  if (!recipe.ingredients.length) {
    ul.innerHTML = `<li class="rv-empty">Keine Zutaten hinterlegt</li>`;
  } else {
    recipe.ingredients.forEach((i) => {
      const qty = (i.amount != null) ? `${fmt(i.amount)} ${i.unit || ""}`.trim() : (i.unit || "");
      const li = el("li");
      li.innerHTML = `<span class="rv-ing-name">${esc(tName(i))}</span><span class="rv-ing-qty">${esc(qty)}</span>`;
      ul.appendChild(li);
    });
  }

  const instr = tInstr(recipe);
  $("#rv-instructions").textContent = instr;
  $("#rv-instructions-wrap").style.display = instr ? "" : "none";

  const notes = tNotes(recipe);
  $("#rv-notes").textContent = notes;
  $("#rv-notes-wrap").style.display = notes ? "" : "none";

  const view = $("#recipe-view");
  view.classList.add("open");
  view.scrollTop = 0;
}
function closeRecipeView() { $("#recipe-view").classList.remove("open"); currentViewRecipe = null; }
$("#rv-back").addEventListener("click", closeRecipeView);
$("#rv-edit").addEventListener("click", () => { if (currentViewRecipe) openModal(currentViewRecipe); });

// ---------------- Plan (single-day view) ----------------
let PLAN = [];
let DAY_NOTES = {};
let currentDay = (new Date().getDay() + 6) % 7;  // 0=Mon .. 6=Sun, default today
let slotCtx = null;                              // {day, meal, entry} while editor open

async function renderDay() {
  [PLAN, DAY_NOTES] = await Promise.all([api("plan"), api("day-notes")]);
  currentDay = Math.max(0, Math.min(DAYS.length - 1, currentDay));
  renderFreqBar();
  renderDayHeader();

  const wrap = $("#day-slots");
  wrap.innerHTML = "";
  const dayKey = DAYS[currentDay].key;

  MEALS.forEach((m) => {
    const entry = PLAN.find((p) => p.day === dayKey && p.meal === m.key) || null;
    const row = el("div", "meal-slot");
    row.appendChild(el("div", "slot-label", esc(mealLabel(m))));
    const dish = el("button", "slot-dish" + (entry ? "" : " empty"));
    if (entry) {
      const g = fg(entry.food_group);
      if (g) dish.style.setProperty("--fg", g.color);
      const nm = entry.manual ? (entry.name || "—") : tName(entry);
      const port = (entry.portions && entry.portions !== 1) ? ` ·${fmt(entry.portions)}` : "";
      const icon = g ? '<span class="fg-dot"></span>' : (entry.manual ? '<span class="hand">✎</span>' : "");
      dish.innerHTML = `${icon}<span class="slot-name">${esc(nm)}${port}</span>`;
    } else {
      dish.innerHTML = `<span class="slot-add">+ hinzufügen</span>`;
    }
    dish.addEventListener("click", () => openSlot(dayKey, m, entry));
    row.appendChild(dish);
    wrap.appendChild(row);
  });

  // "Daran denken" note for the current day.
  const noteRow = el("div", "meal-slot note");
  noteRow.appendChild(el("div", "slot-label", LANG === "de" ? "Daran denken" : "Ricorda di…"));
  const inp = el("input", "note-input");
  inp.value = DAY_NOTES[dayKey] || "";
  inp.placeholder = "…";
  inp.addEventListener("change", async () => {
    await api("day-notes", { method: "POST", body: JSON.stringify({ day: dayKey, text: inp.value }) });
    DAY_NOTES[dayKey] = inp.value.trim();
  });
  noteRow.appendChild(inp);
  wrap.appendChild(noteRow);
}

function renderDayHeader() {
  const lbl = $("#day-current");
  if (lbl && DAYS[currentDay]) lbl.textContent = dayLabel(DAYS[currentDay], false);
  $("#day-prev").disabled = currentDay <= 0;
  $("#day-next").disabled = currentDay >= DAYS.length - 1;
}

function goDay(delta) {
  currentDay = Math.max(0, Math.min(DAYS.length - 1, currentDay + delta));
  renderDay();
}
$("#day-prev").addEventListener("click", () => goDay(-1));
$("#day-next").addEventListener("click", () => goDay(1));

// Swipe left/right on the slot area to change day.
{
  const area = $("#day-slots");
  let x0 = null;
  area.addEventListener("touchstart", (e) => { x0 = e.changedTouches[0].clientX; }, { passive: true });
  area.addEventListener("touchend", (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) goDay(dx < 0 ? 1 : -1);
  }, { passive: true });
}

function renderFreqBar() {
  const bar = $("#freq-bar");
  bar.innerHTML = "";
  const counts = {};
  PLAN.forEach((p) => { if (p.food_group) counts[p.food_group] = (counts[p.food_group] || 0) + 1; });
  FOOD_GROUPS.forEach((g) => {
    const c = counts[g.key] || 0;
    const item = el("div", "freq-item");
    item.style.setProperty("--fg", g.color);
    let state = "ok";
    if (c > g.max) state = "over";
    else if (c < g.min) state = "under";
    item.classList.add(state);
    const target = g.min && g.min !== g.max ? `${g.min}–${g.max}` : `${g.max}`;
    item.innerHTML = `<span class="freq-dot"></span>
      <span class="freq-label">${esc(fgLabel(g))}</span>
      <span class="freq-count">${c}/${target}</span>`;
    bar.appendChild(item);
  });
}

// ---- Slot editor (recipe / free text / delete) ----
function openSlot(dayKey, mealObj, entry) {
  slotCtx = { day: dayKey, meal: mealObj.key, entry };
  $("#cell-search").value = "";
  $("#cell-label").value = (entry && entry.manual) ? (entry.name || "") : "";
  $("#cell-food-group").value = (entry && entry.manual) ? (entry.food_group || "") : "";
  updateCellFoodGroupDot();
  $("#cell-portions").value = (entry && entry.portions) ? entry.portions : 1;
  renderCellList();
  $("#cell-picker-title").textContent = `${mealLabel(mealObj)} · ${dayLabel(DAYS[currentDay], false)}`;
  $("#cell-picker-delete").style.display = entry ? "" : "none";
  $("#cell-picker").classList.add("open");
}
function closeSlot() { $("#cell-picker").classList.remove("open"); slotCtx = null; }

async function setSlot(body) {
  await api("plan/set", { method: "POST", body: JSON.stringify(body) });
  closeSlot();
  renderDay();
}

$("#cell-search").addEventListener("input", renderCellList);
$("#cell-food-group").addEventListener("change", updateCellFoodGroupDot);
$("#cell-picker-close").addEventListener("click", closeSlot);
$("#cell-picker-cancel").addEventListener("click", closeSlot);
$("#cell-picker").addEventListener("click", (e) => { if (e.target.id === "cell-picker") closeSlot(); });
// "Speichern" persists the free-text entry; recipes save directly on tap in the list.
$("#cell-picker-add").addEventListener("click", async () => {
  if (!slotCtx) return;
  const label = $("#cell-label").value.trim();
  const portions = parseFloat($("#cell-portions").value) || 1;
  const food_group = $("#cell-food-group").value;
  if (!label) { toast("Rezept antippen oder per Hand eintragen"); return; }
  await setSlot({ day: slotCtx.day, meal: slotCtx.meal, portions, label, food_group });
});
$("#cell-picker-delete").addEventListener("click", async () => {
  if (!slotCtx) return;
  await setSlot({ day: slotCtx.day, meal: slotCtx.meal });  // empty payload clears the slot
});

// ---------------- Plan actions ----------------
$("#btn-clear-plan").addEventListener("click", async () => {
  if (!confirm("Ganzen Plan leeren?")) return;
  await api("plan/clear", { method: "POST" });
  renderDay();
});
$("#btn-load-week").addEventListener("click", async () => {
  const week = parseInt($("#atlas-week").value) || 1;
  if (!confirm(`Atlas-Woche ${week} laden? Der aktuelle Plan wird ersetzt.`)) return;
  try {
    const res = await api("load-example-week", { method: "POST", body: JSON.stringify({ week, clear: true }) });
    await loadRecipes();        // atlas import may have added recipes
    renderDay();
    toast(`Atlas-Woche ${week} geladen (${res.added} Einträge) ✓`);
  } catch (e) { toast("Fehler: " + e.message); }
});
$("#btn-make-list").addEventListener("click", () => switchView("shopping"));

// ---------------- Shopping list ----------------
let LAST_LIST = { groups: [] };
async function renderShopping() {
  LAST_LIST = await api("shopping-list");
  const wrap = $("#shopping-list");
  wrap.innerHTML = "";
  if (!LAST_LIST.groups.length) {
    wrap.appendChild(el("div", "empty", "Liste ist leer. Plane Mahlzeiten oder füge eigene Einträge hinzu."));
    return;
  }
  LAST_LIST.groups.forEach((g) => {
    const group = el("div", "aisle-group");
    group.appendChild(el("div", "aisle-title", esc(g.aisle)));
    g.items.forEach((it) => {
      const row = el("div", "shop-item" + (it.checked ? " checked" : ""));
      const qty = it.amount_display ? `${it.amount_display} ${esc(it.unit)}` : "";
      row.innerHTML = `<div class="check">${it.checked ? "✓" : ""}</div>
        <div class="label">${esc(tName(it))}${it.manual ? ' <span class="manual-tag">●</span>' : ""}</div>
        <div class="qty">${qty}</div>`;
      row.addEventListener("click", async () => {
        const newChecked = !it.checked;
        await api("shopping-list/toggle", { method: "POST", body: JSON.stringify({ key: it.key, checked: newChecked }) });
        renderShopping();
      });
      if (it.manual) {
        const del = el("button", "icon-btn", "✕");
        del.addEventListener("click", async (e) => {
          e.stopPropagation();
          await api("manual-items/" + it.manual_id, { method: "DELETE" });
          renderShopping();
        });
        row.appendChild(del);
      }
      group.appendChild(row);
    });
    wrap.appendChild(group);
  });
}

$("#btn-add-item").addEventListener("click", async () => {
  const name = $("#item-name").value.trim();
  if (!name) { toast("Name fehlt"); return; }
  const amt = $("#item-amount").value;
  await api("manual-items", { method: "POST", body: JSON.stringify({
    name, amount: amt === "" ? null : parseFloat(amt),
    unit: $("#item-unit").value.trim(), aisle: $("#item-aisle").value,
  })});
  $("#item-name").value = ""; $("#item-amount").value = ""; $("#item-unit").value = "";
  renderShopping();
});

$("#btn-clear-checks").addEventListener("click", async () => {
  await api("shopping-list/clear-checks", { method: "POST" }); renderShopping();
});

$("#btn-copy").addEventListener("click", async () => {
  const lines = [];
  LAST_LIST.groups.forEach((g) => g.items.forEach((it) => {
    if (it.checked) return;
    const qty = it.amount_display ? ` ${it.amount_display} ${it.unit}`.trimEnd() : "";
    lines.push(`${tName(it)}${qty}`);
  }));
  if (!lines.length) { toast("Nichts zu kopieren"); return; }
  const text = lines.join("\n");
  try {
    await navigator.clipboard.writeText(text);
    toast(`${lines.length} Einträge kopiert ✓`);
  } catch {
    // Fallback for non-secure contexts
    const ta = el("textarea"); ta.value = text; document.body.appendChild(ta);
    ta.select(); document.execCommand("copy"); ta.remove();
    toast(`${lines.length} Einträge kopiert ✓`);
  }
});

// ---------------- Allergen / food tracker ----------------
function sev(key) { return SEVERITIES.find((s) => s.key === key); }
function sevLabel(key) { const s = sev(key); return s ? (LANG === "de" ? s.de : s.it) : ""; }
function allergenLabel(a) { return LANG === "de" ? a.de : a.it; }
function statusLabel(st) {
  if (st === "like") return LANG === "de" ? "mag 😋" : "gli piace 😋";
  if (st === "dislike") return LANG === "de" ? "mag nicht 😖" : "non gli piace 😖";
  return "";
}
function fmtDate(iso) {
  if (!iso) return "";
  const p = iso.split("-");
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : iso;
}

function fillSeveritySelect() {
  const sel = $("#re-severity");
  if (!sel) return;
  sel.innerHTML = "";
  SEVERITIES.forEach((s) => { const o = el("option"); o.value = s.key; o.textContent = LANG === "de" ? s.de : s.it; sel.appendChild(o); });
}

async function loadFoods() {
  FOODS = await api("foods");
  renderAllergens();
}

function renderAllergens() {
  fillSeveritySelect();
  renderReofferList();
  renderQuickpick();
  renderFoodList();
}

function renderReofferList() {
  const wrap = $("#reoffer-list");
  wrap.innerHTML = "";
  const due = FOODS.filter((f) => f.due);
  if (!due.length) return;
  const box = el("div", "reoffer-box");
  box.appendChild(el("div", "reoffer-title", `🔔 ${LANG === "de" ? "Erneut anbieten" : "Da riproporre"}`));
  const chips = el("div", "reoffer-chips");
  due.forEach((f) => {
    const chip = el("button", "reoffer-chip" + (f.allergen ? " allergen" : ""));
    chip.innerHTML = `${esc(tName(f))} <span class="ago">${fmtDate(f.last_date)}</span>`;
    chip.addEventListener("click", () => openFoodModal(f));
    chips.appendChild(chip);
  });
  box.appendChild(chips);
  wrap.appendChild(box);
}

function renderQuickpick() {
  const wrap = $("#allergen-quickpick");
  wrap.innerHTML = "";
  // Match by the displayed (German) name to mark allergens as done.
  const tracked = new Set(FOODS.map((f) => tName(f).toLowerCase()));
  ALLERGENS.forEach((a) => {
    const label = allergenLabel(a);
    const done = tracked.has(label.toLowerCase());
    const chip = el("button", "qp-chip" + (done ? " done" : ""));
    chip.textContent = label + (done ? " ✓" : "");
    chip.addEventListener("click", () => {
      if (done) {
        const f = FOODS.find((x) => tName(x).toLowerCase() === label.toLowerCase());
        if (f) openFoodModal(f);
      } else {
        openFoodModal(null, { name: label, allergen: true });
      }
    });
    wrap.appendChild(chip);
  });
}

function renderFoodList() {
  const wrap = $("#food-list");
  wrap.innerHTML = "";
  if (!FOODS.length) {
    wrap.appendChild(el("div", "empty", "Noch nichts eingeführt. Tippe auf „+ Neu“ oder ein Allergen oben."));
    return;
  }
  FOODS.forEach((f) => {
    const card = el("div", "food-card");
    const s = sev(f.max_severity);
    const dot = s ? `<span class="sev-dot" style="--sev:${s.color}" title="${esc(sevLabel(f.max_severity))}"></span>` : "";
    const badges = [];
    if (f.allergen) badges.push('<span class="badge allergen">Allergen</span>');
    if (f.status) badges.push(`<span class="badge soft">${esc(statusLabel(f.status))}</span>`);
    if (f.due) badges.push(`<span class="badge due">${LANG === "de" ? "fällig" : "da riproporre"}</span>`);
    card.innerHTML = `<div class="badges">${badges.join("")}</div>
      <h3>${dot}${esc(tName(f))}</h3>
      <div class="meta">${f.reactions.length} ${LANG === "de" ? "Versuch(e)" : "tentativi"} · ${LANG === "de" ? "zuletzt" : "ultimo"} ${esc(fmtDate(f.last_date)) || "–"}</div>`;
    card.addEventListener("click", () => openFoodModal(f));
    wrap.appendChild(card);
  });
}

// ---- Food modal ----
function openFoodModal(food, prefill) {
  editingFood = food || null;
  const src = food || prefill || {};
  $("#food-modal-title").textContent = food ? tName(food) : "Neues Lebensmittel";
  $("#f-name").value = food ? tName(food) : (src.name || "");
  $("#f-status").value = src.status || "";
  $("#f-allergen").checked = !!src.allergen;
  $("#f-first-date").value = (food && food.first_date) || todayISO();
  $("#re-date").value = todayISO();
  $("#re-note").value = "";
  $("#btn-delete-food").style.display = food ? "" : "none";
  renderReactionRows();
  $("#food-modal").classList.add("open");
}
function closeFoodModal() { $("#food-modal").classList.remove("open"); editingFood = null; }

function renderReactionRows() {
  const wrap = $("#reaction-rows");
  wrap.innerHTML = "";
  const reactions = (editingFood && editingFood.reactions) || [];
  if (!reactions.length) {
    wrap.appendChild(el("div", "hint", LANG === "de" ? "Noch keine Reaktion erfasst." : "Nessuna reazione registrata."));
    return;
  }
  reactions.forEach((r) => {
    const s = sev(r.severity);
    const row = el("div", "list-row");
    row.innerHTML = `<span class="sev-dot" style="--sev:${s ? s.color : "#ccc"}"></span>
      <div class="grow"><div class="title">${esc(sevLabel(r.severity))} <span class="sub">${esc(fmtDate(r.date))}</span></div>
      ${r.note ? `<div class="sub">${esc(r.note)}</div>` : ""}</div>`;
    const del = el("button", "icon-btn", "✕");
    del.addEventListener("click", async () => {
      await api("reactions/" + r.id, { method: "DELETE" });
      await refreshFoodsKeepEditing();
    });
    row.appendChild(del);
    wrap.appendChild(row);
  });
}

function foodBody() {
  return {
    name: $("#f-name").value.trim(),
    name_de: "",
    allergen: $("#f-allergen").checked,
    status: $("#f-status").value,
    first_date: $("#f-first-date").value,
  };
}

async function persistFood() {
  // Create or update without closing; returns the food dict and keeps editingFood in sync.
  const body = foodBody();
  let res;
  if (editingFood && editingFood.id) res = await api("foods/" + editingFood.id, { method: "PUT", body: JSON.stringify(body) });
  else res = await api("foods", { method: "POST", body: JSON.stringify(body) });
  editingFood = res;
  return res;
}

async function refreshFoodsKeepEditing() {
  FOODS = await api("foods");
  renderAllergens();
  if (editingFood) { editingFood = FOODS.find((f) => f.id === editingFood.id) || editingFood; renderReactionRows(); }
}

$("#btn-new-food").addEventListener("click", () => openFoodModal(null));
$("#food-modal-close").addEventListener("click", closeFoodModal);
$("#food-cancel").addEventListener("click", closeFoodModal);
$("#food-modal").addEventListener("click", (e) => { if (e.target.id === "food-modal") closeFoodModal(); });

$("#btn-save-food").addEventListener("click", async () => {
  if (!foodBody().name) { toast("Name fehlt"); return; }
  try { await persistFood(); closeFoodModal(); await loadFoods(); toast("Gespeichert ✓"); }
  catch (e) { toast("Fehler: " + e.message); }
});

$("#btn-delete-food").addEventListener("click", async () => {
  if (!editingFood || !editingFood.id) return;
  if (!confirm("Eintrag wirklich löschen?")) return;
  await api("foods/" + editingFood.id, { method: "DELETE" });
  closeFoodModal(); await loadFoods(); toast("Gelöscht");
});

$("#btn-add-reaction").addEventListener("click", async () => {
  if (!foodBody().name) { toast("Erst einen Namen eingeben"); return; }
  try {
    if (!editingFood || !editingFood.id) await persistFood();   // create the food first
    await api("foods/" + editingFood.id + "/reactions", { method: "POST", body: JSON.stringify({
      date: $("#re-date").value, severity: $("#re-severity").value, note: $("#re-note").value,
    })});
    $("#re-note").value = "";
    await refreshFoodsKeepEditing();
    toast("Reaktion erfasst ✓");
  } catch (e) { toast("Fehler: " + e.message); }
});

// ---------------- Settings ----------------
function addFreqRow(g) {
  const row = el("div", "freq-set-row");
  row.dataset.key = g ? g.key : "";
  const color = el("input", "freq-color"); color.type = "color";
  color.value = g ? g.color : "#9b8bd6"; color.dataset.k = "color";
  const label = el("input", "freq-set-label-input"); label.type = "text"; label.placeholder = "Name";
  label.value = g ? g.de : ""; label.dataset.k = "label";
  const min = el("input"); min.type = "number"; min.min = "0"; min.step = "1"; min.value = g ? g.min : 0; min.dataset.k = "min";
  const dash = el("span", "freq-dash", "–");
  const max = el("input"); max.type = "number"; max.min = "0"; max.step = "1"; max.value = g ? g.max : 0; max.dataset.k = "max";
  const del = el("button", "icon-btn freq-del", "✕");
  del.type = "button";
  del.addEventListener("click", () => row.remove());
  row.append(color, label, min, dash, max, del);
  $("#freq-settings").appendChild(row);
  return row;
}

function openSettings() {
  const wrap = $("#freq-settings");
  wrap.innerHTML = "";
  FOOD_GROUPS.forEach((g) => addFreqRow(g));
  $("#set-reoffer").value = REOFFER_DAYS;
  $("#settings-modal").classList.add("open");
}
function closeSettings() { $("#settings-modal").classList.remove("open"); }
$("#btn-add-foodgroup").addEventListener("click", () => addFreqRow(null));

async function reloadMeta() {
  const meta = await api("meta");
  FOOD_GROUPS = meta.food_groups || FOOD_GROUPS;
  REOFFER_DAYS = meta.reoffer_days ?? REOFFER_DAYS;
  fillFoodGroupSelect();
  const active = document.querySelector(".view.active");
  if (active && active.id === "view-plan") renderDay();
  if (active && active.id === "view-allergens") loadFoods();
}

async function saveSettings() {
  const groups = [...$("#freq-settings").children].map((row) => {
    const get = (k) => row.querySelector(`[data-k="${k}"]`).value;
    const mn = parseInt(get("min")), mx = parseInt(get("max"));
    return {
      key: row.dataset.key || "",
      de: get("label").trim(),
      color: get("color"),
      min: Number.isNaN(mn) ? 0 : Math.max(0, mn),
      max: Number.isNaN(mx) ? 0 : Math.max(0, mx),
    };
  }).filter((g) => g.de);
  if (!groups.length) { toast("Mindestens eine Gruppe nötig"); return; }
  const reoffer = Math.max(1, parseInt($("#set-reoffer").value) || REOFFER_DAYS);
  try {
    await api("food-groups", { method: "POST", body: JSON.stringify(groups) });
    await api("settings", { method: "POST", body: JSON.stringify({ key: "reoffer_days", value: String(reoffer) }) });
    await reloadMeta();
    await loadRecipes();
    closeSettings();
    toast("Einstellungen gespeichert ✓");
  } catch (e) { toast("Fehler: " + e.message); }
}

$("#btn-settings").addEventListener("click", openSettings);
$("#settings-close").addEventListener("click", closeSettings);
$("#settings-cancel").addEventListener("click", closeSettings);
$("#settings-modal").addEventListener("click", (e) => { if (e.target.id === "settings-modal") closeSettings(); });
$("#btn-save-settings").addEventListener("click", saveSettings);

// ---------------- Helpers ----------------
function todayISO() { return new Date().toISOString().slice(0, 10); }
function esc(s) { return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function fmt(n) { return Number.isInteger(n) ? n : Number(n).toFixed(1); }

// ---------------- Init ----------------
(async function init() {
  try {
    const meta = await api("meta");
    AISLES = meta.aisles;
    MEALS = meta.meals || [];
    DAYS = meta.days || [];
    FOOD_GROUPS = meta.food_groups || [];
    ALLERGENS = meta.allergens || [];
    SEVERITIES = meta.severities || [];
    REOFFER_DAYS = meta.reoffer_days ?? 3;
    fillFoodGroupSelect();
    fillSeveritySelect();
    const itemAisle = $("#item-aisle");
    AISLES.forEach((a) => { const o = el("option"); o.textContent = a; itemAisle.appendChild(o); });
    await loadRecipes();
  } catch (e) {
    toast("Verbindungsfehler: " + e.message);
  }
})();
