"""Beikost Planner – FastAPI backend.

Stores recipes, a weekly plan and a shopping list in SQLite.
Designed to run as a Home Assistant add-on behind Ingress, but also runs
standalone (DB then lands next to this file).
"""
import os
import sqlite3
from contextlib import closing
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

DB_PATH = os.environ.get("DB_PATH", str(Path(__file__).parent / "beikost.db"))
STATIC_DIR = Path(__file__).parent / "static"

# Fixed display order for grocery aisles.
AISLES = [
    "Obst & Gemüse",
    "Milchprodukte",
    "Getreide & Beilagen",
    "Fleisch & Fisch",
    "Vorrat",
    "Sonstiges",
]

app = FastAPI(title="Beikost Planner")


# --------------------------------------------------------------------------
# Database helpers
# --------------------------------------------------------------------------
def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    with closing(connect()) as conn, conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS recipes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category TEXT DEFAULT '',
                servings REAL NOT NULL DEFAULT 1,
                notes TEXT DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS ingredients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                amount REAL,
                unit TEXT DEFAULT '',
                aisle TEXT DEFAULT 'Sonstiges',
                position INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS plan (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
                portions REAL NOT NULL DEFAULT 1,
                day TEXT DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS manual_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                amount REAL,
                unit TEXT DEFAULT '',
                aisle TEXT DEFAULT 'Sonstiges'
            );
            CREATE TABLE IF NOT EXISTS checks (
                item_key TEXT PRIMARY KEY
            );
            """
        )
    seed_if_empty()


def seed_if_empty() -> None:
    with closing(connect()) as conn:
        count = conn.execute("SELECT COUNT(*) AS c FROM recipes").fetchone()["c"]
    if count:
        return
    samples = [
        ("Haferbrei mit Banane & Apfel", "Frühstück", 1, "Klassiker zum Start in den Tag.", [
            ("Haferflocken (zart)", 30, "g", "Getreide & Beilagen"),
            ("Banane", 0.5, "Stück", "Obst & Gemüse"),
            ("Apfel", 0.5, "Stück", "Obst & Gemüse"),
            ("Vollmilch", 100, "ml", "Milchprodukte"),
        ]),
        ("Karotten-Kartoffel-Brei mit Hähnchen", "Mittag", 2, "Eisenlieferant durch das Hähnchen.", [
            ("Karotte", 150, "g", "Obst & Gemüse"),
            ("Kartoffel", 100, "g", "Obst & Gemüse"),
            ("Hähnchenbrust", 50, "g", "Fleisch & Fisch"),
            ("Rapsöl", 1, "TL", "Vorrat"),
        ]),
        ("Brokkoli-Süßkartoffel-Püree", "Mittag", 2, "Mild und cremig.", [
            ("Brokkoli", 120, "g", "Obst & Gemüse"),
            ("Süßkartoffel", 150, "g", "Obst & Gemüse"),
            ("Rapsöl", 1, "TL", "Vorrat"),
        ]),
        ("Apfel-Birnen-Mus", "Snack", 2, "Ohne zugesetzten Zucker.", [
            ("Apfel", 1, "Stück", "Obst & Gemüse"),
            ("Birne", 1, "Stück", "Obst & Gemüse"),
            ("Zimt", 1, "Prise", "Vorrat"),
        ]),
        ("Vollkorn-Gemüse-Risotto", "Mittag", 2, "Brühe ungesalzen verwenden.", [
            ("Vollkornreis", 60, "g", "Getreide & Beilagen"),
            ("Zucchini", 100, "g", "Obst & Gemüse"),
            ("Karotte", 80, "g", "Obst & Gemüse"),
            ("Gemüsebrühe (ungesalzen)", 200, "ml", "Vorrat"),
        ]),
        ("Joghurt mit Heidelbeeren", "Snack", 1, "Erst ab ca. 9–10 Monaten in kleinen Mengen.", [
            ("Naturjoghurt (3,5%)", 100, "g", "Milchprodukte"),
            ("Heidelbeeren", 40, "g", "Obst & Gemüse"),
        ]),
    ]
    with closing(connect()) as conn, conn:
        for name, cat, serv, notes, ings in samples:
            cur = conn.execute(
                "INSERT INTO recipes (name, category, servings, notes) VALUES (?,?,?,?)",
                (name, cat, serv, notes),
            )
            rid = cur.lastrowid
            for pos, (iname, amt, unit, aisle) in enumerate(ings):
                conn.execute(
                    "INSERT INTO ingredients (recipe_id, name, amount, unit, aisle, position) "
                    "VALUES (?,?,?,?,?,?)",
                    (rid, iname, amt, unit, aisle, pos),
                )


# --------------------------------------------------------------------------
# Pydantic models
# --------------------------------------------------------------------------
class IngredientIn(BaseModel):
    name: str
    amount: Optional[float] = None
    unit: str = ""
    aisle: str = "Sonstiges"


class RecipeIn(BaseModel):
    name: str
    category: str = ""
    servings: float = 1
    notes: str = ""
    ingredients: list[IngredientIn] = []


class PlanIn(BaseModel):
    recipe_id: int
    portions: float = 1
    day: str = ""


class ManualItemIn(BaseModel):
    name: str
    amount: Optional[float] = None
    unit: str = ""
    aisle: str = "Sonstiges"


class ToggleIn(BaseModel):
    key: str
    checked: bool


# --------------------------------------------------------------------------
# Serialization helpers
# --------------------------------------------------------------------------
def recipe_to_dict(conn: sqlite3.Connection, row: sqlite3.Row) -> dict:
    ings = conn.execute(
        "SELECT name, amount, unit, aisle FROM ingredients "
        "WHERE recipe_id=? ORDER BY position, id",
        (row["id"],),
    ).fetchall()
    return {
        "id": row["id"],
        "name": row["name"],
        "category": row["category"],
        "servings": row["servings"],
        "notes": row["notes"],
        "ingredients": [dict(i) for i in ings],
    }


def item_key(name: str, unit: str) -> str:
    return f"{name.strip().lower()}|{(unit or '').strip().lower()}"


# --------------------------------------------------------------------------
# Recipe routes
# --------------------------------------------------------------------------
@app.get("/api/recipes")
def list_recipes():
    with closing(connect()) as conn:
        rows = conn.execute("SELECT * FROM recipes ORDER BY name COLLATE NOCASE").fetchall()
        return [recipe_to_dict(conn, r) for r in rows]


@app.post("/api/recipes")
def create_recipe(data: RecipeIn):
    if not data.name.strip():
        raise HTTPException(400, "Name fehlt")
    with closing(connect()) as conn, conn:
        cur = conn.execute(
            "INSERT INTO recipes (name, category, servings, notes) VALUES (?,?,?,?)",
            (data.name.strip(), data.category, max(data.servings, 0.1), data.notes),
        )
        rid = cur.lastrowid
        _save_ingredients(conn, rid, data.ingredients)
        return recipe_to_dict(conn, conn.execute("SELECT * FROM recipes WHERE id=?", (rid,)).fetchone())


@app.put("/api/recipes/{rid}")
def update_recipe(rid: int, data: RecipeIn):
    with closing(connect()) as conn, conn:
        exists = conn.execute("SELECT id FROM recipes WHERE id=?", (rid,)).fetchone()
        if not exists:
            raise HTTPException(404, "Rezept nicht gefunden")
        conn.execute(
            "UPDATE recipes SET name=?, category=?, servings=?, notes=? WHERE id=?",
            (data.name.strip(), data.category, max(data.servings, 0.1), data.notes, rid),
        )
        conn.execute("DELETE FROM ingredients WHERE recipe_id=?", (rid,))
        _save_ingredients(conn, rid, data.ingredients)
        return recipe_to_dict(conn, conn.execute("SELECT * FROM recipes WHERE id=?", (rid,)).fetchone())


@app.delete("/api/recipes/{rid}")
def delete_recipe(rid: int):
    with closing(connect()) as conn, conn:
        conn.execute("DELETE FROM recipes WHERE id=?", (rid,))
    return {"ok": True}


def _save_ingredients(conn, rid, ingredients):
    for pos, ing in enumerate(ingredients):
        if not ing.name.strip():
            continue
        conn.execute(
            "INSERT INTO ingredients (recipe_id, name, amount, unit, aisle, position) "
            "VALUES (?,?,?,?,?,?)",
            (rid, ing.name.strip(), ing.amount, ing.unit, ing.aisle or "Sonstiges", pos),
        )


# --------------------------------------------------------------------------
# Plan routes
# --------------------------------------------------------------------------
@app.get("/api/plan")
def get_plan():
    with closing(connect()) as conn:
        rows = conn.execute(
            "SELECT p.id, p.recipe_id, p.portions, p.day, r.name, r.category, r.servings "
            "FROM plan p JOIN recipes r ON r.id = p.recipe_id ORDER BY p.id"
        ).fetchall()
        return [dict(r) for r in rows]


@app.post("/api/plan")
def add_plan(data: PlanIn):
    with closing(connect()) as conn, conn:
        r = conn.execute("SELECT id FROM recipes WHERE id=?", (data.recipe_id,)).fetchone()
        if not r:
            raise HTTPException(404, "Rezept nicht gefunden")
        conn.execute(
            "INSERT INTO plan (recipe_id, portions, day) VALUES (?,?,?)",
            (data.recipe_id, max(data.portions, 0.1), data.day),
        )
    return {"ok": True}


@app.delete("/api/plan/{pid}")
def remove_plan(pid: int):
    with closing(connect()) as conn, conn:
        conn.execute("DELETE FROM plan WHERE id=?", (pid,))
    return {"ok": True}


@app.post("/api/plan/clear")
def clear_plan():
    with closing(connect()) as conn, conn:
        conn.execute("DELETE FROM plan")
    return {"ok": True}


# --------------------------------------------------------------------------
# Manual shopping items
# --------------------------------------------------------------------------
@app.post("/api/manual-items")
def add_manual(data: ManualItemIn):
    if not data.name.strip():
        raise HTTPException(400, "Name fehlt")
    with closing(connect()) as conn, conn:
        conn.execute(
            "INSERT INTO manual_items (name, amount, unit, aisle) VALUES (?,?,?,?)",
            (data.name.strip(), data.amount, data.unit, data.aisle or "Sonstiges"),
        )
    return {"ok": True}


@app.delete("/api/manual-items/{mid}")
def delete_manual(mid: int):
    with closing(connect()) as conn, conn:
        conn.execute("DELETE FROM manual_items WHERE id=?", (mid,))
    return {"ok": True}


# --------------------------------------------------------------------------
# Shopping list (aggregation)
# --------------------------------------------------------------------------
@app.get("/api/shopping-list")
def shopping_list():
    with closing(connect()) as conn:
        plan = conn.execute(
            "SELECT p.portions, r.servings, p.recipe_id FROM plan p "
            "JOIN recipes r ON r.id = p.recipe_id"
        ).fetchall()
        checked = {row["item_key"] for row in conn.execute("SELECT item_key FROM checks").fetchall()}

        # key -> aggregated entry
        agg: dict[str, dict] = {}

        def add(name, amount, unit, aisle, manual=False, manual_id=None):
            key = item_key(name, unit)
            entry = agg.get(key)
            if entry is None:
                entry = {
                    "key": key,
                    "name": name,
                    "amount": None,
                    "unit": unit or "",
                    "aisle": aisle or "Sonstiges",
                    "manual": manual,
                    "manual_id": manual_id,
                }
                agg[key] = entry
            if amount is not None:
                entry["amount"] = (entry["amount"] or 0) + amount
            if manual:
                entry["manual"] = True
                entry["manual_id"] = manual_id

        for pl in plan:
            factor = (pl["portions"] or 1) / (pl["servings"] or 1)
            ings = conn.execute(
                "SELECT name, amount, unit, aisle FROM ingredients WHERE recipe_id=?",
                (pl["recipe_id"],),
            ).fetchall()
            for ing in ings:
                scaled = ing["amount"] * factor if ing["amount"] is not None else None
                add(ing["name"], scaled, ing["unit"], ing["aisle"])

        for mi in conn.execute("SELECT * FROM manual_items").fetchall():
            add(mi["name"], mi["amount"], mi["unit"], mi["aisle"], manual=True, manual_id=mi["id"])

    # group by aisle in fixed order
    groups = []
    for aisle in AISLES:
        items = [e for e in agg.values() if e["aisle"] == aisle]
        items.sort(key=lambda e: e["name"].lower())
        for e in items:
            e["checked"] = e["key"] in checked
            if e["amount"] is not None:
                a = e["amount"]
                e["amount_display"] = str(int(a)) if abs(a - round(a)) < 1e-6 else f"{a:.1f}"
            else:
                e["amount_display"] = ""
        if items:
            groups.append({"aisle": aisle, "items": items})
    return {"groups": groups}


@app.post("/api/shopping-list/toggle")
def toggle_item(data: ToggleIn):
    with closing(connect()) as conn, conn:
        if data.checked:
            conn.execute("INSERT OR IGNORE INTO checks (item_key) VALUES (?)", (data.key,))
        else:
            conn.execute("DELETE FROM checks WHERE item_key=?", (data.key,))
    return {"ok": True}


@app.post("/api/shopping-list/clear-checks")
def clear_checks():
    with closing(connect()) as conn, conn:
        conn.execute("DELETE FROM checks")
    return {"ok": True}


@app.get("/api/meta")
def meta():
    return {"aisles": AISLES}


# --------------------------------------------------------------------------
# Frontend
# --------------------------------------------------------------------------
@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.exception_handler(404)
def not_found(request, exc):
    return JSONResponse({"detail": "not found"}, status_code=404)


init_db()
