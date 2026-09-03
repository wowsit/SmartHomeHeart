# SmartHomeHeart – Aufbau-Dokumentation

Stand: 3. September 2026 (abends) · Repository `wowsit/SmartHomeHeart` · main = `7d67fa9` (PR #8)

> **Wichtig:** Kapitel 6.3, 8 und 9 beschreiben den **tatsächlichen** Stand auf dem Pi `homehole` (per SSH geprüft am 3.9.2026). Der Pi nutzt für das Dashboard **kein** `docker compose`, sondern einen nginx-Container mit gemountetem `dist/`-Ordner; Home Assistant läuft als eigener `docker run`-Container.

Diese Dokumentation beschreibt vollständig, was bisher gebaut wurde und wie das Projekt von null wieder aufgebaut wird: Hardware, GitHub, Entwicklung am Laptop, Raspberry Pi, Home Assistant, Fernzugriff. Der Quellcode liegt im Repo; diese Datei unter `docs/AUFBAU.md`, der Sprachassistent ist in `assistant/README.md` beschrieben.

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
| Fernzugriff | Tailscale-Tailnet; Pi `homehole` = `100.109.2.10` (LAN `192.168.178.151`), Viktor als Node `viktor-ai` mit SSH-Key für Benutzer `wowsit` |
| Sprachassistent | HA Assist-Pipeline „Haus (Claude)“: Wyoming-STT über Groq (`groq_stt`), CalDAV-Helfer (`calhelper`), openWakeWord; Details in `assistant/README.md` |

### Merge-Historie

| PR | Inhalt |
|---|---|
| Initial import | Vite/React-Grundgerüst, HA-WebSocket-Backend, Mock-Backend, Portrait-Bühne, Docker + Kiosk-Skripte |
| #1 | Refactoring-UI-Designsystem: feste Abstands-/Schriftskalen, HSL-Palette, Hierarchie, Erhebung |
| – | Light-Theme auf Wandfarbe `#D8CDC1`, UI entrümpelt |
| #2 | Kalender: Monatsansicht, Farben pro Kalender, CalDAV/iCloud-Anleitung |
| #3 | Übersicht als Always-on-Startseite: kompakter Kalender als Mittelpunkt, 4-Lichter-Widget, Termin-anlegen-Sheet |
| #4 | Diese Aufbau-Dokumentation |
| #5 | Echte HA-Entities (`weather.forecast_home`, `calendar.hjem`, `calendar.arbeid`), Termine als Chips im Tageskästchen, Tag-Detail-Sheet |
| #6 | `assistant/`: Sprachassistent „Haus“ – calhelper, groq_stt, HA-Skripte, Claude-Prompt |
| #7 | `VITE_HA_URL=auto`: ein Build für Kiosk (localhost) und Browser im LAN; CORS-Hinweis für HA ≥ 2026 |
| #8 | Sprachchat im Dashboard: Wake Word → Sprechblase, Browser-Mikro streamt in die HA-Assist-Pipeline |

## 2. Architektur

```
┌──────────────── Raspberry Pi 4 (Raspberry Pi OS Bookworm, 64-bit) ────────────────┐
│                                                                                    │
│  Chromium --kiosk http://localhost:8080/?kiosk=1   (27" Touch, hochkant)           │
│         │ HTTP                                                                     │
│         ▼                                                                          │
│  [Container pi-dashboard]  nginx :8080  → ~/dashboard/dist (Vite-Build, gemountet) │
│         │ WebSocket /api/websocket  +  REST /api/calendars/…                       │
│         ▼                                                                          │
│  [Container homeassistant] :8123  (network_mode: host, ~/homeassistant = /config)  │
│         ├─ CalDAV  → https://caldav.icloud.com   (Apple-Kalender)                  │
│         ├─ Met.no  → Wetter                                                        │
│         ├─ Assist-Pipeline „Haus (Claude)“                                         │
│         │     ├─ [groq_stt]     Wyoming-STT  127.0.0.1:10301 → Groq Whisper        │
│         │     ├─ [calhelper]    CalDAV löschen/verschieben  127.0.0.1:10400        │
│         │     ├─ [openwakeword] Wake Word     127.0.0.1:10500                      │
│         │     └─ [whisper]      lokales Fallback-STT (gestoppt)                    │
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
VITE_HA_URL=http://192.168.178.151:8123   # oder http://100.109.2.10:8123 über Tailscale
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

1. **Raspberry Pi Imager** → Raspberry Pi OS (64-bit) **mit Desktop**. Auf `homehole` läuft aktuell Debian 13 (trixie), Kernel 6.18, aarch64.
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

### 6.3 Home Assistant und Dashboard starten

**So läuft es auf `homehole` (Ist-Stand):**

```bash
# Home Assistant – eigener Container, Konfiguration in ~/homeassistant
docker run -d --name homeassistant --restart=unless-stopped --privileged --network=host \
  -v /home/wowsit/homeassistant:/config -e TZ=Europe/Berlin \
  ghcr.io/home-assistant/home-assistant:stable

# Dashboard – nginx liefert den fertigen Build aus ~/dashboard/dist aus
mkdir -p ~/dashboard/dist
# nginx.conf aus dem Repo (deploy/nginx.conf) nach ~/dashboard/nginx.conf kopieren
docker run -d --name pi-dashboard --restart=unless-stopped -p 8080:80 \
  -v /home/wowsit/dashboard/dist:/usr/share/nginx/html \
  -v /home/wowsit/dashboard/nginx.conf:/etc/nginx/conf.d/default.conf \
  nginx:alpine
```

Der Build entsteht **nicht auf dem Pi** (zu langsam, kein Repo-Klon dort), sondern am Laptop oder bei Viktor und wird als `dist/` kopiert:

```bash
# am Laptop / bei Viktor, im Repo auf main
VITE_HA_URL=auto VITE_HA_TOKEN=<Long-Lived-Token> npm run build
tar czf dist.tgz -C dist . && scp dist.tgz wowsit@homehole:/tmp/
# auf dem Pi
cd ~/dashboard && cp -a dist dist.bak-$(date +%Y%m%d-%H%M%S) \
  && rm -rf dist/* && tar xzf /tmp/dist.tgz -C dist && rm /tmp/dist.tgz \
  && docker exec pi-dashboard nginx -s reload
```

Danach im Browser **hart neu laden** (Cmd+Shift+R), sonst bleibt das alte JS im Cache. Wichtig: `VITE_*` werden **beim Build** eingebrannt – bei neuem Token oder anderer URL neu bauen. `VITE_HA_URL=auto` ist Pflicht, damit derselbe Build vom Kiosk (`localhost`) und vom Mac (`192.168.178.151`) funktioniert.

Prüfen: `http://192.168.178.151:8080` zeigt das Dashboard, `docker ps` zeigt `homeassistant` und `pi-dashboard` als `Up`. Fehlersuche: `docker logs --tail 50 pi-dashboard` – tauchen dort Anfragen wie `GET /auto/api/…` oder `GET /ws/api/websocket` auf, ist ein alter Build ohne `auto`-Unterstützung im Einsatz → neu bauen.

**Alternative (Neuaufbau von null):** `deploy/docker-compose.yml` startet HA + Dashboard zusammen und baut das Dashboard auf dem Pi (`cd ~/SmartHomeHeart/deploy && cp ../.env.example .env && docker compose up -d --build`). Auf einem Pi 4 mit 2 GB dauert der Build lange; der obige Weg ist im Alltag schneller.

Sprachassistent-Container (`calhelper`, `groq_stt`): siehe `assistant/README.md` (`cd assistant && docker compose up -d --build`).

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

Stand 3.9.2026 ist der Kiosk auf `homehole` **noch nicht eingerichtet** (kein `~/kiosk.sh`, kein Autostart) – das Display fehlt noch. Das Skript installiert Chromium, `unclutter`, Inter-Schrift, setzt Autologin auf den Desktop, schaltet Bildschirm-Blanking aus und legt `~/kiosk.sh` + Autostart (labwc und XDG) an. `kiosk.sh` startet Chromium mit `--kiosk http://localhost:8080/?kiosk=1`, unterdrückt Fehlerdialoge, deaktiviert Pinch-Zoom und Rückwärts-Wischen. Andere URL: `DASHBOARD_URL=… ~/kiosk.sh`.

## 7. Home Assistant

### 7.1 Erst-Einrichtung

`http://homehole.local:8123` → Konto anlegen → Standort setzen (*Einstellungen → System → Allgemein → Standort*: Fichtenweg 10A, 26209 Hatten / Sandkrug) → Met.no-Wetter wird automatisch `weather.home`.

### 7.2 Long-Lived-Token

Profil (unten links) → *Sicherheit* → *Langlebige Zugangstoken* → *Token erstellen* (Name `dashboard`). Den Token einmal kopieren (wird nicht erneut angezeigt) und in `deploy/.env` als `VITE_HA_TOKEN` eintragen. Ein zweiter Token `viktor` dient dem Fernzugriff (Kap. 8).

### 7.3 CORS

Auf `homehole` ist die `http:`-Konfiguration bereits in die UI migriert (`~/homeassistant/.storage/http`, `yaml_migration_done: true`) – ein `http:`-Block in `configuration.yaml` wird **ignoriert**. Erlaubte Origins (Stand 3.9.2026): `http://localhost:5173`, `http://localhost:8080`, `http://192.168.178.151:8080`, `http://homehole.local:8080`, `http://100.109.2.10:8080`. Ändern: *Einstellungen → System → Netzwerk* (HTTP-Einstellungen) oder `.storage/http` → `data.stable.cors_allowed_origins`, dann HA neu starten. Prüfen: `curl -sD - -o /dev/null -H "Origin: http://192.168.178.151:8080" -H "Authorization: Bearer <Token>" http://localhost:8123/api/ | grep -i access-control`.

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

Auf dem Pi läuft Tailscale (1.102.x), Node `homehole` = `100.109.2.10`. Installation: `curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up`.

Viktor hängt als Node **`viktor-ai`** im Tailnet (per Auth-Key aufgenommen) und erreicht:

- Home Assistant: `http://100.109.2.10:8123` (eigener Long-Lived-Token `viktor`)
- Dashboard: `http://100.109.2.10:8080`
- SSH als `wowsit`: Viktors öffentlicher Schlüssel steht in `~/.ssh/authorized_keys`. **Tailscale SSH ist auf dem Pi abgeschaltet** (`sudo tailscale set --ssh=false`), weil die Standard-ACL im „check“-Modus eine Browser-Bestätigung verlangt, die ein Headless-Client nicht leisten kann. Klassisches sshd über die Tailnet-IP funktioniert.

Damit kann Viktor Builds einspielen, Container/Logs prüfen und HA-Konfiguration lesen. Zugriff entziehen: Node `viktor-ai` in der Tailscale-Admin-Konsole löschen und/oder Key aus `authorized_keys` entfernen. Die LAN-IP `192.168.178.151` ist von außen nicht erreichbar; sie ist per DHCP vergeben (feste IP in der Fritz!Box noch offen).

## 9. Betrieb

| Aufgabe | Befehl (auf dem Pi) |
|---|---|
| Dashboard-Update einspielen | Build am Laptop/bei Viktor, `dist/` kopieren, `docker exec pi-dashboard nginx -s reload` (Kap. 6.3) |
| HA aktualisieren | `docker pull ghcr.io/home-assistant/home-assistant:stable && docker stop homeassistant && docker rm homeassistant`, dann `docker run …` aus Kap. 6.3 (Konfiguration bleibt in `~/homeassistant`) |
| Logs | `docker logs -f pi-dashboard` / `docker logs -f homeassistant` / `docker logs -f groq_stt` |
| Status | `docker ps -a` |
| Kiosk neu starten | `pkill chromium; ~/kiosk.sh &` (sobald Kiosk eingerichtet) |
| HA-Konfiguration prüfen | *Entwicklerwerkzeuge → YAML → Konfiguration prüfen* |
| Letzte STT-Aufnahme anhören | `docker cp groq_stt:/tmp/last.wav .` (Container läuft mit `DEBUG_SAVE=1`) |

Fehlerbilder:

- **„Keine Verbindung zu Home Assistant“** unten links → Token falsch/abgelaufen (HA antwortet 401), HA nicht erreichbar, oder Build ohne `auto`-Unterstützung (nginx-Log zeigt `/auto/api/…`). Mit gültigem Token und `VITE_HA_URL=auto` neu bauen, Browser hart neu laden.
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

1. Echte Entity-IDs für Lichter, Räume, Szenen, Media-Player in `config.ts` eintragen (Kalender und Wetter sind echt, Rest noch Platzhalter).
2. YouTube Music: HA-Integration (HACS „YouTube Music“ oder Music Assistant) einrichten → `media_player`-Entity.
3. Display kaufen, Kiosk einrichten (Kap. 6.5), Rotation + Touch-Kalibrierung verifizieren.
4. Feste IP für den Pi in der Fritz!Box (aktuell DHCP `192.168.178.151`).
5. Home Assistant aktualisieren (Stand 3.9.2026: 2026.8.1 installiert, 2026.9.0 verfügbar); Pi-Pakete aktualisieren (`sudo apt full-upgrade`).
6. Container `whisper` (lokales Fallback-STT) endgültig entfernen, sobald Groq-STT sich bewährt hat (spart ~500 MB RAM).
7. Optional: Automation für Bildschirm-Dimmen nachts (HA → `shell_command` auf dem Pi oder Chromium-Overlay).
