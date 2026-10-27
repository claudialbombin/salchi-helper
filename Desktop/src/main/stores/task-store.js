/**
 * @file Base class shared by both task stores.
 *
 * A store owns the list of open tasks and notifies listeners with a `change` event
 * whenever anything the UI shows has changed.
 */
'use strict';

const { EventEmitter } = require('events');
const { sortByDue } = require('../due-dates');

/**
 * @typedef {object} Task
 * @property {string} id
 * @property {string} title
 * @property {string | null} [due] - See due-dates.js for the format.
 * @property {string | null} [calendarUrl] - Link to the Google Calendar event (Notion edition).
 */

/** How long a completed task stays visible (ticked) before it leaves the list. */
const COMPLETE_ANIMATION_MS = 450;

/**
 * @abstract
 */
class TaskStore extends EventEmitter {
  /**
   * Starts with an empty list; call `load()` to fill it.
   */
  constructor() {
    super();
    /** @type {Task[]} Open tasks, already sorted for display. */
    this.tasks = [];
    /** @type {Set<string>} Tasks being ticked off (shown struck through for a moment). */
    this.completing = new Set();
    /** @type {string | null} Last error, shown at the top of the list. */
    this.error = null;
    /** True while a load is in flight. */
    this.loading = false;
    /** Time of the last successful load, in ms since the epoch. */
    this.lastLoadAt = 0;
  }

  /**
   * @param {string} id
   * @returns {Task | undefined}
   */
  find(id) {
    return this.tasks.find((task) => task.id === id);
  }

  /**
   * Tasks that are still being saved cannot be edited yet.
   *
   * @param {string} id
   * @returns {boolean}
   */
  isPending(id) {
    return id.startsWith('pending-');
  }

  /**
   * Reloads the list only if it has not been refreshed recently.
   * Called when the list is opened, so it is fresh without hammering the backend.
   *
   * @param {number} maxAgeMs
   */
  refreshIfStale(maxAgeMs) {
    if (Date.now() - this.lastLoadAt > maxAgeMs) this.load();
  }

  /**
   * Ticks a task off: it stays visible for a moment, then leaves the list.
   *
   * @param {string} id
   */
  async complete(id) {
    // Keep a reference now: a reload during the animation skips tasks being completed.
    const task = this.find(id);
    if (!task || this.isPending(id) || this.completing.has(id)) return;
    this.completing.add(id);
    this.emitChange();

    await new Promise((resolve) => setTimeout(resolve, COMPLETE_ANIMATION_MS));
    this.tasks = this.tasks.filter((t) => t.id !== id);
    this.emitChange();

    try {
      await this.persistCompletion(task);
    } catch (err) {
      this.error = err.message;
      this.completing.delete(id);
      await this.load(); // bring the task back if it could not be saved
      return;
    }
    this.completing.delete(id);
    this.emitChange();
  }

  /**
   * Re-sorts the list in place after a change that may affect the order.
   *
   * @protected
   */
  resort() {
    this.tasks = sortByDue(this.tasks);
  }

  /**
   * @protected
   */
  emitChange() {
    this.emit('change');
  }

  /* ---- To be implemented by each store ---- */

  /** @abstract @returns {Promise<void>} */
  async load() { throw new Error('not implemented'); }

  /** @abstract @param {string} title @param {string | null} due */
  async add(title, due) { throw new Error('not implemented'); }

  /** @abstract @param {string} id @param {string | null} due */
  async setDue(id, due) { throw new Error('not implemented'); }

  /**
   * @abstract
   * @protected
   * @param {Task} task
   */
  async persistCompletion(task) { throw new Error('not implemented'); }

  /**
   * Extra entries for the right-click menu of a task, specific to each edition.
   *
   * @param {Task} task
   * @param {{ openExternal: (url: string) => void }} helpers
   * @returns {Electron.MenuItemConstructorOptions[]}
   */
  extraMenuItems(task, helpers) { return []; }
}

module.exports = { TaskStore };
