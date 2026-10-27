/**
 * @file Resolves which edition of Salchi is running.
 *
 * Salchi ships in two flavours that share all of their code:
 *   - "notion": tasks live in a Notion database, so several computers (and the Notion
 *     mobile app) see the same list.
 *   - "local":  tasks live in a JSON file on this computer. No account needed.
 *
 * Packaged builds read the edition from `package.json` (electron-builder injects it through
 * `extraMetadata`). During development it can be overridden with `--edition=local`.
 */
'use strict';

/** @enum {string} */
const Edition = Object.freeze({
  NOTION: 'notion',
  LOCAL: 'local',
});

/**
 * Works out the edition for this process.
 *
 * @returns {Edition} The edition to run; defaults to Notion when nothing says otherwise.
 */
function resolveEdition() {
  const flag = process.argv.find((arg) => arg.startsWith('--edition='));
  if (flag) return parseEdition(flag.split('=')[1]);

  try {
    // In a packaged app this is the package.json written by electron-builder.
    return parseEdition(require('../../package.json').edition);
  } catch {
    return Edition.NOTION;
  }
}

/**
 * Maps a free-form value to a known edition.
 *
 * @param {unknown} value - Raw value coming from the command line or package.json.
 * @returns {Edition}
 */
function parseEdition(value) {
  return value === Edition.LOCAL ? Edition.LOCAL : Edition.NOTION;
}

module.exports = { Edition, resolveEdition };
