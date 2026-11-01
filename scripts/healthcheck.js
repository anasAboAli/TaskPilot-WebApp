'use strict';

/**
 * Docker HEALTHCHECK script.
 * Uses Node's built-in http module so the image does not need curl or wget.
 * Exit code 0 = healthy, 1 = unhealthy.
 */
const http = require('node:http');

const port = process.env.PORT || 3000;

const req = http.get({ host: '127.0.0.1', port, path: '/health', timeout: 3000 }, (res) => {
  process.exit(res.statusCode === 200 ? 0 : 1);
});

req.on('timeout', () => {
  req.destroy();
  process.exit(1);
});
req.on('error', () => process.exit(1));
