/**
 * @file Tray icon (Windows notification area / Linux status area) and its menu.
 */
'use strict';

const { Tray, Menu, nativeImage } = require('electron');
const { t } = require('./i18n');

/**
 * @typedef {object} TrayActions
 * @property {() => void} toggleVisible
 * @property {() => void} openSettings
 * @property {() => void} quit
 * @property {() => void} [refresh] - Notion edition only.
 * @property {() => void} [openInNotion] - Notion edition only.
 */

/**
 * Creates the tray icon.
 *
 * @param {object} options
 * @param {string} options.iconPath
 * @param {TrayActions} options.actions
 * @returns {{ setPendingCount: (count: number) => void, relabel: () => void }}
 */
function createTray({ iconPath, actions }) {
  const tray = new Tray(nativeImage.createFromPath(iconPath));
  let pendingCount = 0;

  /** Builds the menu in the current language. */
  const buildMenu = () => {
    const template = [{ label: t('tray.toggle'), click: actions.toggleVisible }];
    if (actions.refresh) template.push({ label: t('header.reload'), click: actions.refresh });
    template.push({ label: t('tray.settings'), click: actions.openSettings });
    if (actions.openInNotion) template.push({ label: t('tray.openList'), click: actions.openInNotion });
    template.push({ type: 'separator' }, { label: t('tray.quit'), click: actions.quit });
    tray.setContextMenu(Menu.buildFromTemplate(template));
  };

  /** Writes the tooltip in the current language. */
  const updateTooltip = () => {
    tray.setToolTip(pendingCount ? t('tray.pending', { count: pendingCount }) : t('tray.nothing'));
  };

  buildMenu();
  tray.on('click', actions.toggleVisible);

  return {
    /**
     * Updates the tooltip with the number of open tasks.
     *
     * @param {number} count
     */
    setPendingCount(count) {
      pendingCount = count;
      updateTooltip();
    },

    /** Rebuilds the menu and tooltip after the language changes. */
    relabel() {
      buildMenu();
      updateTooltip();
    },
  };
}

module.exports = { createTray };
