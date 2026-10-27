/**
 * @file electron-builder `afterPack` hook (Linux only).
 *
 * Renames the Electron binary to `salchi.bin` and puts a tiny launcher script in its place.
 * The launcher adds two flags that must be known before any app code runs:
 *   --ozone-platform=x11  Salchi positions its own window, which Wayland does not allow;
 *                         XWayland (present on every Wayland desktop) does.
 *   --no-sandbox          Only inside AppImages: Ubuntu 24.04+ blocks the unprivileged user
 *                         namespaces Chromium's sandbox relies on, and an AppImage cannot
 *                         ship the AppArmor profile that would allow them (the .deb does).
 */
'use strict';

const fs = require('fs');
const path = require('path');

/**
 * @param {import('electron-builder').AfterPackContext} context
 */
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'linux') return;

  const name = context.packager.executableName;
  const binary = path.join(context.appOutDir, name);
  fs.renameSync(binary, `${binary}.bin`);

  fs.writeFileSync(binary, `#!/bin/bash
HERE="$(dirname "$(readlink -f "$0")")"
EXTRA=(--ozone-platform=x11)
if [ -n "$APPIMAGE" ]; then EXTRA+=(--no-sandbox); fi
exec "$HERE/${name}.bin" "\${EXTRA[@]}" "$@"
`);
  fs.chmodSync(binary, 0o755);
};
