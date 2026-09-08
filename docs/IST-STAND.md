# Ist-Stand `homehole` – automatisch exportiert

> Erzeugt am **2026-09-08 20:09 CEST** von `deploy/export-state.py` direkt auf dem Pi. **Nicht von Hand bearbeiten** – wird bei jedem Deploy
> neu erzeugt (`deploy/export-state.sh`). Geheimnisse (Tokens, Passwörter, API-Keys, E-Mail-Adressen) sind maskiert.
> Rohdateien liegen in [`docs/ist-stand/`](ist-stand/). Architektur & Aufbau-Anleitung: [`AUFBAU.md`](AUFBAU.md), Sprachassistent: [`../assistant/README.md`](../assistant/README.md).

## System

| Was | Wert |
|---|---|
| Host | HomeHole |
| OS / Kernel | Debian GNU/Linux 13 (trixie) / 6.18.34+rpt-rpi-v8 |
| Modell | Raspberry Pi 4 Model B Rev 1.5 |
| Uptime | up 4 days, 6 hours, 7 minutes |
| RAM | 1.0Gi belegt von 1.8Gi |
| Disk / | 13G belegt von 29G (48%) |
| Docker | 29.7.2, build a7dcaa6 |
| Tailscale | 1.102.3 |
| LAN-IP | 192.168.178.52 |
| Tailscale-IP / -Name | 100.109.2.10 / homehole.tailea3a91.ts.net |
| Apt-Updates ausstehend | 31 |
| Home Assistant | 2026.8.1 |

## Container

| Container | Image | Status | Netz | Restart | Ports (Host→Container) | Mounts | Cmd | Env (nur Namen) |
|---|---|---|---|---|---|---|---|---|
| openwakeword | rhasspy/wyoming-openwakeword | running | bridge | unless-stopped | 127.0.0.1:10500→10400/tcp | /home/wowsit/openwakeword/custom:/custom | --preload-model okay_nabu --preload-model hey_haus --custom-model-dir /custom --threshold 0.5 --trigger-level 1 | – |
| groq_stt | groq_stt | running | bridge | unless-stopped | 127.0.0.1:10301→10301/tcp | – | python -u /app/groq_stt.py | GROQ_API_KEY STT_LANGUAGE STT_PROMPT |
| wwrec | python:3.12-alpine | running | bridge | unless-stopped | 172.17.0.1:10460→10460/tcp | /home/wowsit/wwrec:/app:ro, /home/wowsit/wakeword-clips:/clips | python /app/wwrec.py | – |
| otbr | openthread/border-router:latest | exited | host | always | – | /home/wowsit/homeassistant-stack/otbr:/data:rw | – | OT_INFRA_IF OT_RCP_DEVICE OT_THREAD_IF OT_WEB_LISTEN_PORT S6_OVERLAY_VERSION |
| calhelper | calhelper | running | bridge | unless-stopped | 127.0.0.1:10400→10400/tcp | – | python -u /app/calhelper.py | CALDAV_PASS CALDAV_PASS2 CALDAV_URL CALDAV_USER CALDAV_USER2 TZ |
| homeassistant | ghcr.io/home-assistant/home-assistant:stable | running | host | unless-stopped | – | /home/wowsit/homeassistant:/config:rw, /etc/localtime:/etc/localtime:ro | – | PIP_EXTRA_INDEX_URL S6_BEHAVIOUR_IF_STAGE2_FAILS S6_CMD_WAIT_FOR_SERVICES S6_CMD_WAIT_FOR_SERVICES_MAXTIME S6_SERVICES_GRACETIME S6_SERVICES_READYTIME UV_EXTRA_INDEX_URL UV_NO_CACHE UV_SYSTEM_PYTHON |
| matter-server | ghcr.io/home-assistant-libs/python-matter-server:stable | running | host | unless-stopped | – | /home/wowsit/homeassistant-stack/matter:/data:rw | --storage-path /data --paa-root-cert-dir /data/credentials --primary-interface wlan0 | chip_example_url |
| pi-dashboard | nginx:alpine | running | bridge | unless-stopped | 0.0.0.0:8443→443/tcp, 0.0.0.0:8080→80/tcp | /home/wowsit/dashboard/nginx.conf:/etc/nginx/conf.d/default.conf:ro, /home/wowsit/dashboard/tls:/etc/nginx/tls:ro, /home/wowsit/dashboard/dist:/usr/share/nginx/html:ro | nginx -g daemon off; | ACME_VERSION DYNPKG_RELEASE NGINX_VERSION NJS_RELEASE NJS_VERSION PKG_RELEASE |

## Dashboard (nginx `pi-dashboard`)

