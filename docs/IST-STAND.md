# Ist-Stand `homehole` – automatisch exportiert

> Erzeugt am **2026-09-03 18:08 CEST** von `deploy/export-state.py` direkt auf dem Pi. **Nicht von Hand bearbeiten** – wird bei jedem Deploy
> neu erzeugt (`deploy/export-state.sh`). Geheimnisse (Tokens, Passwörter, API-Keys, E-Mail-Adressen) sind maskiert.
> Rohdateien liegen in [`docs/ist-stand/`](ist-stand/). Architektur & Aufbau-Anleitung: [`AUFBAU.md`](AUFBAU.md), Sprachassistent: [`../assistant/README.md`](../assistant/README.md).

## System

| Was | Wert |
|---|---|
| Host | HomeHole |
| OS / Kernel | Debian GNU/Linux 13 (trixie) / 6.18.34+rpt-rpi-v8 |
| Modell | Raspberry Pi 4 Model B Rev 1.5 |
| Uptime | up 1 hour, 24 minutes |
| RAM | 1.3Gi belegt von 1.8Gi |
| Disk / | 16G belegt von 29G (57%) |
| Docker | 29.7.2, build a7dcaa6 |
| Tailscale | 1.102.3 |
| LAN-IP | 192.168.178.151 |
| Tailscale-IP / -Name | 100.109.2.10 / homehole.tailea3a91.ts.net |
| Apt-Updates ausstehend | 215 |
| Home Assistant | 2026.8.1 |

## Container

| Container | Image | Status | Netz | Restart | Ports (Host→Container) | Mounts | Cmd | Env (nur Namen) |
|---|---|---|---|---|---|---|---|---|
| piper | rhasspy/wyoming-piper | running | bridge | unless-stopped | 127.0.0.1:10200→10200/tcp | /home/wowsit/piper-data:/data | --voice de_DE-thorsten-medium --length-scale 0.85 | – |
| groq_stt | groq_stt | running | bridge | unless-stopped | 127.0.0.1:10301→10301/tcp | – | python -u /app/groq_stt.py | GROQ_API_KEY STT_LANGUAGE STT_PROMPT |
| homeassistant | ghcr.io/home-assistant/home-assistant:stable | running | host | unless-stopped | – | /home/wowsit/homeassistant:/config:rw, /etc/localtime:/etc/localtime:ro | – | PIP_EXTRA_INDEX_URL S6_BEHAVIOUR_IF_STAGE2_FAILS S6_CMD_WAIT_FOR_SERVICES S6_CMD_WAIT_FOR_SERVICES_MAXTIME S6_SERVICES_GRACETIME S6_SERVICES_READYTIME UV_EXTRA_INDEX_URL UV_NO_CACHE UV_SYSTEM_PYTHON |
| matter-server | ghcr.io/home-assistant-libs/python-matter-server:stable | running | host | unless-stopped | – | /home/wowsit/homeassistant-stack/matter:/data:rw | --storage-path /data --paa-root-cert-dir /data/credentials --primary-interface wlan0 | chip_example_url |
| otbr | openthread/border-router:latest | running | host | always | – | /home/wowsit/homeassistant-stack/otbr:/data:rw | – | OT_INFRA_IF OT_RCP_DEVICE OT_THREAD_IF S6_OVERLAY_VERSION |
| pi-dashboard | nginx:alpine | running | bridge | unless-stopped | 0.0.0.0:8443→443/tcp, 0.0.0.0:8080→80/tcp | /home/wowsit/dashboard/nginx.conf:/etc/nginx/conf.d/default.conf:ro, /home/wowsit/dashboard/tls:/etc/nginx/tls:ro, /home/wowsit/dashboard/dist:/usr/share/nginx/html:ro | nginx -g daemon off; | ACME_VERSION DYNPKG_RELEASE NGINX_VERSION NJS_RELEASE NJS_VERSION PKG_RELEASE |
| openwakeword | rhasspy/wyoming-openwakeword | running | bridge | unless-stopped | 127.0.0.1:10500→10400/tcp | /home/wowsit/openwakeword/custom:/custom | --preload-model ok_nabu --custom-model-dir /custom | – |
| calhelper | calhelper | running | bridge | unless-stopped | 127.0.0.1:10400→10400/tcp | – | python -u /app/calhelper.py | CALDAV_PASS CALDAV_URL CALDAV_USER TZ |
| whisper | rhasspy/wyoming-whisper | exited | bridge | no | 0.0.0.0:10300→10300/tcp | /home/wowsit/whisper-data:/data | --model tiny-int8 --language de --beam-size 1 | – |

