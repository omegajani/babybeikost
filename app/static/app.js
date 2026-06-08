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
let LANG = "it";            // display language for dish/ingredient names
let editingId = null;
let pickerCtx = null;       // {day, meal} while the cell picker is open

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
  if (name === "plan") renderPlanGrid();
  if (name === "shopping") renderShopping();
}

// ---------------- Language toggle ----------------
function syncLangToggle() {
  document.querySelectorAll("#lang-toggle button").forEach((b) =>
    b.classList.toggle("active", b.dataset.lang === LANG));
}
async function setLang(lang) {
  if (lang === LANG) return;
  LANG = lang;
  syncLangToggle();
  try { await api("settings", { method: "POST", body: JSON.stringify({ key: "content_lang", value: lang }) }); }
  catch (e) { /* keep UI responsive even if persisting fails */ }
  // Re-render everything that shows names.
  renderRecipes();
  fillRecipeSelect();
  const active = document.querySelector(".view.active");
  if (active && active.id === "view-plan") renderPlanGrid();
  if (active && active.id === "view-shopping") renderShopping();
}
document.querySelectorAll("#lang-toggle button").forEach((b) =>
  b.addEventListener("click", () => setLang(b.dataset.lang)));

// ---------------- Recipes ----------------
async function loadRecipes() {
  RECIPES = await api("recipes");
  renderRecipes();
  fillRecipeSelect();
}

function renderRecipes() {
  const wrap = $("#recipe-list");
  wrap.innerHTML = "";
  if (!RECIPES.length) {
    wrap.appendChild(el("div", "empty", "Noch keine Rezepte. Tippe auf „+ Neu“."));
    return;
  }
  RECIPES.forEach((r) => {
    const card = el("div", "recipe-card");
    const g = fg(r.food_group);
    const badge = g ? `<span class="badge fg" style="--fg:${g.color}">${esc(fgLabel(g))}</span> ` : "";
    const cat = r.category ? `<span class="badge">${esc(r.category)}</span>` : "";
    card.innerHTML = `<div class="badges">${badge}${cat}</div><h3>${esc(tName(r))}</h3>
      <div class="meta">${r.ingredients.length} Zutaten · ${fmt(r.servings)} Portion(en)</div>`;
    card.addEventListener("click", () => openModal(r));
    wrap.appendChild(card);
  });
}

function fillRecipeSelect() {
  // Used by the cell picker.
  const sel = $("#cell-recipe");
  if (!sel) return;
  sel.innerHTML = "";
  RECIPES.forEach((r) => {
    const o = el("option");
    o.value = r.id;
    o.textContent = tName(r);
    sel.appendChild(o);
  });
}

function fillFoodGroupSelect() {
  const sel = $("#r-food-group");
  sel.innerHTML = "";
  const none = el("option"); none.value = ""; none.textContent = "—"; sel.appendChild(none);
  FOOD_GROUPS.forEach((g) => {
    const o = el("option"); o.value = g.key; o.textContent = `${g.de} / ${g.it}`; sel.appendChild(o);
  });
}

// ---------------- Recipe modal ----------------
function openModal(recipe) {
  editingId = recipe ? recipe.id : null;
  $("#modal-title").textContent = recipe ? "Rezept bearbeiten" : "Neues Rezept";
  $("#r-name").value = recipe ? recipe.name : "";
  $("#r-name-de").value = recipe ? (recipe.name_de || "") : "";
  $("#r-category").value = recipe ? recipe.category : "Mittag";
  $("#r-food-group").value = recipe ? (recipe.food_group || "") : "";
  $("#r-servings").value = recipe ? recipe.servings : 1;
  $("#r-notes").value = recipe ? recipe.notes : "";
  $("#r-notes-de").value = recipe ? (recipe.notes_de || "") : "";
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
  const name = el("input"); name.placeholder = "Zutat (IT)"; name.value = ing.name || ""; name.dataset.k = "name";
  const amount = el("input"); amount.type = "number"; amount.step = "any"; amount.placeholder = "Menge";
  amount.value = ing.amount ?? ""; amount.dataset.k = "amount";
  const unit = el("input"); unit.placeholder = "Einheit"; unit.value = ing.unit || ""; unit.dataset.k = "unit";
  const del = el("button", "icon-btn", "✕");
  del.addEventListener("click", () => wrap.remove());
  top.append(name, amount, unit, del);
  const nameDe = el("input", "ing-name-de"); nameDe.placeholder = "Zutat (DE, optional)";
  nameDe.value = ing.name_de || ""; nameDe.dataset.k = "name_de";
  const aisle = el("select", "aisle-select"); aisle.dataset.k = "aisle";
  AISLES.forEach((a) => { const o = el("option"); o.textContent = a; aisle.appendChild(o); });
  aisle.value = ing.aisle || "Sonstiges";
  wrap.append(top, nameDe, aisle);
  $("#ing-rows").appendChild(wrap);
}

