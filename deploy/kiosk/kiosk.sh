#!/bin/bash
# Startet Chromium im Kiosk-Modus auf dem Touchscreen (wird vom Autostart aufgerufen)
URL="${DASHBOARD_URL:-http://localhost:8080/?kiosk=1}"

# Bildschirm nie abschalten (X11; unter Wayland/labwc regelt das raspi-config)
xset s off 2>/dev/null; xset -dpms 2>/dev/null; xset s noblank 2>/dev/null

# "Chromium wurde nicht richtig beendet"-Dialog verhindern
PREFS="$HOME/.config/chromium/Default/Preferences"
[ -f "$PREFS" ] && sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"Crashed"/"exit_type":"Normal"/' "$PREFS"

exec chromium-browser \
  --kiosk "$URL" \
  --noerrdialogs --disable-infobars --disable-session-crashed-bubble \
  --disable-features=TranslateUI --disable-pinch --overscroll-history-navigation=0 \
  --touch-events=enabled --check-for-update-interval=31536000 \
  --autoplay-policy=no-user-gesture-required \
  --window-size=1920,1080 --window-position=0,0 --start-fullscreen