## Dashboard (nginx `pi-dashboard`)

| Was | Wert |
|---|---|
| Deployter Build | 064c688 (main) deployed 2026-09-03 16:40 CEST |
| Assets | index-DeBlR2Va.js, index-cVlT78Jj.css |
| dist geändert | 2026-09-03 16:37 |
| HA-URL-Modus | auto (location.hostname:8123 / bei https same-origin) |
| TLS-Zertifikat | notAfter=Aug 31 14:38:12 2036 GMT X509v3 Subject Alternative Name: DNS:localhost, DNS:HomeHole, DNS:HomeHole.local, IP Address:127.0.0.1, IP Address:192.168.178.151, IP Address:100.109.2.10, DNS:homehole.tailea3a91.ts.net |
| Backups | dist.bak-20260903-160124, dist.bak-20260903-163812 |
| Kiosk | nicht eingerichtet |

nginx-Konfiguration: [`ist-stand/nginx.conf`](ist-stand/nginx.conf)

## Home Assistant

### Integrationen (config_entries)

| Domain | Titel | Quelle | State | Daten-Schlüssel (Werte nicht exportiert) | Unter-Einträge |
|---|---|---|---|---|---|
| analytics | Analytics | system |  | – | – |
| anthropic | Claude | user |  | api_key | Claude conversation (conversation); Claude AI Task (ai_task_data) |
| backup | Backup | system |  | – | – |
| bluetooth | Raspberry Pi Trading Ltd None (D8:3A:DD:87:BD:3B) | integration_discovery |  | – | – |
| caldav | <email> | user |  | password, url, username, verify_ssl | – |
| go2rtc | go2rtc | system |  | – | – |
| google_translate | Google Translate text-to-speech | onboarding |  | language, tld | – |
| home_connect |  <email> | user |  | auth_implementation, token | – |
| met | Home | onboarding |  | track_home | – |
| mobile_app | Fynn’s iPhone | registration |  | app_data, app_id, app_name, app_version, device_id, device_name, manufacturer, model, no_legacy_encryption, os_name, os_version, secret, supports_encryption, user_id, webhook_id | – |
| radio_browser | Radio Browser | onboarding |  | – | – |
| shopping_list | Shopping list | onboarding |  | – | – |
| sun | Sun | import |  | – | – |
| wyoming | groq-whisper | user |  | host, port | – |
| wyoming | openwakeword | user |  | host, port | – |
| wyoming | piper | user |  | host, port | – |

### Anthropic „Claude conversation“

Optionen: `{"chat_model": "claude-haiku-4-5", "code_execution": false, "llm_hass_api": ["assist"], "max_tokens": 250, "prompt_caching": "prompt", "recommended": false, "thinking_budget": 0, "user_location": false, "web_fetch": false, "web_fetch_max_uses": 5, "web_search": false, "web_search_max_uses": 5}` – Prompt (2283 Zeichen): [`ist-stand/claude_prompt.live.txt`](ist-stand/claude_prompt.live.txt)

### Assist-Pipelines (★ = bevorzugt)

| Name | Sprache | Konversation | STT | TTS (Stimme) | Lokale Intents | Wake-Word Entity / ID |
|---|---|---|---|---|---|---|
| Home Assistant | en | conversation.home_assistant | – | – | nein | – / – |
| ★ Haus (Claude) | de | conversation.claude_conversation | stt.groq_whisper | tts.piper (de_DE-thorsten-medium) | ja | wake_word.openwakeword / hey_jarvis |

### Für Assist freigegebene Entitäten (explizit)

_keine expliziten Einträge – es gilt die Standard-Freigabe der Entitäten (siehe Spalte „Assist“ unten)_

### HTTP (.storage/http)

| Einstellung | Wert |
|---|---|
| login_attempts_threshold | -1 |
| ssl_profile | "modern" |
| cors_allowed_origins | ["https://cast.home-assistant.io", "http://localhost:5173", "http://localhost:8080", "http://192.168.178.151:8080", "http://homehole.local:8080", "http://100.109.2.10:8080"] |
| server_port | 8123 |
| ip_ban_enabled | true |
| use_x_frame_options | true |

### Bereiche

Living Room (`living_room`), Kitchen (`kitchen`), Bedroom (`bedroom`)

