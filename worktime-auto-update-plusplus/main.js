/********************************************************************
 * 🕒 Worktime Auto Update++ v1.3.x
 * Autor: Sven Jakob
 * Beschreibung: Arbeitszeit + Feiertage + Pause + Statusanzeige
 * Hinweis: Pausenregel proportional (min(Überhang, Pause))
 ********************************************************************/

let obsidian;
try {
    obsidian = require("obsidian");
} catch (e) {
    console.error("[Worktime++] Modul 'obsidian' nicht gefunden. Bitte Obsidian >=1.4.0 verwenden.");
    throw e;
}

const { Plugin, PluginSettingTab, Setting, Notice, normalizePath } = obsidian;

const DEFAULT_SETTINGS = {
    holidayPath: "meta/holidays.json",
    bundesland: "HE",
    pauseRules: [
        { hours: 6, pause: 30 },
        { hours: 9, pause: 45 },
        { hours: 10, pause: 60 }
    ]
};

const DE_STATES = {
    "BW": "Baden-Württemberg",
    "BY": "Bayern",
    "BE": "Berlin",
    "BB": "Brandenburg",
    "HB": "Bremen",
    "HH": "Hamburg",
    "HE": "Hessen",
    "MV": "Mecklenburg-Vorpommern",
    "NI": "Niedersachsen",
    "NW": "Nordrhein-Westfalen",
    "RP": "Rheinland-Pfalz",
    "SL": "Saarland",
    "SN": "Sachsen",
    "ST": "Sachsen-Anhalt",
    "SH": "Schleswig-Holstein",
    "TH": "Thüringen"
};

class WorktimeAutoUpdatePlusPlus extends Plugin {

    async onload() {
        console.log("[Worktime++] Plugin wird geladen...");
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

        // Statusbar
        this.statusBar = this.addStatusBarItem();
        this.statusBar.setText("⏱ Initialisiere...");
        await this.updateStatusBar(true);
        this.registerInterval(window.setInterval(() => this.updateStatusBar(false), 60_000));

        this.registerEvent(
            this.app.workspace.on("file-open", async () => {
                await this.updateStatusBar(true);
            })
        );

        // Commands
        this.addCommand({
            id: "recalculate-worktime",
            name: "⟳ Arbeitszeit neu berechnen",
            callback: async () => {
                await this.writeWorkTimeFinal();
            }
        });

        this.addCommand({
            id: "update-holidays",
            name: "📅 Feiertage generieren (Bundesland)",
            callback: () => this.ensureHolidaysForYear()
        });

        this.addSettingTab(new WorktimeSettingsTab(this.app, this));
        new Notice("Worktime Auto Update++ aktiviert ✅", 2000);
    }

    onunload() {
        if (this.statusBar) this.statusBar.remove();
        console.log("[Worktime++] entladen.");
    }

    // ==========================================================
    // 🧮 Arbeitszeit-Berechnung – mit proportionaler Pausenlogik
    // ==========================================================
    computeWorkTime(startStr, endStr) {
        const start = new Date(startStr);
        const end = new Date(endStr);

        if (isNaN(start) || isNaN(end) || end < start) {
            return { minutes: null, error: true };
        }

        let total = Math.round((end - start) / 60000); // Minuten gesamt

        // Regeln DESC sortieren (größte Schwelle zuerst)
        const rules = [...(this.settings.pauseRules || [])]
            .map(r => ({
                hours: Number(r.hours) || 0,
                minutes: Number(r.minutes) || 0,
                pause: Number(r.pause) || 0
            }))
            .sort(
                (a, b) =>
                    (b.hours * 60 + b.minutes) -
                    (a.hours * 60 + a.minutes)
            );

        for (const r of rules) {
            const threshold = r.hours * 60 + r.minutes;
            if (total > threshold) {
                const over = total - threshold;
                const effectivePause = Math.min(over, r.pause);
                total -= effectivePause;
                break; // nur höchste passende Regel
            }
        }

        return { minutes: total, error: false };
    }

