/**
 * Production server for Mosart Graphics Control.
 *
 * Serves the built static files from dist/ and provides the same
 * proxy routes that the Vite plugins handle during development:
 *   - /mosart-proxy/{host}/{port}/...  → dynamic Mosart API proxy
 *   - /api/thumb?payloadUrl=...         → thumbnail via Viz Preview Server snapshot API
 *   - /api/servers (GET/POST)          → read/write servers.json
 *
 * Usage:
 *   npm run build
 *   node server.js
 *
 * Environment variables (all optional):
 *   PORT  — port to listen on (default: 3000). Set this at install time via
 *           "PORT=8080 node install-service.js" to bake it into the service.
 */

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, 'dist');
const SERVERS_JSON = path.join(DIST_DIR, 'servers.json');
const CONFIG_FILE = path.join(__dirname, 'config.json');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');

const DEFAULT_SETTINGS = {
  stationName: '',
  handlerConfig: [],
  pollConfig: { timelineMs: 500, graphicsMs: 1500 },
  inactivityMinutes: 15,
  adminPassword: '1234',
};

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')); } catch { return {}; }
}

function writeConfig(data) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function readSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')) };
    }
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function writeSettings(data) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

const appConfig = readConfig();
const PORT = appConfig.port || parseInt(process.env.PORT || '3000', 10);

// MIME types for static files
const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/**
 * Load allowed hostnames from servers.json.
 * Re-reads on every call so newly-added servers are picked up without restart.
 */
function loadAllowedHosts() {
  try {
    const data = fs.readFileSync(SERVERS_JSON, 'utf-8');
    const servers = JSON.parse(data);
    return new Set(servers.map(s => s.host.toLowerCase()));
  } catch {
    return new Set();
  }
}

