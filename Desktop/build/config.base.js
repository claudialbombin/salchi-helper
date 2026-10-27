/**
 * @file electron-builder settings shared by both editions.
 *
 * Each edition has its own small config (config.notion.js / config.local.js) that extends
 * this one with its file names and injects the edition into the packaged package.json.
 * See https://www.electron.build/configuration
 */
'use strict';

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
    },

    linux: {
      target: [{ target: 'AppImage', arch: ['x64'] }, { target: 'deb', arch: ['x64'] }],
      icon: 'build/icon.png',
      category: 'Utility',
      synopsis: 'A floating dachshund that keeps your to-do list in sight',
      desktop: { entry: { Name: 'Salchi', Comment: 'Tu perrito salchicha de las notitas', StartupWMClass: 'Salchi' } },
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