    formatMinutesToHuman(min) {
        if (min == null) return "Fehler";
        const h = Math.floor(min / 60);
        const m = min % 60;

        if (h > 0 && m > 0) return `${h} Stunden ${m} Minuten`;
        if (h > 0) return `${h} Stunden`;
        if (m > 0) return `${m} Minuten`;
        return "0 Minuten";
    }

    // ==========================================================
    // Statusbar: work_start → jetzt, max. bis work_end
    // ==========================================================
    async updateStatusBar(initial = false) {
        const file = this.app.workspace.getActiveFile();
        if (!file) {
            this.statusBar.setText("⏱ Kein Startzeitpunkt");
            return;
        }

        try {
            const content = await this.app.vault.read(file);

            // YAML-Block extrahieren
            const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
            const yaml = yamlMatch ? yamlMatch[1] : "";

            const startMatch =
                yaml.match(/work_start:\s*([\d\-T:]+)/) ||
                content.match(/work_start:\s*([\d\-T:]+)/);

            if (!startMatch) {
                this.statusBar.setText("⏱ Kein Startzeitpunkt");
                return;
            }

            const startStr = startMatch[1];
            const start = new Date(startStr);

            if (isNaN(start.getTime())) {
                this.statusBar.setText("⏱ Ungültiger Startzeitpunkt");
                return;
            }

            // work_end (optional)
            const endMatch =
                yaml.match(/work_end:\s*([\d\-T:]+)/) ||
                content.match(/work_end:\s*([\d\-T:]+)/);

            let endFromNote = null;
            if (endMatch) {
                const endTmp = new Date(endMatch[1]);
                if (!isNaN(endTmp.getTime())) {
                    endFromNote = endTmp;
                }
            }

            const now = new Date();
            let endForCalc;

            if (endFromNote && now > endFromNote) {
                // max. bis work_end
                endForCalc = endFromNote;
            } else {
                // bis jetzt
                endForCalc = now;
            }

            if (endForCalc < start) {
                this.statusBar.setText("⏱ Noch nicht gestartet");
                return;
            }

            const calc = this.computeWorkTime(
                start.toISOString(),
                endForCalc.toISOString()
            );

            if (calc.error) {
                this.statusBar.setText("⚠️ Fehler");
                return;
            }

            const text = this.formatMinutesToHuman(calc.minutes);
            this.statusBar.setText(`⏱ ${text}`);

            if (initial) this.statusBar.setAttr("title", "Worktime Auto Update++");

        } catch (err) {
            console.error("[Worktime++] Fehler in updateStatusBar:", err);
            this.statusBar.setText("⚠️ Fehler beim Lesen");
        }
    }

    // ==========================================================
    // Command: work_time_final in der Note setzen (work_start → work_end)
    // ==========================================================
    async writeWorkTimeFinal() {
        const file = this.app.workspace.getActiveFile();
        if (!file) {
            new Notice("Keine Datei aktiv.");
            return;
        }

        const content = await this.app.vault.read(file);

        // YAML-Block extrahieren
        const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
        const yaml = yamlMatch ? yamlMatch[1] : "";

        const startMatch =
            yaml.match(/work_start:\s*([\d\-T:]+)/) ||
            content.match(/work_start:\s*([\d\-T:]+)/);

        const endMatch =
            yaml.match(/work_end:\s*([\d\-T:]+)/) ||
            content.match(/work_end:\s*([\d\-T:]+)/);

        if (!startMatch || !endMatch) {
            new Notice("work_start oder work_end nicht gefunden.");
            return;
        }

        const calc = this.computeWorkTime(startMatch[1], endMatch[1]);
        if (calc.error) {
            new Notice("Fehler bei der Berechnung von work_time_final.");
            return;
        }

        const text = this.formatMinutesToHuman(calc.minutes);

        let updated = content;

        if (/work_time_final:\s*.*/.test(updated)) {
            // existiert → ersetzen
            updated = updated.replace(
                /work_time_final:\s*.*/,
                `work_time_final: ${text}`
            );
        } else if (yamlMatch) {
            // Im bestehenden YAML-Block einfügen
            updated = updated.replace(
                /^---\n([\s\S]*?)\n---/,
                (full, inner) => {
                    const trimmed = inner.replace(/\s+$/, "");
                    return `---\n${trimmed}\nwork_time_final: ${text}\n---`;
                }
            );
        } else {
            // Kein YAML → neuen Block erzeugen
            updated = `---\nwork_time_final: ${text}\n---\n\n${content}`;
        }

        await this.app.vault.modify(file, updated);
        new Notice(`Arbeitszeit gesetzt: ${text}`);
    }

