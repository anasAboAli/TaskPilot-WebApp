'use strict';

const http = require('node:http');
const config = require('./config');
const TaskStore = require('./store/taskStore');
const { createApp } = require('./app');

const store = new TaskStore(config.dataDir);
const server = http.createServer(createApp(store));

server.listen(config.port, config.host, () => {
  console.log(`${config.appName} v${config.version} listening on http://${config.host}:${config.port}`);
  console.log(`Data directory: ${config.dataDir}`);
});

// Graceful shutdown: Docker sends SIGTERM on `docker stop`.
function shutdown(signal) {
  console.log(`${signal} received, shutting down gracefully...`);
  server.close(() => {
    console.log('Server closed. Bye!');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