| Was | Wert |
|---|---|
| Deployter Build | 38e9a12-sensoren 2026-09-08T18:08:10+00:00 |
| Assets | index-BYjPBgkf.js, index-CB12KJG5.css |
| dist geändert | 2026-09-08 20:08 |
| HA-URL-Modus | auto (location.hostname:8123 / bei https same-origin) |
| TLS-Zertifikat | notAfter=Aug 31 14:38:12 2036 GMT X509v3 Subject Alternative Name: DNS:localhost, DNS:HomeHole, DNS:HomeHole.local, IP Address:127.0.0.1, IP Address:192.168.178.151, IP Address:100.109.2.10, DNS:homehole.tailea3a91.ts.net |
| Backups | dist.bak-2026-09-08, dist.bak-20260903-160124, dist.bak-20260903-163812, dist.bak-20260904-223308, dist.bak-20260905-222856, dist.bak-20260905-225555, dist.bak-20260906-180728, dist.bak-20260907-164919, dist.bak-20260907-170352 |
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
| caldav | <email> | user |  | password, url, username, verify_ssl | – |
| edge_tts | Edge TTS | user |  | – | – |
| go2rtc | go2rtc | system |  | – | – |
| group | Esszimmer deckenlampe | user |  | – | – |
| group | Licht Wohnen | user |  | – | – |
| home_connect |  <email> | user |  | auth_implementation, token | – |
| homekit_controller | LG webOS TV BD3C | zeroconf |  | AccessoryIP, AccessoryIPs, AccessoryLTPK, AccessoryPairingID, AccessoryPort, Connection, iOSDeviceLTPK, iOSDeviceLTSK, iOSPairingId | – |
| matter | Matter | zeroconf |  | integration_created_addon, url, use_addon | – |
| met | Home | onboarding |  | track_home | – |
| mobile_app | Emilia | registration |  | app_data, app_id, app_name, app_version, device_id, device_name, manufacturer, model, no_legacy_encryption, os_name, os_version, secret, supports_encryption, user_id, webhook_id | – |
| mobile_app | Fynn’s iPhone | registration |  | app_data, app_id, app_name, app_version, device_id, device_name, manufacturer, model, no_legacy_encryption, os_name, os_version, secret, supports_encryption, user_id, webhook_id | – |
| music_assistant | Music Assistant | user |  | token, url | – |
| otbr | Open Thread Border Router | user |  | url | – |
| radio_browser | Radio Browser | onboarding |  | – | – |
| shopping_list | Shopping list | onboarding |  | – | – |
| sun | Sun | import |  | – | – |
| thread | Thread | zeroconf |  | – | – |
| wyoming | groq-whisper | user |  | host, port | – |
| wyoming | openwakeword | user |  | host, port | – |
| zha |  | user |  | device, radio_type | – |

### Anthropic „Claude conversation“

Optionen: `{"chat_model": "claude-haiku-4-5", "code_execution": false, "llm_hass_api": ["assist"], "max_tokens": 250, "prompt_caching": "prompt", "recommended": false, "thinking_budget": 0, "user_location": false, "web_fetch": false, "web_fetch_max_uses": 5, "web_search": false, "web_search_max_uses": 5}` – Prompt (2801 Zeichen): [`ist-stand/claude_prompt.live.txt`](ist-stand/claude_prompt.live.txt)

### Assist-Pipelines (★ = bevorzugt)

| Name | Sprache | Konversation | STT | TTS (Stimme) | Lokale Intents | Wake-Word Entity / ID |
|---|---|---|---|---|---|---|
| Home Assistant | en | conversation.home_assistant | – | – | nein | – / – |
| ★ Haus (Claude) | de | conversation.claude_conversation | stt.groq_whisper | tts.edge_tts_service_edge_tts | nein | wake_word.openwakeword / hey_haus |

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

Wohnzimmer (`living_room`), Kitchen (`kitchen`), Bedroom (`bedroom`), Esszimmer (`esszimmer`), Draussen (`draussen`), Büro (`buro`)

### Personen

| Name | Device-Tracker |
|---|---|
| emfy | device_tracker.fynns_iphone, device_tracker.emilia |

### Entitäten (296)

