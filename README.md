# 🥄 Beikost Planner – Home Assistant Add-on

Selbst gehostetes Tool für die Beikost-Phase: **Rezepte verwalten**,
**Tages-/Wochenplan pflegen** und daraus eine **aggregierte Einkaufsliste** erzeugen.

Läuft als lokales Home-Assistant-Add-on per Ingress in der Seitenleiste.
Daten liegen in SQLite unter `/data` (von HA dauerhaft gesichert).

## Aktueller Stand

- **Status:** v0.3
- **Sprache in der UI:** aktuell einsprachig **Deutsch**
- **Vorhanden:**
  - Rezept-CRUD inkl. Zutaten, Kategorien und Regalzuordnung
  - Plan als **Ein-Tag-Ansicht** mit Navigation (`‹ Wochentag ›`)
  - Pro Mahlzeit genau ein Eintrag: Rezept, Freitext-Gericht oder leer
  - Aggregierte Einkaufsliste (nach Regal gruppiert, Posten abhaken, „Kopieren“)
  - Allergen-/Beikost-Tracker (Reaktionen, „mag/mag nicht“, Wiedervorlage)
  - Einstellungs-Modal für Richtwerte und Erinnerungs-Schwelle
- **Hinweis:** Zweisprachige IT/DE-Datenfelder bleiben intern erhalten für spätere
  Mehrsprachigkeit (Phase B).

## Installation (lokales Add-on)

> Voraussetzung: **Home Assistant OS** oder **Supervised** (nur diese unterstützen Add-ons).

1. Dieses Repository (bzw. den Add-on-Ordner) nach `/addons/beikost_planner` kopieren.
2. In Home Assistant: **Einstellungen → Add-ons → Add-on Store** und lokale Add-ons
   aktualisieren/suchen.
3. Add-on **Beikost Planner** öffnen → **Installieren** → **Starten**.
4. „In Seitenleiste anzeigen“ aktivieren.

### Wichtig bei Updates

Add-ons laufen aus einem gebauten Docker-Image. Nach Dateiänderungen im Add-on-Ordner
reicht ein Restart nicht aus:

```bash
ha addons rebuild local_beikost_planner
```

Danach das Add-on neu starten.

## Bedienung (kurz)

- **Rezepte:** Anlegen, bearbeiten, löschen; Zutaten mit Menge/Einheit/Regal.
- **Plan:** Tag wechseln, pro Mahlzeit ein Gericht setzen (Rezept oder Freitext).
- **Einkaufsliste:** aus Plan-Einträgen mit Rezept berechnet; gleiche Zutaten (gleiche Einheit)
  werden zusammengefasst.
- **Tracker 🍓:** eingeführte Lebensmittel und Reaktionen dokumentieren.

## Roadmap (nächster Schritt)

1. **Bring-Anbindung über HA-Integration** (`todo.add_item` auf konfigurierbare Bring-Entity)
2. Vorrat / vorgekochte Portionen
3. Mehrsprachigkeit (Phase B/C)

## Technik

- Backend: FastAPI + SQLite (`/data/beikost.db`)
- Frontend: Vanilla HTML/CSS/JS (kein Build-Schritt)
- Ingress-tauglich über relative Pfade
- Start via `uvicorn` (Python 3.12)
