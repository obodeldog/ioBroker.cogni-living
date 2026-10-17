#!/bin/bash
# Stoppt das Skript, falls ein Befehl fehlschlägt
set -e

echo "--- Starte Test-Umgebungs-Setup ---"

# 1. Javascript-Adapter installieren
echo "[SCHRITT 1/4] Installiere Javascript-Adapter..."
dev-server install javascript || { echo "FEHLER: Javascript-Installation fehlgeschlagen."; exit 1; }
echo "-> Javascript-Adapter installiert."

# 2. Javascript-Instanz aktivieren
echo "[SCHRITT 2/4] Aktiviere Instanz javascript.0..."
dev-server enable javascript.0 || { echo "FEHLER: Aktivierung von javascript.0 fehlgeschlagen."; exit 1; }
echo "-> Instanz javascript.0 aktiviert."

# 3. Test-Sensor Objekt erstellen
echo "[SCHRITT 3/4] Erstelle Test-Sensor '0_userdata.0.TestSensor'..."
dev-server exec -- iobroker object set 0_userdata.0.TestSensor --json '{
    "type": "state",
    "common": { "name": "TestSensor", "type": "boolean", "role": "sensor", "read": true, "write": true, "def": false },
    "native": {}
}' || { echo "FEHLER: Erstellung des Test-Sensors fehlgeschlagen."; exit 1; }
echo "-> Test-Sensor erstellt."

# 4. Test-Skript erstellen
echo "[SCHRITT 4/4] Erstelle Test-Skript 'common.Test-Trigger'..."
dev-server exec -- iobroker object set system.script.js.common.Test-Trigger --json '{
    "type": "script",
    "common": { "name": "Test-Trigger", "engineType": "Javascript/js", "source": "setState(\"0_userdata.0.TestSensor\", true, true);", "enabled": false, "engine": "system.adapter.javascript.0" },
    "native": {}
}' || { echo "FEHLER: Erstellung des Test-Skripts fehlgeschlagen."; exit 1; }
echo "-> Test-Skript erstellt."

echo "--- Setup erfolgreich abgeschlossen ---"
