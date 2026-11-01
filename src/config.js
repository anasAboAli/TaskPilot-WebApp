'use strict';

const path = require('node:path');
const pkg = require('../package.json');

/**
 * Central configuration, read from environment variables with safe defaults.
 */
const config = {
  appName: 'TaskPilot',
  version: pkg.version,
  host: process.env.HOST || '0.0.0.0',
  port: Number.parseInt(process.env.PORT, 10) || 3000,
  dataDir: path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data')),
  nodeEnv: process.env.NODE_ENV || 'development',
};

module.exports = config;
