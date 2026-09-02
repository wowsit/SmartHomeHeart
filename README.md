# SmartHomeHeart

Wandmontiertes Touch-Dashboard im Hochformat (Raspberry Pi 4, 27" FHD Touch, 1080×1920) für Home Assistant:
Smarthome, Wetter, Kalender, Musik – eigene UI, HA macht die Logik.

- Feste 1080×1920-Bühne im Hochformat (`config.orientation`, alternativ `landscape`), skaliert proportional auf jeden Bildschirm, auf dem 27"-Display 1:1
- Touch-Ziele mindestens 64 px, kein Zoom/Pinch, kein Kontextmenü, Slider für Finger optimiert
- Live-Updates per HA-WebSocket, automatischer Reconnect, Verbindungsanzeige links unten
- Demo-Modus mit simulierten Geräten (ohne HA-Token)
- Uhr-Bildschirmschoner nach 5 min ohne Berührung (`config.screensaverAfter`)

## Lokal starten (Laptop)

```bash
npm install
npm run dev          # http://localhost:5173  -> Demo-Modus
```

Mit echter HA-Instanz: `.env.example` nach `.env` kopieren, `VITE_HA_URL` + `VITE_HA_TOKEN` eintragen, `npm run dev` neu starten.
Token: HA → Profil → Sicherheit → *Langlebige Zugangstoken*. Wichtig: in HA unter `configuration.yaml`

```yaml
http:
  cors_allowed_origins:
    - http://localhost:5173
    - http://localhost:8080
```

`?mock=1` an die URL hängen erzwingt den Demo-Modus, `?kiosk=1` blendet den Mauszeiger aus.

## Entities anpassen

`src/config.ts`: Räume, Szenen, Wetter-, Kalender- und Media-Player-Entity. Unterstützt: `light.*` (mit Helligkeit), `switch.*`, `climate.*`, `scene.*`, `weather.*`, `calendar.*`, `media_player.*`.

## Auf dem Raspberry Pi

```bash
git clone https://github.com/wowsit/SmartHomeHeart.git ~/SmartHomeHeart && cd ~/SmartHomeHeart/deploy
cp ../.env.example .env   # HA-URL + Token eintragen
docker compose up -d --build       # HA (Port 8123) + Dashboard (Port 8080)
bash kiosk/install-kiosk.sh        # Chromium-Kiosk, Autostart, Display-Timeout aus
sudo reboot
```

## Build-Varianten

- `npm run build` → `dist/` für nginx
- `SINGLEFILE=1 npx vite build --outDir dist-single` → eine einzelne `index.html` (Demo/Vorschau)
