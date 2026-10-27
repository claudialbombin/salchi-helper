/**
 * @file Persistent settings stored as JSON in the app's user-data folder.
 *
 * The Notion token is the only secret. When the OS offers an encrypted store (DPAPI on
 * Windows, libsecret/kwallet on Linux) it is encrypted with Electron's `safeStorage`;
 * otherwise it falls back to base64 so the app still works on minimal Linux setups.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { safeStorage } = require('electron');

/**
 * Reads and writes `config.json`. Every `set` is persisted immediately.
 */
class ConfigStore {
  /**
   * @param {string} directory - Folder where `config.json` lives (usually `app.getPath('userData')`).
   */
  constructor(directory) {
    /** @private */
    this.file = path.join(directory, 'config.json');
    /** @private @type {Record<string, any>} */
    this.data = {};
  }

  /**
   * Reads the settings from disk. A missing or corrupt file simply means "no settings yet".
   */
  load() {
    try {
      this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch {
      this.data = {};
    }
    if (this.migrateLegacyKeys()) this.save();
  }

  /**
   * Writes the settings to disk, creating the folder on first run.
   */
  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
  }

  /**
   * @param {string} key
   * @returns {any} The stored value, or `undefined`.
   */
  get(key) {
    return this.data[key];
  }

  /**
   * Stores a value and persists it immediately.
   *
   * @param {string} key
   * @param {any} value
   */
  set(key, value) {
    this.data[key] = value;
    this.save();
  }

  /**
   * @returns {string | null} The Notion integration token, decrypted, or `null` if not set.
   */
  getToken() {
    if (!this.data.token) return null;
    try {
      const raw = Buffer.from(this.data.token, 'base64');
      return this.data.tokenEncrypted ? safeStorage.decryptString(raw) : raw.toString('utf8');
    } catch {
      // The keyring changed (e.g. a new user profile): the token has to be entered again.
      return null;
    }
  }

  /**
   * Stores the Notion token, encrypted whenever the platform allows it.
   *
   * @param {string} token
   */
  setToken(token) {
    if (safeStorage.isEncryptionAvailable()) {
      this.data.token = safeStorage.encryptString(token).toString('base64');
      this.data.tokenEncrypted = true;
    } else {
      this.data.token = Buffer.from(token, 'utf8').toString('base64');
      this.data.tokenEncrypted = false;
    }
    this.save();
  }

  /**
   * Renames keys written by version 1.0 so existing installs keep their settings.
   *
   * @private
   * @returns {boolean} Whether anything was changed.
   */
  migrateLegacyKeys() {
    if (!('checkbox' in this.data)) return false;
    this.data.doneProperty = this.data.doneProperty || this.data.checkbox;
    delete this.data.checkbox;
    return true;
  }
}

module.exports = { ConfigStore };
