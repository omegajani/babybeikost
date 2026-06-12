# CLAUDE.md – Beikost Planner

Kontext für die Weiterentwicklung dieses Projekts (z. B. in Claude Code).

## Was das ist
Selbst gehostetes Tool für die Beikost-Phase eines Babys: Rezepte verwalten →
Wochenplan zusammenstellen → automatische, aggregierte Einkaufsliste. Läuft als
**lokales Home-Assistant-Add-on** (Ingress-Panel in der Seitenleiste).

**Status:** v0.3. Auf v0.1/v0.2 aufbauend (Rezept-CRUD, Einkaufsliste, Atlas-Menü-Import aus
*L'atlante dello svezzamento* S. 232, Häufigkeits-Leiste):

> **Sprache:** Die App ist **einsprachig Deutsch**. Der Sprach-Umschalter und die IT/DE-Doppel-
> felder sind aus der UI entfernt; `LANG` steht fest auf `"de"`. **Deutsch ist die kanonische
> Sprache überall**: `atlas.py` liefert deutsche `name`/`notes`/Zutaten (`*_de`=leer), und eine
> einmalige Migration `_consolidate_to_de` (geschützt durch Settings-Flag `de_consolidated`) hat
> die bestehenden Geräte-Daten von IT auf DE umgezogen (`name=name_de`, `*_de` geleert). Es gibt
> also **kein Italienisch mehr** in Daten oder Anzeige. Die `*_de`-Spalten bleiben im Schema (leer)
> für eine spätere echte Mehrsprachigkeit (**Phase B**, würde dann aus dem Deutschen übersetzen).

- **Wochenplan als Ein-Tag-Ansicht** (nicht mehr 7-Spalten-Raster): Kopfzeile `‹ Wochentag ›`
  (Pfeile + Wischen, Default = heute), je Mahlzeit **genau ein Gericht**; Klick auf den Slot →
  Rezept auswählen / **per Hand (Freitext)** eintragen / löschen. Plan-Einträge dürfen jetzt
  Freitext ohne Rezept sein (`plan.recipe_id` nullable + `plan.label`).
- **Allergen-/Beikost-Tracker** (eigener Tab 🍓): eingeführte Lebensmittel mit mehreren
  Reaktions-Versuchen (keine/leicht/stark), mag/mag-nicht, Allergen-Schnellauswahl, Erinnerung
  „erneut anbieten".
- **Einstellungs-Panel** (⚙️ oben rechts, Modal): Häufigkeits-Richtwerte je Lebensmittelgruppe
  konfigurierbar, Erinnerungs-Schwelle (Tage), Anzeige-Sprache (IT/DE). Werte in `settings`.
- **„Häufigkeit pro Woche" ist voll anpassbar**: die Lebensmittelgruppen-Liste (Name, Farbe,
  Min/Max je Woche) ist im ⚙️-Panel frei editierbar (`+ Gruppe` / ✕ zum Löschen), nicht mehr nur
  die Zielwerte. Default-Katalog erweitert um **Gemüse, Obst, Getreide** (zusätzlich zu
  Fleisch/Fisch/Eier/Hülsenfrüchte/Milchprodukte). Rezepte bekommen ihre Lebensmittelgruppe
  standardmäßig **automatisch** anhand der Zutaten-/Namens-Stichwörter zugewiesen
  (`FOOD_GROUP_KEYWORDS`/`compute_food_group` in `main.py`); im Rezept-Editor lässt sich das
  Dropdown auf eine konkrete Gruppe umstellen (= **manuelle Übersteuerung**, `food_group_auto=0`,
  bleibt danach stabil) oder zurück auf „Automatisch" (`food_group_auto=1`, wird neu berechnet).
  Beim Speichern des Häufigkeits-Katalogs werden alle noch-automatischen Rezepte neu getaggt.
- **Freitext-Plan-Einträge können ein Häufigkeits-Tag bekommen**: im Slot-Editor steht neben
  „Per Hand eintragen" ein Dropdown „Häufigkeits-Tag" (`#cell-food-group`, Werte = aktueller
  Häufigkeits-Katalog + „—"). Der Wert wird in `plan.food_group` gespeichert (additive Spalte,
  Default leer) und fließt wie bei Rezepten in `renderFreqBar`/die Farbpunkte ein. Für
  Rezept-Einträge bleibt das Tag weiterhin aus `recipes.food_group` (kein Override auf
  Plan-Ebene). Bereits vorhandene Freitext-Einträge ohne Tag lassen sich nachträglich durch
  Öffnen des Slots + Tag wählen + Speichern versehen.