    // ==========================================================
    // Feiertage laden/speichern
    // ==========================================================
    async loadHolidaysObject() {
        const adapter = this.app.vault.adapter;
        const file = normalizePath(this.settings.holidayPath || "meta/holidays.json");

        const exists = await adapter.exists(file);
        if (!exists) {
            const initial = { custom: {} };
            await adapter.write(file, JSON.stringify(initial, null, 2));
            return initial;
        }

        try {
            const raw = await adapter.read(file);
            const obj = JSON.parse(raw || "{}");
            if (!obj.custom) obj.custom = {};
            return obj;
        } catch (e) {
            console.error("[Worktime++] Fehler beim Lesen der Feiertage:", e);
            const fallback = { custom: {} };
            await adapter.write(file, JSON.stringify(fallback, null, 2));
            return fallback;
        }
    }

    async saveHolidaysObject(obj) {
        const adapter = this.app.vault.adapter;
        const file = normalizePath(this.settings.holidayPath || "meta/holidays.json");
        await adapter.mkdir(normalizePath(file.split("/").slice(0, -1).join("/")));
        await adapter.write(file, JSON.stringify(obj, null, 2));
        new Notice("Feiertage gespeichert ✅");
    }

    async ensureHolidaysForYear(year = new Date().getFullYear()) {
        const obj = await this.loadHolidaysObject();
        obj[year] = this.generateHolidaysForState(year, this.settings.bundesland);
        await this.saveHolidaysObject(obj);
        new Notice(`Feiertage ${year} für ${DE_STATES[this.settings.bundesland]} generiert`);
    }

    // ============================================
    // Feiertagsberechnung
    // ============================================
    easterSunday(year) {
        const a = year % 19, b = Math.floor(year / 100), c = year % 100;
        const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4), k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const month = Math.floor((h + l - 7 * m + 114) / 31);
        const day = ((h + l - 7 * m + 114) % 31) + 1;
        return new Date(Date.UTC(year, month - 1, day));
    }

    addDaysUTC(d, n) {
        const r = new Date(d.getTime());
        r.setUTCDate(r.getUTCDate() + n);
        return r;
    }

    fmt(d) {
        const y = d.getUTCFullYear();
        const m = (d.getUTCMonth() + 1).toString().padStart(2, "0");
        const da = d.getUTCDate().toString().padStart(2, "0");
        return `${y}-${m}-${da}`;
    }

    generateHolidaysForState(year, state) {
        const easter = this.easterSunday(year);
        const H = {};

        H[`${year}-01-01`] = "Neujahr";
        H[`${year}-05-01`] = "Tag der Arbeit";
        H[`${year}-10-03`] = "Tag der Deutschen Einheit";
        H[`${year}-12-25`] = "1. Weihnachtstag";
        H[`${year}-12-26`] = "2. Weihnachtstag";
        H[`${year}-12-24`] = "Heiligabend";
        H[`${year}-12-31`] = "Silvester";

        H[this.fmt(this.addDaysUTC(easter, -2))] = "Karfreitag";
        H[this.fmt(this.addDaysUTC(easter, +1))] = "Ostermontag";
        H[this.fmt(this.addDaysUTC(easter, +39))] = "Christi Himmelfahrt";
        H[this.fmt(this.addDaysUTC(easter, +50))] = "Pfingstmontag";

        if (["BW", "BY", "ST"].includes(state)) H[`${year}-01-06`] = "Heilige Drei Könige";
        if (["BW", "BY", "HE", "NW", "RP", "SL"].includes(state)) H[this.fmt(this.addDaysUTC(easter, +60))] = "Fronleichnam";
        if (["BB", "MV", "SN", "ST", "TH", "SH", "HB", "HH", "NI"].includes(state)) H[`${year}-10-31`] = "Reformationstag";
        if (["BW", "BY", "NW", "RP", "SL"].includes(state)) H[`${year}-11-01`] = "Allerheiligen";
        if (["BE", "MV"].includes(state)) H[`${year}-03-08`] = "Internationaler Frauentag";

        if (state === "SN") {
            const d = new Date(Date.UTC(year, 10, 23));
            while (d.getUTCDay() !== 3) d.setUTCDate(d.getUTCDate() - 1);
            d.setUTCDate(d.getUTCDate() - 7);
            H[this.fmt(d)] = "Buß- und Bettag";
        }

        return H;
    }
}

