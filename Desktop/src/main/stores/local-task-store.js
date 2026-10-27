/**
 * @file Task store backed by a JSON file on this computer (the "local" edition).
 *
 * File layout (`tasks.json` in the user-data folder):
 *   { "pending": [Task…], "done": [Task & { completedAt }…] }
 * Completed tasks are kept as a small history (the most recent `HISTORY_LIMIT`).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { TaskStore } = require('./task-store');
const { googleCalendarTemplateUrl } = require('../due-dates');

const HISTORY_LIMIT = 500;

/**
 * Task store for the local edition.
 */
class LocalTaskStore extends TaskStore {
  /**
   * @param {string} directory - Folder that holds `tasks.json`.
   */
  constructor(directory) {
    super();
    /** @private */
    this.file = path.join(directory, 'tasks.json');
    /** @private File written by version 1.0, migrated on first load. */
    this.legacyFile = path.join(directory, 'tareas.json');
    /** @private @type {Array<object>} */
    this.history = [];
  }

  /**
   * Reads the tasks from disk. Never fails: a missing or unreadable file means an empty list.
   */
  async load() {
    const data = this.readFile();
    this.tasks = data.pending;
    this.history = data.done;
    this.resort();
    this.lastLoadAt = Date.now();
    this.emitChange();
  }

  /**
   * @param {string} title
   * @param {string | null} due
   */
  async add(title, due) {
    const task = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      title,
      createdAt: new Date().toISOString(),
    };
    if (due) task.due = due;
    this.tasks.push(task);
    this.resort();
    this.writeFile();
    this.emitChange();
  }

  /**
   * @param {string} id
   * @param {string | null} due
   */
  async setDue(id, due) {
    const task = this.find(id);
    if (!task) return;
    if (due) task.due = due;
    else delete task.due;
    this.resort();
    this.writeFile();
    this.emitChange();
  }

  /**
   * Deletes a task for good (it does not go to the history).
   *
   * @param {string} id
   */
  remove(id) {
    this.tasks = this.tasks.filter((task) => task.id !== id);
    this.writeFile();
    this.emitChange();
  }

  /**
   * @protected
   * @param {import('./task-store').Task} task
   */
  async persistCompletion(task) {
    this.history.push({ ...task, completedAt: new Date().toISOString() });
    this.writeFile();
  }

  /**
   * @param {import('./task-store').Task} task
   * @param {{ openExternal: (url: string) => void }} helpers
   */
  extraMenuItems(task, { openExternal }) {
    const items = [];
    if (task.due) {
      items.push({ label: 'Añadir a Google Calendar', click: () => openExternal(googleCalendarTemplateUrl(task)) });
    }
    items.push({ type: 'separator' }, { label: 'Borrar', click: () => this.remove(task.id) });
    return items;
  }

  /**
   * @private
   * @returns {{ pending: object[], done: object[] }}
   */
  readFile() {
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      return {
        pending: Array.isArray(data.pending) ? data.pending : [],
        done: Array.isArray(data.done) ? data.done : [],
      };
    } catch {
      return this.readLegacyFile();
    }
  }

  /**
   * Imports the Spanish-keyed file used by version 1.0 so nobody loses their tasks.
   * The old file is left untouched as a backup.
   *
   * @private
   * @returns {{ pending: object[], done: object[] }}
   */
  readLegacyFile() {
    try {
      const legacy = JSON.parse(fs.readFileSync(this.legacyFile, 'utf8'));
      const convert = ({ creada, hecha, ...rest }) => ({
        ...rest,
        ...(creada && { createdAt: creada }),
        ...(hecha && { completedAt: hecha }),
      });
      const data = {
        pending: (Array.isArray(legacy.pendientes) ? legacy.pendientes : []).map(convert),
        done: (Array.isArray(legacy.hechas) ? legacy.hechas : []).map(convert),
      };
      this.tasks = data.pending;
      this.history = data.done;
      this.writeFile();
      return data;
    } catch {
      return { pending: [], done: [] };
    }
  }

  /**
   * Saves atomically (write to a temp file, then rename) so a crash never leaves a
   * half-written file behind.
   *
   * @private
   */
  writeFile() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temp = `${this.file}.tmp`;
    fs.writeFileSync(temp, JSON.stringify({
      pending: this.tasks,
      done: this.history.slice(-HISTORY_LIMIT),
    }, null, 2));
    fs.renameSync(temp, this.file);
  }
}

module.exports = { LocalTaskStore };
