/**
 * @file Tray icon (Windows notification area / Linux status area) and its menu.
 */
'use strict';

const { Tray, Menu, nativeImage } = require('electron');

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
 * @returns {{ setPendingCount: (count: number) => void }}
 */
function createTray({ iconPath, actions }) {
  const tray = new Tray(nativeImage.createFromPath(iconPath));

  const template = [{ label: 'Mostrar / ocultar a Salchi', click: actions.toggleVisible }];
  if (actions.refresh) template.push({ label: 'Recargar', click: actions.refresh });
  template.push({ label: 'Ajustes…', click: actions.openSettings });
  if (actions.openInNotion) template.push({ label: 'Abrir la lista en Notion', click: actions.openInNotion });
  template.push({ type: 'separator' }, { label: 'Salir', click: actions.quit });

  tray.setContextMenu(Menu.buildFromTemplate(template));
  tray.on('click', actions.toggleVisible);

  return {
    /**
     * Updates the tooltip with the number of open tasks.
     *
     * @param {number} count
     */
    setPendingCount(count) {
      tray.setToolTip(count
        ? `Salchi · ${count} pendiente${count === 1 ? '' : 's'}`
        : 'Salchi · nada pendiente');
    },
  };
}

module.exports = { createTray };
