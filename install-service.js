/**
 * Installs Mosart Graphics Control as a Windows Service.
 *
 * Prerequisites:
 *   npm install -g node-windows
 *
 * Usage:
 *   node install-service.js          — install & start the service on port 3000
 *   PORT=8080 node install-service.js — install on a custom port
 *   node install-service.js remove   — uninstall the service
 *
 * Once installed the service appears in services.msc as
 * "Mosart Graphics Control" and starts automatically on boot.
 */

import { Service } from 'node-windows';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const svc = new Service({
  name: 'Mosart Graphics Control',
  description: 'Web UI for Viz Mosart overlay graphics control',
  script: path.join(__dirname, 'server.js'),
  env: [{ name: 'PORT', value: process.env.PORT || '3000' }],
});

if (process.argv[2] === 'remove') {
  svc.on('uninstall', () => console.log('Service removed.'));
  svc.uninstall();
} else {
  svc.on('install', () => {
    console.log('Service installed. Starting...');
    svc.start();
  });
  svc.on('alreadyinstalled', () => console.log('Service is already installed.'));
  svc.on('start', () => console.log('Service started.'));
  svc.install();
}