| Integration | Entity-ID | Name | Bereich | Status | Assist |
|---|---|---|---|---|---|
| anthropic | `ai_task.claude_ai_task` |  | – | aktiv | – |
| anthropic | `conversation.claude_conversation` |  | – | aktiv | – |
| automation | `automation.anlage_bei_musik_automatisch_an` | Anlage: bei Musik automatisch an | – | aktiv | – |
| automation | `automation.kalender_live_icloud_abgleichen_dashboard_benachrichtigen` | Kalender live: iCloud abgleichen + Dashboard benachrichtigen | – | aktiv | – |
| automation | `automation.prasenz_buro_bodenlampe_an_aus` | Präsenz Büro: Bodenlampe an/aus | – | aktiv | – |
| automation | `automation.prasenz_kuche_licht_an_aus` | Präsenz Küche: Licht an/aus | – | aktiv | – |
| automation | `automation.wakeup_song_abspielen` | Wakeup-Song abspielen | – | aktiv | – |
| backup | `event.backup_automatic_backup` | Automatic backup | – | aktiv | – |
| backup | `sensor.backup_backup_manager_state` | Backup Manager state | – | aktiv | – |
| backup | `sensor.backup_last_attempted_automatic_backup` | Last attempted automatic backup | – | aktiv | – |
| backup | `sensor.backup_last_successful_automatic_backup` | Last successful automatic backup | – | aktiv | – |
| backup | `sensor.backup_next_scheduled_automatic_backup` | Next scheduled automatic backup | – | aktiv | – |
| caldav | `calendar.arbeid` | Arbeid | – | aktiv | ja |
| caldav | `calendar.arbeit` | Arbeit | – | aktiv | ja |
| caldav | `calendar.calendar` | Calendar | – | aktiv | – |
| caldav | `calendar.familie` | Familie | – | aktiv | ja |
| caldav | `calendar.hjem` | Hjem | – | aktiv | ja |
| caldav | `calendar.kalender` | Kalender | – | aktiv | ja |
| caldav | `calendar.privat` | Privat | – | aktiv | ja |
| caldav | `calendar.schule` | Schule | – | aktiv | – |
| caldav | `calendar.untitled` | Untitled | – | aktiv | – |
| caldav | `todo.erinnerungen` | Erinnerungen | – | aktiv | ja |
| caldav | `todo.familie` | Familie | – | aktiv | ja |
| caldav | `todo.fremdworter_zum_nachschlagen` | Fremdwörter zum nachschlagen | – | aktiv | ja |
| caldav | `todo.musik` | Musik | – | aktiv | ja |
| caldav | `todo.paminnelser` | Påminnelser ⚠️ | – | aktiv | ja |
| caldav | `todo.runterladen` | Runterladen | – | aktiv | ja |
| caldav | `todo.schule` | Schule | – | aktiv | ja |
| caldav | `todo.verabredungen` | Verabredungen | – | aktiv | ja |
| edge_tts | `tts.edge_tts_service_edge_tts` | Edge TTS | – | aktiv | – |
| group | `light.esszimmer_deckenlampe` | Esszimmer deckenlampe | Esszimmer | aktiv | ja |
| group | `switch.licht_wohnen` | Licht Wohnen | – | aktiv | ja |
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
| homekit_controller | `button.lg_webos_tv_bd3c_identify` | LG webOS TV BD3C Identify | Wohnzimmer | aktiv | – |
| homekit_controller | `media_player.lg_webos_tv_bd3c` | LG webOS TV BD3C | Wohnzimmer | aktiv | ja |
| homekit_controller | `switch.lg_webos_tv_bd3c_mute` | LG webOS TV BD3C Mute | Wohnzimmer | aktiv | – |
| input_boolean | `input_boolean.wakeup_aktiv` | Wakeup-Song aktiv | – | aktiv | – |
| input_datetime | `input_datetime.wakeup_zeit` | Wakeup-Uhrzeit | – | aktiv | – |
| input_text | `input_text.wakeup_song` | Wakeup-Song | – | aktiv | – |
| input_text | `input_text.wakeup_song_uri` | Wakeup-Song URI (Music Assistant) | – | aktiv | – |
| matter | `binary_sensor.kajplats_e27_ws_globe_1521lm_hardware_faults` | Hardware faults | Kitchen | aus: integration | – |
| matter | `binary_sensor.kajplats_e27_ws_globe_1521lm_network_faults` | Network faults | Kitchen | aus: integration | – |
| matter | `binary_sensor.kajplats_e27_ws_globe_1521lm_radio_faults` | Radio faults | Kitchen | aus: integration | – |
| matter | `button.kajplats_e27_ws_globe_1521lm_identify` | Identify | Kitchen | aktiv | – |
| matter | `light.kajplats_e27_ws_globe_1521lm` |  | Kitchen | aktiv | ja |
| matter | `number.kajplats_e27_ws_globe_1521lm_off_transition_time` | Off transition time | Kitchen | aktiv | – |
| matter | `number.kajplats_e27_ws_globe_1521lm_on_level` | On level | Kitchen | aktiv | – |
| matter | `number.kajplats_e27_ws_globe_1521lm_on_off_transition_time` | On/Off transition time | Kitchen | aktiv | – |
| matter | `number.kajplats_e27_ws_globe_1521lm_on_transition_time` | On transition time | Kitchen | aktiv | – |
| matter | `number.kajplats_e27_ws_globe_1521lm_power_on_level` | Power-on level | Kitchen | aktiv | – |
| matter | `select.kajplats_e27_ws_globe_1521lm_power_on_behavior` | Power-on behavior | Kitchen | aktiv | – |
| matter | `sensor.kajplats_e27_ws_globe_1521lm_boot_reason` | Boot reason | Kitchen | aus: integration | – |
| matter | `sensor.kajplats_e27_ws_globe_1521lm_reboot_count` | Reboot count | Kitchen | aus: integration | – |
| matter | `sensor.kajplats_e27_ws_globe_1521lm_thread_channel` | Thread channel | Kitchen | aus: integration | – |
| matter | `sensor.kajplats_e27_ws_globe_1521lm_thread_network_name` | Thread network name | Kitchen | aus: integration | – |
| matter | `sensor.kajplats_e27_ws_globe_1521lm_thread_routing_role` | Thread routing role | Kitchen | aus: integration | – |
| matter | `sensor.kajplats_e27_ws_globe_1521lm_uptime` | Uptime | Kitchen | aus: integration | – |
| matter | `update.kajplats_e27_ws_globe_1521lm_firmware` | Firmware | Kitchen | aktiv | – |
| met | `weather.forecast_home` | Home | – | aktiv | ja |
| mobile_app | `binary_sensor.emilia_camera_motion` | Emilia Camera Motion | – | aus: integration | – |
| mobile_app | `binary_sensor.emilia_kiosk_mode` | Emilia Kiosk Mode | – | aktiv | – |
| mobile_app | `binary_sensor.emilia_kiosk_screensaver` | Emilia Kiosk Screensaver | – | aktiv | – |
| mobile_app | `binary_sensor.fynns_iphone_camera_motion` | Fynn’s iPhone Camera Motion | – | aus: integration | – |
| mobile_app | `binary_sensor.fynns_iphone_kiosk_mode` | Fynn’s iPhone Kiosk Mode | – | aktiv | – |
| mobile_app | `binary_sensor.fynns_iphone_kiosk_screensaver` | Fynn’s iPhone Kiosk Screensaver | – | aktiv | – |
| mobile_app | `device_tracker.emilia` | Emilia | – | aktiv | – |
| mobile_app | `device_tracker.fynns_iphone` | Fynn’s iPhone | – | aktiv | – |
| mobile_app | `notify.emilia` |  | – | aktiv | – |
| mobile_app | `notify.fynns_iphone` |  | – | aktiv | – |
| mobile_app | `sensor.emilia_app_version` | Emilia App Version | – | aktiv | – |
| mobile_app | `sensor.emilia_audio_output` | Emilia Audio Output | – | aktiv | – |
| mobile_app | `sensor.emilia_battery_level` | Emilia Battery Level | – | aktiv | – |
| mobile_app | `sensor.emilia_battery_state` | Emilia Battery State | – | aktiv | – |
| mobile_app | `sensor.emilia_bssid` | Emilia BSSID | – | aktiv | – |
| mobile_app | `sensor.emilia_camera_stream` | Emilia Camera Stream | – | aus: integration | – |
| mobile_app | `sensor.emilia_connection_type` | Emilia Connection Type | – | aktiv | – |
| mobile_app | `sensor.emilia_geocoded_location` | Emilia Geocoded Location | – | aktiv | – |
| mobile_app | `sensor.emilia_kiosk_brightness` | Emilia Kiosk Brightness | – | aktiv | – |
| mobile_app | `sensor.emilia_kiosk_volume` | Emilia Kiosk Volume | – | aktiv | – |
| mobile_app | `sensor.emilia_last_update_trigger` | Emilia Last Update Trigger | – | aktiv | – |
| mobile_app | `sensor.emilia_location_permission` | Emilia Location permission | – | aktiv | – |
| mobile_app | `sensor.emilia_sim_1` | Emilia SIM 1 | – | aktiv | – |
| mobile_app | `sensor.emilia_sim_2` | Emilia SIM 2 | – | aktiv | – |
| mobile_app | `sensor.emilia_ssid` | Emilia SSID | – | aktiv | – |
| mobile_app | `sensor.emilia_storage` | Emilia Storage | – | aktiv | – |
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
| music_assistant | `button.fynns_macbook_air_favorite_current_song` | Favorite current song | – | aktiv | – |
| music_assistant | `button.lg_webos_tv_up77009lb_favorite_current_song` | Favorite current song | – | aktiv | – |
| music_assistant | `button.wohnzimmer_b06_favorite_current_song` | Favorite current song | – | aktiv | – |
| music_assistant | `media_player.fynns_macbook_air` |  | – | aktiv | ja |
| music_assistant | `media_player.lg_webos_tv_up77009lb` |  | – | aktiv | ja |
| music_assistant | `media_player.wohnzimmer_b06` |  | Wohnzimmer | aktiv | ja |
| person | `person.emfy` | emfy | – | aktiv | – |
| script | `script.alle_lichter_an` | Alle Lichter an | – | aktiv | ja |
| script | `script.alle_lichter_aus` | Alle Lichter aus | – | aktiv | ja |
| script | `script.anlage_aus` | Anlage aus | – | aktiv | ja |
| script | `script.kalendereintrag_erstellen` | Kalendereintrag erstellen | – | aktiv | ja |
| script | `script.musik_abspielen` | Musik abspielen | – | aktiv | ja |
| script | `script.termin_loeschen` | Termin löschen | – | aktiv | ja |
| script | `script.termin_verschieben` | Termin verschieben | – | aktiv | ja |
| script | `script.viktor_beauftragen` | Viktor beauftragen | – | aktiv | ja |
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
| wyoming | `wake_word.openwakeword` | openwakeword | – | aktiv | – |
| zha | `binary_sensor.buro_presensmelder` |  | Büro | aktiv | – |
| zha | `binary_sensor.buro_presensmelder_occupancy` | Occupancy | Büro | aktiv | – |
| zha | `binary_sensor.presensmelder_kuche` |  | Kitchen | aktiv | – |
| zha | `binary_sensor.presensmelder_kuche_occupancy` | Occupancy | Kitchen | aktiv | – |
| zha | `button.anlage_stecker_identify` | Identify | Wohnzimmer | aktiv | – |
| zha | `button.buro_presensmelder_identify` | Identify | Büro | aktiv | – |
| zha | `button.burozimmer_bodenlampe_identify` | Identify | Büro | aktiv | – |
| zha | `button.esszimmer_identify` | Identify | Esszimmer | aktiv | – |
| zha | `button.esszimmerlampe_identify` | Identify | Esszimmer | aktiv | – |
| zha | `button.esszimmerlampe_identify_2` | Identify | Esszimmer | aktiv | – |
| zha | `button.esszimmerlampe_identify_3` | Identify | Esszimmer | aktiv | – |
| zha | `button.giesssensor_hinten_ecke_wohnzimmer_identify` | Identify | Esszimmer | aktiv | – |
| zha | `button.giesssensor_kuche_identify` | Identify | Kitchen | aktiv | – |
| zha | `button.giesssensor_wohntimmer_identify` | Identify | Wohnzimmer | aktiv | – |
| zha | `button.giesssensor_wohntimmer_identify_2` | Identify | Wohnzimmer | aktiv | – |
| zha | `button.presensmelder_kuche_identify` | Identify | Kitchen | aktiv | – |
| zha | `button.stecker_kuchenlicht_identify` | Identify | – | aktiv | – |
| zha | `button.stehtlampe_wohnzimmer_identify` | Identify | Wohnzimmer | aktiv | – |
| zha | `button.tempratur_sensor_draussen_identify` | Identify | – | aktiv | – |
| zha | `button.tempratur_sensor_drinnen_identify` | Identify | – | aktiv | – |
| zha | `button.wohnzimmer_identify` | Identify | Wohnzimmer | aktiv | – |
| zha | `light.esszimmerlampe` |  | Esszimmer | aktiv | ja |
| zha | `light.esszimmerlampe_2` |  | Esszimmer | aktiv | ja |
| zha | `light.esszimmerlampe_3` |  | Esszimmer | aktiv | ja |
| zha | `number.buro_presensmelder_fading_time` | Fading time | Büro | aktiv | – |
| zha | `number.buro_presensmelder_medium_motion_detection_distance` | Medium motion detection distance | Büro | aktiv | – |
| zha | `number.buro_presensmelder_medium_motion_detection_sensitivity` | Medium motion detection sensitivity | Büro | aktiv | – |
| zha | `number.buro_presensmelder_motion_detection_distance` | Motion detection distance | Büro | aktiv | – |
| zha | `number.buro_presensmelder_motion_detection_sensitivity` | Motion detection sensitivity | Büro | aktiv | – |
| zha | `number.buro_presensmelder_small_motion_detection_distance` | Small motion detection distance | Büro | aktiv | – |
| zha | `number.buro_presensmelder_small_motion_detection_sensitivity` | Small motion detection sensitivity | Büro | aktiv | – |
| zha | `number.esszimmerlampe_power_on_level` | Power-on level | Esszimmer | aktiv | – |
| zha | `number.esszimmerlampe_power_on_level_2` | Power-on level | Esszimmer | aktiv | – |
| zha | `number.esszimmerlampe_power_on_level_3` | Power-on level | Esszimmer | aktiv | – |
| zha | `number.presensmelder_kuche_fading_time` | Fading time | Kitchen | aktiv | – |
| zha | `number.presensmelder_kuche_medium_motion_detection_distance` | Medium motion detection distance | Kitchen | aktiv | – |
| zha | `number.presensmelder_kuche_medium_motion_detection_sensitivity` | Medium motion detection sensitivity | Kitchen | aktiv | – |
| zha | `number.presensmelder_kuche_motion_detection_distance` | Motion detection distance | Kitchen | aktiv | – |
| zha | `number.presensmelder_kuche_motion_detection_sensitivity` | Motion detection sensitivity | Kitchen | aktiv | – |
| zha | `number.presensmelder_kuche_small_motion_detection_distance` | Small motion detection distance | Kitchen | aktiv | – |
| zha | `number.presensmelder_kuche_small_motion_detection_sensitivity` | Small motion detection sensitivity | Kitchen | aktiv | – |
| zha | `select.anlage_stecker_power_on_behavior` | Power-on behavior | Wohnzimmer | aktiv | – |
| zha | `select.buro_presensmelder_motion_state` | Motion state | Büro | aktiv | – |
| zha | `select.burozimmer_bodenlampe_power_on_behavior` | Power-on behavior | Büro | aktiv | – |
| zha | `select.esszimmer_power_on_behavior` | Power-on behavior | Esszimmer | aktiv | – |
| zha | `select.esszimmerlampe_power_on_behavior` | Power-on behavior | Esszimmer | aktiv | – |
| zha | `select.esszimmerlampe_power_on_behavior_2` | Power-on behavior | Esszimmer | aktiv | – |
| zha | `select.esszimmerlampe_power_on_behavior_3` | Power-on behavior | Esszimmer | aktiv | – |
| zha | `select.presensmelder_kuche_motion_state` | Motion state | Kitchen | aktiv | – |
| zha | `select.stecker_kuchenlicht_power_on_behavior` | Power-on behavior | – | aktiv | – |
| zha | `select.stehtlampe_wohnzimmer_power_on_behavior` | Power-on behavior | Wohnzimmer | aktiv | – |
| zha | `sensor.anlage_stecker_current` | Current | Wohnzimmer | aktiv | – |
| zha | `sensor.anlage_stecker_lqi` | LQI | Wohnzimmer | aus: integration | – |
| zha | `sensor.anlage_stecker_power` | Power | Wohnzimmer | aktiv | – |
| zha | `sensor.anlage_stecker_rssi` | RSSI | Wohnzimmer | aus: integration | – |
| zha | `sensor.anlage_stecker_summation_delivered` | Summation delivered | Wohnzimmer | aktiv | – |
| zha | `sensor.anlage_stecker_voltage` | Voltage | Wohnzimmer | aktiv | – |
| zha | `sensor.buro_presensmelder_illuminance` | Illuminance | Büro | aktiv | – |
| zha | `sensor.buro_presensmelder_lqi` | LQI | Büro | aus: integration | – |
| zha | `sensor.buro_presensmelder_rssi` | RSSI | Büro | aus: integration | – |
| zha | `sensor.burozimmer_bodenlampe_current` | Current | Büro | aktiv | – |
| zha | `sensor.burozimmer_bodenlampe_lqi` | LQI | Büro | aus: integration | – |
| zha | `sensor.burozimmer_bodenlampe_power` | Power | Büro | aktiv | – |
| zha | `sensor.burozimmer_bodenlampe_rssi` | RSSI | Büro | aus: integration | – |
| zha | `sensor.burozimmer_bodenlampe_summation_delivered` | Summation delivered | Büro | aktiv | – |
| zha | `sensor.burozimmer_bodenlampe_voltage` | Voltage | Büro | aktiv | – |
| zha | `sensor.esszimmer_battery` | Battery | Esszimmer | aktiv | – |
| zha | `sensor.esszimmer_lqi` | LQI | Esszimmer | aktiv | – |
| zha | `sensor.esszimmer_rssi` | RSSI | Esszimmer | aktiv | – |
| zha | `sensor.esszimmerlampe_lqi` | LQI | Esszimmer | aus: integration | – |
| zha | `sensor.esszimmerlampe_lqi_2` | LQI | Esszimmer | aus: integration | – |
| zha | `sensor.esszimmerlampe_lqi_3` | LQI | Esszimmer | aus: integration | – |
| zha | `sensor.esszimmerlampe_rssi` | RSSI | Esszimmer | aus: integration | – |
| zha | `sensor.esszimmerlampe_rssi_2` | RSSI | Esszimmer | aus: integration | – |
| zha | `sensor.esszimmerlampe_rssi_3` | RSSI | Esszimmer | aus: integration | – |
| zha | `sensor.giesssensor_hinten_ecke_wohnzimmer_battery` | Battery | Esszimmer | aktiv | – |
| zha | `sensor.giesssensor_hinten_ecke_wohnzimmer_humidity` | Humidity | Esszimmer | aktiv | ja |
| zha | `sensor.giesssensor_hinten_ecke_wohnzimmer_lqi` | LQI | Esszimmer | aus: integration | – |
| zha | `sensor.giesssensor_hinten_ecke_wohnzimmer_rssi` | RSSI | Esszimmer | aus: integration | – |
| zha | `sensor.giesssensor_hinten_ecke_wohnzimmer_temperature` | Temperature | Esszimmer | aktiv | ja |
| zha | `sensor.giesssensor_kuche_battery` | Battery | Kitchen | aktiv | – |
| zha | `sensor.giesssensor_kuche_humidity` | Humidity | Kitchen | aktiv | ja |
| zha | `sensor.giesssensor_kuche_lqi` | LQI | Kitchen | aus: integration | – |
| zha | `sensor.giesssensor_kuche_rssi` | RSSI | Kitchen | aus: integration | – |
| zha | `sensor.giesssensor_kuche_temperature` | Temperature | Kitchen | aktiv | ja |
| zha | `sensor.giesssensor_wohntimmer_battery` | Battery | Wohnzimmer | aktiv | – |
| zha | `sensor.giesssensor_wohntimmer_battery_2` | Battery | Wohnzimmer | aktiv | – |
| zha | `sensor.giesssensor_wohntimmer_humidity` | Humidity | Wohnzimmer | aktiv | ja |
| zha | `sensor.giesssensor_wohntimmer_humidity_2` | Humidity | Wohnzimmer | aktiv | ja |
| zha | `sensor.giesssensor_wohntimmer_lqi` | LQI | Wohnzimmer | aus: integration | – |
| zha | `sensor.giesssensor_wohntimmer_lqi_2` | LQI | Wohnzimmer | aus: integration | – |
| zha | `sensor.giesssensor_wohntimmer_rssi` | RSSI | Wohnzimmer | aus: integration | – |
| zha | `sensor.giesssensor_wohntimmer_rssi_2` | RSSI | Wohnzimmer | aus: integration | – |
| zha | `sensor.giesssensor_wohntimmer_temperature` | Temperature | Wohnzimmer | aktiv | ja |
| zha | `sensor.giesssensor_wohntimmer_temperature_2` | Temperature | Wohnzimmer | aktiv | ja |
| zha | `sensor.presensmelder_kuche_illuminance` | Illuminance | Kitchen | aktiv | – |
| zha | `sensor.presensmelder_kuche_lqi` | LQI | Kitchen | aus: integration | – |
| zha | `sensor.presensmelder_kuche_rssi` | RSSI | Kitchen | aus: integration | – |
| zha | `sensor.stecker_kuchenlicht_current` | Current | – | aktiv | – |
| zha | `sensor.stecker_kuchenlicht_lqi` | LQI | – | aus: integration | – |
| zha | `sensor.stecker_kuchenlicht_power` | Power | – | aktiv | – |
| zha | `sensor.stecker_kuchenlicht_rssi` | RSSI | – | aus: integration | – |
| zha | `sensor.stecker_kuchenlicht_summation_delivered` | Summation delivered | – | aktiv | – |
| zha | `sensor.stecker_kuchenlicht_voltage` | Voltage | – | aktiv | – |
| zha | `sensor.stehtlampe_wohnzimmer_current` | Current | Wohnzimmer | aktiv | – |
| zha | `sensor.stehtlampe_wohnzimmer_lqi` | LQI | Wohnzimmer | aus: integration | – |
| zha | `sensor.stehtlampe_wohnzimmer_power` | Power | Wohnzimmer | aktiv | – |
| zha | `sensor.stehtlampe_wohnzimmer_rssi` | RSSI | Wohnzimmer | aus: integration | – |
| zha | `sensor.stehtlampe_wohnzimmer_summation_delivered` | Summation delivered | Wohnzimmer | aktiv | – |
| zha | `sensor.stehtlampe_wohnzimmer_voltage` | Voltage | Wohnzimmer | aktiv | – |
| zha | `sensor.tempratur_sensor_draussen_battery` | Battery | – | aktiv | – |
| zha | `sensor.tempratur_sensor_draussen_humidity` | Humidity | – | aktiv | ja |
| zha | `sensor.tempratur_sensor_draussen_lqi` | LQI | – | aus: integration | – |
| zha | `sensor.tempratur_sensor_draussen_rssi` | RSSI | – | aus: integration | – |
| zha | `sensor.tempratur_sensor_draussen_temperature` | Temperature | – | aktiv | ja |
| zha | `sensor.tempratur_sensor_drinnen_battery` | Battery | – | aktiv | – |
| zha | `sensor.tempratur_sensor_drinnen_humidity` | Humidity | – | aktiv | ja |
| zha | `sensor.tempratur_sensor_drinnen_lqi` | LQI | – | aus: integration | – |
| zha | `sensor.tempratur_sensor_drinnen_rssi` | RSSI | – | aus: integration | – |
| zha | `sensor.tempratur_sensor_drinnen_temperature` | Temperature | – | aktiv | ja |
| zha | `sensor.wohnzimmer_battery` | Battery | Wohnzimmer | aktiv | – |
| zha | `sensor.wohnzimmer_lqi` | LQI | Wohnzimmer | aus: integration | – |
| zha | `sensor.wohnzimmer_rssi` | RSSI | Wohnzimmer | aus: integration | – |
| zha | `switch.anlage_stecker` |  | Wohnzimmer | aktiv | ja |
| zha | `switch.buro_presensmelder_led_indicator` | LED indicator | Büro | aktiv | ja |
| zha | `switch.burozimmer_bodenlampe` |  | Büro | aktiv | ja |
| zha | `switch.esszimmer` |  | Esszimmer | aktiv | ja |
| zha | `switch.presensmelder_kuche_led_indicator` | LED indicator | Kitchen | aktiv | ja |
| zha | `switch.stecker_kuchenlicht` |  | – | aktiv | ja |
| zha | `switch.stehtlampe_wohnzimmer` |  | Wohnzimmer | aktiv | ja |
| zha | `switch.wohnzimmer` |  | Wohnzimmer | aktiv | ja |
| zha | `update.anlage_stecker_firmware` | Firmware | Wohnzimmer | aktiv | – |
| zha | `update.buro_presensmelder_firmware` | Firmware | Büro | aktiv | – |
| zha | `update.burozimmer_bodenlampe_firmware` | Firmware | Büro | aktiv | – |
| zha | `update.esszimmer_firmware` | Firmware | Esszimmer | aktiv | – |
| zha | `update.esszimmerlampe_firmware` | Firmware | Esszimmer | aktiv | – |
| zha | `update.esszimmerlampe_firmware_2` | Firmware | Esszimmer | aktiv | – |
| zha | `update.esszimmerlampe_firmware_3` | Firmware | Esszimmer | aktiv | – |
| zha | `update.presensmelder_kuche_firmware` | Firmware | Kitchen | aktiv | – |
| zha | `update.stecker_kuchenlicht_firmware` | Firmware | – | aktiv | – |
| zha | `update.stehtlampe_wohnzimmer_firmware` | Firmware | Wohnzimmer | aktiv | – |
| zha | `update.tempratur_sensor_draussen_firmware` | Firmware | – | aktiv | – |
| zha | `update.tempratur_sensor_drinnen_firmware` | Firmware | – | aktiv | – |
| zha | `update.wohnzimmer_firmware` | Firmware | Wohnzimmer | aktiv | – |

