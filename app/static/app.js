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
let editingId = null;

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

// ---------------- Tabs ----------------
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => switchView(tab.dataset.view));
});
function switchView(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === name));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + name));
  if (name === "plan") renderPlan();
  if (name === "shopping") renderShopping();
}

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
    const badge = r.category ? `<span class="badge">${esc(r.category)}</span><br>` : "";
    card.innerHTML = `${badge}<h3>${esc(r.name)}</h3>
      <div class="meta">${r.ingredients.length} Zutaten · ${fmt(r.servings)} Portion(en)</div>`;
    card.addEventListener("click", () => openModal(r));
    wrap.appendChild(card);
  });
}

function fillRecipeSelect() {
  const sel = $("#plan-recipe");
  sel.innerHTML = "";
  RECIPES.forEach((r) => {
    const o = el("option");
    o.value = r.id;
    o.textContent = r.category ? `${r.name} (${r.category})` : r.name;
    sel.appendChild(o);
  });
}

// ---------------- Recipe modal ----------------
function openModal(recipe) {
  editingId = recipe ? recipe.id : null;
  $("#modal-title").textContent = recipe ? "Rezept bearbeiten" : "Neues Rezept";
  $("#r-name").value = recipe ? recipe.name : "";
  $("#r-category").value = recipe ? recipe.category : "Mittag";
  $("#r-servings").value = recipe ? recipe.servings : 1;
  $("#r-notes").value = recipe ? recipe.notes : "";
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
  const name = el("input"); name.placeholder = "Zutat"; name.value = ing.name || ""; name.dataset.k = "name";
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
    return { name: get("name"), amount: amt === "" ? null : parseFloat(amt), unit: get("unit"), aisle: get("aisle") };
  }).filter((i) => i.name.trim());
}

async function saveRecipe() {
  const body = {
    name: $("#r-name").value.trim(),
    category: $("#r-category").value,
    servings: parseFloat($("#r-servings").value) || 1,
    notes: $("#r-notes").value.trim(),
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

// ---------------- Plan ----------------
async function renderPlan() {
  const plan = await api("plan");
  const wrap = $("#plan-list");
  wrap.innerHTML = "";
  if (!plan.length) {
    wrap.appendChild(el("div", "empty", "Noch nichts geplant. Wähle oben ein Rezept."));
    return;
  }
  plan.forEach((p) => {
    const row = el("div", "list-row");
    const dayTag = p.day ? `<span class="badge">${esc(p.day)}</span> ` : "";
    row.innerHTML = `<div class="grow"><div class="title">${dayTag}${esc(p.name)}</div>
      <div class="sub">${fmt(p.portions)} Portion(en)</div></div>`;
    const del = el("button", "icon-btn", "✕");
    del.addEventListener("click", async () => { await api("plan/" + p.id, { method: "DELETE" }); renderPlan(); });
    row.appendChild(del);
    wrap.appendChild(row);
  });
}

$("#btn-add-plan").addEventListener("click", async () => {
  const recipe_id = parseInt($("#plan-recipe").value);
  if (!recipe_id) { toast("Erst ein Rezept anlegen"); return; }
  await api("plan", { method: "POST", body: JSON.stringify({
    recipe_id, day: $("#plan-day").value, portions: parseFloat($("#plan-portions").value) || 1,
  })});
  renderPlan();
  toast("Zum Plan hinzugefügt");
});
$("#btn-clear-plan").addEventListener("click", async () => {
  if (!confirm("Ganzen Plan leeren?")) return;
  await api("plan/clear", { method: "POST" }); renderPlan();
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
        <div class="label">${esc(it.name)}${it.manual ? ' <span class="manual-tag">●</span>' : ""}</div>
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
    lines.push(`${it.name}${qty}`);
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
    const itemAisle = $("#item-aisle");
    AISLES.forEach((a) => { const o = el("option"); o.textContent = a; itemAisle.appendChild(o); });
    await loadRecipes();
  } catch (e) {
    toast("Verbindungsfehler: " + e.message);
  }
})();