// ==========================================================
// Settings Tab
// ==========================================================
class WorktimeSettingsTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    saveAndRestoreScroll(callback) {
        const scroll = this.containerEl.scrollTop;
        callback().then(() => this.containerEl.scrollTop = scroll);
    }

    async display() {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl("h2", { text: "⚙️ Worktime Auto Update++" });

        // Pfad
        new Setting(containerEl)
            .setName("Pfad zu den Feiertagen")
            .setDesc("JSON-Datei im Vault (z. B. meta/holidays.json)")
            .addText(t => t
                .setValue(this.plugin.settings.holidayPath)
                .onChange(async v => {
                    this.plugin.settings.holidayPath = v.trim() || "meta/holidays.json";
                    await this.plugin.saveData(this.plugin.settings);
                    new Notice("Pfad gespeichert");
                    this.saveAndRestoreScroll(() => this.display());
                })
            );

        // Bundesland
        new Setting(containerEl)
            .setName("Bundesland")
            .setDesc("Feiertage werden hierfür generiert.")
            .addDropdown(d => {
                Object.entries(DE_STATES).forEach(([k, l]) => d.addOption(k, l));
                d.setValue(this.plugin.settings.bundesland);

                d.onChange(async v => {
                    this.plugin.settings.bundesland = v;
                    await this.plugin.saveData(this.plugin.settings);
                    new Notice(`Bundesland gesetzt: ${DE_STATES[v]}`);
                    this.saveAndRestoreScroll(() => this.display());
                });
            });

        // ------------------------------------------------------
        // 🕒 Pausenregelung
        // ------------------------------------------------------
        containerEl.createEl("h3", { text: "🕒 Pausenregeln" });

        const rules = this.plugin.settings.pauseRules || [];

        // Sortieren nach Schwelle (absteigend)
        rules.sort((a, b) =>
            (Number(b.hours || 0) * 60 + Number(b.minutes || 0)) -
            (Number(a.hours || 0) * 60 + Number(a.minutes || 0))
        );

        rules.forEach((rule, index) => {
            new Setting(containerEl)
                .setName(`Regel ${index + 1}`)
                .setDesc(`Ab ${rule.hours}h ${rule.minutes || 0}m → ${rule.pause} Minuten Pause`)
                .addText(t => t
                    .setPlaceholder("Stunden")
                    .setValue(String(rule.hours ?? 0))
                    .onChange(async v => {
                        rule.hours = Number(v) || 0;
                        await this.plugin.saveData(this.plugin.settings);
                    })
                )
                .addText(t => t
                    .setPlaceholder("Minuten")
                    .setValue(String(rule.minutes ?? 0))
                    .onChange(async v => {
                        rule.minutes = Number(v) || 0;
                        await this.plugin.saveData(this.plugin.settings);
                    })
                )
                .addText(t => t
                    .setPlaceholder("Pause (Minuten)")
                    .setValue(String(rule.pause ?? 0))
                    .onChange(async v => {
                        rule.pause = Number(v) || 0;
                        await this.plugin.saveData(this.plugin.settings);
                    })
                )
                .addButton(b => b
                    .setButtonText("❌")
                    .setWarning()
                    .onClick(async () => {
                        rules.splice(index, 1);
                        await this.plugin.saveData(this.plugin.settings);
                        this.display();
                    })
                );
        });

        // Neue Regel hinzufügen
        containerEl.createEl("h3", { text: "➕ Neue Regel hinzufügen" });

        let newHours = "";
        let newMinutes = "";
        let newPause = "";

        new Setting(containerEl)
            .setName("Neue Pausenregel")
            .addText(t => t
                .setPlaceholder("Stunden")
                .onChange(v => newHours = v.trim()))
            .addText(t => t
                .setPlaceholder("Minuten")
                .onChange(v => newMinutes = v.trim()))
            .addText(t => t
                .setPlaceholder("Pause in Minuten")
                .onChange(v => newPause = v.trim()))
            .addButton(b => b
                .setButtonText("💾 Hinzufügen")
                .onClick(async () => {
                    rules.push({
                        hours: Number(newHours) || 0,
                        minutes: Number(newMinutes) || 0,
                        pause: Number(newPause) || 0
                    });

                    rules.sort((a, b) =>
                        (Number(b.hours || 0) * 60 + Number(b.minutes || 0)) -
                        (Number(a.hours || 0) * 60 + Number(a.minutes || 0))
                    );

                    await this.plugin.saveData(this.plugin.settings);
                    new Notice("Pausenregel hinzugefügt");
                    this.display();
                })
            );

        // Feiertage anzeigen
        containerEl.createEl("h3", { text: "📅 Feiertage" });

        const holidays = await this.plugin.loadHolidaysObject();
        const year = new Date().getFullYear();
        const yearMap = holidays[year] || {};
        const customMap = holidays.custom || {};

        // Jahr-Feiertage
        Object.keys(yearMap).sort().forEach(d => {
            new Setting(containerEl)
                .setName(d)
                .setDesc(yearMap[d])
                .addButton(b => b.setButtonText("❌").onClick(async () => {
                    delete holidays[year][d];
                    await this.plugin.saveHolidaysObject(holidays);
                    this.saveAndRestoreScroll(() => this.display());
                }));
        });

        // Custom Feiertage
        if (Object.keys(customMap).length > 0) {
            containerEl.createEl("h3", { text: "🎈 Eigene freie Tage" });

            Object.keys(customMap).sort().forEach(d => {
                new Setting(containerEl)
                    .setName(d)
                    .setDesc(customMap[d])
                    .addButton(b => b.setButtonText("❌").onClick(async () => {
                        delete holidays.custom[d];
                        await this.plugin.saveHolidaysObject(holidays);
                        this.saveAndRestoreScroll(() => this.display());
                    }));
            });
        }

        // Feiertag hinzufügen
        let newDate = "";
        let newName = "";

        new Setting(containerEl)
            .setName("Feiertag hinzufügen")
            .setDesc("Neuen Feiertag zu 'custom' hinzufügen")
            .addText(t => t.setPlaceholder("YYYY-MM-DD").onChange(v => newDate = v.trim()))
            .addText(t => t.setPlaceholder("Name").onChange(v => newName = v.trim()))
            .addButton(b => b.setButtonText("💾 Speichern").onClick(async () => {
                if (!newDate || !newName) {
                    new Notice("Bitte Datum & Name eingeben");
                    return;
                }
                const data = await this.plugin.loadHolidaysObject();
                if (!data.custom) data.custom = {};
                data.custom[newDate] = newName.trim();
                await this.plugin.saveHolidaysObject(data);
                new Notice("Feiertag hinzugefügt");
                this.saveAndRestoreScroll(() => this.display());
            }));
    }
}

module.exports = WorktimeAutoUpdatePlusPlus;
