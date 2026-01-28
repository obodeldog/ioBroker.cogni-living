/*
 * tasks.js - Korrigiert für src-admin Struktur
 */
'use strict';

const { buildReact } = require('@iobroker/build-tools');

// WICHTIG: Wir zeigen auf 'src-admin', weil dort deine vite.config.mjs liegt!
buildReact('src-admin', {
    rootDir: __dirname,
    vite: true
});