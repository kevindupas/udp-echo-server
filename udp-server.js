'use strict';

const dgram = require('dgram');

const PORT = parseInt(process.env.UDP_PORT || '5005', 10);
const MAX_PACKET_SIZE = 512;
const RATE_WINDOW_MS = 1000;
const RATE_LIMIT_PER_IP = 200;

const server = dgram.createSocket('udp4');
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

server.on('message', (msg, rinfo) => {
  if (msg.length > MAX_PACKET_SIZE) return;
  if (isRateLimited(rinfo.address)) return;
  server.send(msg, 0, msg.length, rinfo.port, rinfo.address, (err) => {
    if (err) console.error(`Send error to ${rinfo.address}:${rinfo.port} — ${err.message}`);
  });
});

server.on('listening', () => {
  const addr = server.address();
  console.log(`[udp-echo] listening on ${addr.address}:${addr.port}`);
  console.log(`[udp-echo] rate limit: ${RATE_LIMIT_PER_IP} pkt/s per IP`);
});

server.on('error', (err) => {
  console.error(`[udp-echo] error: ${err.message}`);
  server.close();
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('[udp-echo] SIGTERM received, closing...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('[udp-echo] SIGINT received, closing...');
  server.close(() => process.exit(0));
});

server.bind(PORT);
