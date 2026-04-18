/**
 * Repariert HANDBUCH.md: Lag als Windows-1252 / falsch gespeicherter Text vor.
 * Schritt 1: iconv-lite windows-1252 → UTF-8 String
 * Schritt 2: Platzhalter ? / ?? wo Emojis zerstört wurden → wiederherstellen
 */
'use strict';

const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

const HAND = path.join(__dirname, '..', '_internal', 'HANDBUCH.md');

let s = iconv.decode(fs.readFileSync(HAND), 'windows-1252');

/** Ersetzt in dieser Reihenfolge (längere Treffer zuerst wo nötig) */
const replacements = [
  ['## ??? FRONTEND-KACHELN INVENTAR — Alle Tooltip-Texte (1:1 aus Code)',
    '## 🗂️ FRONTEND-KACHELN INVENTAR — Alle Tooltip-Texte (1:1 aus Code)'],
  ['## ?? RECHTLICHER HINWEIS', '## 🚨 RECHTLICHER HINWEIS'],
  ['## ?? ALGORITHMUS-DOKUMENTATION — SCHLAFANALYSE (OC-7)',
    '## 📐 ALGORITHMUS-DOKUMENTATION — SCHLAFANALYSE (OC-7)'],
  ['## ?? SCHLAFANALYSE (OC-7)', '## 📊 SCHLAFANALYSE (OC-7)'],
  ['## ?? SENSOR-KONFIGURATION', '## 🔧 SENSOR-KONFIGURATION'],
  ['## ?? SENSOR-VORAUSSETZUNGEN JE SCHLAFKACHEL-ELEMENT',
    '## 📌 SENSOR-VORAUSSETZUNGEN JE SCHLAFKACHEL-ELEMENT'],
  ['## ?? OC-10: SCHLAF-SCORE WOCHENANSICHT *(ab v0.33.63)*',
    '## 📊 OC-10: SCHLAF-SCORE WOCHENANSICHT *(ab v0.33.63)*'],
  ['## ?? LITERATURVERZEICHNIS', '## 📚 LITERATURVERZEICHNIS'],
  ['## ?? OFFENE DOKUMENTATIONSTHEMEN', '## 📋 OFFENE DOKUMENTATIONSTHEMEN'],

  ['Status: ? = Tooltip vorhanden | ?? = Kein Tooltip (TODO)',
    'Status: ✅ = Tooltip vorhanden | ⚠️ = Kein Tooltip (TODO)'],

  ['| ?? (voll) | Vaginal — vom Sensor erkannt |', '| 🌹 (voll) | Vaginal — vom Sensor erkannt |'],
  ['| ?? (blass) | Vaginal — nur manuell eingetragen |', '| 🌹 (blass) | Vaginal — nur manuell eingetragen |'],
  ['| ?? (voll) | Oral/Hand — vom Sensor erkannt |', '| 💋 (voll) | Oral/Hand — vom Sensor erkannt |'],
  ['| ?? (blass) | Oral/Hand — nur manuell eingetragen |', '| 💋 (blass) | Oral/Hand — nur manuell eingetragen |'],
  ['| ? | Nicht klassifiziert (erkannt, aber Typ unklar) |', '| ❔ | Nicht klassifiziert (erkannt, aber Typ unklar) |'],
  ['| ? | Nullnummer — Fehlauslösung, zählt nicht als Session |', '| 🚫 | Nullnummer — Fehlauslösung, zählt nicht als Session |'],
  ['| ??×2 | 2 erkannte Fragmente (Sensor teilte Session auf) |', '| ⚡×2 | 2 erkannte Fragmente (Sensor teilte Session auf) |'],
  ['**Was beim Klick auf "?? Nullnummer" passiert:**',
    '**Was beim Klick auf „🚫 Nullnummer“ passiert:**'],
  ['**Nicht hier:** Deploy-Schritte, Bugfixes ? PROJEKT_STATUS.md | Ideen ? BRAINSTORMING.md',
    '**Nicht hier:** Deploy-Schritte, Bugfixes → PROJEKT_STATUS.md | Ideen → BRAINSTORMING.md'],
  ['**Stand:** v0.33.144 | **Kein Medizinprodukt** ? ausschließlich zur persönlichen Dokumentation.',
    '**Stand:** v0.33.144 | **Kein Medizinprodukt** — ausschließlich zur persönlichen Dokumentation.'],

  ['> Einschlafzeit (??): Letzte FP2-Bettbelegung', '> Einschlafzeit (📡): Letzte FP2-Bettbelegung'],
  ['> Aufwachzeit (??): Erste Bettleere', '> Aufwachzeit (📡): Erste Bettleere'],
];

for (const [from, to] of replacements) {
  if (!s.includes(from)) {
    console.warn('WARN: Muster nicht gefunden (bereits gefixt oder Text geändert?):', from.slice(0, 72) + '…');
  }
  s = s.split(from).join(to);
}

/** Tabellen: erste Spalte war 📡 im Original (Git ff.) */
s = s.split('| ?? |').join('| 📡 |');
/** gap60 Sonderfall */
s = s.split('| ⚠️ | ⚠️ | ⚠️ | `gap60`').join('| ⚠️ | `gap60`');
if (s.includes('| 📡 | 📡 | 📡 | `gap60`')) {
  s = s.split('| 📡 | 📡 | 📡 | `gap60`').join('| ⚠️ | `gap60`');
}
if (s.includes('| 📡 | 📡 | `gap60`')) {
  // falls nur doppelt ersetzt — korrigiere erste Zeile gap60 auf Warnung
  s = s.replace(/\| 📡 \| 📡 \| `gap60` \| \*\*Schlafzimmer-Aktivitätspause\*\*/, '| ⚠️ | `gap60` | **Schlafzimmer-Aktivitätspause**');
}

/** Dreifach ? vor gap60 manuell */
if (s.includes('| ??? | `gap60`')) {
  s = s.split('| ??? | `gap60`').join('| ⚠️ | `gap60`');
}

/** Aktiv-Spalte */
s = s.split('| ? aktiv').join('| ✅ aktiv');

/** Typische Zerstörung „mit ?“ wie „Radar-Bett belegt ?“ → Mittelpunkt vor Forward-Scan */
s = s.split('belegt ? **Forward-Scan**').join('belegt · **Forward-Scan**');
s = s.split('Außenaktiv.?').join('Außenaktivität');
s = s.split(' ohne 30-Min-Folgeaktivität ? erster').join(' ohne 30-Min-Folgeaktivität → erster');

/** ``?? kein Sensor`` aus Logs */
if (s.includes('`?? kein Sensor`')) {
  s = s.split('`?? kein Sensor`').join('`⚠️ kein Sensor`');
}

/** Restliche häufige Artefakte */
s = s.replace(/\| \?\? \| `last_outside`/g, '| 📡 | `last_outside`');
s = s.replace(/\| \?\? \| `haus_still`/g, '| 📡 | `haus_still`');

fs.writeFileSync(HAND, '\ufeff' + s, 'utf8');
console.log('OK:', HAND, 'UTF-8 mit BOM geschrieben, Zeichen:', s.length);