function collectIngredients() {
  return [...$("#ing-rows").children].map((w) => {
    const get = (k) => w.querySelector(`[data-k="${k}"]`).value;
    const amt = get("amount");
    return {
      name: get("name"), name_de: get("name_de"),
      amount: amt === "" ? null : parseFloat(amt), unit: get("unit"), aisle: get("aisle"),
    };
  }).filter((i) => i.name.trim());
}

async function saveRecipe() {
  const body = {
    name: $("#r-name").value.trim(),
    name_de: $("#r-name-de").value.trim(),
    category: $("#r-category").value,
    food_group: $("#r-food-group").value,
    servings: parseFloat($("#r-servings").value) || 1,
    notes: $("#r-notes").value.trim(),
    notes_de: $("#r-notes-de").value.trim(),
    ingredients: collectIngredients(),
  };
  if (!body.name) { toast("Name fehlt"); return; }
  try {
    if (editingId) await api("recipes/" + editingId, { method: "PUT", body: JSON.stringify(body) });
    else await api("recipes", { method: "POST", body: JSON.stringify(body) });
    closeModal();
    await loadRecipes();
    toast("Gespeichert ✓");
  } catch (e) { toast("Fehler: " + e.message); }
}

async function deleteRecipe() {
  if (!editingId) return;
  if (!confirm("Rezept wirklich löschen?")) return;
  await api("recipes/" + editingId, { method: "DELETE" });
  closeModal();
  await loadRecipes();
  toast("Gelöscht");
}

$("#btn-new-recipe").addEventListener("click", () => openModal(null));
$("#btn-add-ing").addEventListener("click", () => addIngRow());
$("#btn-save-recipe").addEventListener("click", saveRecipe);
$("#btn-delete-recipe").addEventListener("click", deleteRecipe);
$("#modal-close").addEventListener("click", closeModal);
$("#btn-cancel").addEventListener("click", closeModal);
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });

// ---------------- Plan grid ----------------
let PLAN = [];
let DAY_NOTES = {};

async function renderPlanGrid() {
  [PLAN, DAY_NOTES] = await Promise.all([api("plan"), api("day-notes")]);
  renderFreqBar();
  const grid = $("#plan-grid");
  grid.innerHTML = "";
  grid.style.gridTemplateColumns = `96px repeat(${DAYS.length}, minmax(132px, 1fr))`;

  // Header row: corner + day headers.
  grid.appendChild(el("div", "grid-corner"));
  DAYS.forEach((d) => {
    const h = el("div", "grid-dayhead");
    h.innerHTML = `<span class="d-short">${esc(dayLabel(d, true))}</span>`;
    grid.appendChild(h);
  });

  // One row per meal slot.
  MEALS.forEach((m) => {
    grid.appendChild(el("div", "grid-meallabel", esc(mealLabel(m))));
    DAYS.forEach((d) => {
      const cell = el("div", "grid-cell");
      const entries = PLAN.filter((p) => p.day === d.key && p.meal === m.key);
      entries.forEach((p) => cell.appendChild(buildChip(p)));
      const add = el("button", "cell-add", "+");
      add.title = "Gericht hinzufügen";
      add.addEventListener("click", () => openPicker(d.key, m.key, d, m));
      cell.appendChild(add);
      grid.appendChild(cell);
    });
  });

  // "Ricorda di… / Daran denken" row.
  grid.appendChild(el("div", "grid-meallabel note", LANG === "de" ? "Daran denken" : "Ricorda di…"));
  DAYS.forEach((d) => {
    const cell = el("div", "grid-cell note-cell");
    const inp = el("input", "note-input");
    inp.value = DAY_NOTES[d.key] || "";
    inp.placeholder = "…";
    inp.addEventListener("change", async () => {
      await api("day-notes", { method: "POST", body: JSON.stringify({ day: d.key, text: inp.value }) });
      DAY_NOTES[d.key] = inp.value.trim();
    });
    cell.appendChild(inp);
    grid.appendChild(cell);
  });
}

