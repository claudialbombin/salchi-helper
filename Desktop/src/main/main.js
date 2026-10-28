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

const fs = require('fs');
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
const i18n = require('./i18n');
const { t } = i18n;

const POLL_INTERVAL_MS = 20_000;     // background refresh of the Notion list
const STALE_AFTER_MS = 5_000;        // refresh when the list is opened if older than this
const MAX_TITLE_LENGTH = 2_000;

const edition = resolveEdition();
const config = new ConfigStore(app.getPath('userData'));
const notion = new NotionClient(() => config.getToken());

/**
 * Adopts the language picked in the Windows installer, if any.
 *
 * The installer writes it to `resources/install-language.txt`. It is applied once per value,
 * so installing again with a different choice switches the language, while a choice made
 * later in the settings is not overwritten on every launch.
 */
function adoptInstallerLanguage() {
  if (!app.isPackaged) return;
  let code;
  try {
    code = fs.readFileSync(path.join(process.resourcesPath, 'install-language.txt'), 'utf8').trim();
  } catch {
    return; // no installer choice (Linux, or an older installer)
  }
  if (i18n.isSupported(code) && code !== config.get('installerLanguage')) {
    config.set('language', code);
    config.set('installerLanguage', code);
  }
}

/**
 * @param {string} code - A Salchi language code.
 * @returns {string} The matching Chromium UI locale (used by date and time inputs).
 */
function chromiumLocale(code) {
  return { 'zh-Hans': 'zh-CN', 'zh-Hant': 'zh-TW' }[code] || code;
}

// The language has to be known before Chromium starts: it decides how <input type="time">
// is shown (24-hour clock or AM/PM). Until the user picks one, guess it from the system.
config.load();
adoptInstallerLanguage();
i18n.setLanguage(config.get('language')
  || i18n.bestLanguage([process.env.LC_ALL, process.env.LANG, Intl.DateTimeFormat().resolvedOptions().locale]
    .filter(Boolean).map((locale) => locale.split('.')[0])));
const startupLocale = chromiumLocale(i18n.language());
app.commandLine.appendSwitch('lang', startupLocale);

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
    language: i18n.language(),
    chooseLanguage: floating.ui.chooseLanguage,
  });
  tray?.setPendingCount(store.tasks.length);
}

/**
 * Sends the strings of the current language to the renderer, with the list of languages for
 * the chooser and the text direction (right-to-left for Arabic, Hebrew, Persian and Urdu).
 */
function pushStrings() {
  const language = i18n.language();
  floating?.send('i18n', {
    language,
    dir: i18n.directionOf(language),
    strings: i18n.strings(language),
    languages: i18n.LANGUAGES,
  });
}

/**
 * Switches the interface language and remembers it.
 *
 * @param {unknown} code
 */
function setLanguage(code) {
  if (!i18n.isSupported(code)) return;
  config.set('language', code);

  // Chromium reads its locale only at start-up, and the time field follows it (24-hour clock
  // or AM/PM). When that has to change, restart Salchi; it comes back in the same place.
  if (app.isPackaged && chromiumLocale(code) !== startupLocale) {
    // An AppImage runs from a temporary mount that disappears when this process exits, so it
    // must be restarted from the .AppImage file itself (its launcher adds the usual flags).
    app.relaunch(process.env.APPIMAGE ? { execPath: process.env.APPIMAGE, args: [] } : undefined);
    app.exit(0);
    return;
  }

  i18n.setLanguage(code);
  tray?.relabel();
  pushStrings();

  if (floating.ui.chooseLanguage) {
    // First run: once the language is chosen, carry on with the usual start-up.
    floating.closeLanguageChooser();
    if (needsNotionSetup()) floating.openSettings();
  }
  pushState();
}

/**
 * @returns {boolean} Whether the Notion edition still lacks a token or a page.
 */
function needsNotionSetup() {
  return edition === Edition.NOTION && (!config.getToken() || !config.get('databaseId'));
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
    { label: t('task.done'), click: () => store.complete(id) },
    {
      label: task.due ? t('task.changeDateMenu') : t('task.addDateMenu'),
      click: () => floating.send('task-action', { action: 'pick-date', id }),
    },
  ];
  if (task.due) template.push({ label: t('task.removeDate'), click: () => store.setDue(id, null) });
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
    if (!config.getToken()) throw new Error(t('errors.pasteToken'));

    const link = String(form.link || '').trim();
    if (link && extractNotionId(link) !== config.get('databaseId')) {
      const { databaseId, doneProperty } = await notion.resolveTaskDatabase(link);
      config.set('databaseId', databaseId);
      config.set('doneProperty', doneProperty);
    }
    if (!config.get('databaseId')) throw new Error(t('errors.pasteLink'));

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
  ipcMain.on('ready', () => {
    pushStrings();
    pushState();
  });
  ipcMain.on('set-language', (_event, code) => setLanguage(code));
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

  // Now that Electron is ready, the system's preferred languages give a better first guess.
  if (!config.get('language')) i18n.setLanguage(i18n.bestLanguage(app.getPreferredSystemLanguages()));

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
    if (!config.get('language')) floating.openLanguageChooser();
    else if (needsNotionSetup()) floating.openSettings();
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
