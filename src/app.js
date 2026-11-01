'use strict';

const fs = require('node:fs');
const path = require('node:path');
const config = require('./config');
const { HttpError, sendJson, readJsonBody, Router } = require('./http');
const { validateTask, STATUSES, PRIORITIES } = require('./validation');

const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/**
 * Builds the request handler. The store is injected so tests can use an in-memory store.
 * @param {import('./store/taskStore')} store
 */
function createApp(store) {
  const startedAt = Date.now();
  const router = new Router();

  router.get('/health', (req, res) => {
    sendJson(res, 200, {
      status: 'ok',
      app: config.appName,
      version: config.version,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
    });
  });

  router.get('/api/tasks', (req, res, { query }) => {
    const status = query.get('status') || undefined;
    const priority = query.get('priority') || undefined;
    if (status && !STATUSES.includes(status)) throw new HttpError(400, `Unknown status filter: ${status}`);
    if (priority && !PRIORITIES.includes(priority)) throw new HttpError(400, `Unknown priority filter: ${priority}`);
    const tasks = store.list({ status, priority, q: query.get('q') || undefined });
    sendJson(res, 200, { count: tasks.length, data: tasks });
  });

  router.post('/api/tasks', async (req, res) => {
    const body = await readJsonBody(req);
    const { value, errors } = validateTask(body);
    if (errors.length) throw new HttpError(422, 'Validation failed', errors);
    sendJson(res, 201, { data: store.create(value) });
  });

  router.get('/api/tasks/:id', (req, res, { params }) => {
    const task = store.get(params.id);
    if (!task) throw new HttpError(404, 'Task not found');
    sendJson(res, 200, { data: task });
  });

  router.patch('/api/tasks/:id', async (req, res, { params }) => {
    if (!store.get(params.id)) throw new HttpError(404, 'Task not found');
    const body = await readJsonBody(req);
    const { value, errors } = validateTask(body, { partial: true });
    if (errors.length) throw new HttpError(422, 'Validation failed', errors);
    sendJson(res, 200, { data: store.update(params.id, value) });
  });

  router.delete('/api/tasks/:id', (req, res, { params }) => {
    if (!store.remove(params.id)) throw new HttpError(404, 'Task not found');
    sendJson(res, 204);
  });

  router.get('/api/stats', (req, res) => {
    sendJson(res, 200, { data: store.stats() });
  });

  function serveStatic(pathname, res) {
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    const filePath = path.normalize(path.join(PUBLIC_DIR, relative));
    if (!filePath.startsWith(PUBLIC_DIR)) return false; // path traversal guard
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;
    const type = MIME_TYPES[path.extname(filePath)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    fs.createReadStream(filePath).pipe(res);
    return true;
  }

  return async function handle(req, res) {
    const started = process.hrtime.bigint();
    const url = new URL(req.url, 'http://localhost');

    res.on('finish', () => {
      if (config.nodeEnv === 'test') return;
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      console.log(`${req.method} ${url.pathname} ${res.statusCode} ${ms.toFixed(1)}ms`);
    });

    try {
      const match = router.match(req.method, url.pathname);
      if (match && match.methodNotAllowed) throw new HttpError(405, 'Method not allowed');
      if (match) {
        await match.handler(req, res, { params: match.params, query: url.searchParams });
        return;
      }
      if (req.method === 'GET' && !url.pathname.startsWith('/api/') && serveStatic(url.pathname, res)) return;
      throw new HttpError(404, 'Route not found');
    } catch (err) {
      if (err instanceof HttpError) {
        sendJson(res, err.status, { error: err.message, ...(err.details ? { details: err.details } : {}) });
      } else {
        console.error('[error]', err);
        sendJson(res, 500, { error: 'Internal server error' });
      }
    }
  };
}

module.exports = { createApp };