### YAML-Konfiguration (Kopien, Geheimnisse maskiert)

- [`ist-stand/configuration.yaml`](ist-stand/configuration.yaml) (38 Zeilen)
- [`ist-stand/automations.yaml`](ist-stand/automations.yaml) (174 Zeilen)
- [`ist-stand/scripts.yaml`](ist-stand/scripts.yaml) (309 Zeilen)
- [`ist-stand/scenes.yaml`](ist-stand/scenes.yaml) (0 Zeilen)

### Skripte

| script.* | Alias |
|---|---|
| `script.kalendereintrag_erstellen` | Kalendereintrag erstellen |
| `script.termin_loeschen` | Termin löschen |
| `script.termin_verschieben` | Termin verschieben |
| `script.musik_abspielen` | Musik abspielen |
| `script.viktor_beauftragen` | Viktor beauftragen |
| `script.alle_lichter_aus` | Alle Lichter aus |
| `script.alle_lichter_an` | Alle Lichter an |
| `script.anlage_aus` | Anlage aus |

### Automationen

- 'Kalender live: iCloud abgleichen + Dashboard benachrichtigen'
- 'Präsenz Küche: Licht an/aus'
- 'Präsenz Büro: Bodenlampe an/aus'
- 'Anlage: bei Musik automatisch an'
- 'Wakeup-Song abspielen'

