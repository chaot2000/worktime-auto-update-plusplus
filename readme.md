<p align="center">
  <img src="github-banner-worktime-auto-update-plusplus.png" alt="Worktime Auto Update++" width="100%">
</p>

---

# 🕒 **Worktime Auto Update++**

### _Obsidian Plugin zur automatischen Arbeitszeiterfassung – inkl. Feiertagen, Pausenregeln, Statusbar & Test-Engine_

Worktime Auto Update++ ist ein erweitertes Obsidian-Plugin zur präzisen Arbeitszeiterfassung direkt in deinen täglichen Notizen. Es kombiniert intelligente Pausenlogik, Bundesland-Feiertage und automatische Aktualisierung der Arbeitszeit im YAML deiner Daily Notes.

---

# ✨ **Features**

### 🟢 Automatische Arbeitszeitberechnung

- Berechnet die Netto-Arbeitszeit basierend auf:
    
    - `work_start`
    - `work_end`
    - Pausenregeln (voll konfigurierbar)
        
- Unterstützt **proportionale Pausenabzüge** nach Arbeitsrecht:
    - Beispiel: 6h-Regel → max. 30 Minuten Pause
    - Überschuss wird anteilig abgezogen (min(Überhang, Pause))

---

### 🟦 Live-Statusbar

- Zeigt die laufende Arbeitszeit an:
    
    - Von `work_start` bis **jetzt**
    - **Oder maximal bis `work_end`**
    - Mit allen Pausenregeln berücksichtigt

---

### 🟡 „Arbeitszeit neu berechnen“-Command

Setzt direkt in der Note die YAML-Property:

```yaml
`work_time_final: 8 Stunden 30 Minuten`
```


Basierend auf deiner Pausenlogik.

---

### 📅 Feiertagsunterstützung für Deutschland

- Feiertage für jedes Bundesland in Deutschland
- Speicherung in `meta/holidays.json`
- Eigene Feiertage können hinzugefügt werden

---

### 🕒 Flexible Pausenregeln

Über das Einstellungsmenü konfigurierbar:

- Schwelle in Stunden + Minuten
- Abzuziehende Pausenzeit
- Mehrere Regeln möglich (werden automatisch absteigend sortiert)

---

# 📦 **Installation**

### ✅ Variante 1 – Manuell installieren

1. Lade die ZIP des Plugins herunter
2. Entpacke sie
3. Kopiere den Plugin-Ordner **worktime-auto-update-plusplus** nach:

```yaml
<DeinVault>/.obsidian/plugins/worktime-auto-update-plusplus/
```

4. Starte Obsidian neu
5. Aktiviere das Plugin unter:
**Einstellungen → Community Plugins → Worktime Auto Update++**


# 📘 **Bedienung**

### Worktime starten

In deiner Daily Note:

```yaml
`work_start: 2025-11-21T06:00 work_end: 2025-11-21T14:30`
```

### Arbeitszeit final berechnen

Command Palette öffnen →  
**"Arbeitszeit neu berechnen"**

→ schreibt `work_time_final` automatisch.

