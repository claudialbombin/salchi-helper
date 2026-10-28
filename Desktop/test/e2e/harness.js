/**
 * @file Tiny helpers shared by the end-to-end tests.
 *
 * Each test is loaded with `electron -r <test> .`, so it runs in the main process before
 * the app itself. It isolates the user-data folder, waits for the window and then drives
 * the real UI through `executeJavaScript`, just like a user clicking around.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { app } = require('electron');

/**
 * Points the app at a fresh, empty user-data folder and returns it.
 *
 * @returns {string}
 */
function isolateUserData() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'salchi-test-'));
  app.setPath('userData', dir);
  return dir;
}

/**
 * Runs `scenario` once the window has loaded, then exits with 0 (pass) or 1 (fail).
 *
 * @param {(t: { js: Function, wait: Function, check: Function, win: Electron.BrowserWindow }) => Promise<void>} scenario
 */
function runScenario(scenario) {
  const failures = [];

  /** @param {boolean} condition @param {string} label */
  const check = (condition, label) => {
    console.log(`${condition ? '  ✔' : '  ✘'} ${label}`);
    if (!condition) failures.push(label);
  };
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  app.on('browser-window-created', (_event, win) => {
    win.webContents.once('did-finish-load', async () => {
      const js = (code) => win.webContents.executeJavaScript(code);
      try {
        await wait(1200);
        await scenario({ js, wait, check, win });
      } catch (err) {
        check(false, `scenario crashed: ${err.stack || err}`);
      }
      app.exit(failures.length ? 1 : 0);
    });
  });
}

/**
 * Intercepts context menus (menus shown with `popup`) so they can be inspected and
 * "clicked" without a real native menu. Other menus, like the tray's, are left alone.
 *
 * @returns {{ last: () => Electron.MenuItemConstructorOptions[], built: () => Electron.MenuItemConstructorOptions[][],
 *   click: (label: string) => void }}
 */
function captureMenus() {
  const { Menu } = require('electron');
  const buildFromTemplate = Menu.buildFromTemplate.bind(Menu);
  let lastTemplate = [];
  const built = [];
  Menu.buildFromTemplate = (template) => {
    built.push(template);
    const menu = buildFromTemplate(template);
    menu.popup = (options) => {
      lastTemplate = template;
      if (options && options.callback) options.callback();
    };
    return menu;
  };
  return {
    last: () => lastTemplate,
    /** Every menu built so far, popped up or not (the tray's included), newest last. */
    built: () => built,
    click: (label) => lastTemplate.find((item) => item.label === label).click(),
  };
}

/** @returns {string} "YYYY-MM-DD" for today + `days`, in local time. */
function localDate(days = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

module.exports = { isolateUserData, runScenario, captureMenus, localDate };
