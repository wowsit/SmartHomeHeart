# Sprachassistent „Haus“ – Regeln & Workflow für schnelle, kurze Antworten

Stand: 2026-09-03. Ausgangsproblem: Antworten kamen spät, waren zu lang, die Sprachausgabe war langsam
und ließ sich nicht unterbrechen. Dieses Dokument hält fest, **woran das lag**, **was geändert wurde**
und **welche Regeln ab jetzt gelten**. Der jeweils aktive Zustand steht immer in `IST-STAND.md`.

## 1. Wo die Zeit verloren ging (Messung/Analyse)

Eine Anfrage läuft durch fünf Stufen; jede kostet Zeit:

| Stufe | Vorher | Problem | Nachher |
|---|---|---|---|
| Aufnahme (Handy-App) | VAD der App | Whisper halluziniert bei Stille/Rauschen („Amen.“, „Untertitelung des ZDF“, Wortschleifen) → Claude reagiert auf Müll | `groq_stt` filtert Halluzinationen (verbose_json: compression_ratio, avg_logprob, Wortschleifen, Floskel-Liste) → leeres Transkript, HA sagt kurz „nichts verstanden“ |
| STT (Groq whisper-large-v3-turbo) | ~0,5–1 s | ok | Vokabular-Prompt (Zahnarzt, Hjem, Arbeid, Einkaufsliste …) als Default in `groq_stt.py` |
| Agent (Claude via Anthropic-Integration) | „Empfohlene Einstellungen“ = **Extended Thinking mit 1024 Token Budget**, `max_tokens 3000` | Denkphase vor jeder Antwort = 1–3 s zusätzlich; kein hartes Längenlimit | `recommended: false`, `claude-haiku-4-5`, **thinking_budget 0**, `max_tokens 250`, Prompt-Caching an |
| Prompt | „kurz und natürlich“ | zu weich, Claude erklärt, fragt nach, listet auf | Harte Regeln: max. 1 Satz / 15 Wörter, „Ok.“ bei Gerätesteuerung, max. 3 Kalendereinträge, Rückfrage max. 5 Wörter |
| Lokale Intents | aus | jedes „Ofen aus“/„Milch auf die Liste“ ging durch das LLM | Pipeline `prefer_local_intents: true` → HA-eigene Intents (Ein/Aus, Listen, Wetter, Timer) antworten in < 0,5 s ohne LLM, Rest geht an Claude |
| TTS | Google Translate | nicht streamingfähig (Antwort muss komplett fertig sein), Sprechtempo nicht einstellbar, blechern | Piper (lokal, Wyoming) mit `length_scale` < 1 = schneller sprechen; **Streaming**: HA gibt Satz für Satz aus, sobald Claude ihn liefert |

Gemessen nach der Umstellung über die komplette Pipeline (Text rein, TTS raus, 2026-09-03 18:05):

| Anfrage | Weg | Zeit bis Antwort | Antwort |
|---|---|---|---|
| „Setz Milch auf die Einkaufsliste“ | lokaler HA-Intent, kein LLM | **0,5 s** | „Milch hinzugefügt“ |
| „Wie wird das Wetter morgen?“ | Claude + Wetter-Tool | 4,1 s | „Morgen teilweise bewölkt, 20 Grad.“ |
| „Nimm Milch von der Einkaufsliste“ | Claude + Tool | 2,4 s | „Milch von der Einkaufsliste genommen.“ |

Piper-TTS (thorsten-medium, Pi 4): 0,8–1,3 s pro Satz warm, erster Aufruf nach Start ~8 s (Modell laden).

### TTS-Stimme: Microsoft Edge TTS (seit 2026-09-03 18:25)

