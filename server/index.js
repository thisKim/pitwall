import dgram from 'node:dgram';
import net from 'node:net';
import { WebSocketServer } from 'ws';
import { decodePacket } from './packet.js';

const WS_PORT = Number(process.env.FH_WS_PORT ?? 8787);
// Throttle the browser feed; the game emits at frame rate (up to 120 Hz).
const SEND_HZ = Number(process.env.FH_SEND_HZ ?? 30);

// The game binds its own outgoing socket somewhere in this range.
const RESERVED = { from: 5200, to: 5300 };

let listener = {
  host: process.env.FH_UDP_HOST ?? '0.0.0.0',
  port: Number(process.env.FH_UDP_PORT ?? 5400),
};
let socket = null;
let bindError = null;
let latest = null;
let lastPacketAt = 0;

const wss = new WebSocketServer({ port: WS_PORT });
wss.on('listening', () => console.log(`[ws]  clients -> ws://localhost:${WS_PORT}`));

function configMessage() {
  return JSON.stringify({ type: 'config', ...listener, error: bindError, reserved: RESERVED });
}

function broadcast(payload) {
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(payload);
  }
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
    broadcast(configMessage());
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
    console.error('[udp] error:', err.message);
    broadcast(configMessage());
  });

  next.bind(port, host, () => {
    listener = { host, port };
    bindError = null;
    latest = null;
    lastPacketAt = 0;
    console.log(`[udp] listening on ${host}:${port}`);
    broadcast(configMessage());
  });
}

wss.on('connection', (client) => {
  client.send(configMessage());

  client.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg?.type !== 'config') return;
    bind(String(msg.host ?? listener.host), Number(msg.port));
  });
});

bind(listener.host, listener.port);
console.log('      Set this IP/port in FH6: Settings > HUD and Gameplay > Data Out');

setInterval(() => {
  if (!latest || wss.clients.size === 0) return;
  broadcast(
    JSON.stringify({
      type: 'frame',
      t: lastPacketAt,
      stale: Date.now() - lastPacketAt > 1000,
      data: latest,
    }),
  );
}, Math.round(1000 / SEND_HZ));
