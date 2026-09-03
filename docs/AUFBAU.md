# SmartHomeHeart – Aufbau-Dokumentation

Stand: 3. September 2026 · Repository `wowsit/SmartHomeHeart` · main = `4071f54` (PR #3)

Diese Dokumentation beschreibt vollständig, was bisher gebaut wurde und wie das Projekt von null wieder aufgebaut wird: Hardware, GitHub, Entwicklung am Laptop, Raspberry Pi, Home Assistant, Fernzugriff. Der vollständige Quellcode steht im Anhang; die Datei liegt zusätzlich im Repo unter `docs/AUFBAU.md`.

## 1. Was gebaut wurde

| Thema | Stand |
|---|---|
| Ziel | Wandmontiertes Touch-Dashboard im Hochformat (1080×1920) für Smarthome, Wetter, Kalender, Musik |
| Frontend | React 19 + TypeScript + Vite 8, eigene UI nach Refactoring-UI-Regeln, Hintergrund = Wandfarbe `#D8CDC1` |
| Backend | Home Assistant (Docker). Das Frontend spricht **ausschließlich** die HA-API (WebSocket + REST, Long-Lived-Token) |
| Kalender | Apple/iCloud über die HA-Integration **CalDAV** → `calendar.*`-Entities; Termine anlegen per `calendar.create_event` |
| Wetter | HA `weather.home` (Met.no), Standort Sandkrug |
| Musik | HA `media_player.*` (YouTube Music über HA-Integration, noch offen) |
| Auslieferung | Docker Compose: HA (`:8123`) + nginx-Container mit Dashboard (`:8080`); Chromium-Kiosk auf dem Pi |
| Demo-Modus | Ohne Token laufen simulierte Geräte (`src/ha/mock.ts`), `?mock=1` erzwingt ihn |
| Fernzugriff | Tailscale-Tailnet; HA-Host `homehole` = `100.109.2.10`, Viktor-Sandbox als Node `viktor-sandbox` |

### Merge-Historie

| PR | Inhalt |
|---|---|
| Initial import | Vite/React-Grundgerüst, HA-WebSocket-Backend, Mock-Backend, Portrait-Bühne, Docker + Kiosk-Skripte |
| #1 | Refactoring-UI-Designsystem: feste Abstands-/Schriftskalen, HSL-Palette, Hierarchie, Erhebung |
| – | Light-Theme auf Wandfarbe `#D8CDC1`, UI entrümpelt |
| #2 | Kalender: Monatsansicht, Farben pro Kalender, CalDAV/iCloud-Anleitung |
| #3 | Übersicht als Always-on-Startseite: kompakter Kalender als Mittelpunkt, 4-Lichter-Widget, Termin-anlegen-Sheet |

## 2. Architektur

```
┌──────────────── Raspberry Pi 4 (Raspberry Pi OS Bookworm, 64-bit) ────────────────┐
│                                                                                    │
│  Chromium --kiosk http://localhost:8080/?kiosk=1   (27" Touch, hochkant)           │
│         │ HTTP                                                                     │
│         ▼                                                                          │
│  [Container pi-dashboard]  nginx :8080  → statisches Vite-Build (dist/)            │
│         │ WebSocket /api/websocket  +  REST /api/calendars/…                       │
│         ▼                                                                          │
│  [Container homeassistant] :8123  (network_mode: host)                             │
│         ├─ CalDAV  → https://caldav.icloud.com   (Apple-Kalender)                  │
│         ├─ Met.no  → Wetter                                                        │
│         └─ Zigbee/WLAN/… → Lichter, Schalter, Klima, Szenen, Media-Player          │
│                                                                                    │
│  tailscaled (Node „homehole“, 100.109.2.10) ─── Tailnet ─── Viktor-Sandbox        │
└────────────────────────────────────────────────────────────────────────────────────┘
```

Grundsätze:

- **HA ist die einzige Quelle.** Keine eigene Server-Logik, keine Datenbank. Neue Datenquellen = HA-Integration + Entity-ID in `src/config.ts`.
- **Feste Bühne.** Die UI ist auf 1080×1920 gebaut und wird per `transform: scale()` auf jede Fenstergröße skaliert; auf dem 27"-Display 1:1.
- **Touch first.** Ziele ≥ 64 px, kein Pinch/Zoom, keine Kontextmenüs, Slider für Finger.
- **Ruhe statt Dichte.** Startseite ist die Übersicht (Uhr, Wetter, Kalender, 4 Lichter, Musik). Verbindungsstatus erscheint nur, wenn etwas nicht stimmt. Uhr-Bildschirmschoner nach 5 min.

### Quellcode-Struktur

| Pfad | Zweck |
|---|---|
| `src/config.ts` | **Die** Konfigurationsdatei: Entities, Räume, Szenen, Kalender, Ausrichtung, Startseite |
| `src/ha/types.ts` | Backend-Interface `HaBackend` (Entities, Services, Forecast, Kalender) |
| `src/ha/ws.ts` | Echte HA-Anbindung: `home-assistant-js-websocket` + REST für Kalender, Reconnect mit Backoff |
| `src/ha/mock.ts` | Demo-Backend mit simulierten Geräten |
| `src/ha/useHa.ts` | React-Context + Hooks (`useEntities`, `useEntity`, `useConnState`) und Backend-Auswahl |
| `src/App.tsx` | Bühne, Navigation, Seiten (Übersicht / Zuhause / Kalender / Musik), Bildschirmschoner |
| `src/components/*` | `Clock`, `Weather`, `Calendar` (Widget + Seite), `AddEvent`, `Smarthome` (Kacheln, Räume, Lichter), `Media`, `Icons` |
| `src/styles.css` | Designsystem: Skalen, warme Grau-Palette (Hue 30), Amber-Akzent, Erhebung |
| `deploy/` | `Dockerfile`, `docker-compose.yml`, `nginx.conf`, `kiosk/`, `ha/automation-termin-erinnerung.yaml` |

## 3. Hardware

| Teil | Details |
|---|---|
| Rechner | Raspberry Pi 4 (4 GB+), 32 GB+ SD-Karte (besser SSD via USB), Netzteil 5 V/3 A |
| Display | 27" IPS, 1920×1080, Touch (USB), 220 cd/m², matt – **hochkant montiert** (1080×1920) |
| Kabel | Micro-HDMI → HDMI, USB-A für Touch, Netzwerk (LAN empfohlen) |
| Wand | Caparol 3D Palazzo 115 = `#D8CDC1`; Dashboard-Hintergrund identisch |

## 4. GitHub

### Repository

- URL: `https://github.com/wowsit/SmartHomeHeart`
- Standardbranch `main`, geschützt durch den Workflow „nur über Pull Requests“.
- Branch-Namen: `feat/<thema>`, `fix/<thema>`, `docs/<thema>`.

### Viktor ↔ GitHub

Viktor ist über die GitHub-Integration des Viktor-Workspaces mit dem Konto verbunden (Einrichtung: Viktor-App → Integrations → GitHub → Connect, OAuth im Browser). Viktor arbeitet mit einem lokalen Klon, Git-Worktrees pro Branch und öffnet PRs; gemergt wird nach Review durch dich (oder auf Zuruf durch Viktor).

### Eigener Rechner einrichten

```bash
# Git + Node 22 installieren (macOS: brew install git node@22 / Windows: winget install Git.Git OpenJS.NodeJS.LTS)
git config --global user.name  "Dein Name"
git config --global user.email "deine@mail.de"

# HTTPS-Klon (beim ersten Push fragt Git nach Benutzername + Personal Access Token)
git clone https://github.com/wowsit/SmartHomeHeart.git
cd SmartHomeHeart
```

Personal Access Token: GitHub → Settings → Developer settings → Personal access tokens → Fine-grained → Repository `SmartHomeHeart`, Rechte *Contents: Read and write*, *Pull requests: Read and write*. Alternativ SSH-Key: `ssh-keygen -t ed25519`, öffentlichen Schlüssel unter GitHub → Settings → SSH keys eintragen, dann `git@github.com:wowsit/SmartHomeHeart.git` klonen.

### Arbeitsablauf

```bash
git switch main && git pull
git switch -c feat/mein-thema
# … ändern, testen (npm run dev / npm run build) …
git add -A && git commit -m "Kurz was und warum"
git push -u origin feat/mein-thema
# Pull Request auf GitHub öffnen → Review → Merge → Branch löschen
```

## 5. Entwicklung am Laptop

```bash
npm install
npm run dev            # http://localhost:5173 → Demo-Modus
npm run build          # tsc -b && vite build → dist/
npm run lint           # oxlint
SINGLEFILE=1 npx vite build --outDir dist-single   # eine einzelne index.html (Vorschau)
```

Mit echter HA-Instanz `.env` anlegen (aus `.env.example`):

```ini
VITE_HA_URL=http://homeassistant.local:8123
VITE_HA_TOKEN=<Long-Lived-Token>
```

Dann in HA `configuration.yaml` die Herkunft erlauben (sonst blockt der Browser die REST-Aufrufe):

```yaml
http:
  cors_allowed_origins:
    - http://localhost:5173
    - http://localhost:8080
    - http://192.168.178.151:8080   # Pi-IP im LAN, damit das Dashboard auch vom Mac/Handy im Browser geht
```

**Achtung (HA ≥ 2026):** Sobald die `http:`-Einstellungen einmal in die UI migriert wurden (`.storage/http` mit `yaml_migration_done: true`), wird der YAML-Block **ignoriert**. Dann die Origins in HA unter *Einstellungen → System → Netzwerk* (HTTP-Einstellungen) eintragen oder in `.storage/http` → `data.stable.cors_allowed_origins` ergänzen und HA neu starten.

`VITE_HA_URL=auto` nimmt automatisch den Host, von dem das Dashboard geladen wurde (Port 8123) – ein Build für Kiosk (`localhost`) und Browser im LAN (`192.168.178.151`).

URL-Parameter: `?mock=1` Demo erzwingen · `?kiosk=1` Mauszeiger aus · `?page=calendar` Startseite wählen.

## 6. Raspberry Pi einrichten

### 6.1 Betriebssystem

1. **Raspberry Pi Imager** → Raspberry Pi OS (64-bit) **mit Desktop** (Bookworm).
2. Im Imager unter „Einstellungen“: Hostname `homehole`, Benutzer anlegen, WLAN/LAN, **SSH aktivieren**, Zeitzone `Europe/Berlin`.
3. Booten, per SSH verbinden: `ssh <user>@homehole.local`.
4. `sudo apt update && sudo apt full-upgrade -y && sudo reboot`

### 6.2 Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker          # oder neu einloggen
docker --version && docker compose version
```

### 6.3 Projekt holen und starten

```bash
git clone https://github.com/wowsit/SmartHomeHeart.git ~/SmartHomeHeart
cd ~/SmartHomeHeart/deploy
cp ../.env.example .env
nano .env              # VITE_HA_URL=http://localhost:8123  VITE_HA_TOKEN=<Token, s. Kap. 7.2>
docker compose up -d --build
```

Beim **allerersten** Start existiert noch kein Token: `docker compose up -d homeassistant`, HA unter `http://homehole.local:8123` einrichten (Kap. 7), Token erzeugen, in `.env` eintragen, dann `docker compose up -d --build dashboard`. Wichtig: `VITE_*` werden **beim Build** eingebrannt – nach jeder Änderung an `.env` neu bauen.

Prüfen: `http://homehole.local:8080` zeigt das Dashboard, `docker compose ps` zeigt beide Container `running`.

### 6.4 Display hochkant

Das Display ist physisch um 90° gedreht. Rotation im Betriebssystem setzen (Wayland/labwc, Standard ab Bookworm):

```bash
# Ausgangsname ermitteln
wlr-randr
# Bild drehen (270 falls andersherum montiert)
wlr-randr --output HDMI-A-1 --transform 90
```

Dauerhaft: Menü → Einstellungen → *Screen Configuration* → Bildschirm → Ausrichtung → *Right*/*Left* → Übernehmen. Touch-Eingabe dreht labwc mit; falls nicht, in `~/.config/labwc/rc.xml` unter `<libinput>` den Touch dem Ausgang zuordnen (`<device category="touch"><mapToOutput>HDMI-A-1</mapToOutput></device>`).

Die App erkennt das gedrehte Fenster (1080×1920) selbst und skaliert die Portrait-Bühne 1:1.

### 6.5 Kiosk

```bash
bash ~/SmartHomeHeart/deploy/kiosk/install-kiosk.sh
sudo reboot
```

Das Skript installiert Chromium, `unclutter`, Inter-Schrift, setzt Autologin auf den Desktop, schaltet Bildschirm-Blanking aus und legt `~/kiosk.sh` + Autostart (labwc und XDG) an. `kiosk.sh` startet Chromium mit `--kiosk http://localhost:8080/?kiosk=1`, unterdrückt Fehlerdialoge, deaktiviert Pinch-Zoom und Rückwärts-Wischen. Andere URL: `DASHBOARD_URL=… ~/kiosk.sh`.

## 7. Home Assistant

### 7.1 Erst-Einrichtung

`http://homehole.local:8123` → Konto anlegen → Standort setzen (*Einstellungen → System → Allgemein → Standort*: Fichtenweg 10A, 26209 Hatten / Sandkrug) → Met.no-Wetter wird automatisch `weather.home`.

### 7.2 Long-Lived-Token

Profil (unten links) → *Sicherheit* → *Langlebige Zugangstoken* → *Token erstellen* (Name `dashboard`). Den Token einmal kopieren (wird nicht erneut angezeigt) und in `deploy/.env` als `VITE_HA_TOKEN` eintragen. Ein zweiter Token `viktor` dient dem Fernzugriff (Kap. 8).

### 7.3 CORS

In `deploy/ha-config/configuration.yaml` (Block wie in Kap. 5, zusätzlich `http://homehole.local:8080` und `http://<Pi-IP>:8080`). HA neu starten: *Einstellungen → System → Neu starten*.

### 7.4 Apple-Kalender (CalDAV)

1. `https://appleid.apple.com` → *Anmeldung und Sicherheit* → *App-spezifische Passwörter* → neues Passwort „Home Assistant“.
2. HA: *Einstellungen → Geräte & Dienste → Integration hinzufügen → CalDAV*
   - URL `https://caldav.icloud.com` · Benutzername = Apple-ID (E-Mail) · Passwort = App-Passwort
3. Pro iCloud-Kalender entsteht `calendar.<name>` (*Einstellungen → Entitäten*, Filter „calendar.“).
4. In `src/config.ts` eintragen:

```ts
calendars: [
  { entity: 'calendar.meine_termine', name: 'Meine Termine', color: 'green' },
  { entity: 'calendar.partnerin',     name: 'Lena',          color: 'blue'  },
],
```

Farben: `green`, `blue`, `orange`, `purple`, `grey`. Das Dashboard lädt `GET /api/calendars/<entity>?start=…&end=…` für den sichtbaren Monat (alle 5 min) und legt neue Termine per Service `calendar.create_event` direkt in iCloud an.

### 7.5 Termin-Erinnerung (Automation)

iCloud liefert über CalDAV keine Alarme, daher übernimmt HA: `deploy/ha/automation-termin-erinnerung.yaml` schickt 30 min vor jedem Termin eine Push-Nachricht an die HA-App. *Einstellungen → Automationen → Neue Automation → ⋮ → In YAML bearbeiten*, Inhalt einfügen, `calendar.…` und `notify.mobile_app_…` anpassen.

### 7.6 Entities ins Dashboard

Alle Geräte werden in `src/config.ts` referenziert: `lights` (4 Lichter der Übersicht), `rooms` (Kacheln pro Raum: `light.*`, `switch.*`, `climate.*`), `scenes`, `weather`, `mediaPlayer`, `calendars`. Entity-IDs stehen in HA unter *Entwicklerwerkzeuge → Zustände*. Nach Änderung: Commit + PR, auf dem Pi `git pull && docker compose up -d --build dashboard`.

## 8. Fernzugriff (Tailscale)

Auf dem Pi:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up            # Link im Browser öffnen, mit dem Tailscale-Konto anmelden
tailscale ip -4              # → 100.109.2.10 (homehole)
```

Viktor hängt als Node `viktor-sandbox` im Tailnet (per Auth-Key aufgenommen) und erreicht HA unter `http://100.109.2.10:8123`. Damit kann Viktor Entities auslesen, Integrationen (z. B. CalDAV) per HA-API einrichten und die Konfiguration prüfen. Zugriff jederzeit in der Tailscale-Admin-Konsole entziehen (Node löschen). Auth-Keys sind Einmal-Keys; nach Verwendung in der Konsole widerrufen.

## 9. Betrieb

| Aufgabe | Befehl (auf dem Pi, in `~/SmartHomeHeart/deploy`) |
|---|---|
| Update einspielen | `git -C .. pull && docker compose up -d --build dashboard` |
| HA aktualisieren | `docker compose pull homeassistant && docker compose up -d homeassistant` |
| Logs | `docker compose logs -f dashboard` / `docker compose logs -f homeassistant` |
| Status | `docker compose ps` |
| Kiosk neu starten | `pkill chromium; ~/kiosk.sh &` |
| HA-Konfiguration prüfen | *Entwicklerwerkzeuge → YAML → Konfiguration prüfen* |

Fehlerbilder:

- **„Keine Verbindung zu Home Assistant“** unten links → Token falsch/abgelaufen, HA nicht erreichbar, oder `VITE_HA_URL` zeigt auf einen Host, den der Browser nicht auflöst. `.env` prüfen, neu bauen.
- **Kalender leer, Rest funktioniert** → CORS fehlt (Kap. 7.3) oder Entity-ID in `config.ts` stimmt nicht.
- **„Demo“-Badge** → Kein Token im Build oder `?mock=1` in der URL.
- **Bild quer / Touch versetzt** → Rotation (Kap. 6.4).

## 10. Secrets

| Secret | Wo es lebt | Wo es nie liegt |
|---|---|---|
| HA Long-Lived-Token | `deploy/.env` auf dem Pi (in `.gitignore`) | Git, Chat, Screenshots |
| Apple App-Passwort | Nur in HA (CalDAV-Integration) | Git, Chat |
| Tailscale Auth-Key | Einmal verwendet, danach widerrufen | – |
| GitHub PAT/SSH-Key | Lokaler Rechner | Repo |

Bereits in einem Chat gepostete Secrets gelten als kompromittiert und werden rotiert (App-Passwort neu erzeugen, Auth-Key widerrufen).

## 11. Offene Punkte

1. HA-Token für Viktor + Apple-ID → CalDAV einrichten, echte `calendar.*`-IDs in `config.ts`.
2. Echte Entity-IDs für Lichter, Räume, Szenen, Media-Player eintragen (aktuell Platzhalter aus dem Demo-Modus).
3. YouTube Music: HA-Integration (HACS „YouTube Music“ oder Music Assistant) einrichten → `media_player`-Entity.
4. Display kaufen, Rotation + Touch-Kalibrierung auf dem Pi verifizieren.
5. Optional: Automation für Bildschirm-Dimmen nachts (HA → `shell_command` auf dem Pi oder Chromium-Overlay).
