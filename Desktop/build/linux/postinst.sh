#!/bin/bash
# Post-install script for the Salchi .deb package.
#
# Same as electron-builder's default script, plus an AppArmor profile: Ubuntu 24.04+
# restricts unprivileged user namespaces, which Chromium's sandbox needs. Chrome and
# VS Code ship an equivalent profile.

# Expose the launcher as /usr/bin/salchi.
if type update-alternatives >/dev/null 2>&1; then
    # Remove a previous link that was not created by update-alternatives.
    if [ -L '/usr/bin/salchi' ] && [ -e '/usr/bin/salchi' ] && [ "$(readlink '/usr/bin/salchi')" != '/etc/alternatives/salchi' ]; then
        rm -f '/usr/bin/salchi'
    fi
    update-alternatives --install '/usr/bin/salchi' 'salchi' '/opt/Salchi/salchi' 100 || ln -sf '/opt/Salchi/salchi' '/usr/bin/salchi'
else
    ln -sf '/opt/Salchi/salchi' '/usr/bin/salchi'
fi

# Allow user namespaces for Salchi when AppArmor 4 is in use.
APPARMOR_PROFILE_INSTALLED=0
if [ -d /etc/apparmor.d ] && [ -f /etc/apparmor.d/abi/4.0 ] && hash apparmor_parser 2>/dev/null; then
    cat > /etc/apparmor.d/salchi <<'PROFILE'
abi <abi/4.0>,
include <tunables/global>

profile salchi /opt/Salchi/salchi.bin flags=(unconfined) {
  userns,
  include if exists <local/salchi>
}
PROFILE
    if apparmor_parser --replace --write-cache --skip-read-cache /etc/apparmor.d/salchi; then
        APPARMOR_PROFILE_INSTALLED=1
    fi
fi

# With the profile, Chromium uses user namespaces. Without it, fall back to the setuid
# sandbox helper, which works everywhere.
if [ "$APPARMOR_PROFILE_INSTALLED" = 1 ]; then
    chmod 0755 '/opt/Salchi/chrome-sandbox' || true
else
    chmod 4755 '/opt/Salchi/chrome-sandbox' || true
fi

if hash update-mime-database 2>/dev/null; then
    update-mime-database /usr/share/mime || true
fi
if hash update-desktop-database 2>/dev/null; then
    update-desktop-database /usr/share/applications || true
fi
