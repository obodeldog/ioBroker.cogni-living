'use strict';

const { exec, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const IS_WIN = process.platform === 'win32';
// Wir gehen davon aus, dass wir im "lib" Ordner sind, also müssen wir eins hoch ('..')
const ADAPTER_DIR = path.join(__dirname, '..');
const PERSISTENT_DIR = path.join(ADAPTER_DIR, '.venv');
const VENV_PATH = PERSISTENT_DIR;
const PYTHON_EXE = IS_WIN ? path.join(VENV_PATH, 'Scripts', 'python.exe') : path.join(VENV_PATH, 'bin', 'python');
const PIP_EXE = IS_WIN ? path.join(VENV_PATH, 'Scripts', 'pip.exe') : path.join(VENV_PATH, 'bin', 'pip');

function stopPythonService(adapter) {
    if (adapter.pythonProcess) {
        try {
            adapter.pythonProcess.kill();
        } catch (e) {
            // ignore
        }
        adapter.pythonProcess = null;
    }
}

function installRequirementsInVenv(adapter, reqPath, callback) {
    adapter.log.info(`Installing pip packages... (Caching enabled)`);
    const cmd = `"${PIP_EXE}" install -r "${reqPath}"`;
    exec(cmd, { timeout: 1800000 }, (err, stdout, stderr) => {
        adapter.dependencyInstallInProgress = false;
        if (err) {
            adapter.log.error(`❌ INSTALL FAILED: ${stderr || err.message}`);
            try {
                fs.rmSync(VENV_PATH, { recursive: true, force: true });
            } catch (e) {
                // ignore
            }
        } else {
            adapter.log.info(`✅ INSTALL SUCCESS.`);
            if (callback) {
                callback();
            }
        }
    });
}

function installPythonDependencies(adapter, callback) {
    if (adapter.dependencyInstallInProgress) {
        return;
    }
    adapter.dependencyInstallInProgress = true;

    const reqPath = path.join(ADAPTER_DIR, 'python_service', 'requirements.txt');
    stopPythonService(adapter);

    // Self-Healing: Check for broken pip
    if (fs.existsSync(VENV_PATH) && !fs.existsSync(PIP_EXE)) {
        adapter.log.warn('♻️ Found broken VENV (no pip). Deleting and recreating...');
        try {
            fs.rmSync(VENV_PATH, { recursive: true, force: true });
        } catch (e) {
            adapter.log.error(`Delete failed: ${e.message}`);
        }
    }

    if (!fs.existsSync(VENV_PATH)) {
        try {
            adapter.log.info('Creating new VENV...');
            execSync(`python3 -m venv "${VENV_PATH}"`);
        } catch (e) {
            adapter.dependencyInstallInProgress = false;
            if (e.message.includes('EACCES') || e.message.includes('Permission denied')) {
                adapter.log.error(`🛑 PERMISSION ERROR: Der Adapter darf das VENV nicht anlegen.`);
                adapter.log.error(`👉 LÖSUNG (SSH): sudo chown -R iobroker:iobroker ${ADAPTER_DIR}`);
            } else {
                adapter.log.error(`❌ VENV CREATION FAILED: ${e.message}. (Is 'python3-venv' installed?)`);
            }
            return;
        }
    }
    installRequirementsInVenv(adapter, reqPath, callback);
}

function checkAndInstall(adapter, callback) {
    if (fs.existsSync(PYTHON_EXE) && fs.existsSync(PIP_EXE)) {
        try {
            adapter.log.info('🐍 Checking Python environment...');
            execSync(`"${PYTHON_EXE}" -c "import tensorflow; print('libs_ok')"`, { timeout: 15000 });
            adapter.log.info('✅ Fast-Boot: Environment healthy.');
            if (callback) {
                callback();
            }
            return true;
        } catch (e) {
            adapter.log.warn('⚠️ Fast-Boot failed. Triggering Self-Healing...');
        }
    } else {
        adapter.log.warn('⚠️ Python VENV or PIP missing. Installing...');
    }
    installPythonDependencies(adapter, callback);
    return false;
}

module.exports = {
    checkAndInstall,
    PYTHON_EXE
};