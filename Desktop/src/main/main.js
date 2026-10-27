/**
 * @file Entry point of the Salchi desktop app (Windows and Linux).
 *
 * Wires together:
 *   - the task store (Notion or local file, depending on the edition),
 *   - the floating window with the dachshund,
 *   - the tray icon,
 *   - the IPC channel used by the renderer (see preload.js for the allowed messages).
 */
'use strict';

const path = require('path');
const { app, ipcMain, shell } = require('electron');

const { Edition, resolveEdition } = require('./edition');
const { ConfigStore } = require('./config');
const autostart = require('./autostart');
const { normalizeDue, isGoogleCalendarUrl } = require('./due-dates');
const { NotionClient, extractNotionId } = require('./notion-client');
const { NotionTaskStore } = require('./stores/notion-task-store');
const { LocalTaskStore } = require('./stores/local-task-store');
const { FloatingWindow } = require('./floating-window');
const { createTray } = require('./tray');

const POLL_INTERVAL_MS = 20_000;     // background refresh of the Notion list
const STALE_AFTER_MS = 5_000;        // refresh when the list is opened if older than this
const MAX_TITLE_LENGTH = 2_000;

// Chromium takes its UI locale from the OS. Forcing Spanish keeps <input type="time"> in
// 24-hour format and matches the language of the interface.
app.commandLine.appendSwitch('lang', 'es-ES');

const edition = resolveEdition();
const config = new ConfigStore(app.getPath('userData'));
const notion = new NotionClient(() => config.getToken());

/** @type {import('./stores/task-store').TaskStore} */
let store;
/** @type {FloatingWindow} */
let floating;
/** @type {{ setPendingCount: (count: number) => void } | null} */
let tray = null;

/**
 * Sends the full UI state to the renderer and updates the tray tooltip.
 * The state is small, so sending all of it keeps the renderer stateless and simple.
 */
function pushState() {
  floating?.send('state', {
    edition,
    tasks: store.tasks,
    completing: [...store.completing],
    error: store.error,
    loading: store.loading,
    expanded: floating.ui.expanded,
    pinned: floating.ui.pinned,
    settings: floating.ui.settings,
    hasToken: !!config.getToken(),
    databaseId: config.get('databaseId') || '',
    autostart: autostart.isEnabled(),
  });
  tray?.setPendingCount(store.tasks.length);
}

/**
 * Opens a URL in the browser, but only if it is a Google Calendar link.
 * The renderer is not trusted to open arbitrary URLs.
 *
 * @param {unknown} url
 */
function openCalendarUrl(url) {
  if (isGoogleCalendarUrl(url)) shell.openExternal(url);
}

/**
 * Shows the right-click menu for a task.
 *
 * @param {string} id
 */
function showTaskMenu(id) {
  const task = store.find(id);
  if (!task || store.isPending(id)) return;

  const template = [
    { label: 'Hecho', click: () => store.complete(id) },
    {
      label: task.due ? 'Cambiar fecha…' : 'Ponerle fecha…',
      click: () => floating.send('task-action', { action: 'pick-date', id }),
    },
  ];
  if (task.due) template.push({ label: 'Quitar fecha', click: () => store.setDue(id, null) });
  template.push(...store.extraMenuItems(task, { openExternal: (url) => shell.openExternal(url) }));

  floating.popupMenu(template);
}

/**
 * Validates and applies the Notion settings form.
 *
 * @param {{ token?: string, link?: string }} form
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
async function saveNotionSettings(form) {
  try {
    const token = String(form.token || '').trim();
    if (token) config.setToken(token);
    if (!config.getToken()) throw new Error('Pega el token de tu integración de Notion.');

    const link = String(form.link || '').trim();
    if (link && extractNotionId(link) !== config.get('databaseId')) {
      const { databaseId, doneProperty } = await notion.resolveTaskDatabase(link);
      config.set('databaseId', databaseId);
      config.set('doneProperty', doneProperty);
    }
    if (!config.get('databaseId')) throw new Error('Pega el enlace de una página de Notion.');

    store.error = null;
    floating.applyUiPatch({ settings: false });
    store.load();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Registers every message the renderer may send.
 */
function registerIpc() {
  ipcMain.on('ready', pushState);
  ipcMain.on('hover', (_event, inside) => floating.handleRendererHover(!!inside));
  ipcMain.on('drag-start', () => floating.startDrag());
  ipcMain.on('drag-end', () => floating.endDrag());
  ipcMain.on('ui', (_event, patch) => floating.applyUiPatch(patch || {}));
  ipcMain.on('refresh', () => store.load());

  ipcMain.on('add-task', (_event, payload) => {
    const title = String(payload?.title || '').trim().slice(0, MAX_TITLE_LENGTH);
    if (title) store.add(title, normalizeDue(payload?.due));
  });
  ipcMain.on('complete-task', (_event, id) => store.complete(String(id)));
  ipcMain.on('set-due', (_event, payload) => {
    if (typeof payload?.id === 'string') store.setDue(payload.id, normalizeDue(payload.due));
  });
  ipcMain.on('delete-task', (_event, id) => {
    if (store instanceof LocalTaskStore) store.remove(String(id));
  });
  ipcMain.on('task-menu', (_event, id) => showTaskMenu(String(id)));
  ipcMain.on('open-url', (_event, url) => openCalendarUrl(url));

  ipcMain.on('set-autostart', (_event, enabled) => {
    autostart.setEnabled(!!enabled);
    pushState();
  });
  ipcMain.handle('save-settings', (_event, form) => saveNotionSettings(form || {}));
}

/**
 * Creates everything once Electron is ready.
 */
function start() {
  app.setAppUserModelId('com.claudia.salchi');
  config.load();

  // Open at login by default, but only decide that once so the user's choice sticks.
  if (config.get('autostartSet') === undefined) {
    autostart.setEnabled(true);
    config.set('autostartSet', true);
  }

  store = edition === Edition.LOCAL
    ? new LocalTaskStore(app.getPath('userData'))
    : new NotionTaskStore(notion, config);
  store.on('change', pushState);

  floating = new FloatingWindow({
    config,
    preload: path.join(__dirname, '..', 'preload.js'),
    page: path.join(__dirname, '..', 'renderer', 'index.html'),
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
  });
  floating.on('ui-change', pushState);
  floating.on('expand', () => store.refreshIfStale(STALE_AFTER_MS));
  floating.on('ready', () => {
    const needsSetup = edition === Edition.NOTION && (!config.getToken() || !config.get('databaseId'));
    if (needsSetup) floating.openSettings();
    else if (floating.ui.pinned) floating.setExpanded(true);
    pushState();
  });

  registerIpc();
  floating.create();

  const isNotion = edition === Edition.NOTION;
  tray = createTray({
    iconPath: path.join(__dirname, '..', 'assets', 'tray.png'),
    actions: {
      toggleVisible: () => floating.toggleVisible(),
      openSettings: () => floating.openSettings(),
      quit: () => app.quit(),
      refresh: isNotion ? () => store.load() : undefined,
      openInNotion: isNotion
        ? () => config.get('databaseId') && shell.openExternal(`https://www.notion.so/${config.get('databaseId')}`)
        : undefined,
    },
  });

  store.load();
  if (isNotion) setInterval(() => store.load(), POLL_INTERVAL_MS);
}

// Only one Salchi at a time: launching it again just brings the existing one forward.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => floating?.window?.showInactive());
  app.whenReady().then(start);
  // Closing the window must not quit the app: it lives in the tray.
  app.on('window-all-closed', () => {});
}
