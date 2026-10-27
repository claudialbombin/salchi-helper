/**
 * @file "Open at login" support.
 *
 * Windows uses Electron's login-item API. Linux has no such API, so we follow the
 * freedesktop.org autostart spec and drop a `.desktop` file in `~/.config/autostart`.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const IS_LINUX = process.platform === 'linux';

/**
 * @returns {string} Path of the autostart entry used on Linux.
 */
function linuxEntryPath() {
  return path.join(app.getPath('home'), '.config', 'autostart', 'salchi.desktop');
}

/**
 * Finds the command that starts Salchi again after login.
 *
 * Inside an AppImage `process.execPath` points to a temporary mount, so the AppImage file
 * itself must be used. Packaged builds have a small launcher script next to the real
 * binary (see build/hooks/after-pack.js), which is preferred because it sets the right flags.
 *
 * @returns {string}
 */
function linuxLaunchCommand() {
  if (process.env.APPIMAGE) return process.env.APPIMAGE;
  const launcher = process.execPath.replace(/\.bin$/, '');
  return fs.existsSync(launcher) ? launcher : process.execPath;
}

/**
 * @returns {boolean} Whether Salchi currently starts at login.
 */
function isEnabled() {
  if (!IS_LINUX) return app.getLoginItemSettings().openAtLogin;
  return fs.existsSync(linuxEntryPath());
}

/**
 * Turns "open at login" on or off.
 *
 * @param {boolean} enabled
 */
function setEnabled(enabled) {
  if (!IS_LINUX) {
    app.setLoginItemSettings({ openAtLogin: enabled });
    return;
  }

  const entry = linuxEntryPath();
  if (!enabled) {
    fs.rmSync(entry, { force: true });
    return;
  }

  fs.mkdirSync(path.dirname(entry), { recursive: true });
  fs.writeFileSync(entry, [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Salchi',
    'Comment=Tu perrito salchicha de las notitas',
    `Exec="${linuxLaunchCommand()}"`,
    'Icon=salchi',
    'X-GNOME-Autostart-enabled=true',
    '',
  ].join('\n'));
}

module.exports = { isEnabled, setEnabled };