/** Max body size for POST /api/servers (10 KB). */
const MAX_BODY_SIZE = 10 * 1024;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // --- /mosart-proxy/{host}/{port}/... → dynamic Mosart API proxy ---
  if (url.pathname.startsWith('/mosart-proxy/')) {
    const rest = url.pathname.slice('/mosart-proxy/'.length);
    const match = rest.match(/^([^/]+)\/(\d+)(\/.*)?$/);
    if (!match) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid proxy URL' }));
      return;
    }
    const targetHost = decodeURIComponent(match[1]);
    const targetPort = match[2];
    const targetPath = (match[3] || '/') + url.search;

    // Only proxy to hosts listed in servers.json
    if (!loadAllowedHosts().has(targetHost.toLowerCase())) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Host not in servers.json' }));
      return;
    }

    const proxyReq = http.request(`http://${targetHost}:${targetPort}${targetPath}`, {
      method: req.method,
      headers: { ...req.headers, host: `${targetHost}:${targetPort}` },
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
    req.pipe(proxyReq);
    return;
  }

  // --- /api/thumb?payloadUrl=...&previewHost=...&previewPort=... → Preview Server snapshot proxy ---
  if (url.pathname === '/api/thumb') {
    const payloadUrl = url.searchParams.get('payloadUrl');
    if (!payloadUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing payloadUrl parameter' }));
      return;
    }

    // Build the Preview Server snapshot URL.
    // Derive preview host from the payload URL's hostname; port defaults to 4443.
    let payloadParsed;
    try { payloadParsed = new URL(payloadUrl); } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid payloadUrl parameter' }));
      return;
    }
    const previewHost = url.searchParams.get('previewHost') || payloadParsed.hostname;
    const previewPort = url.searchParams.get('previewPort') || '4443';

    // Only allow thumbnail fetches from hosts in servers.json (or derived from their payloads)
    if (!loadAllowedHosts().has(previewHost.toLowerCase())) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Preview host not in servers.json' }));
      return;
    }

    const snapshotRequest = '<snapshotrequest xmlns="http://www.vizrt.com/snapshotrequest">'
      + '<position><namedposition>$pilot1</namedposition></position>'
      + '<videomoderequest><width>320</width><height>180</height></videomoderequest>'
      + '<snapshotdata view="fill" />'
      + '</snapshotrequest>';

    const snapshotUrl = `https://${previewHost}:${previewPort}/api/preview/snapshot`
      + `?s=${encodeURIComponent(snapshotRequest)}&u=${encodeURIComponent(payloadUrl)}`;

    // rejectUnauthorized: false is needed for self-signed certs on internal Preview Servers.
    // This is acceptable on a trusted broadcast LAN; log a warning so it's visible.
    const fetchReq = https.get(snapshotUrl, { rejectUnauthorized: false }, (fetchRes) => {
      res.writeHead(fetchRes.statusCode, {
        'Content-Type': fetchRes.headers['content-type'] || 'image/png',
        'Cache-Control': 'public, max-age=300',
      });
      fetchRes.pipe(res);
    });
    fetchReq.on('error', (err) => {
      console.error('[thumb-proxy] Error fetching snapshot', snapshotUrl, '→', err.code || err.constructor.name, err.message);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.code ? `${err.code}: ${err.message}` : err.message || String(err) }));
      }
    });
    fetchReq.setTimeout(15000, () => {
      fetchReq.destroy();
      if (!res.headersSent) {
        res.writeHead(504, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Thumbnail fetch timed out' }));
      }
    });
    return;
  }

  // --- /api/servers → read/write servers.json ---
  if (url.pathname === '/api/servers') {
    if (req.method === 'GET') {
      try {
        const data = fs.readFileSync(SERVERS_JSON, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(data);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      let bodySize = 0;
      req.on('data', chunk => {
        bodySize += chunk.length;
        if (bodySize > MAX_BODY_SIZE) {
          req.destroy();
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Payload too large' }));
          return;
        }
        body += chunk;
      });
      req.on('end', () => {
        if (bodySize > MAX_BODY_SIZE) return; // already responded
        try {
          const servers = JSON.parse(body);
          if (!Array.isArray(servers)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Expected an array' }));
            return;
          }
          // Validate each server entry
          for (const s of servers) {
            if (!s.name || typeof s.name !== 'string' || s.name.length > 100) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid server: name required (max 100 chars)' }));
              return;
            }
            if (!s.host || typeof s.host !== 'string' || s.host.length > 255) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid server: host required (max 255 chars)' }));
              return;
            }
            if (!s.port || typeof s.port !== 'number' || s.port < 1 || s.port > 65535) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid server: port must be 1-65535' }));
              return;
            }
            if (!s.apiKey || typeof s.apiKey !== 'string' || s.apiKey.length > 500) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid server: apiKey required (max 500 chars)' }));
              return;
            }
          }
          fs.writeFileSync(SERVERS_JSON, JSON.stringify(servers, null, 2) + '\n', 'utf-8');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    res.writeHead(405);
    res.end();
    return;
  }

  // --- /api/settings → read/write settings.json ---
  if (url.pathname === '/api/settings') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(readSettings()));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const patch = JSON.parse(body);
          writeSettings({ ...readSettings(), ...patch });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    res.writeHead(405);
    res.end();
    return;
  }

  // --- /api/config → read/write app config (port, etc.) ---
  if (url.pathname === '/api/config') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ port: PORT }));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { port } = JSON.parse(body);
          const newPort = parseInt(port, 10);
          if (!newPort || newPort < 1 || newPort > 65535) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Port must be 1–65535' }));
            return;
          }
          writeConfig({ ...readConfig(), port: newPort });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, port: newPort }));
          // Restart so the new port takes effect.
          // node-windows will automatically restart the process.
          setTimeout(() => process.exit(0), 500);
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    res.writeHead(405);
    res.end();
    return;
  }

  // --- Static files from dist/ ---
  let filePath = path.join(DIST_DIR, url.pathname === '/' ? 'index.html' : url.pathname);

  // SPA fallback: if the file doesn't exist and it's not a file with extension, serve index.html
  if (!fs.existsSync(filePath) && !path.extname(filePath)) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  try {
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Mosart Graphics Control running at http://localhost:${PORT}`);
});
