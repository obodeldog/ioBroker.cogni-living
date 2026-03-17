/**
 * AURA � Medizinische Krankheitsprofile
 * Definiert Sensor-Anforderungen und Validierungslogik fuer jedes Krankheitsbild.
 */

export interface DeviceConfig {
    id: string;
    name: string;
    location: string;
    type: string;
    logDuplicates: boolean;
    isExit: boolean;
    isSolar?: boolean;
    isHallway?: boolean;
    isNightSensor?: boolean;
    isBathroomSensor?: boolean;
    isKitchenSensor?: boolean;
    isFP2Bed?: boolean;
    isFP2Living?: boolean;
    isVibrationBed?: boolean;
    sensorFunction?: string;
}

export interface SensorRequirement {
    key: string;
    label: string;
    description: string;
    optional: boolean;
    check: (devices: DeviceConfig[]) => boolean;
    missingHint: string;
}

export interface DiseaseProfile {
    id: string;
    label: string;
    shortLabel: string;
    color: string;
    targetGroup: 'senior' | 'adult' | 'child' | 'all';
    marketScore1P: number;
    marketScoreMP: number;
    multiPersonFeasibility: 'good' | 'partial' | 'difficult' | 'na';
    description: string;
    clinicalBasis: string;
    requiredSensors: SensorRequirement[];
    optionalSensors: SensorRequirement[];
    relevantMetrics: string[];
    needsFP2: boolean;
}

export interface ValidationResult {
    profileId: string;
    readinessPercent: number;
    readinessLevel: 'green' | 'yellow' | 'red' | 'unconfigured';
    presentRequired: SensorRequirement[];
    missingRequired: SensorRequirement[];
    presentOptional: SensorRequirement[];
    missingOptional: SensorRequirement[];
}

// Sensor-Check-Hilfsfunktionen
const MOTION_TYPES = ['motion', 'bewegung', 'praesenz', 'presence', 'occupancy'];
const DOOR_TYPES   = ['door', 'tuer', 'window', 'fenster', 'contact', 'kontakt'];

function hasMotionSensors(devices: DeviceConfig[], minCount = 1): boolean {
    return devices.filter(d => MOTION_TYPES.some(k => (d.type || '').toLowerCase().includes(k))).length >= minCount;
}
function hasDoorSensors(devices: DeviceConfig[], minCount = 1): boolean {
    return devices.filter(d => DOOR_TYPES.some(k => (d.type || '').toLowerCase().includes(k))).length >= minCount;
}
// sensorFunction-Shortcut: wie getEffectiveSF in SensorList (inkl. Legacy-Flags)
function sf(d: DeviceConfig): string {
    if (d.sensorFunction) return (d.sensorFunction as string).toLowerCase();
    if (d.isKitchenSensor)  return 'kitchen';
    if (d.isBathroomSensor) return 'bathroom';
    if (d.isHallway)        return 'hallway';
    if (d.isNightSensor)    return 'bed';
    return '';
}
// Umlaut-Normalisierung fuer location-Vergleiche
function normLoc(s: string): string {
    return s.toLowerCase().replace(/ü/g, 'ue').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ß/g, 'ss');
}
function hasFP2(devices: DeviceConfig[]): boolean {
    return devices.some(d => (d.type || '').toLowerCase().includes('presence_radar'));
}
function hasVibrationSensor(devices: DeviceConfig[]): boolean {
    return devices.some(d => (d.type || '').toLowerCase().includes('vibration') && sf(d) === 'bed');
}

