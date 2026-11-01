'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

/**
 * TaskStore keeps tasks in memory and persists them to a JSON file.
 * Writes are atomic (write to a temp file, then rename) so a crash
 * never leaves a half-written database behind.
 */
class TaskStore {
  /**
   * @param {string|null} dataDir Folder for tasks.json. Pass null for in-memory only (tests).
   */
  constructor(dataDir) {
    this.filePath = dataDir ? path.join(dataDir, 'tasks.json') : null;
    this.tasks = [];
    this.#load();
  }

  #load() {
    if (!this.filePath) return;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    if (!fs.existsSync(this.filePath)) {
      this.#persist();
      return;
    }
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      this.tasks = Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error(`[store] could not read ${this.filePath}, starting empty: ${err.message}`);
      this.tasks = [];
    }
  }

  #persist() {
    if (!this.filePath) return;
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.tasks, null, 2));
    fs.renameSync(tmp, this.filePath);
  }

  list({ status, priority, q } = {}) {
    let result = [...this.tasks];
    if (status) result = result.filter((t) => t.status === status);
    if (priority) result = result.filter((t) => t.priority === priority);
    if (q) {
      const needle = q.toLowerCase();
      result = result.filter(
        (t) => t.title.toLowerCase().includes(needle) || t.description.toLowerCase().includes(needle)
      );
    }
    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get(id) {
    return this.tasks.find((t) => t.id === id) || null;
  }

  create(data) {
    const now = new Date().toISOString();
    const task = {
      id: crypto.randomUUID(),
      title: data.title,
      description: data.description ?? '',
      status: data.status ?? 'todo',
      priority: data.priority ?? 'medium',
      dueDate: data.dueDate ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.push(task);
    this.#persist();
    return task;
  }

  update(id, changes) {
    const task = this.get(id);
    if (!task) return null;
    Object.assign(task, changes, { updatedAt: new Date().toISOString() });
    this.#persist();
    return task;
  }

  remove(id) {
    const index = this.tasks.findIndex((t) => t.id === id);
    if (index === -1) return false;
    this.tasks.splice(index, 1);
    this.#persist();
    return true;
  }

  stats() {
    const today = new Date().toISOString().slice(0, 10);
    const count = (fn) => this.tasks.filter(fn).length;
    return {
      total: this.tasks.length,
      byStatus: {
        todo: count((t) => t.status === 'todo'),
        in_progress: count((t) => t.status === 'in_progress'),
        done: count((t) => t.status === 'done'),
      },
      byPriority: {
        low: count((t) => t.priority === 'low'),
        medium: count((t) => t.priority === 'medium'),
        high: count((t) => t.priority === 'high'),
      },
      overdue: count((t) => t.status !== 'done' && t.dueDate && t.dueDate < today),
    };
  }
}

module.exports = TaskStore;
