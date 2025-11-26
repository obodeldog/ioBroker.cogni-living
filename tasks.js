/*!
 * ioBroker tasks file for tasks like build, clean, etc.
 * Date: 2025-05-31
 */
'use strict';

const { existsSync } = require('node:fs');
const { buildReact, copyFiles, deleteFoldersRecursive, npmInstall, patchHtmlFile } = require('@iobroker/build-tools');

function clean() {
    deleteFoldersRecursive(`${__dirname}/admin`, ['cogni-living.png']);
}

if (process.argv.find(arg => arg === '--0-clean')) {
    clean();
} else if (process.argv.find(arg => arg === '--1-npm')) {
    if (!existsSync(`${__dirname}/src-admin/node_modules`)) {
        npmInstall('./src-admin/').catch(error => console.error(error));
    }
} else if (process.argv.find(arg => arg === '--2-build')) {
    buildReact(`${__dirname}/src-admin/`, { rootDir: __dirname, vite: true }).catch(error => console.error(error));
} else if (process.argv.find(arg => arg === '--3-copy')) {
    // HIER GEÄNDERT: Kopiert erst den Build, DANN die Übersetzungen
    copyFiles(['src-admin/build/**/*', 'src-admin/build/*'], 'admin/')
        .then(() => copyFiles(['src-admin/src/i18n/*.json'], 'admin/i18n/'));
} else if (process.argv.find(arg => arg === '--4-patch')) {
    patchHtmlFile(`${__dirname}/admin/index.html`)
        .then(() => patchHtmlFile(`${__dirname}/src-admin/build/index.html`, '../..'))
        .catch(error => console.error(error));
} else if (process.argv.find(arg => arg === '--build-admin')) {
    clean();
    let npmPromise;
    if (!existsSync(`${__dirname}/src-admin/node_modules`)) {
        npmPromise = npmInstall('./src-admin/').catch(error => console.error(error));
    } else {
        npmPromise = Promise.resolve();
    }
    npmPromise
        .then(() => buildReact(`${__dirname}/src-admin/`, { rootDir: __dirname, vite: true }))
        .then(() => copyFiles(['src-admin/build/**/*', 'src-admin/build/*'], 'admin/'))
        .then(() => copyFiles(['src-admin/src/i18n/*.json'], 'admin/i18n/')) // <--- WICHTIG: Übersetzungen kopieren
        .then(() => patchHtmlFile(`${__dirname}/admin/index.html`, '../..'))
        .catch(error => console.error(error));
} else {
    clean();
    let installPromise;
    if (!existsSync(`${__dirname}/src-admin/node_modules`)) {
        installPromise = npmInstall('./src-admin/').catch(error => console.error(error));
    } else {
        installPromise = Promise.resolve();
    }
    installPromise
        .then(() => buildReact(`${__dirname}/src-admin/`, { rootDir: __dirname, vite: true }))
        .then(() => copyFiles(['src-admin/build/**/*', 'src-admin/build/*'], 'admin/'))
        .then(() => copyFiles(['src-admin/src/i18n/*.json'], 'admin/i18n/')) // <--- WICHTIG: Übersetzungen kopieren
        .then(() => patchHtmlFile(`${__dirname}/admin/index.html`, '../..'));
}