function hasHallwaySensor(devices: DeviceConfig[]): boolean {
    return devices.some(d => d.isHallway === true || sf(d) === 'hallway');
}
function hasExitSensor(devices: DeviceConfig[]): boolean {
    return devices.some(d => d.isExit === true);
}
function hasNightSensor(devices: DeviceConfig[]): boolean {
    if (devices.some(d => d.isNightSensor === true || sf(d) === 'bed')) return true;
    const kw = ['schlaf', 'bedroom', 'nacht', 'night', 'kinderzimmer'];
    return devices.some(d => kw.some(k => normLoc(d.location || '').includes(k)));
}
function hasBathroomSensor(devices: DeviceConfig[]): boolean {
    if (devices.some(d => d.isBathroomSensor === true || sf(d) === 'bathroom')) return true;
    const kw = ['bad', 'wc', 'toilet', 'bath', 'dusche', 'shower'];
    return devices.some(d => kw.some(k => normLoc(d.location || '').includes(k)));
}
function hasKitchenSensor(devices: DeviceConfig[]): boolean {
    if (devices.some(d => sf(d) === 'kitchen')) return true;
    const kw = ['kueche', 'kuech', 'kitchen', 'koch'];
    return devices.some(d =>
        MOTION_TYPES.some(t => (d.type || '').toLowerCase().includes(t)) &&
        kw.some(k => normLoc(d.location || '').includes(k))
    );
}

