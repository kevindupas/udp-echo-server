module.exports = {
  apps: [{
    name: 'udp-echo',
    script: 'authbind',
    args: '--deep node udp-server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '128M',
    env: { UDP_PORT: 5005, TCP_PORT: 443 },
    error_file: '/var/log/udp-echo/error.log',
    out_file: '/var/log/udp-echo/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  }],
};
