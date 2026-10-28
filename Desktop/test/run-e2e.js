/**
 * @file Runs every end-to-end test in its own Electron process.
 *
 * On Linux without a display it wraps Electron in `xvfb-run`, so the tests also work on a
 * headless machine or in CI. Exits with a non-zero code if any test fails.
 */
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const electron = require('electron'); // resolves to the Electron binary path
const root = path.join(__dirname, '..');

const tests = [
  { file: 'e2e/notion.e2e.js', edition: 'notion' },
  { file: 'e2e/local.e2e.js', edition: 'local' },
  { file: 'e2e/i18n.e2e.js', edition: 'local' },
];

/**
 * @param {{ file: string, edition: string }} test
 * @returns {boolean} Whether the test passed.
 */
function runTest({ file, edition }) {
  const args = ['-r', path.join(__dirname, file), root, `--edition=${edition}`];
  if (process.platform === 'linux') args.push('--no-sandbox');

  const headless = process.platform === 'linux' && !process.env.DISPLAY;
  const command = headless ? 'xvfb-run' : electron;
  const commandArgs = headless ? ['-a', electron, ...args] : args;

  const result = spawnSync(command, commandArgs, { encoding: 'utf8', env: { ...process.env, TZ: process.env.TZ || 'Europe/Madrid' } });
  // Only show the test's own output, not Chromium's console noise.
  const lines = `${result.stdout}${result.stderr}`.split('\n').filter((line) => /^(\s+[✔✘]|[A-Z][a-z]+ edition|Languages)/.test(line));
  console.log(lines.join('\n'));
  return result.status === 0;
}

const results = tests.map(runTest);
const failed = results.filter((passed) => !passed).length;
console.log(failed ? `\n${failed} test file(s) failed.` : '\nAll tests passed.');
process.exit(failed ? 1 : 0);