export const DISEASE_PROFILES: DiseaseProfile[] = [
    {
        id: 'fallRisk', label: 'Sturzrisiko', shortLabel: 'Sturz', color: '#f44336',
        targetGroup: 'senior', marketScore1P: 98, marketScoreMP: 90, multiPersonFeasibility: 'good',
        description: 'Ueberwacht Ganggeschwindigkeit, Bad-Aufenthalte und Inaktivitaetsphasen als Indikatoren fuer erhoehtes Sturzrisiko.',
        clinicalBasis: 'Ganggeschwindigkeit < 0,8 m/s gilt als klinischer Praediktor fuer Sturzrisiko (Guralnik et al., NEJM 1995).',
        relevantMetrics: ['gaitSpeed', 'nightRestlessness', 'roomSilence', 'activityLevel'],
        needsFP2: false,
        requiredSensors: [
            { key: 'hallway', label: 'Flur-Sensor (isHallway)', description: 'Fuer Ganggeschwindigkeit zwingend', optional: false, check: hasHallwaySensor, missingHint: 'System \u2192 Sensoren \u2192 Checkbox "Flur?" aktivieren.' },
            { key: 'bathroom', label: 'Bad-Sensor', description: 'Bad-Aufenthalte fuer Sturz-Erkennung', optional: false, check: hasBathroomSensor, missingHint: 'Sensor im Bad hinzufuegen und als Bad-Sensor markieren.' },
            { key: 'motion3', label: 'Bewegungsmelder (mind. 3)', description: 'Raumdeckung fuer Inaktivitaets-Erkennung', optional: false, check: (d) => hasMotionSensors(d, 3), missingHint: 'Bewegungsmelder in Wohnzimmer, Kueche, Schlafzimmer benoetigt.' }
        ],
        optionalSensors: [
            { key: 'nightSensor', label: 'Schlafzimmer-Sensor', description: 'Naechtliche Stuerze erkennen', optional: true, check: hasNightSensor, missingHint: 'Sensor im Schlafzimmer als Nacht-Sensor markieren.' },
            { key: 'fp2', label: 'Aqara FP2 (Sturzerkennung)', description: 'Dedizierte Sturzerkennung via mmWave-Radar', optional: true, check: hasFP2, missingHint: 'Aqara FP2 an der Decke \u2014 direkte Sturzerkennung. ~70\u20ac.' }
        ]
    },
    {
        id: 'dementia', label: 'Demenz-Monitoring', shortLabel: 'Demenz', color: '#9c27b0',
        targetGroup: 'senior', marketScore1P: 97, marketScoreMP: 49, multiPersonFeasibility: 'difficult',
        description: 'Erkennt Demenz-Muster: naechtliches Wandering, Sundowning, Gangverlangsamung und veraenderte Tagesstruktur.',
        clinicalBasis: 'Naechtliches Wandering betrifft 60-80% der Demenzpatienten (McCurry et al., 2004). Gangverlangsamung >5%/Jahr ist Fruehindikator (Buracchio et al., Arch Neurology 2010).',
        relevantMetrics: ['nightRestlessness', 'gaitSpeed', 'roomMobility', 'activityDrift', 'heatmap'],
        needsFP2: true,
        requiredSensors: [
            { key: 'nightSensor', label: 'Schlafzimmer-Sensor (isNightSensor)', description: 'Naechtliche Aktivitaet fuer Wandering-Erkennung', optional: false, check: hasNightSensor, missingHint: 'Sensor im Schlafzimmer als Nacht-Sensor markieren.' },
            { key: 'hallway', label: 'Flur-Sensor (isHallway)', description: 'Ganggeschwindigkeit und Wandering-Erkennung', optional: false, check: hasHallwaySensor, missingHint: 'System \u2192 Sensoren \u2192 Checkbox "Flur?" aktivieren.' },
            { key: 'exit', label: 'Ausgangstuer-Kontakt (isExit)', description: 'Wandering-out-Erkennung (Nacht-Exit)', optional: false, check: hasExitSensor, missingHint: 'Kontaktsensor an Haustuer als "Ausgang" markieren.' },
            { key: 'motion3', label: 'Bewegungsmelder (mind. 3)', description: 'Alle Hauptraeume fuer vollstaendige Erkennung', optional: false, check: (d) => hasMotionSensors(d, 3), missingHint: 'Bewegungsmelder in Wohnzimmer, Kueche, Schlafzimmer.' }
        ],
        optionalSensors: [
            { key: 'kitchen', label: 'Kuechen-Sensor', description: 'Vergessene Mahlzeiten erkennen', optional: true, check: hasKitchenSensor, missingHint: 'Bewegungsmelder in der Kueche.' },
            { key: 'fp2multi', label: 'Aqara FP2 (Multi-Person)', description: 'Fuer Mehrpersonenhaushalt: trennt Patient von Begleitperson', optional: true, check: hasFP2, missingHint: 'Aqara FP2 ermoeglicht Multi-Person-Tracking. ~70\u20ac/Raum.' }
        ]
    },
    {
        id: 'frailty', label: 'Frailty-Syndrom', shortLabel: 'Frailty', color: '#ff9800',
        targetGroup: 'senior', marketScore1P: 92, marketScoreMP: 46, multiPersonFeasibility: 'difficult',
        description: 'Ueberwacht die 3 passiv messbaren Fried-Frailty-Kriterien: Gangverlangsamung, Aktivitaetsrueckgang, Erschoepfung.',
        clinicalBasis: 'Fried Frailty Phenotype (Fried et al., J Gerontol 2001). Passiv messbar: Ganggeschwindigkeit, Aktivitaetslevel, Ruhezeiten.',
        relevantMetrics: ['gaitSpeed', 'activityLevel', 'roomMobility', 'activityDrift'],
        needsFP2: false,
        requiredSensors: [
            { key: 'hallway', label: 'Flur-Sensor (isHallway)', description: 'Ganggeschwindigkeit ist Kern-Frailty-Indikator', optional: false, check: hasHallwaySensor, missingHint: 'Flur-Sensor in System \u2192 Sensoren als "Flur?" markieren.' },
            { key: 'motion2', label: 'Bewegungsmelder (mind. 2)', description: 'Aktivitaetslevel und Raum-Mobilitaet', optional: false, check: (d) => hasMotionSensors(d, 2), missingHint: 'Mindestens 2 Bewegungsmelder in verschiedenen Raeumen.' }
        ],
        optionalSensors: [
            { key: 'exit', label: 'Ausgangstuer-Kontakt', description: 'Aktivitaet ausser Haus als Mobilitaets-Indikator', optional: true, check: hasExitSensor, missingHint: 'Haustuer-Kontaktsensor als "Ausgang" markieren.' }
        ]
    },
    {
        id: 'depression', label: 'Depression', shortLabel: 'Depression', color: '#607d8b',
        targetGroup: 'adult', marketScore1P: 75, marketScoreMP: 38, multiPersonFeasibility: 'difficult',
        description: 'Erkennt Depressionsindikatoren: Aktivitaetsrueckgang, sozialer Rueckzug, Hygiene-Vernachlaessigung, veraenderte Schlafmuster.',
        clinicalBasis: 'Psychomotorische Verlangsamung und Rueckzugsverhalten sind Kernsymptome. Passiv messbar (Meng et al., IEEE JBHI 2020).',
        relevantMetrics: ['activityLevel', 'roomMobility', 'hygieneFrequency', 'ventilationBehavior', 'nightRestlessness'],
        needsFP2: false,
        requiredSensors: [
            { key: 'exit', label: 'Ausgangstuer-Kontakt (isExit)', description: 'Sozialer Rueckzug = weniger Ausgehen', optional: false, check: hasExitSensor, missingHint: 'Kontaktsensor an Haustuer als "Ausgang" markieren.' },
            { key: 'motion2', label: 'Bewegungsmelder (mind. 2)', description: 'Aktivitaetslevel und Raum-Mobilitaet', optional: false, check: (d) => hasMotionSensors(d, 2), missingHint: 'Mindestens 2 Bewegungsmelder.' }
        ],
        optionalSensors: [
            { key: 'bathroom', label: 'Bad-Sensor (Hygiene)', description: 'Hygiene-Vernachlaessigung als Signal', optional: true, check: hasBathroomSensor, missingHint: 'Bad-Sensor fuer Hygiene-Frequenz-Tracking.' },
            { key: 'ventilation', label: 'Fenster-Kontakte (Lueftung)', description: 'Rueckgang der Belueftung als Signal', optional: true, check: hasDoorSensors, missingHint: 'Kontaktsensoren an Fenstern.' }
        ]
    },
    {
        id: 'diabetes2', label: 'Diabetes Typ 2', shortLabel: 'Diabetes T2', color: '#00bcd4',
        targetGroup: 'senior', marketScore1P: 80, marketScoreMP: 60, multiPersonFeasibility: 'partial',
        description: 'Ueberwacht Nykturie (haeufige naechtliche Toilettenbesuche) und veraenderte Essensrhythmen.',
        clinicalBasis: 'Nykturie betrifft >50% der Typ-2-Diabetiker (van Dijk et al., Diabetologia 2006). >2x naechtlich diagnostisch relevant.',
        relevantMetrics: ['nightRestlessness', 'hygieneFrequency', 'activityLevel'],
        needsFP2: false,
        requiredSensors: [
            { key: 'bathroom', label: 'Bad-Sensor (zwingend)', description: 'Nykturie-Erkennung', optional: false, check: hasBathroomSensor, missingHint: 'Bad-Sensor hinzufuegen und als Bad-Sensor markieren.' },
            { key: 'nightSensor', label: 'Schlafzimmer-Sensor', description: 'Nacht-Events fuer Nykturie-Korrelation', optional: false, check: hasNightSensor, missingHint: 'Sensor im Schlafzimmer als Nacht-Sensor markieren.' }
        ],
        optionalSensors: [
            { key: 'kitchen', label: 'Kuechen-Sensor', description: 'Naechtliche Kuechen-Besuche (Hypoglykamie)', optional: true, check: hasKitchenSensor, missingHint: 'Bewegungsmelder in der Kueche.' }
        ]
    },
    {
        id: 'sleepDisorder', label: 'Schlafst�rungen', shortLabel: 'Schlaf', color: '#3f51b5',
        targetGroup: 'all', marketScore1P: 78, marketScoreMP: 59, multiPersonFeasibility: 'partial',
        description: 'Analysiert Einschlaflatenz, Schlaf-Fragmentierung, fruehes Erwachen und zirkadiane Verschiebungen.',
        clinicalBasis: 'Insomnie betrifft 10-15% der Bevoelkerung chronisch. Passives Monitoring ermoeglicht objektive Schlafanalyse (Bianchi et al., J Clin Sleep Med 2020).',
        relevantMetrics: ['nightRestlessness', 'heatmap', 'activityLevel'],
        needsFP2: false,
        requiredSensors: [
            { key: 'nightSensor', label: 'Schlafzimmer-Sensor (isNightSensor)', description: 'Schlaf-Phasen-Erkennung', optional: false, check: hasNightSensor, missingHint: 'Sensor im Schlafzimmer als Nacht-Sensor markieren.' }
        ],
        optionalSensors: [
            { key: 'bathroom', label: 'Bad-Sensor (WASO)', description: 'Naechtliche Unterbrechungen durch Toilettenbesuche', optional: true, check: hasBathroomSensor, missingHint: 'Bad-Sensor fuer Wake-After-Sleep-Onset-Erkennung.' },
            { key: 'fp2sleep', label: 'Aqara FP2 (Schlaf-Monitoring)', description: 'Dediziertes Schlaf-Monitoring via mmWave', optional: true, check: hasFP2, missingHint: 'Aqara FP2 im Schlafzimmer fuer praezises Schlaf-Staging. ~70\u20ac.' }
        ]
    },
    {
        id: 'cardiovascular', label: 'Herzinsuffizienz', shortLabel: 'Herzinsuff.', color: '#e91e63',
        targetGroup: 'senior', marketScore1P: 75, marketScoreMP: 38, multiPersonFeasibility: 'difficult',
        description: 'Erkennt Belastungsintoleranz, Nykturie durch Fluessigkeitsumverteilung und ploetzliche Aktivitaetseinbrueche.',
        clinicalBasis: 'Haeusliches Aktivitaetsmonitoring ermoeglicht Frueherkennung von Dekompensationen (Abraham et al., J Am Coll Cardiol 2011). Re-Hospitalisierungsrate -30% moeglich.',
        relevantMetrics: ['activityLevel', 'gaitSpeed', 'nightRestlessness', 'hygieneFrequency'],
        needsFP2: false,
        requiredSensors: [
            { key: 'hallway', label: 'Flur-Sensor (isHallway)', description: 'Ganggeschwindigkeit als Belastungstoleranz-Indikator', optional: false, check: hasHallwaySensor, missingHint: 'Flur-Sensor markieren.' },
            { key: 'motion2', label: 'Bewegungsmelder (mind. 2)', description: 'Aktivitaetslevel fuer Belastungstoleranz', optional: false, check: (d) => hasMotionSensors(d, 2), missingHint: 'Mindestens 2 Bewegungsmelder.' }
        ],
        optionalSensors: [
            { key: 'bathroom', label: 'Bad-Sensor (Nykturie)', description: 'Fluessigkeitsumverteilung bei Herzinsuffizienz', optional: true, check: hasBathroomSensor, missingHint: 'Bad-Sensor fuer Nykturie-Erkennung.' }
        ]
    },
    {
        id: 'parkinson', label: 'Parkinson', shortLabel: 'Parkinson', color: '#795548',
        targetGroup: 'senior', marketScore1P: 65, marketScoreMP: 52, multiPersonFeasibility: 'partial',
        description: 'Ueberwacht Bradykinesie (verlangsamte Bewegung), Freezing of Gait und REM-Schlaf-Verhaltenstoerungen.',
        clinicalBasis: 'Ganggeschwindigkeit ist sensitivster Biomarker bei Parkinson (Lord et al., Mov Disord 2011). Flur-Transitzeiten > 2 SD ueber Baseline weisen auf Bradykinesie hin.',
        relevantMetrics: ['gaitSpeed', 'nightRestlessness', 'hygieneFrequency'],
        needsFP2: false,
        requiredSensors: [
            { key: 'hallway', label: 'Flur-Sensor (isHallway) � ZWINGEND', description: 'Ganggeschwindigkeit ist Kern-Biomarker', optional: false, check: hasHallwaySensor, missingHint: 'Ohne Flur-Sensor ist Parkinson-Monitoring nicht sinnvoll.' }
        ],
        optionalSensors: [
            { key: 'nightSensor', label: 'Schlafzimmer-Sensor (REM)', description: 'REM-Schlaf-Verhaltenstoerung ist Parkinson-Fruehzeichen', optional: true, check: hasNightSensor, missingHint: 'Schlafzimmer-Sensor fuer REM-Schlaf-Anomalie-Erkennung.' },
            { key: 'bathroom', label: 'Bad-Sensor (Feinmotorik)', description: 'Verlaengerte Bad-Aufenthalte durch Feinmotorik-Probleme', optional: true, check: hasBathroomSensor, missingHint: 'Bad-Sensor fuer Verweildauer-Tracking.' }
        ]
    },
    {
        id: 'copd', label: 'COPD', shortLabel: 'COPD', color: '#009688',
        targetGroup: 'senior', marketScore1P: 72, marketScoreMP: 36, multiPersonFeasibility: 'difficult',
        description: 'Erkennt Exazerbationen durch ploetzlichen Aktivitaetseinbruch und veraendertes Lueftungsverhalten.',
        clinicalBasis: 'Haeusliche Aktivitaetsabnahme ist Fruehwarnzeichen vor COPD-Exazerbation (Donaire-Gonzalez et al., Thorax 2015).',
        relevantMetrics: ['activityLevel', 'ventilationBehavior', 'activityDrift'],
        needsFP2: false,
        requiredSensors: [
            { key: 'motion2', label: 'Bewegungsmelder (mind. 2)', description: 'Aktivitaetslevel bei Exazerbation', optional: false, check: (d) => hasMotionSensors(d, 2), missingHint: 'Mindestens 2 Bewegungsmelder.' },
            { key: 'ventilation', label: 'Fenster-/Tuerensensoren', description: 'Lueftungsverhalten als COPD-Korrelat', optional: false, check: hasDoorSensors, missingHint: 'Kontaktsensoren an Fenstern fuer Lueftungs-Tracking.' }
        ],
        optionalSensors: [
            { key: 'hallway', label: 'Flur-Sensor (Ganggeschwindigkeit)', description: 'Belastungsdyspnoe zeigt sich im Gang', optional: true, check: hasHallwaySensor, missingHint: 'Flur-Sensor fuer Ganggeschwindigkeit.' }
        ]
    },
    {
        id: 'socialIsolation', label: 'Soziale Isolation', shortLabel: 'Isolation', color: '#8bc34a',
        targetGroup: 'senior', marketScore1P: 70, marketScoreMP: 7, multiPersonFeasibility: 'na',
        description: 'Erkennt sozialen Rueckzug: abnehmende Ausgeh-Frequenz, monotoner Tagesablauf, eingeschraenkter Aktionsradius.',
        clinicalBasis: 'Soziale Isolation erhoeh Mortalitaetsrisiko um 29% (Holt-Lunstad et al., Perspect Psychol Sci 2015).',
        relevantMetrics: ['activityLevel', 'roomMobility'],
        needsFP2: false,
        requiredSensors: [
            { key: 'exit', label: 'Ausgangstuer-Kontakt (isExit) � ZWINGEND', description: 'Exit-Frequenz-Trend ist Kern-Indikator', optional: false, check: hasExitSensor, missingHint: 'Kontaktsensor an der Haustuer als "Ausgang" markieren.' }
        ],
        optionalSensors: [
            { key: 'motion2', label: 'Bewegungsmelder (mind. 2)', description: 'Monotoner Tagesablauf durch zu geringe Variabilitaet', optional: true, check: (d) => hasMotionSensors(d, 2), missingHint: 'Mehrere Bewegungsmelder fuer Raum-Mobilitaets-Analyse.' }
        ]
    },
    {
        id: 'epilepsy', label: 'Epilepsie', shortLabel: 'Epilepsie', color: '#ff5722',
        targetGroup: 'child', marketScore1P: 68, marketScoreMP: 76, multiPersonFeasibility: 'good',
        description: 'Naechtliche Anfallsueberwachung: erkennt tonisch-klonische Anfaelle und postiktale Phasen.',
        clinicalBasis: '70-80% der Anfaelle bei Kindern nachts. SUDEP-Risiko durch Nacht-Monitoring reduzierbar (Ryvlin et al., Lancet Neurology 2013).',
        relevantMetrics: ['nightRestlessness', 'roomSilence'],
        needsFP2: true,
        requiredSensors: [
            { key: 'nightSensor', label: 'Sensor im Kinderzimmer (isNightSensor)', description: 'Naechtliche Bewegungsauffaelligkeiten im Schlafbereich', optional: false, check: hasNightSensor, missingHint: 'Sensor im Kinderzimmer als Nacht-Sensor markieren.' }
        ],
        optionalSensors: [
            { key: 'fp2ceiling', label: 'Aqara FP2 (Decke, Kinderzimmer)', description: 'mmWave-Radar erkennt rhythmische Koerperbewegungen', optional: true, check: hasFP2, missingHint: 'Aqara FP2 an der Decke im Kinderzimmer. ~70\u20ac.' },
            { key: 'vibration', label: 'Vibrationssensor am Bett', description: 'Aqara Vibration Sensor fuer rhythmische Bett-Vibrationen', optional: true, check: hasVibrationSensor, missingHint: 'Aqara Smart Vibration Sensor am Bettgestell. ~12\u20ac.' }
        ]
    },
    {
        id: 'diabetes1', label: 'Diabetes Typ 1', shortLabel: 'Diabetes T1', color: '#2196f3',
        targetGroup: 'child', marketScore1P: 65, marketScoreMP: 72, multiPersonFeasibility: 'good',
        description: 'Ueberwacht naechtliche Hypoglykamie-Indikatoren: Unruhe, naechtliche Kuechen-Besuche (Heisshunger), Bewusstlosigkeit.',
        clinicalBasis: 'Dead-in-Bed-Syndrom: haeufigste Todesursache bei jungen T1D-Patienten im Schlaf (Tanenberg et al., Diabetes Care 2010).',
        relevantMetrics: ['nightRestlessness', 'roomSilence'],
        needsFP2: true,
        requiredSensors: [
            { key: 'nightSensor', label: 'Sensor im Kinderzimmer (isNightSensor)', description: 'Hypoglykamie-bedingte Unruhe oder Bewusstlosigkeit', optional: false, check: hasNightSensor, missingHint: 'Sensor im Kinderzimmer als Nacht-Sensor markieren.' }
        ],
        optionalSensors: [
            { key: 'kitchen', label: 'Kuechen-Sensor (Hypoglykamie)', description: 'Naechtliche Kuechen-Besuche = Heisshunger durch Hypoglykamie', optional: true, check: hasKitchenSensor, missingHint: 'Bewegungsmelder in der Kueche.' },
            { key: 'fp2bed', label: 'Aqara FP2 (Kinderzimmer, Decke)', description: 'Erkennt Zittern und Bewusstlosigkeit', optional: true, check: hasFP2, missingHint: 'Aqara FP2 an der Decke. ~70\u20ac.' }
        ]
    },
    {
        id: 'longCovid', label: 'Long-COVID', shortLabel: 'Long-COVID', color: '#4caf50',
        targetGroup: 'adult', marketScore1P: 62, marketScoreMP: 31, multiPersonFeasibility: 'difficult',
        description: 'Erkennt Post-Exertional Malaise (PEM): Boom-Bust-Muster (hohe Aktivitaet, Einbruch am Folgetag) und schleichende Fatigue.',
        clinicalBasis: 'PEM betrifft 80% der Long-COVID-Patienten (Davis et al., Nature Reviews Microbiology 2023). Objektiv messbar durch Aktivitaetstrend.',
        relevantMetrics: ['activityLevel', 'activityDrift', 'gaitSpeed'],
        needsFP2: false,
        requiredSensors: [
            { key: 'motion2', label: 'Bewegungsmelder (mind. 2)', description: 'Aktivitaetslevel fuer PEM-Boom-Bust-Erkennung', optional: false, check: (d) => hasMotionSensors(d, 2), missingHint: 'Mindestens 2 Bewegungsmelder.' }
        ],
        optionalSensors: [
            { key: 'hallway', label: 'Flur-Sensor (Ganggeschwindigkeit)', description: 'Belastungstoleranz ueber Ganggeschwindigkeit', optional: true, check: hasHallwaySensor, missingHint: 'Flur-Sensor fuer Ganggeschwindigkeit.' },
            { key: 'exit', label: 'Ausgangstuer-Kontakt', description: 'Ausser-Haus-Aktivitaet als Aktivitaets-Indikator', optional: true, check: hasExitSensor, missingHint: 'Haustuer-Kontaktsensor fuer Aussen-Aktivitaets-Tracking.' }
        ]
    },
    {
        id: 'bipolar', label: 'Bipolare St�rung', shortLabel: 'Bipolar', color: '#673ab7',
        targetGroup: 'adult', marketScore1P: 58, marketScoreMP: 29, multiPersonFeasibility: 'difficult',
        description: 'Erkennt Phasenuebergaenge: Manie (wenig Schlaf, Hyperaktivitaet) und Depression. Fruehwarnung 3-7 Tage vor Eskalation.',
        clinicalBasis: 'Schlaf-Dysregulation ist erster Hinweis auf beginnende Manie (Harvey et al., Annu Rev Clin Psychol 2011).',
        relevantMetrics: ['nightRestlessness', 'activityLevel', 'roomMobility', 'activityDrift'],
        needsFP2: false,
        requiredSensors: [
            { key: 'nightSensor', label: 'Schlafzimmer-Sensor (isNightSensor)', description: 'Schlaf-Dysregulation als erstes Manie-Zeichen', optional: false, check: hasNightSensor, missingHint: 'Schlafzimmer-Sensor als Nacht-Sensor markieren.' },
            { key: 'motion2', label: 'Bewegungsmelder (mind. 2)', description: 'Aktivitaetslevel fuer Phasenerkennung', optional: false, check: (d) => hasMotionSensors(d, 2), missingHint: 'Mindestens 2 Bewegungsmelder.' }
        ],
        optionalSensors: [
            { key: 'exit', label: 'Ausgangstuer-Kontakt', description: 'Erhoehte Ausgeh-Frequenz in manischen Phasen', optional: true, check: hasExitSensor, missingHint: 'Haustuer-Kontaktsensor.' }
        ]
    }
];