### Personen

| Name | Device-Tracker |
|---|---|
| emfy | device_tracker.fynns_iphone |

### Entitäten (76)

| Integration | Entity-ID | Name | Bereich | Status | Assist |
|---|---|---|---|---|---|
| anthropic | `ai_task.claude_ai_task` |  | – | aktiv | – |
| anthropic | `conversation.claude_conversation` |  | – | aktiv | – |
| backup | `event.backup_automatic_backup` | Automatic backup | – | aktiv | – |
| backup | `sensor.backup_backup_manager_state` | Backup Manager state | – | aktiv | – |
| backup | `sensor.backup_last_attempted_automatic_backup` | Last attempted automatic backup | – | aktiv | – |
| backup | `sensor.backup_last_successful_automatic_backup` | Last successful automatic backup | – | aktiv | – |
| backup | `sensor.backup_next_scheduled_automatic_backup` | Next scheduled automatic backup | – | aktiv | – |
| caldav | `calendar.arbeid` | Arbeid | – | aktiv | ja |
| caldav | `calendar.hjem` | Hjem | – | aktiv | ja |
| caldav | `calendar.untitled` | Untitled | – | aktiv | – |
| caldav | `todo.paminnelser` | Påminnelser ⚠️ | – | aktiv | ja |
| google_translate | `tts.google_translate_en_com` | Google Translate en com | – | aktiv | – |
| home_connect | `binary_sensor.oven_connectivity` | Connectivity | Kitchen | aktiv | – |
| home_connect | `binary_sensor.oven_interior_illumination_active` | Interior illumination active | Kitchen | aktiv | – |
| home_connect | `binary_sensor.oven_local_control` | Local control | Kitchen | aktiv | – |
| home_connect | `binary_sensor.oven_remote_control` | Remote control | Kitchen | aktiv | – |
| home_connect | `binary_sensor.oven_remote_start` | Remote start | Kitchen | aktiv | – |
| home_connect | `button.kitchen_oven_resume_program` | Resume program | Kitchen | aktiv | – |
| home_connect | `button.oven_pause_program` | Pause program | Kitchen | aktiv | – |
| home_connect | `button.oven_stop_program` | Stop program | Kitchen | aktiv | – |
| home_connect | `number.kitchen_oven_duration` | Duration | Kitchen | aktiv | – |
| home_connect | `number.kitchen_oven_setpoint_temperature` | Setpoint temperature | Kitchen | aktiv | – |
| home_connect | `number.kitchen_oven_start_in_relative` | Start in relative | Kitchen | aktiv | – |
| home_connect | `number.oven_alarm_clock` | Alarm clock | Kitchen | aktiv | – |
| home_connect | `select.oven_active_program` | Active program | Kitchen | aktiv | – |
| home_connect | `select.oven_selected_program` | Selected program | Kitchen | aktiv | – |
| home_connect | `sensor.oven_alarm_clock_elapsed` | Alarm clock elapsed | Kitchen | aus: integration | – |
| home_connect | `sensor.oven_current_oven_cavity_temperature` | Current oven cavity temperature | Kitchen | aktiv | ja |
| home_connect | `sensor.oven_door` | Door | Kitchen | aktiv | – |
| home_connect | `sensor.oven_operation_state` | Operation state | Kitchen | aktiv | – |
| home_connect | `sensor.oven_pre_heat_finished` | Pre-heat finished | Kitchen | aus: integration | – |
| home_connect | `sensor.oven_program_finish_time` | Program finish time | Kitchen | aktiv | – |
| home_connect | `sensor.oven_program_finished` | Program finished | Kitchen | aus: integration | – |
| home_connect | `sensor.oven_program_progress` | Program progress | Kitchen | aktiv | – |
| home_connect | `sensor.oven_regular_pre_heat_finished` | Regular pre-heat finished | Kitchen | aus: integration | – |
| home_connect | `switch.oven_child_lock` | Child lock | Kitchen | aktiv | ja |
| home_connect | `switch.oven_power` | Power | Kitchen | aktiv | ja |
| met | `weather.forecast_home` | Home | – | aktiv | ja |
| mobile_app | `binary_sensor.fynns_iphone_camera_motion` | Fynn’s iPhone Camera Motion | – | aus: integration | – |
| mobile_app | `binary_sensor.fynns_iphone_kiosk_mode` | Fynn’s iPhone Kiosk Mode | – | aktiv | – |
| mobile_app | `binary_sensor.fynns_iphone_kiosk_screensaver` | Fynn’s iPhone Kiosk Screensaver | – | aktiv | – |
| mobile_app | `device_tracker.fynns_iphone` | Fynn’s iPhone | – | aktiv | – |
| mobile_app | `notify.fynns_iphone` |  | – | aktiv | – |
| mobile_app | `sensor.fynns_iphone_app_version` | Fynn’s iPhone App Version | – | aktiv | – |
| mobile_app | `sensor.fynns_iphone_audio_output` | Fynn’s iPhone Audio Output | – | aktiv | – |
| mobile_app | `sensor.fynns_iphone_battery_level` | Fynn’s iPhone Battery Level | – | aktiv | – |
| mobile_app | `sensor.fynns_iphone_battery_state` | Fynn’s iPhone Battery State | – | aktiv | – |
| mobile_app | `sensor.fynns_iphone_bssid` | Fynn’s iPhone BSSID | – | aktiv | – |
| mobile_app | `sensor.fynns_iphone_camera_stream` | Fynn’s iPhone Camera Stream | – | aus: integration | – |
| mobile_app | `sensor.fynns_iphone_connection_type` | Fynn’s iPhone Connection Type | – | aktiv | – |
| mobile_app | `sensor.fynns_iphone_geocoded_location` | Fynn’s iPhone Geocoded Location | – | aktiv | – |
| mobile_app | `sensor.fynns_iphone_kiosk_brightness` | Fynn’s iPhone Kiosk Brightness | – | aktiv | – |
| mobile_app | `sensor.fynns_iphone_kiosk_volume` | Fynn’s iPhone Kiosk Volume | – | aktiv | – |
| mobile_app | `sensor.fynns_iphone_last_update_trigger` | Fynn’s iPhone Last Update Trigger | – | aktiv | – |
| mobile_app | `sensor.fynns_iphone_location_permission` | Fynn’s iPhone Location permission | – | aktiv | – |
| mobile_app | `sensor.fynns_iphone_sim_1` | Fynn’s iPhone SIM 1 | – | aktiv | – |
| mobile_app | `sensor.fynns_iphone_sim_2` | Fynn’s iPhone SIM 2 | – | aktiv | – |
| mobile_app | `sensor.fynns_iphone_ssid` | Fynn’s iPhone SSID | – | aktiv | – |
| mobile_app | `sensor.fynns_iphone_storage` | Fynn’s iPhone Storage | – | aktiv | – |
| person | `person.emfy` | emfy | – | aktiv | – |
| script | `script.kalendereintrag_erstellen` | Kalendereintrag erstellen | – | aktiv | ja |
| script | `script.termin_loeschen` | Termin löschen | – | aktiv | ja |
| script | `script.termin_verschieben` | Termin verschieben | – | aktiv | ja |
| shopping_list | `todo.shopping_list` | Shopping List | – | aktiv | ja |
| sun | `binary_sensor.sun_solar_rising` | Solar rising | – | aus: integration | – |
| sun | `sensor.sun_next_dawn` | Next dawn | – | aktiv | – |
| sun | `sensor.sun_next_dusk` | Next dusk | – | aktiv | – |
| sun | `sensor.sun_next_midnight` | Next midnight | – | aktiv | – |
| sun | `sensor.sun_next_noon` | Next noon | – | aktiv | – |
| sun | `sensor.sun_next_rising` | Next rising | – | aktiv | – |
| sun | `sensor.sun_next_setting` | Next setting | – | aktiv | – |
| sun | `sensor.sun_solar_azimuth` | Solar azimuth | – | aus: integration | – |
| sun | `sensor.sun_solar_elevation` | Solar elevation | – | aus: integration | – |
| wyoming | `stt.groq_whisper` | groq-whisper | – | aktiv | – |
| wyoming | `tts.piper` | piper | – | aktiv | – |
| wyoming | `wake_word.openwakeword` | openwakeword | – | aktiv | – |

