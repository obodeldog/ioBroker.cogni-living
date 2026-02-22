'use strict';

/**
 * CLOUDFLARE QUICK TUNNEL MANAGER
 * Version: 0.30.61
 * 
 * Startet einen "Quick Tunnel" via cloudflared binary.
 * Kein Cloudflare-Account nötig – generiert eine temporäre .trycloudflare.com URL.
 * 
 * Für eine permanente URL → Named Tunnel mit Cloudflare-Account nötig.
 * Anleitung: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
 */

const { spawn, execSync } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

let tunnelProcess = null;
let currentUrl = null;
let adapter = null;

// ─── DOWNLOAD ─────────────────────────────────────────────────────────────────

function getCloudflaredPath(dataDir) {
    const ext = process.platform === 'win32' ? '.exe' : '';
    return path.join(dataDir, `cloudflared${ext}`);
}

function getDownloadUrl() {
    const platform = process.platform;
    const arch = process.arch;
    
    // GitHub Release URLs für cloudflared
    const base = 'https://github.com/cloudflare/cloudflared/releases/latest/download/';
    
    if (platform === 'linux') {
        if (arch === 'arm64') return base + 'cloudflared-linux-arm64';
        if (arch === 'arm')   return base + 'cloudflared-linux-arm';
        return base + 'cloudflared-linux-amd64';
    }
    if (platform === 'win32') {
        return base + 'cloudflared-windows-amd64.exe';
    }
    if (platform === 'darwin') {
        if (arch === 'arm64') return base + 'cloudflared-darwin-arm64.tgz';
        return base + 'cloudflared-darwin-amd64.tgz';
    }
    return null;
}

async function downloadCloudflared(destPath) {
    return new Promise((resolve, reject) => {
        const url = getDownloadUrl();
        if (!url) {
            reject(new Error(`Unsupported platform: ${process.platform}/${process.arch}`));
            return;
        }

        if (adapter) adapter.log.info(`[Tunnel] Downloading cloudflared from GitHub...`);
        
        const file = fs.createWriteStream(destPath);
        
        function followRedirects(reqUrl, depth = 0) {
            if (depth > 10) { reject(new Error('Too many redirects')); return; }
            
            https.get(reqUrl, (response) => {
                if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
                    followRedirects(response.headers.location, depth + 1);
                    return;
                }
                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                }
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    // Linux/Mac: Executable-Bit setzen
                    if (process.platform !== 'win32') {
                        try { fs.chmodSync(destPath, '755'); } catch(e) {}
                    }
                    resolve();
                });
            }).on('error', (e) => {
                fs.unlink(destPath, () => {});
                reject(e);
            });
        }
        
        followRedirects(url);
    });
}

async function ensureCloudflared(dataDir) {
    const cloudflaredPath = getCloudflaredPath(dataDir);
    
    if (fs.existsSync(cloudflaredPath)) {
        return cloudflaredPath;
    }
    
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    await downloadCloudflared(cloudflaredPath);
    return cloudflaredPath;
}

// ─── TUNNEL START ─────────────────────────────────────────────────────────────

async function start(adapterRef, port) {
    adapter = adapterRef;
    
    if (tunnelProcess) {
        adapterRef.log.warn('[Tunnel] Already running. Stop first.');
        return currentUrl;
    }

    const dataDir = adapterRef._historyDir ? path.dirname(adapterRef._historyDir) : os.tmpdir();
    
    try {
        const cloudflaredPath = await ensureCloudflared(dataDir);
        adapterRef.log.info(`[Tunnel] Starting Quick Tunnel → http://localhost:${port}`);
        
        return await startTunnel(cloudflaredPath, port, adapterRef);
    } catch(e) {
        adapterRef.log.error(`[Tunnel] Failed to start: ${e.message}`);
        return null;
    }
}

async function startTunnel(cloudflaredPath, port, adapterRef) {
    return new Promise((resolve) => {
        const args = ['tunnel', '--url', `http://localhost:${port}`, '--no-autoupdate'];
        
        tunnelProcess = spawn(cloudflaredPath, args, {
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let resolved = false;
        const timeout = setTimeout(() => {
            if (!resolved) {
                adapterRef.log.warn('[Tunnel] Timeout waiting for URL (30s)');
                resolve(null);
                resolved = true;
            }
        }, 30000);

        // URL erscheint in stderr
        function checkForUrl(data) {
            const text = data.toString();
            const match = text.match(/https:\/\/[a-z0-9\-]+\.trycloudflare\.com/i);
            if (match && !resolved) {
                currentUrl = match[0];
                clearTimeout(timeout);
                resolved = true;
                
                adapterRef.log.info(`[Tunnel] ✅ Cloudflare URL: ${currentUrl}`);
                
                // URL in ioBroker-State speichern
                adapterRef.setStateAsync('system.pwaTunnelUrl', {
                    val: currentUrl + '/?token=' + (adapterRef.config.familyShareToken || ''),
                    ack: true
                }).catch(() => {});
                
                resolve(currentUrl);
            }
        }

        tunnelProcess.stdout.on('data', checkForUrl);
        tunnelProcess.stderr.on('data', checkForUrl);

        tunnelProcess.on('exit', (code) => {
            adapterRef.log.warn(`[Tunnel] Process exited (code ${code})`);
            tunnelProcess = null;
            currentUrl = null;
            
            // Auto-Restart nach 10s
            if (code !== 0 && adapterRef.config.cloudflareEnabled) {
                setTimeout(() => {
                    if (!tunnelProcess) startTunnel(cloudflaredPath, port, adapterRef);
                }, 10000);
            }
        });

        tunnelProcess.on('error', (e) => {
            adapterRef.log.error(`[Tunnel] Process error: ${e.message}`);
            if (!resolved) { resolve(null); resolved = true; }
        });
    });
}

function stop() {
    if (tunnelProcess) {
        tunnelProcess.kill('SIGTERM');
        tunnelProcess = null;
        currentUrl = null;
        if (adapter) adapter.log.info('[Tunnel] Stopped.');
    }
}

function getUrl() {
    return currentUrl;
}

module.exports = { start, stop, getUrl };
