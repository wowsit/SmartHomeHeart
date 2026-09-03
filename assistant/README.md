# Sprachassistent „Haus“ (Home Assistant Assist + Claude)

Stand: 2026-09-03. Läuft auf dem Pi (`homehole`) neben dem Home-Assistant-Container.

## Architektur

```
Mikro (HA-App / später Pi-Satellit mit „Hey Haus“)
   │ Audio
   ▼
HA Assist-Pipeline „Haus (Claude)“ (Sprache: de)
   ├─ STT:  stt.groq_whisper  ── Wyoming ──▶ groq_stt-Container ──▶ Groq API (whisper-large-v3-turbo)
   ├─ Agent: conversation.claude_conversation (Anthropic-Integration, Prompt: claude_prompt.txt)
   │        Werkzeuge = freigegebene Entitäten + Skripte:
   │          script.kalendereintrag_erstellen  → calendar.create_event
   │          script.termin_loeschen            → rest_command.calhelper_delete → calhelper /delete
   │          script.termin_verschieben         → rest_command.calhelper_move   → calhelper /move
   └─ TTS:  tts.google_translate_en_com (de)
```

Freigegebene Entitäten: `calendar.hjem` (privat), `calendar.arbeid` (Arbeit), `weather.forecast_home` und die drei Skripte.

## Bausteine

| Ordner | Was | Port (nur localhost) |
|---|---|---|
| `calhelper/` | Mini-HTTP-Dienst (Python + `caldav`): `/find`, `/delete`, `/move` gegen iCloud CalDAV. Nötig, weil HAs CalDAV-Integration nur Termine anlegen kann. Fuzzy-Titelsuche, fasst Serientermine nicht an. | 10400 |
| `groq_stt/` | Wyoming-STT-Server, der das Audio als WAV an Groq schickt. Mit `DEBUG_SAVE=1` (so läuft er auf dem Pi) bleibt die letzte Aufnahme unter `/tmp/last.wav` im Container (`docker cp groq_stt:/tmp/last.wav .`). Ersetzt das lokale `tiny`-Whisper (Pi 4 mit 2 GB schafft nichts Besseres). Setzt einen eigenen User-Agent, sonst blockt Cloudflare (403 / error 1010). | 10301 |
| `homeassistant/` | `scripts.yaml` (die drei Claude-Werkzeuge), `rest_command.yaml` (für configuration.yaml), `claude_prompt.txt` (System-Prompt der Anthropic-Integration). | – |

Der alte Container `whisper` (`rhasspy/wyoming-whisper`, tiny-int8, Port 10300) ist gestoppt (Exit 137 = OOM) und dient nur noch als Fallback; zusätzlich läuft `openwakeword` (`rhasspy/wyoming-openwakeword`, 127.0.0.1:10500, eigene Modelle in `~/openwakeword/custom`) und kann gestoppt werden, sobald Groq sich bewährt hat (spart ~500 MB RAM).

## Aufsetzen (neu / nach Pi-Neuinstallation)

1. `assistant/calhelper/.env` und `assistant/groq_stt/.env` aus den `.env.example` anlegen (iCloud-App-Passwort, Groq-Key). **Niemals ins Repo.**
2. `cd assistant && docker compose up -d --build`
3. HA → Einstellungen → Geräte & Dienste → **Wyoming Protocol** hinzufügen: Host `127.0.0.1`, Port `10301` → `stt.groq_whisper`.
4. **Anthropic**-Integration hinzufügen (API-Key), im Unterpunkt „Konversation“ den Prompt aus `claude_prompt.txt` einsetzen und „Assist“ als Steuerung aktivieren.
5. `homeassistant/rest_command.yaml` in `configuration.yaml` einfügen → HA neu starten. Skripte aus `scripts.yaml` anlegen.
6. Einstellungen → Sprachassistenten → Pipeline „Haus (Claude)“: Sprache de, Konversationsagent Claude, STT groq-whisper, TTS Google Translate (de), als bevorzugt setzen. Unter „Freigeben“ die Kalender, das Wetter und die drei Skripte freigeben.

## Verhalten (aus dem Prompt)

- Antwortet kurz auf Deutsch, wie gesprochen (kein Markdown).
- Eingabe kommt aus Whisper und kann Fehler enthalten → plausibel interpretieren, stillschweigend korrigieren, **direkt ausführen ohne Rückfrage**, in der Antwort die korrigierten Details nennen. Nachfragen nur im Ausnahmefall.
- Jinja-Datumstabelle im Prompt (heute, morgen, Wochentage → YYYY-MM-DD), weil das Modell Wochentage sonst falsch berechnet.

## Offen / nächste Schritte

- Pi-Satellit mit Wake Word „Hey Haus“: USB-Konferenzlautsprecher mit Echo-Cancelling (z. B. Anker PowerConf S330, Jabra Speak 410) + openWakeWord (eigenes Modell) + Piper-TTS + wyoming-satellite.
- Assistent-Button / Chat im Dashboard (HA WS `assist_pipeline/run`).
- Feste IP für den Pi in der Fritz!Box (aktuell DHCP `192.168.178.151`).