### YAML-Konfiguration (Kopien, Geheimnisse maskiert)

- [`ist-stand/configuration.yaml`](ist-stand/configuration.yaml) (24 Zeilen)
- [`ist-stand/automations.yaml`](ist-stand/automations.yaml) (1 Zeilen)
- [`ist-stand/scripts.yaml`](ist-stand/scripts.yaml) (156 Zeilen)
- [`ist-stand/scenes.yaml`](ist-stand/scenes.yaml) (0 Zeilen)

### Skripte

| script.* | Alias |
|---|---|
| `script.kalendereintrag_erstellen` | Kalendereintrag erstellen |
| `script.termin_loeschen` | Termin löschen |
| `script.termin_verschieben` | Termin verschieben |

### Automationen

_keine_

### Repo ↔ Pi

- `assistant/homeassistant/scripts.yaml` ↔ live: identisch ✅
- `assistant/homeassistant/claude_prompt.txt` ↔ live: identisch ✅
- `deploy/nginx.conf` ↔ live: identisch ✅

### Letzte Warnungen/Fehler im HA-Log

```
2026-09-03 17:12:52.858 ERROR (MainThread) [habluetooth.scanner] hci0 (D8:3A:DD:87:BD:3B): Failed to force stop scanner
2026-09-03 17:19:17.789 ERROR (MainThread) [habluetooth.scanner] hci0 (D8:3A:DD:87:BD:3B): Failed to force stop scanner
2026-09-03 17:22:53.145 ERROR (MainThread) [habluetooth.scanner] hci0 (D8:3A:DD:87:BD:3B): Failed to force stop scanner
2026-09-03 17:29:18.118 ERROR (MainThread) [habluetooth.scanner] hci0 (D8:3A:DD:87:BD:3B): Failed to force stop scanner
2026-09-03 17:32:53.372 ERROR (MainThread) [habluetooth.scanner] hci0 (D8:3A:DD:87:BD:3B): Failed to force stop scanner
2026-09-03 17:39:18.234 ERROR (MainThread) [habluetooth.scanner] hci0 (D8:3A:DD:87:BD:3B): Failed to force stop scanner
2026-09-03 17:42:53.779 ERROR (MainThread) [habluetooth.scanner] hci0 (D8:3A:DD:87:BD:3B): Failed to force stop scanner
2026-09-03 17:49:18.493 ERROR (MainThread) [habluetooth.scanner] hci0 (D8:3A:DD:87:BD:3B): Failed to force stop scanner
2026-09-03 17:52:54.078 ERROR (MainThread) [habluetooth.scanner] hci0 (D8:3A:DD:87:BD:3B): Failed to force stop scanner
2026-09-03 17:59:18.583 ERROR (MainThread) [habluetooth.scanner] hci0 (D8:3A:DD:87:BD:3B): Failed to force stop scanner
2026-09-03 18:02:54.473 ERROR (MainThread) [habluetooth.scanner] hci0 (D8:3A:DD:87:BD:3B): Failed to force stop scanner
2026-09-03 18:05:00.110 ERROR (MainThread) [homeassistant.components.tts] Error on init tts: Language 'de' not supported
2026-09-03 18:05:00.113 ERROR (MainThread) [homeassistant.helpers.http] Unable to serialize to JSON. Bad data found at $.error=Language 'de' not supported(<class 'homeassistant.exceptions.HomeAssistantError'>
2026-09-03 18:05:17.736 ERROR (MainThread) [homeassistant.components.tts] Error on init tts: Language 'de' not supported
2026-09-03 18:05:17.737 ERROR (MainThread) [homeassistant.helpers.http] Unable to serialize to JSON. Bad data found at $.error=Language 'de' not supported(<class 'homeassistant.exceptions.HomeAssistantError'>
```

## Sprachassistent

| Was | Wert |
|---|---|
| openwakeword custom models | – |
| whisper-Modelle (Fallback) | models--rhasspy--faster-whisper-tiny-int8 |
| groq_stt letzte Aufnahme | – |
| TTS-Cache | 39 Dateien |

## Offene Ports (Host)

```
0.0.0.0:111  rpcbind
0.0.0.0:22  sshd
0.0.0.0:5580  matter-server
0.0.0.0:8080  docker-proxy
0.0.0.0:8123  python3
0.0.0.0:8443  docker-proxy
100.109.2.10:35581  tailscaled
[::]:111  rpcbind
127.0.0.1:10200  docker-proxy
127.0.0.1:10301  docker-proxy
127.0.0.1:10400  docker-proxy
127.0.0.1:10500  docker-proxy
127.0.0.1:18554  go2rtc
127.0.0.1:8081  otbr-agent
*:18555  go2rtc
[::]:22  sshd
[::]:5580  matter-server
[::]:8080  docker-proxy
[::]:8123  python3
[::]:8443  docker-proxy
[fd7a:115c:a1e0::9332:20c]:50757  tailscaled
```
