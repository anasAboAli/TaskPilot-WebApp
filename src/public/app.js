'use strict';

const $ = (sel) => document.querySelector(sel);
const STATUS_LABEL = { todo: 'To do', in_progress: 'In progress', done: 'Done' };
const NEXT_STATUS = { todo: 'in_progress', in_progress: 'done', done: 'todo' };

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  const body = await res.json();
  if (!res.ok) {
    const msg = body.details ? body.details.join(' · ') : body.error;
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return body;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function checkHealth() {
  const el = $('#health');
  try {
    const h = await api('/health');
    el.className = 'health ok';
    $('#health-text').textContent = `healthy · v${h.version} · up ${h.uptimeSeconds}s`;
  } catch {
    el.className = 'health down';
    $('#health-text').textContent = 'server unreachable';
  }
}

async function loadStats() {
  const { data } = await api('/api/stats');
  $('#s-total').textContent = data.total;
  $('#s-todo').textContent = data.byStatus.todo;
  $('#s-progress').textContent = data.byStatus.in_progress;
  $('#s-done').textContent = data.byStatus.done;
  $('#s-overdue').textContent = data.overdue;
}

function renderTask(task) {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = task.status !== 'done' && task.dueDate && task.dueDate < today;
  const li = document.createElement('li');
  li.className = `task ${task.status}`;
  li.innerHTML = `
    <input type="checkbox" ${task.status === 'done' ? 'checked' : ''} aria-label="Mark as done" />
    <div>
      <div class="title">${escapeHtml(task.title)}</div>
      ${task.description ? `<div class="desc">${escapeHtml(task.description)}</div>` : ''}
      <div class="meta">
        <span class="badge ${task.priority}">${task.priority}</span>
        <span class="badge ${task.status}">${STATUS_LABEL[task.status]}</span>
        ${task.dueDate ? `<span class="badge ${overdue ? 'overdue' : ''}">due ${task.dueDate}</span>` : ''}
      </div>
    </div>
    <div class="actions">
      <button class="icon" data-action="advance" title="Move to next status">→ ${STATUS_LABEL[NEXT_STATUS[task.status]]}</button>
      <button class="icon danger" data-action="delete" title="Delete task">Delete</button>
    </div>`;

  li.querySelector('input').addEventListener('change', (e) =>
    updateTask(task.id, { status: e.target.checked ? 'done' : 'todo' })
  );
  li.querySelector('[data-action=advance]').addEventListener('click', () =>
    updateTask(task.id, { status: NEXT_STATUS[task.status] })
  );
  li.querySelector('[data-action=delete]').addEventListener('click', async () => {
    await api(`/api/tasks/${task.id}`, { method: 'DELETE' });
    refresh();
  });
  return li;
}

async function loadTasks() {
  const params = new URLSearchParams();
  const status = $('#filter-status').value;
  const priority = $('#filter-priority').value;
  const q = $('#search').value.trim();
  if (status) params.set('status', status);
  if (priority) params.set('priority', priority);
  if (q) params.set('q', q);

  const { data } = await api(`/api/tasks?${params}`);
  const list = $('#tasks');
  list.replaceChildren(...data.map(renderTask));
  $('#empty').style.display = data.length ? 'none' : 'block';
}

async function updateTask(id, changes) {
  await api(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(changes) });
  refresh();
}

function refresh() {
  return Promise.all([loadTasks(), loadStats()]);
}

$('#task-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = $('#form-error');
  errorEl.textContent = '';
  const payload = {
    title: $('#title').value,
    description: $('#description').value,
    priority: $('#priority').value,
    dueDate: $('#dueDate').value || null,
  };
  try {
    await api('/api/tasks', { method: 'POST', body: JSON.stringify(payload) });
    e.target.reset();
    refresh();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

let searchTimer;
$('#search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadTasks, 250);
});
$('#filter-status').addEventListener('change', loadTasks);
$('#filter-priority').addEventListener('change', loadTasks);

checkHealth();
setInterval(checkHealth, 15000);
refresh();