function buildChip(p) {
  const g = fg(p.food_group);
  const chip = el("div", "dish-chip");
  if (g) chip.style.setProperty("--fg", g.color);
  const portions = (p.portions && p.portions !== 1) ? ` ·${fmt(p.portions)}` : "";
  chip.innerHTML = `${g ? '<span class="fg-dot"></span>' : ""}<span class="chip-name">${esc(tName(p))}${portions}</span>`;
  const x = el("button", "chip-x", "✕");
  x.addEventListener("click", async (e) => {
    e.stopPropagation();
    await api("plan/" + p.id, { method: "DELETE" });
    renderPlanGrid();
  });
  chip.appendChild(x);
  return chip;
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

// ---------------- Cell picker ----------------
function openPicker(dayKey, mealKey, dayObj, mealObj) {
  if (!RECIPES.length) { toast("Erst ein Rezept anlegen oder Atlas-Woche laden"); return; }
  pickerCtx = { day: dayKey, meal: mealKey };
  fillRecipeSelect();
  $("#cell-portions").value = 1;
  $("#cell-picker-title").textContent = `${mealLabel(mealObj)} · ${dayLabel(dayObj, false)}`;
  $("#cell-picker").classList.add("open");
}
function closePicker() { $("#cell-picker").classList.remove("open"); pickerCtx = null; }

$("#cell-picker-close").addEventListener("click", closePicker);
$("#cell-picker-cancel").addEventListener("click", closePicker);
$("#cell-picker").addEventListener("click", (e) => { if (e.target.id === "cell-picker") closePicker(); });
$("#cell-picker-add").addEventListener("click", async () => {
  if (!pickerCtx) return;
  const recipe_id = parseInt($("#cell-recipe").value);
  if (!recipe_id) { toast("Kein Rezept gewählt"); return; }
  const portions = parseFloat($("#cell-portions").value) || 1;
  await api("plan", { method: "POST", body: JSON.stringify({
    recipe_id, portions, day: pickerCtx.day, meal: pickerCtx.meal,
  })});
  closePicker();
  renderPlanGrid();
});

// ---------------- Plan actions ----------------
$("#btn-clear-plan").addEventListener("click", async () => {
  if (!confirm("Ganzen Plan leeren?")) return;
  await api("plan/clear", { method: "POST" });
  renderPlanGrid();
});
$("#btn-load-week").addEventListener("click", async () => {
  const week = parseInt($("#atlas-week").value) || 1;
  if (!confirm(`Atlas-Woche ${week} laden? Der aktuelle Plan wird ersetzt.`)) return;
  try {
    const res = await api("load-example-week", { method: "POST", body: JSON.stringify({ week, clear: true }) });
    await loadRecipes();        // atlas import may have added recipes
    renderPlanGrid();
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

// ---------------- Helpers ----------------
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
    LANG = meta.content_lang || "it";
    syncLangToggle();
    fillFoodGroupSelect();
    const itemAisle = $("#item-aisle");
    AISLES.forEach((a) => { const o = el("option"); o.textContent = a; itemAisle.appendChild(o); });
    await loadRecipes();
  } catch (e) {
    toast("Verbindungsfehler: " + e.message);
  }
})();
