// ZEITZONE-TEST für ioBroker-System

console.log('=== SYSTEM TIMEZONE INFO ===');
console.log('Date.now():', Date.now());
console.log('new Date():', new Date().toString());
console.log('new Date().toISOString():', new Date().toISOString());
console.log('new Date().toLocaleString("de-DE"):', new Date().toLocaleString('de-DE'));
console.log('Timezone Offset (minutes):', new Date().getTimezoneOffset());
console.log('Timezone Offset (hours):', new Date().getTimezoneOffset() / -60);

console.log('\n=== TEST: Kalender-Event um 07:00 ===');
const testEvent = '2026-02-05T07:00:00'; // 07:00 ohne Timezone
console.log('Event String:', testEvent);
console.log('new Date(testEvent):', new Date(testEvent).toString());
console.log('new Date(testEvent).toISOString():', new Date(testEvent).toISOString());
console.log('new Date(testEvent).toLocaleString("de-DE"):', new Date(testEvent).toLocaleString('de-DE'));

console.log('\n=== TEST: Mit expliziter Timezone ===');
const testEventWithTZ = '2026-02-05T07:00:00+01:00'; // 07:00 UTC+1
console.log('Event String:', testEventWithTZ);
console.log('new Date(testEventWithTZ):', new Date(testEventWithTZ).toString());
console.log('new Date(testEventWithTZ).toLocaleString("de-DE"):', new Date(testEventWithTZ).toLocaleString('de-DE'));

console.log('\n=== DIAGNOSE ===');
const offset = new Date().getTimezoneOffset() / -60;
if (offset !== 1 && offset !== 2) {
    console.log('⚠️ WARNUNG: System-Timezone ist NICHT Europe/Berlin!');
    console.log('   Erwartet: UTC+1 (Winter) oder UTC+2 (Sommer)');
    console.log('   Tatsächlich: UTC' + (offset >= 0 ? '+' : '') + offset);
} else {
    console.log('✅ System-Timezone ist korrekt: UTC+' + offset);
}
