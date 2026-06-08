# CLAUDE.md – Beikost Planner

Kontext für die Weiterentwicklung dieses Projekts (z. B. in Claude Code).

## Was das ist
Selbst gehostetes Tool für die Beikost-Phase eines Babys: Rezepte verwalten →
Wochenplan zusammenstellen → automatische, aggregierte Einkaufsliste. Läuft als
**lokales Home-Assistant-Add-on** (Ingress-Panel in der Seitenleiste).

**Status:** v0.1 funktionsfähig und manuell getestet (Aggregation, Skalierung,
Abhaken, manuelle Einträge, Rezept-CRUD, Auslieferung der Seite). Bring-Anbindung
ist noch NICHT gebaut – die Liste wird per „Kopieren" als Text exportiert.

## Stack
- Backend: **FastAPI + SQLite** (eine Datei), Python 3.12, Server via `uvicorn`.
- Frontend: **Vanilla HTML/CSS/JS, kein Build-Schritt** (bewusst, für ein schlankes
  Image). Bitte so lassen – kein React/Bundler einführen ohne guten Grund.
- Verpackung: Home-Assistant-Add-on (`config.yaml` + `Dockerfile`, Basis
  `python:3.12-slim`).

## Repo-Layout
```
. (Repo-Root)
├── config.yaml          # HA-Add-on-Manifest (ingress, panel, slug ...)
├── Dockerfile           # python:3.12-slim, startet uvicorn auf Port 8099
├── requirements.txt
├── README.md            # Endnutzer-/Installationsdoku
└── app/
    ├── main.py          # gesamtes Backend: DB, Seed, API-Routen, Frontend-Auslieferung
    └── static/
        ├── index.html   # UI-Gerüst + Rezept-Editor-Modal
        ├── app.css       # warmes, mobile-first Theme (CSS-Variablen oben)
        └── app.js        # Tabs, Rezept-CRUD, Plan, Einkaufsliste
```

## Lokal entwickeln/testen (ohne HA)
```bash
cd app
pip install -r ../requirements.txt
DB_PATH=/tmp/beikost.db uvicorn main:app --reload --port 8099
# -> http://localhost:8099
```
Seed-Rezepte werden nur angelegt, wenn die `recipes`-Tabelle leer ist.

## Kritische Konventionen / Stolperfallen
1. **Ingress = relative Pfade.** Hinter HA-Ingress liegt die App unter einem
   Pfad-Präfix `/api/hassio_ingress/<token>/`. Deshalb MÜSSEN alle URLs im Frontend
   relativ sein (kein führender `/`): `fetch("api/...")`, `href="static/app.css"`.
   Niemals absolute Pfade einführen, sonst bricht es unter HA.
2. **API-Bodies sind JSON.** Alle POST/PUT erwarten `Content-Type: application/json`
   (pydantic-Modelle in `main.py`). Beim Testen mit curl den Header nicht vergessen.
3. **Persistenz:** DB unter `$DB_PATH` (Default `/data/beikost.db`). `/data` wird von
   HA über Neustarts/Updates hinweg gesichert. Lokal liegt die DB sonst neben `main.py`.
4. **Aisles (Regale)** sind eine feste Liste `AISLES` in `main.py` – Frontend holt sie
   über `GET /api/meta`. Änderungen nur dort.
5. SQLite mit `PRAGMA foreign_keys = ON`; Zutaten hängen per `ON DELETE CASCADE` am Rezept.

## Datenmodell (SQLite)
- `recipes(id, name, category, servings, notes)`
- `ingredients(id, recipe_id→recipes, name, amount, unit, aisle, position)`
- `plan(id, recipe_id→recipes, portions, day)`
- `manual_items(id, name, amount, unit, aisle)`
- `checks(item_key)` – abgehakte Einkaufslisten-Posten; `item_key = "<name>|<unit>"` (lowercase)

## API (alles unter `/api`)
- `GET/POST recipes`, `PUT/DELETE recipes/{id}`
- `GET/POST plan`, `DELETE plan/{id}`, `POST plan/clear`
- `POST manual-items`, `DELETE manual-items/{id}`
- `GET shopping-list` (aggregiert Plan+manuell, gruppiert nach Aisle, skaliert per
  `portions/servings`, summiert gleiche `item_key`), `POST shopping-list/toggle`,
  `POST shopping-list/clear-checks`
- `GET meta` (Aisle-Liste)

## Roadmap / nächste Aufgaben (Priorität oben)

### 1. Bring-Anbindung über die HA-Bring-Integration  ← als Nächstes
Voraussetzung beim Nutzer: offizielle **Bring!-Integration** in HA eingerichtet
(legt eine To-do-Entity an, z. B. `todo.<bring_listenname>`).

Umsetzung im Add-on:
- In `config.yaml` `homeassistant_api: true` ergänzen. Das Add-on bekommt dann
  automatisch das Env `SUPERVISOR_TOKEN` und erreicht HA Core unter
  `http://supervisor/core/api`.
- Neuer Backend-Endpoint `POST /api/push-to-bring`: für jeden offenen Listenposten
  einen Call an HA absetzen:
  ```
  POST http://supervisor/core/api/services/todo/add_item
  Authorization: Bearer $SUPERVISOR_TOKEN
  { "entity_id": "<konfigurierte todo-entity>", "item": "Karotte 380 g" }
  ```
- Ziel-Entity konfigurierbar machen: einfachster Weg = Add-on-Option in `config.yaml`
  (`options`/`schema`, im Container als `/data/options.json` lesbar) oder ein
  Settings-Feld in der App (in einer `settings`-Tabelle ablegen).
- Frontend: Button „Auf die Bring-Liste" im Einkaufs-Tab, ruft den Endpoint, zeigt
  Erfolg/Anzahl per Toast.
- Lokal (ohne Supervisor) sauber degradieren: wenn `SUPERVISOR_TOKEN` fehlt, Button
  deaktivieren oder klaren Hinweis zeigen.

### 2. Allergen-Tracker
Eingeführte Lebensmittel protokollieren: erstes Datum, Reaktion (keine/leicht/stark),
Notiz, „mag/mag nicht". Erinnerung, eingeführte Allergene regelmäßig erneut anzubieten.
Eigener Tab + Tabellen `foods_introduced`, `food_reactions`. Optional Verknüpfung mit
Zutatennamen aus Rezepten.

### 3. Vorrat / vorgekochte Portionen
Eiswürfel-/TK-Bestand pro Brei-Sorte, Warnung bei Unterschreiten einer Schwelle.

### 4. Kleinere Politur
- Wochenplan als echte 7-Tage-Ansicht (statt flacher Liste) gruppiert nach Tag.
- Mengen-Edit direkt in der Einkaufsliste.
- Export der Liste auch als geteilter Text/Share-Sheet.

## Hinweise
- Wenn der Nutzer HA als **Container/Core** (kein OS/Supervised) fährt, sind Add-ons
  nicht verfügbar → Alternative: eigenständiger Docker-Container + `panel_iframe` in
  HA, und Bring-Push dann über einen Long-Lived Access Token statt `SUPERVISOR_TOKEN`.
- Die Beispielrezepte sind nur Platzhalter/Demo, keine Ernährungsempfehlung.