Wunsch: weibliche, natürliche Stimme, etwas schneller. Piper hat auf Deutsch nur „low“-Frauenstimmen (kerstin, ramona, eva_k – blechern).
Deshalb Custom-Integration [hasscc/hass-edge-tts](https://github.com/hasscc/hass-edge-tts) (kostenlos, kein Key, streamt Satz für Satz):

| Stimme | Charakter | Latenz pro Satz (vom Pi gemessen) |
|---|---|---|
| **`de-DE-SeraphinaMultilingualNeural`** (aktiv) | warm, natürlich, „Werbestimme“ | 1,6–2,9 s |
| `de-DE-KatjaNeural` | klar, neutral | 0,6–2,0 s (schneller) |
| `de-DE-AmalaNeural` | jung, freundlich | ~2 s |
| Piper `de_DE-thorsten-medium` (Fallback, lokal) | männlich | 0,9–1,4 s |

Sprechtempo: `rate: "+12%"`. Einstellung liegt in den Optionen des Config-Eintrags `edge_tts` (`voice`, `rate`, `language`).
Die UI-Optionsmaske kennt nur `language` – `voice`/`rate` deshalb per Storage-Edit (HA stoppen, `.storage/core.config_entries`
→ Eintrag `edge_tts` → `options`, HA starten) oder per Pipeline-Sprache (Pipeline-`tts_language` = Voice-Name).
Pipeline „Haus (Claude)“: `tts_engine: tts.edge_tts_service_edge_tts`, `tts_language: de-DE-SeraphinaMultilingualNeural`.

Installation: `custom_components/edge_tts` (Release v0.7.7) nach `~/homeassistant/custom_components/`, HA neu starten,
Integration „Microsoft Edge TTS“ hinzufügen (`POST /api/config/config_entries/flow {"handler":"edge_tts"}` legt den Eintrag ohne Formular an).
Risiko: inoffizielle Nutzung des Edge-Browser-Dienstes – fällt sie aus, Pipeline auf `tts.piper` zurückstellen (Container läuft weiter).
Google Translate war mit 0,7 s zwar ähnlich schnell, kann aber weder streamen noch schneller sprechen.

Frühere Messung, Text direkt an `conversation.claude_conversation` (ohne STT/TTS):
„Wie wird das Wetter morgen?“ → „Morgen bewölkt, 21 Grad.“ in 2,8 s; „Setz Milch auf die Einkaufsliste“ → 2,3 s;
Kalenderabfrage 4,3 s (Tool-Aufruf + Antwort). Vorher lagen allein Thinking + lange Antwort darüber.

## 2. Unterbrechen („hört bei neuer Angabe nicht auf zu reden“)

- **Handy-App (iOS/Android):** Es gibt kein Barge-in. Die App spielt die TTS-Antwort komplett ab; tippt man den
  Mikrofon-Button, startet eine neue Aufnahme, aber die laufende Ausgabe wird nicht abgebrochen. Einziger Hebel:
  Antworten so kurz halten, dass es nicht stört (→ Prompt-Regeln + max_tokens).
- **Echte Satelliten** (Home Assistant Voice Preview Edition, ESP32-S3-Box, wyoming-satellite auf einem Pi):
  Wake-Word während der Antwort **stoppt die Ausgabe** sofort und nimmt den neuen Befehl an; zusätzlich gibt es
  ein „Stopp“-Wort. Für die Familie im Raum ist das der eigentliche Weg zu „unterbrechbar“.
- **Folgefragen ohne Wake-Word:** Der Agent kann `continue_conversation` setzen (HA ≥ 2025.4); Satelliten öffnen
  dann das Mikro sofort wieder. Claude tut das automatisch, wenn er eine Rückfrage stellt.

## 3. Regeln (gelten für Prompt, Konfiguration und künftige Änderungen)

1. **Antwortlänge ist Konfiguration, nicht Hoffnung**: `max_tokens ≤ 250` in der Anthropic-Integration + explizites
   Wortlimit im Prompt. Nie wieder „empfohlene Einstellungen“ aktivieren (schaltet Thinking wieder ein).
2. **Kein Extended Thinking für Sprache** (`thinking_budget: 0`). Für die Smart-Home-Befehle bringt es nichts, kostet
   aber jedes Mal Sekunden. Wenn ein Modellwechsel ansteht: Haiku-Klasse bleibt Pflicht, kein Sonnet/Opus für Voice.
3. **Lokal vor LLM**: `prefer_local_intents` bleibt an. Gerätenamen und Aliase so pflegen, dass HA-Intents sie
   treffen („Ofen“, „Einkaufsliste“). Was lokal geht, geht nie durch Claude.
4. **Nur das freigeben, was gesprochen werden soll**: aktuell 11 Entitäten (Kalender, Einkaufsliste, Erinnerungen,
   Ofen, Wetter, drei Skripte). Jede weitere Freigabe vergrößert den Prompt-Kontext → langsamer. Sensoren, die
   niemand per Sprache abfragt, nicht freigeben.
5. **Prompt-Änderungen immer in `assistant/homeassistant/claude_prompt.txt`** committen und dann in HA einsetzen –
   nie nur in HA klicken. Der Drift-Check in `IST-STAND.md` zeigt Abweichungen.
6. **STT nicht blind vertrauen**: Halluzinationsfilter in `groq_stt.py` bleibt an; neue Floskeln, die in
   `docker logs groq_stt` auftauchen, in `HALLUCINATIONS` ergänzen. Neue Fachwörter in `STT_PROMPT` (`.env`) ergänzen.
7. **TTS muss streamen können**: Edge TTS (aktiv) oder Piper (lokal, Fallback). Google Translate nur als Notnagel.
   Sprechtempo über `length_scale` (0,85–0,9), nicht über den Text.
8. **Jede Änderung messen**: `curl -X POST …/api/conversation/process` mit 3–4 Standardfragen (Wetter, Kalender,
   Liste, Gerät) und Zeit stoppen; Ziel < 3 s bis zum ersten gesprochenen Wort. Ergebnis in `IST-STAND.md` landet
   automatisch über den Export.

## 4. Workflow bei Änderungen am Assistenten

```
1. Prompt / groq_stt.py / Pipeline im Repo ändern
2. groq_stt neu bauen:  scp groq_stt.py homehole:~/groq_stt/ && ssh homehole 'cd ~/groq_stt && docker build -t groq_stt . && docker rm -f groq_stt && sudo docker run -d --name groq_stt --restart unless-stopped -p 127.0.0.1:10301:10301 --env-file ~/groq_stt/.env groq_stt'
3. Prompt/Modell: HA → Einstellungen → Geräte & Dienste → Anthropic → „Claude conversation“ → Konfigurieren
   (oder per API-Reconfigure-Flow, siehe deploy/ha-anthropic-options.md) – kein HA-Neustart nötig
4. Pipeline: HA → Sprachassistenten → „Haus (Claude)“ (Local-Intents, TTS, Tempo)
5. Messen (Abschnitt 3.8), dann deploy/export-state.sh → IST-STAND.md → commit + push
```

## 5. Nächste Stufen (noch nicht umgesetzt)

- **Satellit im Raum** für „Hey Jarvis“, Unterbrechen und Folgefragen: HA Voice Preview Edition (~60 €, fertig) oder
  Pi + USB-Konferenzmikro mit Echo-Cancelling + `wyoming-satellite`. Erst dann lohnt sich `openwakeword` wieder
  (läuft aktuell ohne Nutzen, ~500 MB RAM).
- **Eigene Sätze** (`custom_sentences/de/`) für die häufigsten Befehle → treffen lokal, 0 LLM-Kosten, sofortige Antwort.
- **Ofen-Alias** „Backofen“, damit „Backofen aus“ lokal trifft.
- Groq-Whisper-Alternative bei Latenzproblemen: `distil-whisper` gibt es nur für Englisch; für Deutsch bleibt
  `whisper-large-v3-turbo` die schnellste brauchbare Option.
