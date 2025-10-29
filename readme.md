<p align="center">
  <img src="docs/github-banner-worktime-auto-update-plusplus.png" alt="Worktime Auto Update++" width="100%">
</p>


# 🕒 Worktime Auto Update++ v1.2.9

Ein erweitertes Obsidian-Plugin zur **Arbeitszeitverwaltung**, **Pausenregel-Automatisierung** und **Feiertagsberechnung nach Bundesland**.  
Jetzt mit Scrollfix und verbessertem Konfigurationsfenster!

---

## ✨ Neue Features & Fixes in 1.2.9

✅ **Kein Scrollsprung mehr** im Einstellungsfenster  
✅ **Feiertage speichern korrekt** im konfigurierten Pfad (`meta/holidays.json`)  
✅ **Custom-Feiertage** werden sofort in der Oberfläche sichtbar  
✅ **Bundesland-Auswahl** für Feiertage (inkl. Himmelfahrt, Fronleichnam usw.)  
✅ **Pausenregeln konfigurierbar** mit flexiblen Stunden-Minuten-Werten  
✅ **Feiertage pro Jahr generierbar**  
✅ **Live-Arbeitszeit in Statusleiste**

---

## ⚙️ Installation

### 🧩 Manuelle Installation

1. Lade die Datei **`worktime-auto-update-plusplus_v1.2.9.zip`** herunter.  
2. Entpacke sie in deinen Vault unter:

<Vault>/.obsidian/plugins/worktime-auto-update-plusplus/

yaml
Code kopieren
3. Starte Obsidian neu.
4. Aktiviere das Plugin in  
**Einstellungen → Community Plugins → Worktime Auto Update++**

---

### 🪄 Update von älteren Versionen

1. Deaktiviere das Plugin.  
2. Ersetze die alte Plugin-Version durch die neue.  
3. Aktiviere das Plugin erneut.

---

## ⚙️ Konfiguration

### 🗂 Pfad zu Feiertagen
Wähle, wo deine Feiertage gespeichert werden sollen (z. B. `meta/holidays.json`).

Die Datei wird automatisch erstellt und gepflegt.

---

### 🏠 Bundesland
Wähle dein Bundesland, um automatisch alle Feiertage des aktuellen Jahres zu generieren.

---

### 🎈 Eigene freie Tage
Trage beliebige Zusatz-Feiertage ein:
- Datum: `YYYY-MM-DD`
- Name: Freie Bezeichnung

---

### 🕒 Pausenregeln
Beispiele:
| Arbeitszeit (h) | Pause (min) |
|------------------|-------------|
| 6                | 30          |
| 9                | 45          |
| 10               | 60          |

Neue Regeln hinzufügen oder löschen per Klick.

---

## 📁 Beispiel `meta/holidays.json`

```json
{
"2025": {
 "2025-01-01": "Neujahr",
 "2025-05-01": "Tag der Arbeit",
 "2025-10-03": "Tag der Deutschen Einheit",
 "2025-12-25": "1. Weihnachtstag",
 "2025-12-26": "2. Weihnachtstag"
},
"custom": {
 "2025-12-24": "Heiligabend",
 "2025-12-31": "Silvester"
}
}
💡 Hinweise
Komplett offlinefähig

Keine externen API-Aufrufe

Kompatibel mit Obsidian ≥ 1.4.0

Funktioniert auf Windows, macOS und Linux

🧑‍💻 Autor & Lizenz
Autor: Sven Jakob
Lizenz: MIT License
Version: 1.2.9
Repository: https://github.com/chaot2000/worktime-auto-update-plusplus

📦 Assets zum Release anhängen
 worktime-auto-update-plusplus_v1.2.9.zip

 manifest.json

 styles.css

 main.js