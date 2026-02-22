'use strict';

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const IS_WIN = process.platform === 'win32';

// --- NEW PATH STRATEGY (v0.29.31) ---
// Wir gehen aus dem 'node_modules'-Ordner raus und in 'iobroker-data'.
// Struktur: /opt/iobroker/node_modules/iobroker.cogni-living/lib/.. -> /opt/iobroker/node_modules/iobroker.cogni-living
// Davon 2 hoch -> /opt/iobroker
// Dann rein in -> iobroker-data/cogni-living
const ADAPTER_DIR = path.join(__dirname, '..');
const IOBROKER_ROOT = path.join(ADAPTER_DIR, '..', '..');
const DATA_DIR = path.join(IOBROKER_ROOT, 'iobroker-data', 'cogni-living');
const VENV_PATH = path.join(DATA_DIR, 'venv');

// Sicherstellen, dass der Daten-Ordner existiert
if (!fs.existsSync(DATA_DIR)) {
    try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {
        // Fallback falls Rechte fehlen, bleiben wir lokal (Notfall)
        console.error("Could not create data dir, falling back to local");
    }
}

// Pfade definieren
const PYTHON_EXE = IS_WIN ? path.join(VENV_PATH, 'Scripts', 'python.exe') : path.join(VENV_PATH, 'bin', 'python');

/**
 * Nur noch prüfen, NICHTS mehr installieren.
 * Wenn etwas fehlt -> Detaillierte Anleitung im Log ausgeben.
 */
function checkAndInstall(adapter, callback) {
    let isHealthy = false;
    let errorReason = "";

    // 1. Check: Existiert die Binary?
    if (fs.existsSync(PYTHON_EXE)) {
        try {
            // 2. Check: Ist sie ausführbar?
            execSync(`"${PYTHON_EXE}" --version`, { timeout: 5000 });

            // 3. Check: Sind die schweren Bibliotheken da?
            // Wir prüfen nur pandas & numpy, da diese am öftesten fehlen
            execSync(`"${PYTHON_EXE}" -c "import pandas; import numpy; print('libs_ok')"`, { timeout: 10000 });

            isHealthy = true;
        } catch (e) {
            errorReason = `Python existiert, aber Bibliotheken fehlen oder Absturz: ${e.message}`;
        }
    } else {
        errorReason = `Python Binary nicht gefunden unter: ${PYTHON_EXE}`;
    }

    if (isHealthy) {
        adapter.log.info(`✅ Python Environment detected & healthy (Persistent). Ready.`);
        if (callback) callback();
        return true;
    } else {
        // KEINE Installation. Aber eine PERFEKTE Anleitung im Log.
        // WICHTIG: Die Pfade in der Anleitung müssen jetzt auf den neuen DATA_DIR zeigen!
        adapter.log.error(`🛑 PYTHON UMGEBUNG FEHLT! (Manuelle Installation erforderlich)`);
        adapter.log.error(`-------------------------------------------------------------`);
        adapter.log.error(`WICHTIG: Speicherort wurde geändert auf 'iobroker-data', damit Updates nicht mehr alles löschen!`);
        adapter.log.error(`Bitte führen Sie diese Befehle einmalig in der Konsole (Putty) aus:`);
        adapter.log.error(``);
        // Wir nutzen hier absolute Pfade für Klarheit, assuming standard installation
        adapter.log.error(`1. mkdir -p /opt/iobroker/iobroker-data/cogni-living`);
        adapter.log.error(`2. cd /opt/iobroker/iobroker-data/cogni-living`);
        adapter.log.error(`3. sudo rm -rf venv`);
        adapter.log.error(`4. sudo python3 -m venv venv`);
        adapter.log.error(`   (Falls Fehler: "sudo apt install python3-venv python3-full")`);
        adapter.log.error(`5. sudo ./venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu --no-cache-dir`);

        // Der Pfad zur requirements.txt ist immer noch im Adapter-Ordner!
        adapter.log.error(`6. sudo ./venv/bin/pip install -r /opt/iobroker/node_modules/iobroker.cogni-living/python_service/requirements.txt --no-cache-dir`);

        adapter.log.error(`7. sudo chown -R iobroker:iobroker /opt/iobroker/iobroker-data/cogni-living`);
        adapter.log.error(`-------------------------------------------------------------`);
        adapter.log.error(`Grund für Abbruch: ${errorReason}`);

        return false;
    }
}

module.exports = {
    checkAndInstall,
    get PYTHON_EXE() { return PYTHON_EXE; }
};