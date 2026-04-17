'use strict';

const dgram = require('dgram');
const net   = require('net');

const UDP_PORT = parseInt(process.env.UDP_PORT || '5005', 10);
const TCP_PORT = parseInt(process.env.TCP_PORT || '5006', 10);
const MAX_PACKET_SIZE = 512;
const RATE_WINDOW_MS = 1000;
const RATE_LIMIT_PER_IP = 200;

// ── Rate limiter (shared between UDP and TCP) ────────────────────────────────
const rateMap = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  let entry = rateMap.get(ip);
  if (!entry || now - entry.windowStart >= RATE_WINDOW_MS) {
    entry = { count: 1, windowStart: now };
    rateMap.set(ip, entry);
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_PER_IP;
}

setInterval(() => {
  const cutoff = Date.now() - RATE_WINDOW_MS * 2;
  for (const [ip, entry] of rateMap) {
    if (entry.windowStart < cutoff) rateMap.delete(ip);
  }
}, 30_000);

// ── UDP echo ─────────────────────────────────────────────────────────────────
const udpServer = dgram.createSocket('udp4');

udpServer.on('message', (msg, rinfo) => {
  if (msg.length > MAX_PACKET_SIZE) return;
  if (isRateLimited(rinfo.address)) return;
  udpServer.send(msg, 0, msg.length, rinfo.port, rinfo.address, (err) => {
    if (err) console.error(`[udp] send error to ${rinfo.address}:${rinfo.port} — ${err.message}`);
  });
});

udpServer.on('listening', () => {
  const addr = udpServer.address();
  console.log(`[udp-echo] listening on ${addr.address}:${addr.port}`);
});

udpServer.on('error', (err) => {
  console.error(`[udp-echo] error: ${err.message}`);
  udpServer.close();
  process.exit(1);
});

udpServer.bind(UDP_PORT);

// ── TCP echo (fallback for carriers that block UDP) ──────────────────────────
const tcpServer = net.createServer((socket) => {
  const ip = socket.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    socket.destroy();
    return;
  }

  let buf = Buffer.alloc(0);

  socket.on('data', (chunk) => {
    if (isRateLimited(ip)) { socket.destroy(); return; }
    buf = Buffer.concat([buf, chunk]);
    // Echo back every 4-byte frame
    while (buf.length >= 4) {
      const frame = buf.slice(0, 4);
      buf = buf.slice(4);
      socket.write(frame);
    }
  });

  socket.on('error', () => socket.destroy());
  socket.setTimeout(10_000, () => socket.destroy());
});

tcpServer.listen(TCP_PORT, () => {
  console.log(`[tcp-echo] listening on 0.0.0.0:${TCP_PORT}`);
});

tcpServer.on('error', (err) => {
  console.error(`[tcp-echo] error: ${err.message}`);
});

// ── Graceful shutdown ────────────────────────────────────────────────────────
function shutdown(sig) {
  console.log(`[echo] ${sig} received, closing...`);
  udpServer.close();
  tcpServer.close(() => process.exit(0));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
