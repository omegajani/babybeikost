# 🥄 Beikost Planner – Home Assistant Add-on

Ein kleines, selbst gehostetes Tool für die Beikost-Phase: **Rezepte verwalten**,
einen **Wochenplan** zusammenstellen und daraus automatisch eine **Einkaufsliste**
erzeugen, die gleiche Zutaten zusammenrechnet und nach Regal/Kategorie gruppiert.

Läuft als lokales Home-Assistant-Add-on und erscheint per Ingress direkt in der
HA-Seitenleiste. Daten liegen in SQLite unter `/data` (von HA dauerhaft gesichert).

## Installation (lokales Add-on)

> Voraussetzung: **Home Assistant OS** oder **Supervised** (nur diese unterstützen Add-ons).
> Bei HA Container/Core stattdessen den Ordner als eigenständigen Docker-Container
> starten und per `panel_iframe` einbinden – sag kurz Bescheid, dann passe ich das an.

1. Kopiere den Ordner `beikost-planner/` in das `addons/`-Verzeichnis deiner HA-Instanz
   (z. B. über das **Samba**- oder **Studio Code Server**-Add-on, Pfad `/addons/`).
2. In Home Assistant: **Einstellungen → Add-ons → Add-on Store → ⋮ → Repositories prüfen**
   bzw. oben rechts **„Nach Updates suchen"** – das lokale Add-on „Beikost Planner"
   erscheint dann unter **Local add-ons**.
3. Add-on öffnen → **Installieren** → **Starten**.
4. „In Seitenleiste anzeigen" aktivieren – fertig. Das Symbol erscheint links als **Beikost**.

## Bedienung

- **Rezepte:** Beispielrezepte sind enthalten. Tippe ein Rezept an zum Bearbeiten,
  oder „+ Neu" für ein eigenes. Pro Zutat: Name, Menge, Einheit und Regal.
- **Wochenplan:** Rezept + Tag + Portionen wählen → „Hinzufügen". Die Portionen werden
  relativ zu den Basis-Portionen des Rezepts hochgerechnet.
- **Einkaufsliste:** wird aus dem Plan erzeugt; gleiche Zutaten (gleiche Einheit) werden
  addiert und nach Regal gruppiert. Eigene Einträge (z. B. Windeln) lassen sich ergänzen.
  Antippen = abhaken. **„Kopieren"** legt die offenen Posten als Textliste in die
  Zwischenablage – so kannst du sie sofort in Bring (oder wo auch immer) einfügen.

## Nächste Schritte (geplant)

- **Bring-Anbindung über die offizielle HA-Bring-Integration:** Button „auf die
  Bring-Liste" ruft `todo.add_item` auf der Bring-To-do-Entity auf. Die App braucht
  dafür nur einen HA-Token; Bring-Zugangsdaten bleiben in HA.
- **Allergen-Tracker:** eingeführte Lebensmittel + Reaktionen protokollieren.
- **Vorrats-/Eiswürfel-Bestand** für vorgekochte Portionen.

## Technik

- Backend: FastAPI + SQLite (eine Datei, `/data/beikost.db`)
- Frontend: statisches HTML/CSS/JS (kein Build-Schritt), ingress-tauglich (relative Pfade)
- Image: `python:3.12-slim`, Start via `uvicorn`
