#!/bin/bash
# Einmalig auf dem Raspberry Pi (Raspberry Pi OS Bookworm, Desktop) ausführen:
#   bash deploy/kiosk/install-kiosk.sh
set -e
sudo apt-get update
sudo apt-get install -y chromium-browser unclutter fonts-inter x11-xserver-utils

# Autologin auf Desktop (B4) und Bildschirmschoner/Blanking aus
sudo raspi-config nonint do_boot_behaviour B4
sudo raspi-config nonint do_blanking 1

# Kiosk-Script nach ~/kiosk.sh und Autostart-Eintrag
cp "$(dirname "$0")/kiosk.sh" "$HOME/kiosk.sh"; chmod +x "$HOME/kiosk.sh"
mkdir -p "$HOME/.config/autostart" "$HOME/.config/labwc"
cat > "$HOME/.config/autostart/dashboard-kiosk.desktop" <<DESK
[Desktop Entry]
Type=Application
Name=Dashboard Kiosk
Exec=$HOME/kiosk.sh
X-GNOME-Autostart-enabled=true
DESK
# Wayland (labwc, Standard ab Bookworm): Mauszeiger ausblenden + Autostart
cat > "$HOME/.config/labwc/autostart" <<LAB
unclutter -idle 1 &
$HOME/kiosk.sh &
LAB
echo "Fertig. Neustart: sudo reboot"
