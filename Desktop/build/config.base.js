/**
 * @file electron-builder settings shared by both editions.
 *
 * Each edition has its own small config (config.notion.js / config.local.js) that extends
 * this one with its file names and injects the edition into the packaged package.json.
 * See https://www.electron.build/configuration
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { writeInstallerScript } = require('./installer-language');

const LOCALES = path.join(__dirname, '..', '..', 'locales');

/**
 * Translated "Comment" lines for the Linux .desktop entry, e.g. `Comment[fr]`, so app menus
 * describe Salchi in the user's language.
 *
 * @returns {Record<string, string>}
 */
function localizedComments() {
  const { languages } = JSON.parse(fs.readFileSync(path.join(LOCALES, 'languages.json'), 'utf8'));
  const entries = {};
  for (const { code } of languages) {
    const strings = JSON.parse(fs.readFileSync(path.join(LOCALES, `${code}.json`), 'utf8'));
    // freedesktop locale keys use underscores and no script subtags: zh_CN, pt_BR…
    const key = { 'zh-Hans': 'zh_CN', 'zh-Hant': 'zh_TW' }[code] || code.replace('-', '_');
    entries[`Comment[${key}]`] = strings['autostart.comment'];
  }
  return entries;
}

/**
 * @param {'notion' | 'local'} edition
 * @param {string} artifactSuffix - Appended to installer names, e.g. "con-Notion".
 * @returns {import('electron-builder').Configuration}
 */
module.exports = function baseConfig(edition, artifactSuffix) {
  return {
    appId: 'com.claudia.salchi',
    productName: 'Salchi',
    extraMetadata: { edition },
    directories: { output: `dist/${edition}`, buildResources: 'build' },
    files: ['src/**', 'package.json'],
    // The translations are shared with the Mac app, so they live outside this folder.
    extraResources: [{ from: LOCALES, to: 'locales', filter: ['*.json'] }],
    publish: null,

    win: {
      target: [{ target: 'nsis', arch: ['x64'] }],
      icon: 'build/icon.ico',
    },
    nsis: {
      oneClick: true,
      perMachine: false,
      runAfterFinish: true,
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      shortcutName: 'Salchi',
      installerIcon: 'build/icon.ico',
      uninstallerIcon: 'build/icon.ico',
      uninstallDisplayName: 'Salchi',
      artifactName: `Salchi-Setup-${artifactSuffix}.\${ext}`,
      // Language menu shown before installing; generated from the shared locales folder.
      include: writeInstallerScript(path.join(__dirname, 'generated')),
    },

    linux: {
      target: [{ target: 'AppImage', arch: ['x64'] }, { target: 'deb', arch: ['x64'] }],
      icon: 'build/icon.png',
      category: 'Utility',
      synopsis: 'A floating dachshund that keeps your to-do list in sight',
      // electron-builder 25 takes the .desktop keys directly (a nested `entry` object ends up
      // in the file as "entry=[object Object]").
      desktop: {
        Name: 'Salchi',
        Comment: 'Your little dachshund for to-dos',
        ...localizedComments(),
        StartupWMClass: 'Salchi',
      },
    },
    appImage: { artifactName: `Salchi-${artifactSuffix}.AppImage` },
    deb: {
      packageName: 'salchi',
      artifactName: `salchi-${artifactSuffix}_amd64.deb`,
      afterInstall: 'build/linux/postinst.sh',
      afterRemove: 'build/linux/postrm.sh',
    },
    afterPack: 'build/hooks/after-pack.js',
  };
};
