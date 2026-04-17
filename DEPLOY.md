# UDP Echo Server — Deploy Guide

## Requirements

- Node.js 18+
- PM2 (`npm install -g pm2`)
- UDP port 5005 open on your server

## Firewall

```bash
ufw allow 5005/udp
ufw reload
```

## Deploy

```bash
mkdir -p /var/log/udp-echo
cd /opt/udp-echo
cp udp-server.js ecosystem.config.js ./

pm2 start ecosystem.config.js
pm2 save
pm2 startup   # follow the printed command to enable auto-start on reboot
```

## Monitor

```bash
pm2 status
pm2 logs udp-echo
pm2 monit
```

## Environment variables

| Variable   | Default | Description        |
|------------|---------|--------------------|
| `UDP_PORT` | `5005`  | UDP listening port |

## Protocol

Client sends packets up to 512 bytes. First 4 bytes = sequence number (uint32 big-endian).  
Server echoes each packet unchanged.  
Client counts missing echoes → `lossPercent = (sent - received) / sent × 100`

## Smoke test

```bash
# Requires netcat
echo -n "0001hello" | nc -u -w1 <SERVER_IP> 5005
```
