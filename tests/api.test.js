'use strict';

process.env.NODE_ENV = 'test';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const TaskStore = require('../src/store/taskStore');
const { createApp } = require('../src/app');

let server;
let baseUrl;

async function request(method, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

before(async () => {
  server = http.createServer(createApp(new TaskStore(null)));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

describe('health', () => {
  it('GET /health returns ok', async () => {
    const { status, body } = await request('GET', '/health');
    assert.equal(status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(typeof body.uptimeSeconds, 'number');
  });
});

describe('tasks API', () => {
  let taskId;

  it('creates a task', async () => {
    const { status, body } = await request('POST', '/api/tasks', {
      title: 'Write Dockerfile',
      priority: 'high',
      dueDate: '2030-01-15',
    });
    assert.equal(status, 201);
    assert.equal(body.data.title, 'Write Dockerfile');
    assert.equal(body.data.status, 'todo');
    taskId = body.data.id;
  });

  it('rejects invalid tasks with 422', async () => {
    const { status, body } = await request('POST', '/api/tasks', { title: '', priority: 'urgent' });
    assert.equal(status, 422);
    assert.ok(body.details.length >= 2);
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await fetch(`${baseUrl}/api/tasks`, { method: 'POST', body: '{bad json' });
    assert.equal(res.status, 400);
  });

  it('lists and filters tasks', async () => {
    await request('POST', '/api/tasks', { title: 'Write README', priority: 'low' });
    const all = await request('GET', '/api/tasks');
    assert.equal(all.body.count, 2);
    const high = await request('GET', '/api/tasks?priority=high');
    assert.equal(high.body.count, 1);
    const search = await request('GET', '/api/tasks?q=readme');
    assert.equal(search.body.data[0].title, 'Write README');
  });

  it('gets a single task', async () => {
    const { status, body } = await request('GET', `/api/tasks/${taskId}`);
    assert.equal(status, 200);
    assert.equal(body.data.id, taskId);
  });

  it('updates a task status', async () => {
    const { status, body } = await request('PATCH', `/api/tasks/${taskId}`, { status: 'done' });
    assert.equal(status, 200);
    assert.equal(body.data.status, 'done');
  });

  it('returns stats', async () => {
    const { body } = await request('GET', '/api/stats');
    assert.equal(body.data.total, 2);
    assert.equal(body.data.byStatus.done, 1);
  });

  it('deletes a task', async () => {
    const del = await request('DELETE', `/api/tasks/${taskId}`);
    assert.equal(del.status, 204);
    const missing = await request('GET', `/api/tasks/${taskId}`);
    assert.equal(missing.status, 404);
  });

  it('returns 404 for unknown routes and 405 for wrong methods', async () => {
    assert.equal((await request('GET', '/api/unknown')).status, 404);
    assert.equal((await request('PUT', '/api/tasks')).status, 405);
  });
});

describe('web UI', () => {
  it('serves the index page', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /TaskPilot/);
  });

  it('blocks path traversal', async () => {
    const res = await fetch(`${baseUrl}/..%2f..%2fpackage.json`);
    assert.equal(res.status, 404);
  });
});
