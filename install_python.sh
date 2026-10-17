#!/bin/bash
# DATEI: install_python.sh
# VERSION: 3.0 (Universal: Debian 10/11/12 Support)
# ZWECK: Installiert KI-Bibliotheken automatisch passend zum Systemalter

echo "=========================================="
echo "🤖 COGNI-LIVING PYTHON INSTALLER (V3.0)"
echo "=========================================="

ADAPTER_DIR="/opt/iobroker/node_modules/iobroker.cogni-living"
if [ -d "$ADAPTER_DIR" ]; then cd "$ADAPTER_DIR"; fi

# SCHRITT 1: Pip aktualisieren
echo "🔄 Prüfe Paket-Manager..."
sudo -u iobroker python3 -m pip install --upgrade pip 2>/dev/null

echo "🐍 Installiere KI-Bibliotheken..."

# --- STRATEGIE 1: MODERN (Debian 12 / Bookworm) ---
# Nutzt --break-system-packages für neue Python-Versionen
if sudo -u iobroker python3 -m pip install torch numpy pandas scikit-learn --break-system-packages 2>/dev/null; then
    echo "✅ Installation (Modern/Debian 12) erfolgreich."
    echo "   Bitte Instanz neu starten."
    exit 0
fi

# --- STRATEGIE 2: STANDARD (Debian 11 / Bullseye) ---
# Der klassische Weg für normale Systeme
if sudo -u iobroker python3 -m pip install torch numpy pandas scikit-learn 2>/dev/null; then
    echo "✅ Installation (Standard/Debian 11) erfolgreich."
    echo "   Bitte Instanz neu starten."
    exit 0
fi

# --- STRATEGIE 3: LEGACY (Debian 10 / Buster / Alte Hardware) ---
# Erzwingt ältere Versionen & Binaries (kein Kompilieren), wie wir es eben getestet haben.
echo "⚠️ Altes System erkannt. Nutze Legacy-Modus..."
if sudo -u iobroker python3 -m pip install "numpy<1.22" "pandas<1.4" "scikit-learn<1.1" torch --only-binary=:all:; then
    echo "✅ Installation (Legacy/Debian 10) erfolgreich."
    echo "   Bitte Instanz neu starten."
    exit 0
fi

# Wenn wir hier landen, ist das System wirklich am Ende
echo "❌ FEHLER: Keine kompatible Installation möglich."
exit 1