Geplant/offen: **Phase B** (beliebige Sprachen statt fix IT/DE), **Phase C** LibreTranslate-
Auto-Übersetzung, Bring-Anbindung (Liste wird weiterhin per „Kopieren" als Text exportiert).

Auf dem Gerät läuft es als lokales Add-on `local_beikost_planner` (HA OS, SSH-Alias
`homeassistant` → 192.168.2.49). **Wichtig:** Lokale Add-ons laufen aus einem gebauten
Docker-Image; nach Datei-Änderungen in `/addons/beikost_planner/` muss
`ha addons rebuild local_beikost_planner` laufen – ein bloßer `restart` nutzt das alte Image.

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
- `recipes(id, name, name_de, category, servings, notes, notes_de, instructions,
  instructions_de, food_group, food_group_auto)` – `name`/`notes`/`instructions` kanonisch
  (**Deutsch**, siehe Sprach-Hinweis oben); `*_de` aktuell leer (für Phase B). `instructions` =
  mehrzeilige Zubereitung. `food_group` = Key aus dem aktuellen Häufigkeits-Katalog (default
  carne/pesce/uova/legumi/formaggi/verdura/frutta/cereali, oder ''). `food_group_auto` (1/0,
  Default 1): wenn 1, wird `food_group` bei jedem Speichern aus Name+Zutaten neu berechnet
  (`compute_food_group`); wird im Editor manuell eine Gruppe gewählt, wird `food_group_auto=0`
  gesetzt und der Wert bleibt fix, bis wieder „Automatisch" gewählt wird. Klick auf eine
  Rezeptkarte öffnet die **Vollbild-Leseansicht** (`#recipe-view`); Bearbeiten nur über den
  „Bearbeiten"-Button.
- `ingredients(id, recipe_id→recipes, name, name_de, amount, unit, aisle, position)`
- `plan(id, recipe_id→recipes NULLABLE, portions, day, meal, label, food_group)` – `day` =
  `mon..sun`, `meal` ∈ {colazione, pranzo, cena, merenda}. **`recipe_id` nullable**: ist es NULL,
  ist der Eintrag ein **Freitext-Gericht** (`label`), das nicht in die Einkaufsliste einfließt.
  `food_group` (additive Spalte, Default leer) trägt das Häufigkeits-Tag **nur für
  Freitext-Einträge** (im Slot-Editor wählbar); bei Rezept-Einträgen kommt das Tag stattdessen
  aus `recipes.food_group` und `plan.food_group` bleibt leer. Migration `_migrate_plan_table`
  baut die Tabelle einmalig um (SQLite kann NOT NULL nicht in-place lockern). Pro `(day, meal)`
  genau ein Eintrag (UI-seitig via `POST /api/plan/set`).
- `manual_items(id, name, amount, unit, aisle)`
- `checks(item_key)` – abgehakte Posten; `item_key = "<name>|<unit>"` (lowercase, **kanonischer
  Name** → stabil über Sprachwechsel).
- `settings(key, value)` – `content_lang` (`it`/`de`), `food_groups_custom` (JSON-Liste
  `[{key, de, color, min, max}]`, der voll editierbare Häufigkeits-Katalog – ist er gesetzt,
  ersetzt er `FOOD_GROUPS` komplett; legacy `freq_targets` (`{group:{min,max}}`-Overrides auf
  `FOOD_GROUPS`) wird nur noch als Fallback gelesen, solange `food_groups_custom` fehlt),
  `food_groups_auto_assigned` (Migrationsflag, s. u.), `reoffer_days` (Allergen-Erinnerungs-
  Schwelle).
- `day_notes(day, text)` – die „Daran denken…"-Zeile pro Wochentag.
- `foods_introduced(id, name, name_de, allergen, status, first_date)` – eingeführte Lebensmittel
  (`status` ∈ {'', 'like', 'dislike'}); `food_reactions(id, food_id→…, date, severity, note)`
  (`severity` ∈ {none, mild, strong}). `due`/`last_date`/`max_severity` werden in `food_to_dict`
  berechnet (Schwelle = `reoffer_days`).

Zweisprachigkeit/Konstanten leben in `main.py` (`MEALS`, `DAYS`, `FOOD_GROUPS`, `ALLERGENS`,
`SEVERITIES`, via `GET /api/meta`). `FOOD_GROUP_KEYWORDS` (ebenfalls `main.py`) ist die
Stichwortliste (lowercase, ganze Wörter) für die automatische Rezept-Verschlagwortung – neue
Gruppen, die der Nutzer selbst über das ⚙️-Panel anlegt, haben dort keine Einträge und werden
daher nie automatisch vergeben (nur manuell zuweisbar). Atlas-Menüdaten (Rezepte + Wochen) in
`app/atlas.py`.
**Stolperfalle:** Der Aggregations-Key der Einkaufsliste MUSS auf dem kanonischen `name` bleiben,
sonst brechen Summen/Häkchen beim Sprachwechsel. Importierte Rezepte tragen **keine Mengen**.

## API (alles unter `/api`)
- `GET/POST recipes`, `PUT/DELETE recipes/{id}`
- `GET plan`; `POST plan/set` (`{day, meal, recipe_id?|label?, portions}` – ersetzt den Slot,
  leerer Body = löschen); `POST plan/clear`; (`POST plan` + `DELETE plan/{id}` bleiben,
  von `load-example-week`/Abwärtskompatibilität genutzt).
- `POST manual-items`, `DELETE manual-items/{id}`
- `GET shopping-list` (nur Plan-Einträge **mit** Rezept; Freitext zählt nicht),
  `POST shopping-list/toggle`, `POST shopping-list/clear-checks`
- `GET meta` (Aisles, `meals`, `days`, `food_groups` = aktueller Häufigkeits-Katalog, `allergens`,
  `severities`, `reoffer_days`, `content_lang`)
- `POST food-groups` (Body: Liste `[{key?, de, color, min, max}]` – ersetzt den Häufigkeits-
  Katalog komplett, vergibt Keys für neue Gruppen via `slugify`, tagged danach alle Rezepte mit
  `food_group_auto=1` neu)
- `GET/POST settings` (`{key,value}`), `GET/POST day-notes` (`{day,text}`)
- `GET/POST foods`, `PUT/DELETE foods/{id}`, `POST foods/{id}/reactions`, `DELETE reactions/{id}`
- `POST import-atlas` (idempotent), `POST load-example-week` (`{week, clear}`)

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

### 2. ~~Allergen-Tracker~~ ✅ erledigt (v0.3)
Eigener Tab 🍓 + Tabellen `foods_introduced`/`food_reactions`, Allergen-Schnellauswahl,
mehrere Reaktions-Versuche, „erneut anbieten"-Erinnerung. Offen optional: Verknüpfung mit
Zutatennamen (Datalist-Autocomplete ist da, echte Verknüpfung noch nicht).

### Mehrsprachigkeit – Phase B/C (offen)
- **Phase B:** beliebige Sprachen statt fix IT/DE (i18n-JSON-Spalten `name_i18n`/`notes_i18n`,
  Sprachverwaltung im ⚙️-Panel). Plan dazu lag bereits vor.
- **Phase C:** LibreTranslate-Auto-Übersetzung (Settings-URL + `POST /api/translate-missing`),
  optional LibreTranslate-HA-Add-on.

### 3. Vorrat / vorgekochte Portionen
Eiswürfel-/TK-Bestand pro Brei-Sorte, Warnung bei Unterschreiten einer Schwelle.

### 4. Kleinere Politur
- ~~Wochenplan-Ansicht~~ ✅ jetzt Ein-Tag-Ansicht mit Pfeil/Wisch-Navigation (v0.3).
- Mengen-Edit direkt in der Einkaufsliste.
- Export der Liste auch als geteilter Text/Share-Sheet.

## Hinweise
- Wenn der Nutzer HA als **Container/Core** (kein OS/Supervised) fährt, sind Add-ons
  nicht verfügbar → Alternative: eigenständiger Docker-Container + `panel_iframe` in
  HA, und Bring-Push dann über einen Long-Lived Access Token statt `SUPERVISOR_TOKEN`.
- Die Beispielrezepte sind nur Platzhalter/Demo, keine Ernährungsempfehlung.
