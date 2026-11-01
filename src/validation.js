'use strict';

const STATUSES = ['todo', 'in_progress', 'done'];
const PRIORITIES = ['low', 'medium', 'high'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates a task payload.
 * @param {object} body Incoming JSON body.
 * @param {{partial?: boolean}} options partial=true for PATCH (fields optional).
 * @returns {{ value: object, errors: string[] }}
 */
function validateTask(body, { partial = false } = {}) {
  const errors = [];
  const value = {};

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { value, errors: ['Request body must be a JSON object'] };
  }

  if (body.title !== undefined || !partial) {
    if (typeof body.title !== 'string' || body.title.trim().length === 0) {
      errors.push('title is required and must be a non-empty string');
    } else if (body.title.trim().length > 120) {
      errors.push('title must be at most 120 characters');
    } else {
      value.title = body.title.trim();
    }
  }

  if (body.description !== undefined) {
    if (typeof body.description !== 'string' || body.description.length > 1000) {
      errors.push('description must be a string of at most 1000 characters');
    } else {
      value.description = body.description.trim();
    }
  }

  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) errors.push(`status must be one of: ${STATUSES.join(', ')}`);
    else value.status = body.status;
  }

  if (body.priority !== undefined) {
    if (!PRIORITIES.includes(body.priority)) errors.push(`priority must be one of: ${PRIORITIES.join(', ')}`);
    else value.priority = body.priority;
  }

  if (body.dueDate !== undefined) {
    if (body.dueDate === null || body.dueDate === '') {
      value.dueDate = null;
    } else if (typeof body.dueDate !== 'string' || !DATE_RE.test(body.dueDate) || Number.isNaN(Date.parse(body.dueDate))) {
      errors.push('dueDate must be a date in YYYY-MM-DD format');
    } else {
      value.dueDate = body.dueDate;
    }
  }

  if (partial && errors.length === 0 && Object.keys(value).length === 0) {
    errors.push('Provide at least one field to update');
  }

  return { value, errors };
}

module.exports = { validateTask, STATUSES, PRIORITIES };