export function validateDiseaseReadiness(profileId: string, devices: DeviceConfig[]): ValidationResult {
    const profile = DISEASE_PROFILES.find(p => p.id === profileId);
    if (!profile) return { profileId, readinessPercent: 0, readinessLevel: 'unconfigured', presentRequired: [], missingRequired: [], presentOptional: [], missingOptional: [] };

    const presentRequired: SensorRequirement[] = [];
    const missingRequired: SensorRequirement[] = [];
    const presentOptional: SensorRequirement[] = [];
    const missingOptional: SensorRequirement[] = [];

    for (const req of profile.requiredSensors) {
        (req.check(devices) ? presentRequired : missingRequired).push(req);
    }
    for (const opt of profile.optionalSensors) {
        (opt.check(devices) ? presentOptional : missingOptional).push(opt);
    }

    const totalRequired = profile.requiredSensors.length;
    const totalOptional = profile.optionalSensors.length;
    const requiredScore = totalRequired > 0 ? (presentRequired.length / totalRequired) * 80 : 80;
    const optionalScore = totalOptional > 0 ? (presentOptional.length / totalOptional) * 20 : 20;
    const readinessPercent = Math.round(requiredScore + optionalScore);

    let readinessLevel: ValidationResult['readinessLevel'];
    if (missingRequired.length === 0) {
        readinessLevel = missingOptional.length === 0 ? 'green' : 'yellow';
    } else if (presentRequired.length > 0) {
        readinessLevel = 'yellow';
    } else {
        readinessLevel = 'red';
    }

    return { profileId, readinessPercent, readinessLevel, presentRequired, missingRequired, presentOptional, missingOptional };
}

export function validateAllProfiles(devices: DeviceConfig[]): Record<string, ValidationResult> {
    const result: Record<string, ValidationResult> = {};
    for (const profile of DISEASE_PROFILES) {
        result[profile.id] = validateDiseaseReadiness(profile.id, devices);
    }
    return result;
}

export const PROFILE_BY_ID: Record<string, DiseaseProfile> = Object.fromEntries(
    DISEASE_PROFILES.map(p => [p.id, p])
);
