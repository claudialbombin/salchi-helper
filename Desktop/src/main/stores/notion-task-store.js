/**
 * @file Task store backed by a Notion database (the "notion" edition).
 *
 * Edits are optimistic: the UI updates immediately and the change is sent to Notion in the
 * background. If Notion rejects it, the list is reloaded so it never lies for long.
 */
'use strict';

const { TaskStore } = require('./task-store');

/**
 * Task store for the Notion edition.
 */
class NotionTaskStore extends TaskStore {
  /**
   * @param {import('../notion-client').NotionClient} client
   * @param {import('../config').ConfigStore} config
   */
  constructor(client, config) {
    super();
    /** @private */
    this.client = client;
    /** @private */
    this.config = config;
    /** @private Database whose schema has already been checked during this session. */
    this.schemaCheckedFor = null;
  }

  /** @returns {string | undefined} */
  get databaseId() {
    return this.config.get('databaseId');
  }

  /** @returns {string} Name of the checkbox column that marks a task as done. */
  get doneProperty() {
    return this.config.get('doneProperty') || 'Hecho';
  }

  /**
   * Fetches the open tasks. Tasks still being created locally are kept at the end.
   */
  async load() {
    if (this.loading) return;
    this.loading = true;
    this.emitChange();

    try {
      if (!this.databaseId) throw new Error('Falta elegir la página de Notion: abre ⚙ ajustes.');
      if (this.schemaCheckedFor !== this.databaseId) {
        await this.client.ensureSchema(this.databaseId);
        this.schemaCheckedFor = this.databaseId;
      }

      const fetched = await this.client.queryOpenTasks(this.databaseId, this.doneProperty);
      const pending = this.tasks.filter((task) => this.isPending(task.id));
      this.tasks = fetched.filter((task) => !this.completing.has(task.id)).concat(pending);
      this.resort();
      this.error = null;
      this.lastLoadAt = Date.now();
    } catch (err) {
      this.error = err.message;
    }

    this.loading = false;
    this.emitChange();
  }

  /**
   * @param {string} title
   * @param {string | null} due
   */
  async add(title, due) {
    const placeholder = { id: `pending-${Date.now()}-${Math.random().toString(16).slice(2)}`, title, due, calendarUrl: null };
    this.tasks.push(placeholder);
    this.resort();
    this.emitChange();

    try {
      const id = await this.client.createTask(this.databaseId, title, due);
      // A refresh may have brought the new page in already; avoid showing it twice.
      if (this.find(id)) {
        this.tasks = this.tasks.filter((task) => task !== placeholder);
      } else {
        Object.assign(placeholder, { id });
      }
    } catch (err) {
      this.tasks = this.tasks.filter((task) => task !== placeholder);
      this.error = err.message;
    }
    this.emitChange();
  }

  /**
   * @param {string} id
   * @param {string | null} due
   */
  async setDue(id, due) {
    const task = this.find(id);
    if (!task || this.isPending(id)) return;
    task.due = due;
    this.resort();
    this.emitChange();

    try {
      await this.client.setDue(id, due);
    } catch (err) {
      this.error = err.message;
      await this.load();
    }
  }

  /**
   * @protected
   * @param {import('./task-store').Task} task
   */
  persistCompletion(task) {
    return this.client.markDone(task.id, this.doneProperty);
  }

  /**
   * @param {import('./task-store').Task} task
   * @param {{ openExternal: (url: string) => void }} helpers
   */
  extraMenuItems(task, { openExternal }) {
    const items = [];
    if (task.calendarUrl) {
      items.push({ label: 'Abrir en Google Calendar', click: () => openExternal(task.calendarUrl) });
    }
    items.push(
      { type: 'separator' },
      { label: 'Abrir en Notion', click: () => openExternal(`https://www.notion.so/${task.id.replace(/-/g, '')}`) },
    );
    return items;
  }
}

module.exports = { NotionTaskStore };
