#!/bin/bash
# Post-removal script for the Salchi .deb package: undoes what postinst.sh did.

if [ "$1" = "remove" ] || [ "$1" = "purge" ]; then
    if type update-alternatives >/dev/null 2>&1; then
        update-alternatives --remove 'salchi' '/opt/Salchi/salchi' || true
    else
        rm -f '/usr/bin/salchi'
    fi
    if [ -f /etc/apparmor.d/salchi ]; then
        apparmor_parser --remove /etc/apparmor.d/salchi 2>/dev/null || true
        rm -f /etc/apparmor.d/salchi
    fi
fi
