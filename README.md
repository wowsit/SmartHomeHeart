# SmartHomeHeart

[![CI](https://github.com/wowsit/SmartHomeHeart/actions/workflows/ci.yml/badge.svg)](https://github.com/wowsit/SmartHomeHeart/actions/workflows/ci.yml)

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

> **https / Mikrofon:** Der Sprachassistent braucht einen Secure Context. Der nginx auf dem Pi liefert das Dashboard deshalb zusätzlich unter `https://<pi>:8443` aus (selbstsigniertes Zertifikat aus `deploy/tls/make-cert.sh`, Browserwarnung einmal akzeptieren) und reicht `/api/` an Home Assistant weiter.


`?mock=1` an die URL hängen erzwingt den Demo-Modus, `?kiosk=1` blendet den Mauszeiger aus.

## Entities anpassen

`src/config.ts`: Räume, Szenen, Wetter-, Kalender- und Media-Player-Entity. Unterstützt: `light.*` (mit Helligkeit), `switch.*`, `climate.*`, `scene.*`, `weather.*`, `calendar.*`, `media_player.*`.

## Apple-Kalender (iCloud) anbinden

Der Kalender läuft – wie alles – über Home Assistant. Für iCloud ist das die **CalDAV**-Integration:

1. Auf <https://appleid.apple.com> → *Anmeldung und Sicherheit* → *App-spezifische Passwörter* → neues Passwort erzeugen (z. B. „Home Assistant“).
2. In HA: *Einstellungen → Geräte & Dienste → Integration hinzufügen → CalDAV*
   - URL: `https://caldav.icloud.com`
   - Benutzername: deine Apple-ID (E-Mail), Passwort: das App-Passwort aus Schritt 1
3. HA legt pro iCloud-Kalender eine Entity `calendar.<name>` an (*Einstellungen → Entitäten*, nach „calendar.“ filtern).
4. Entity-ID in `src/config.ts` unter `calendars` eintragen, Farbe wählen (`green`, `blue`, `orange`, `purple`):
   ```ts
   calendars: [
     { entity: 'calendar.max', name: 'Meine Termine', color: 'green' },
     { entity: 'calendar.lena', name: 'Lena', color: 'blue' }, // zweiter Kalender später
   ],
   ```

Das Dashboard liest die Termine über `GET /api/calendars/<entity>` (Monatsbereich, alle 5 Minuten aktualisiert). Die Übersicht zeigt den Monat kompakt; ein Tipp auf den Monatsnamen öffnet die Kalender-Seite (Monate blättern, Termine des Tages, **Plus** zum Eintragen mit Bildschirmtastatur). Neue Termine gehen per `calendar.create_event` direkt in den iCloud-Kalender.

### Erinnerungen (immer an)

iCloud speichert über CalDAV keine Alarm-Einstellung, die HA setzen könnte – deshalb übernimmt HA die Erinnerung für **alle** Termine des Kalenders: `deploy/ha/automation-termin-erinnerung.yaml` schickt 30 Minuten vor jedem Termin eine Push-Nachricht an die Home-Assistant-App (Handy). In HA unter *Einstellungen → Automationen → Neue Automation → ⋮ → In YAML bearbeiten* einfügen, `calendar.…` und `notify.mobile_app_…` anpassen.

## Wetter-Standort

Das Wetter kommt aus HA (`weather.home`, Met.no). Standort in HA setzen: *Einstellungen → System → Allgemein → Standort* → Fichtenweg 10A, 26209 Hatten (Sandkrug). Der Ortsname im Dashboard steht in `config.locationName`.

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
