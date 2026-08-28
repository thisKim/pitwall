import { app, BrowserWindow, ipcMain } from 'electron';
import dgram from 'node:dgram';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePacket, FIELDS } from './packet.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

// The game binds its own outgoing socket somewhere in this range.
const RESERVED = { from: 5200, to: 5300 };

let window = null;
let socket = null;
let listener = {
  host: process.env.FH_UDP_HOST ?? '0.0.0.0',
  port: Number(process.env.FH_UDP_PORT ?? 5400),
};
let bindError = null;
let latest = null;
let lastPacketAt = 0;

const FIELD_NAMES = FIELDS.map((field) => field.name);

const configPayload = () => ({
  ...listener,
  error: bindError,
  reserved: RESERVED,
  fields: FIELD_NAMES,
});

function send(channel, payload) {
  if (window && !window.isDestroyed()) window.webContents.send(channel, payload);
}

/** Validates a requested listener address, returning an error string or null. */
function validate(host, port) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    return 'Port must be an integer between 1024 and 65535.';
  }
  if (port >= RESERVED.from && port <= RESERVED.to) {
    return `Ports ${RESERVED.from}-${RESERVED.to} are used by the game's own socket.`;
  }
  if (!net.isIPv4(host)) return 'Host must be an IPv4 address.';
  return null;
}

function bind(host, port) {
  const invalid = validate(host, port);
  if (invalid) {
    bindError = invalid;
    send('pitwall:config', configPayload());
    return;
  }

  const previous = socket;
  if (previous) {
    previous.removeAllListeners();
    previous.close();
  }

  const next = dgram.createSocket('udp4');
  socket = next;

  next.on('message', (msg) => {
    if (next !== socket) return;
    const data = decodePacket(msg);
    if (!data) return;
    latest = data;
    lastPacketAt = Date.now();
  });

  next.on('error', (err) => {
    if (next !== socket) return;
    bindError = err.message;
    socket = null;
    next.close();
    send('pitwall:config', configPayload());
  });

  next.bind(port, host, () => {
    listener = { host, port };
    bindError = null;
    latest = null;
    lastPacketAt = 0;
    send('pitwall:config', configPayload());
  });
}

function createWindow() {
  window = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#0b0e14',
    title: 'Pitwall',
    webPreferences: {
      preload: path.join(dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (DEV_SERVER_URL) window.loadURL(DEV_SERVER_URL);
  else window.loadFile(path.join(dirname, '..', 'dist', 'index.html'));

  window.webContents.on('did-finish-load', () => send('pitwall:config', configPayload()));
}

app.whenReady().then(() => {
  ipcMain.handle('pitwall:config', () => configPayload());
  ipcMain.handle('pitwall:setListener', (_event, { host, port }) => {
    bind(String(host), Number(port));
    return configPayload();
  });

  bind(listener.host, listener.port);
  createWindow();

  // Throttle the renderer feed; the game emits at frame rate.
  setInterval(() => {
    if (!latest) return;
    send('pitwall:frame', { t: lastPacketAt, stale: Date.now() - lastPacketAt > 1000, data: latest });
  }, 33);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
