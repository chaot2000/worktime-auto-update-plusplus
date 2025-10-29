/********************************************************************
 * 🕒 Worktime Auto Update++ v1.2.9
 * Autor: Sven Jakob
 * Beschreibung: Arbeitszeit + Feiertage mit konfigurierbarem Pfad
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

        // Statusleiste
        this.statusBar = this.addStatusBarItem();
        this.statusBar.setText("⏱ Lade Arbeitszeit...");
        await this.updateStatusBar(true);
        this.registerInterval(window.setInterval(() => this.updateStatusBar(false), 60000));

        // Commands
        this.addCommand({
            id: "recalculate-worktime",
            name: "⟳ Arbeitszeit neu berechnen",
            callback: () => this.updateStatusBar(false)
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

    // Arbeitszeit aktualisieren (live)
    async updateStatusBar(initial = false) {
        let startTime = new Date();
        try {
            const file = this.app.workspace.getActiveFile();
            if (file) {
                const content = await this.app.vault.read(file);
                const match = content.match(/work_start:\s*([\d\-T:]+)/);
                if (match) startTime = new Date(match[1]);
            }
        } catch (_) { }

        const now = new Date();
        const diffHours = (now - startTime) / 3600000;
        const h = Math.floor(diffHours);
        const m = Math.round((diffHours - h) * 60);
        this.statusBar.setText(`⏱ ${h}:${m.toString().padStart(2, "0")} h`);
        if (initial) this.statusBar.setAttr("title", "Worktime Auto Update++");
    }

    // Feiertage laden/speichern mit Adapter
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
        console.log("[Worktime++] Feiertage gespeichert:", file);
        new Notice("Feiertage gespeichert ✅");
    }

    async ensureHolidaysForYear(year = new Date().getFullYear()) {
        const obj = await this.loadHolidaysObject();
        obj[year] = this.generateHolidaysForState(year, this.settings.bundesland);
        await this.saveHolidaysObject(obj);
        new Notice(`Feiertage ${year} für ${DE_STATES[this.settings.bundesland]} generiert ✅`);
    }

    // === Feiertagsberechnung ===
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

    addDaysUTC(d, n) { const r = new Date(d.getTime()); r.setUTCDate(r.getUTCDate() + n); return r; }
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
        if (["BW","BY","ST"].includes(state)) H[`${year}-01-06`] = "Heilige Drei Könige";
        if (["BW","BY","HE","NW","RP","SL"].includes(state)) H[this.fmt(this.addDaysUTC(easter, +60))] = "Fronleichnam";
        if (["BB","MV","SN","ST","TH","SH","HB","HH","NI"].includes(state)) H[`${year}-10-31`] = "Reformationstag";
        if (["BW","BY","NW","RP","SL"].includes(state)) H[`${year}-11-01`] = "Allerheiligen";
        if (["BE","MV"].includes(state)) H[`${year}-03-08`] = "Internationaler Frauentag";
        if (state === "SN") {
            const d = new Date(Date.UTC(year, 10, 23));
            while (d.getUTCDay() !== 3) d.setUTCDate(d.getUTCDate() - 1);
            d.setUTCDate(d.getUTCDate() - 7);
            H[this.fmt(d)] = "Buß- und Bettag";
        }
        return H;
    }
}

// =================== Settings Tab ===================
class WorktimeSettingsTab extends PluginSettingTab {
    constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }

    // Scrollfix: speichert und stellt Scrollposition wieder her
    saveAndRestoreScroll(callback) {
        const scrollPos = this.containerEl.scrollTop;
        callback().then(() => {
            this.containerEl.scrollTop = scrollPos;
        });
    }

    async display() {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl("h2", { text: "⚙️ Worktime Auto Update++" });

        // === Pfad zu den Feiertagen ===
        new Setting(containerEl)
            .setName("Pfad zu den Feiertagen")
            .setDesc("JSON-Datei im Vault (z. B. meta/holidays.json). Wird automatisch angelegt.")
            .addText(t => t
                .setValue(this.plugin.settings.holidayPath)
                .onChange(async v => {
                    this.plugin.settings.holidayPath = v.trim() || "meta/holidays.json";
                    await this.plugin.saveData(this.plugin.settings);
                    new Notice(`Pfad gesetzt: ${this.plugin.settings.holidayPath}`);
                    this.saveAndRestoreScroll(() => this.display());
                })
            );

        // === Bundesland-Auswahl ===
        new Setting(containerEl)
            .setName("Bundesland")
            .setDesc("Feiertage werden für dieses Bundesland generiert.")
            .addDropdown(d => {
                Object.entries(DE_STATES).forEach(([k, l]) => d.addOption(k, l));
                d.setValue(this.plugin.settings.bundesland);
                d.onChange(async v => {
                    this.plugin.settings.bundesland = v;
                    await this.plugin.saveData(this.plugin.settings);
                    new Notice(`Bundesland: ${DE_STATES[v]}`);
                    this.saveAndRestoreScroll(() => this.display());
                });
            });

        // === Feiertage anzeigen ===
        containerEl.createEl("h3", { text: "📅 Feiertage" });

        const holidaysObj = await this.plugin.loadHolidaysObject();
        const year = new Date().getFullYear();
        const yearMap = holidaysObj[year] || {};
        const customMap = holidaysObj.custom || {};

        const yearDates = Object.keys(yearMap).sort();
        if (yearDates.length > 0) {
            yearDates.forEach(d => new Setting(containerEl)
                .setName(d)
                .setDesc(yearMap[d])
                .addButton(b => b.setButtonText("❌").onClick(async () => {
                    delete holidaysObj[year][d];
                    await this.plugin.saveHolidaysObject(holidaysObj);
                    this.saveAndRestoreScroll(() => this.display());
                })));
        }

        // === Custom-Feiertage ===
        if (Object.keys(customMap).length > 0) {
            containerEl.createEl("h3", { text: "🎈 Eigene freie Tage (custom)" });
            Object.keys(customMap).sort().forEach(d => {
                new Setting(containerEl)
                    .setName(d)
                    .setDesc(customMap[d])
                    .addButton(b => b.setButtonText("❌").onClick(async () => {
                        delete holidaysObj.custom[d];
                        await this.plugin.saveHolidaysObject(holidaysObj);
                        this.saveAndRestoreScroll(() => this.display());
                    }));
            });
        }

        // === Feiertag hinzufügen ===
        new Setting(containerEl)
            .setClass("holiday-add-section")
            .setName("Neuer Feiertag")
            .setDesc("Datum (YYYY-MM-DD) und Name eintragen (wird in „custom“ gespeichert):")
            .addText(t => t.setPlaceholder("YYYY-MM-DD").onChange(v => this.__newHolDate = v.trim()))
            .addText(t => t.setPlaceholder("Bezeichnung (z. B. Heiligabend)").onChange(v => this.__newHolName = v.trim()))
            .addButton(b => b.setButtonText("💾 Speichern").onClick(async () => {
                if (!this.__newHolDate || !/^\d{4}-\d{2}-\d{2}$/.test(this.__newHolDate)) {
                    new Notice("Bitte ein gültiges Datum (YYYY-MM-DD) eingeben.");
                    return;
                }
                if (!this.__newHolName?.trim()) {
                    new Notice("Bitte eine Bezeichnung eingeben.");
                    return;
                }
                const data = await this.plugin.loadHolidaysObject();
                if (!data.custom) data.custom = {};
                data.custom[this.__newHolDate] = this.__newHolName.trim();
                await this.plugin.saveHolidaysObject(data);
                new Notice(`Feiertag hinzugefügt: ${this.__newHolDate} – ${this.__newHolName}`);
                this.__newHolDate = ""; this.__newHolName = "";
                this.saveAndRestoreScroll(() => this.display());
            }));

        // === Pausenregeln ===
        containerEl.createEl("h3", { text: "🕒 Pausenregeln" });
        this.plugin.settings.pauseRules.forEach((r, i) => new Setting(containerEl)
            .setName(`Regel ${i + 1}`)
            .setDesc(`Ab ${r.hours} h → ${r.pause} min`)
            .addText(t => t.setValue(String(r.hours)).onChange(v => r.hours = parseFloat(v)))
            .addText(t => t.setValue(String(r.pause)).onChange(v => r.pause = parseFloat(v)))
            .addButton(b => b.setButtonText("❌").onClick(async () => {
                this.plugin.settings.pauseRules.splice(i, 1);
                await this.plugin.saveData(this.plugin.settings);
                this.saveAndRestoreScroll(() => this.display());
            })));

        new Setting(containerEl)
            .addButton(b => b.setCta().setButtonText("+ Regel hinzufügen").onClick(async () => {
                this.plugin.settings.pauseRules.push({ hours: 8, pause: 30 });
                await this.plugin.saveData(this.plugin.settings);
                this.saveAndRestoreScroll(() => this.display());
            }));

        // === Aktionen ===
        containerEl.createEl("h3", { text: "⚡ Aktionen" });
        new Setting(containerEl)
            .setName("Feiertage generieren (akt. Jahr)")
            .setDesc("Erzeugt/überschreibt die Datei am konfigurierten Pfad für das ausgewählte Bundesland.")
            .addButton(b => b
                .setCta()
                .setButtonText("📅 Generieren")
                .onClick(async () => {
                    await this.plugin.ensureHolidaysForYear();
                    this.saveAndRestoreScroll(() => this.display());
                }));
    }
}

module.exports = WorktimeAutoUpdatePlusPlus;
