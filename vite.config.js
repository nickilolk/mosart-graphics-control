import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

/**
 * Vite plugin that exposes a POST /api/servers endpoint
 * to write the server list back to public/servers.json.
 * This lets the AdminPage UI persist changes to the shared config file.
 */
/** Max body size for POST /api/servers (10 KB). */
const MAX_BODY_SIZE = 10 * 1024;

function serversApiPlugin() {
  return {
    name: 'servers-api',
    configureServer(server) {
      server.middlewares.use('/api/servers', (req, res) => {
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
            if (bodySize > MAX_BODY_SIZE) return;
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
              const filePath = path.resolve('public/servers.json');
              fs.writeFileSync(filePath, JSON.stringify(servers, null, 2) + '\n', 'utf-8');
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true }));
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
        } else if (req.method === 'GET') {
          try {
            const filePath = path.resolve('public/servers.json');
            const data = fs.readFileSync(filePath, 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data);
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        } else {
          res.writeHead(405);
          res.end();
        }
      });
    },
  };
}

/**
 * Load allowed hostnames from servers.json.
 * Re-reads on every call so newly-added servers are picked up without restart.
 */
function loadAllowedHosts() {
  try {
    const data = fs.readFileSync(path.resolve('public/servers.json'), 'utf-8');
    const servers = JSON.parse(data);
    return new Set(servers.map(s => s.host.toLowerCase()));
  } catch {
    return new Set();
  }
}

/**
 * Vite plugin that dynamically proxies Mosart API requests.
 * URL format: /mosart-proxy/{host}/{port}/api/v1/...
 * This replaces the old hardcoded proxy target, allowing the app to connect
 * to any Mosart server configured in servers.json.
 */
function mosartProxyPlugin() {
  return {
    name: 'mosart-proxy',
    configureServer(server) {
      server.middlewares.use('/mosart-proxy', (req, res) => {
        // Parse host and port from the URL: /mosart-proxy/{host}/{port}/rest/of/path
        const match = req.url.match(/^\/([^/]+)\/(\d+)(\/.*)?$/);
        if (!match) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid proxy URL — expected /mosart-proxy/{host}/{port}/...' }));
          return;
        }

        const targetHost = decodeURIComponent(match[1]);
        const targetPort = match[2];
        const targetPath = match[3] || '/';

        // Only proxy to hosts listed in servers.json
        if (!loadAllowedHosts().has(targetHost.toLowerCase())) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Host not in servers.json' }));
          return;
        }
        const targetUrl = `http://${targetHost}:${targetPort}${targetPath}`;

        const proxyReq = http.request(targetUrl, {
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
      });
    },
  };
}

/**
 * Vite plugin that proxies thumbnail requests via Viz Preview Server snapshot API.
 * GET /api/thumb?payloadUrl=<encoded-payload-url>[&previewHost=...][&previewPort=...]
 * Builds a Preview Server snapshot request from the data element payload URL.
 */
function thumbnailProxyPlugin() {
  return {
    name: 'thumbnail-proxy',
    configureServer(server) {
      server.middlewares.use('/api/thumb', (req, res) => {
        const parsed = new URL(req.url, 'http://localhost');
        const payloadUrl = parsed.searchParams.get('payloadUrl');

        if (!payloadUrl) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing payloadUrl parameter' }));
          return;
        }

        let payloadParsed;
        try {
          payloadParsed = new URL(payloadUrl);
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid payloadUrl parameter' }));
          return;
        }

        const previewHost = parsed.searchParams.get('previewHost') || payloadParsed.hostname;
        const previewPort = parsed.searchParams.get('previewPort') || '4443';

        // Only allow thumbnail fetches from hosts in servers.json
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
        // This is acceptable on a trusted broadcast LAN.
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
      });
    },
  };
}

/**
 * Vite plugin that serves /api/settings in dev mode.
 * Reads/writes settings.json so dev mode shares settings with production.
 */
function settingsApiPlugin() {
  const DEFAULT_SETTINGS = {
    stationName: '',
    handlerConfig: [],
    pollConfig: { timelineMs: 500, graphicsMs: 1500 },
    inactivityMinutes: 15,
    adminPassword: '1234',
  };
  const SETTINGS_FILE = path.resolve('settings.json');
  let settings = { ...DEFAULT_SETTINGS };
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      settings = { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')) };
    }
  } catch {}

  return {
    name: 'settings-api',
    configureServer(server) {
      server.middlewares.use('/api/settings', (req, res) => {
        if (req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(settings));
        } else if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              settings = { ...settings, ...JSON.parse(body) };
              fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true }));
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
        } else {
          res.writeHead(405);
          res.end();
        }
      });
    },
  };
}

/**
 * Vite plugin that serves /api/config in dev mode.
 * Returns the current dev port; POST is a no-op (dev server can't self-restart).
 */
function configApiPlugin() {
  const devPort = parseInt(process.env.PORT || '3000', 10);
  return {
    name: 'config-api',
    configureServer(server) {
      server.middlewares.use('/api/config', (req, res) => {
        if (req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ port: devPort, devMode: true }));
        } else if (req.method === 'POST') {
          // Can't restart Vite dev server programmatically; just acknowledge.
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, devMode: true }));
        } else {
          res.writeHead(405);
          res.end();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), serversApiPlugin(), settingsApiPlugin(), mosartProxyPlugin(), thumbnailProxyPlugin(), configApiPlugin()],
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    open: true,
  },
});
