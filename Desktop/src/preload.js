/**
 * @file Bridge between the renderer and the main process.
 *
 * The renderer runs with context isolation and no Node.js access. It can only use the small
 * `window.salchi` API defined here, and can only send the messages listed in `ALLOWED`.
 */
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/** Messages the renderer is allowed to send to the main process. */
const ALLOWED = new Set([
  'ready',
  'hover',
  'drag-start',
  'drag-end',
  'ui',
  'refresh',
  'add-task',
  'complete-task',
  'delete-task',
  'set-due',
  'task-menu',
  'open-url',
  'set-autostart',
  'set-language',
]);

contextBridge.exposeInMainWorld('salchi', {
  /**
   * Subscribes to full UI state updates.
   *
   * @param {(state: object) => void} callback
   */
  onState: (callback) => ipcRenderer.on('state', (_event, state) => callback(state)),

  /**
   * Subscribes to the interface strings, sent at start-up and whenever the language changes.
   *
   * @param {(bundle: { language: string, dir: 'ltr' | 'rtl', strings: Record<string, string>,
   *   languages: { code: string, name: string, dir: string }[] }) => void} callback
   */
  onStrings: (callback) => ipcRenderer.on('i18n', (_event, bundle) => callback(bundle)),

  /**
   * Subscribes to actions chosen in a native menu (e.g. "Add a date…").
   *
   * @param {(action: { action: string, id: string }) => void} callback
   */
  onTaskAction: (callback) => ipcRenderer.on('task-action', (_event, action) => callback(action)),

  /**
   * Sends a fire-and-forget message to the main process.
   *
   * @param {string} channel - Must be one of `ALLOWED`.
   * @param {unknown} [payload]
   */
  send: (channel, payload) => {
    if (ALLOWED.has(channel)) ipcRenderer.send(channel, payload);
  },

  /**
   * Saves the Notion settings and reports whether they worked.
   *
   * @param {{ token: string, link: string }} form
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  saveSettings: (form) => ipcRenderer.invoke('save-settings', form),
});