### Repo ↔ Pi

- `assistant/homeassistant/scripts.yaml` ↔ live: identisch ✅
- `assistant/homeassistant/claude_prompt.txt` ↔ live: identisch ✅
- `deploy/nginx.conf` ↔ live: identisch ✅

### Letzte Warnungen/Fehler im HA-Log

```
2026-09-08 20:06:37.165 WARNING (SyncWorker_0) [homeassistant.loader] We found a custom integration edge_tts which has not been tested by Home Assistant. This component might cause stability problems, be sure to disable it if you experience issues with Home Assistant
2026-09-08 20:06:41.569 ERROR (MainThread) [habluetooth.scanner] hci0 (D8:3A:DD:87:BD:3B): Failed to force stop scanner
2026-09-08 20:07:12.968 ERROR (MainThread) [homeassistant.components.home_connect.coordinator] Error fetching 01KZZKFPJD9HRGDEK4GD1T2JVH-386060532692004457-001 data: Appliance Oven (386060532692004457-001) is disconnected
2026-09-08 20:07:18.261 WARNING (SyncWorker_12) [urllib3.connectionpool] Connection pool is full, discarding connection: p168-caldav.icloud.com. Connection pool size: 10
2026-09-08 20:07:18.279 WARNING (SyncWorker_13) [urllib3.connectionpool] Connection pool is full, discarding connection: p168-caldav.icloud.com. Connection pool size: 10
2026-09-08 20:07:18.291 WARNING (SyncWorker_14) [urllib3.connectionpool] Connection pool is full, discarding connection: p168-caldav.icloud.com. Connection pool size: 10
2026-09-08 20:07:32.132 ERROR (MainThread) [habluetooth.scanner] hci0 (D8:3A:DD:87:BD:3B): Failed to force stop scanner
2026-09-08 20:07:32.145 ERROR (MainThread) [habluetooth.scanner] hci0 (D8:3A:DD:87:BD:3B): Failed to force stop scanner
2026-09-08 20:07:37.631 ERROR (MainThread) [habluetooth.scanner] hci0 (D8:3A:DD:87:BD:3B): Failed to force stop scanner
2026-09-08 20:07:42.443 ERROR (MainThread) [habluetooth.scanner] hci0 (D8:3A:DD:87:BD:3B): Failed to force stop scanner
2026-09-08 20:07:58.162 ERROR (MainThread) [habluetooth.scanner] hci0 (D8:3A:DD:87:BD:3B): Failed to force stop scanner
2026-09-08 20:08:22.901 ERROR (MainThread) [habluetooth.scanner] hci0 (D8:3A:DD:87:BD:3B): Failed to force stop scanner
```

## Sprachassistent

| Was | Wert |
|---|---|
| openwakeword custom models | hey_haus.tflite hey_haus.tflite.v4-bak-2026-09-08 |
| whisper-Modelle (Fallback) | – |
| groq_stt letzte Aufnahme | – |
| TTS-Cache | 78 Dateien |

## Offene Ports (Host)

```
*:18555  go2rtc
0.0.0.0:22  sshd
0.0.0.0:5580  matter-server
0.0.0.0:8080  docker-proxy
0.0.0.0:8123  python3
0.0.0.0:8443  docker-proxy
100.109.2.10:35581  tailscaled
127.0.0.1:10301  docker-proxy
127.0.0.1:10400  docker-proxy
127.0.0.1:10500  docker-proxy
127.0.0.1:18554  go2rtc
172.17.0.1:10460  docker-proxy
[::]:22  sshd
[::]:5580  matter-server
[::]:8080  docker-proxy
[::]:8123  python3
[::]:8443  docker-proxy
[fd7a:115c:a1e0::9332:20c]:50757  tailscaled
```
