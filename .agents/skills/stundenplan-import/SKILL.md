---
name: stundenplan-import
description: Automatisierter Import von Raum-Stundenplänen (z. B. aus Fotos, Screenshots oder Tabellen) für das gesamte Schuljahr in die Raumplaner-Datenbank.
---

# Stundenplan-Import Workflow

Verwende diese Anleitung, wenn der Benutzer ein Bild, Foto oder eine Tabelle eines Stundenplans für einen Raum bereitstellt und diesen für das Schuljahr reservieren möchte.

## Workflow

1. **Bild / Eingabe analysieren**:
   - Lies den Raumnamen aus dem Bildkopf (z. B. „Musik“, „Aula“, „Computerraum“, „Zeichenraum“, „Physiksaal“, „Werken“).
   - Erfasse alle gefüllten Zellen nach Wochentag (Montag bis Freitag) und Schulstunde (1. bis 10.).
   - Beachte Doppelstunden oder Blockungen (z. B. 5a + 5b als 5. Stunde 11:45–12:40).

2. **JSON-Datei erstellen**:
   Erstelle eine temporäre Datei (z. B. `scratch/timetable_import.json`):
   ```json
   {
     "room": "<Raumname oder ID>",
     "weeks": 43,
     "schoolYearStart": "2026-09-14",
     "timetable": {
       "Montag": { "1.": "Klassenname" },
       "Dienstag": { "1.": "Klasse", "2.": "Klasse" },
       "Mittwoch": { ... },
       "Donnerstag": { ... },
       "Freitag": { ... }
     }
   }
   ```

3. **Import durchführen**:
   Führe das Importskript aus:
   ```bash
   node scripts/import-timetable.mjs scratch/timetable_import.json [--dry-run] [--clean-existing] [--skip-conflicts]
   ```
   - **Automatische Stunden-Verbindung**: Werden aufeinanderfolgende Stunden am selben Tag für dieselbe Klasse/Titel angegeben (z. B. 1. und 2. Stunde oder 1-2), verbindet das Skript diese automatisch zu einer durchgehenden Buchung. Die Verbindung erfolgt strikt pro Tag (niemals über mehrere Tage hinweg).
   - **Kalender-Darstellung**: In der Raumübersicht (`SimpleRoomDetailPage`) werden zusammenhängende Schulstunden bzw. mehrstündige Reservierungen vertikal mit `rowSpan` zu einer einzigen Zelle ohne trennende Zwischenlinien verbunden.
   - Mit `--dry-run` kann vorab geprüft werden, ob Konflikte mit bestehenden Buchungen vorliegen.
   - Mit `--clean-existing` werden vorhandene Serien für das Schuljahr in diesem Raum vorher sauber überschrieben.
   - Mit `--skip-conflicts` werden bestehende manuelle Buchungen (z. B. Erasmus, Projektwochen) vorrangig beibehalten und nur die kollidierenden Stundenplan-Einzeltermine übersprungen.

4. **Ergebnis melden**:
   - Bestätige dem Benutzer die Anzahl der angelegten Termine und zeige eine kurze tabellarische Übersicht der erfassten Fächer/Lerngruppen.

