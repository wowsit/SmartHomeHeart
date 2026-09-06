# Viktor neu einbinden – Checkliste (günstig)

Stand: 2026-09-05. Diese Liste gilt, wenn Viktor in einem **neuen Workspace** (oder nach Verlust seiner Notizen)
SmartHomeHeart übernehmen soll. Der erste Setup am 5.9.2026 hat ~1.550 Credits gekostet, weil Viktor ohne Vorwissen
Repo, alle PRs, Doku und Pi erkunden musste. Mit dieser Liste sind **~400–600 Credits** realistisch.

Keine Secrets in dieser Datei – die stehen in der passwortgeschützten PDF „SmartHomeHeart-Zugaenge“ (Abschnitt 7 dort ist
identisch mit dieser Liste, plus Werte).

## Teil A – Was Fynn vorbereitet (5 Minuten)

1. **Workspace nicht wechseln, wenn es nicht nötig ist.** Der günstigste Setup ist keiner: Viktors Notizen (Skills)
   bleiben im Workspace erhalten, jeder weitere Auftrag startet mit Vorwissen.
2. GitHub-Integration verbinden (Repo `wowsit/SmartHomeHeart`).
3. **Eine** DM an Viktor mit allem zusammen:
   - PDF „SmartHomeHeart-Zugaenge“ als Anhang + Passwort im selben Text
   - Wortlaut: *„Setup SmartHomeHeart exakt nach `docs/VIKTOR-SETUP.md` Teil B, Schritte 1–6. Keine Analyse offener Punkte,
     keine PR-Historie lesen, kein Test-Sprachauftrag mit Umsetzung. Am Ende nur kurz melden.“*
4. Nach Viktors Rückmeldung: Setup-URL des neuen Webhooks öffnen → *Reveal* → Token per DM schicken (Schritt B5).

## Teil B – Was Viktor macht (in dieser Reihenfolge, nichts anderes)

| # | Schritt | Wie | Ziel-Check |
|---|---------|-----|-----------|
| 1 | PDF entschlüsseln | `pymupdf` → `authenticate(pw)`; verschlüsselte Kopie außerhalb des Repos ablegen, Klartext nie speichern | Werte lesbar |
| 2 | Repo klonen | `coworker_git` clone; **nur** lesen: `README.md`, `docs/VIKTOR-SETUP.md`, `docs/AUFBAU.md` Kap. Deploy + Fallen (Kap. 12–14). Nicht: PR-Liste, IST-STAND, Issues | Clone da |
| 3 | Tailnet beitreten | Tailscale static binary (1.86.x) laden, `tailscaled --tun=userspace-networking --state=… --socket=…`, `tailscale up --authkey=<PDF> --hostname=viktor-ai`; Test `tailscale ssh wowsit@homehole hostname` | Antwort `HomeHole` |
| 4 | Webhook anlegen | `create_webhook_trigger(path="/smarthomeheart/sprachauftrag", allow_unsigned=True)` + `subscribe_agent(path="/smarthomeheart/sprachauftrag/umsetzen", prompt=<siehe unten>, max_per_day=40)`; Inbound-URL per `sudo sed` in Pi `~/homeassistant/secrets.yaml` → `viktor_webhook_url` | Trigger existiert, URL im Pi |
| 5 | Token setzen | Setup-URL an Fynn → Token kommt per DM → `viktor_webhook_token` in `secrets.yaml`; HA: `POST /api/services/rest_command/reload`; Test vom Pi: `curl -X POST -H "X-Viktor-Token: …" -d '{"auftrag":"Verbindungstest, nichts tun","quelle":"test-dry"}' <url>` | HTTP 202 |
| 6 | Notizen anlegen | Skill `smarthomeheart` (Pi-Zugang, Deploy, Fallen, Webhook), Nutzer-Skill, `tailnet_up.sh` + `pi.sh` Helfer | Skill vorhanden |

Danach **stoppen** und melden. Alles Weitere (PR-Review, offene Punkte, Updates) sind eigene, separat beauftragte Läufe.

### Was den ersten Setup teuer gemacht hat (vermeiden)
- Alle 21 PRs + kompletten Verlauf lesen statt zwei Doku-Dateien.
- Pi-Zustand komplett inventarisieren (alle Container, RAM, Disk, dist-Backups) statt `docker ps`.
- Mehrere Zwischenberichte statt einer Endmeldung.
- Test-Sprachauftrag, der einen echten Agentenlauf startet (~200 Credits) – `curl` mit HTTP 202 reicht.

### Prompt für die Agent-Subscription (Schritt 4)
> Du bist Viktor, der KI-Entwickler für SmartHomeHeart (wowsit, Slack U0BV6SLAHCN). Ein Sprachauftrag aus Home Assistant
> Assist liegt im Payload-Feld `auftrag` (Freitext aus Spracherkennung, Hörfehler plausibel korrigieren). Lies zuerst
> `skills/smarthomeheart/SKILL.md` und `skills/codebase_engineering/SKILL.md`. Setze den Auftrag um (Branch + PR, ggf.
> Deploy auf den Pi und Ergebnis prüfen). Unklar oder gefährlich → per DM nachfragen und stoppen. Am Ende kurze DM an
> U0BV6SLAHCN (Deutsch): verstanden, gemacht, PR-Link, deployt?, offen. Keine Secrets in Slack/Repo/Skills.

## Teil C – Laufende Kosten klein halten
- Ein Thema pro Nachricht, konkret formuliert („Wetterkachel 20 % größer“).
- „Nur analysieren, nicht umsetzen“ sagen, wenn erst eine Einschätzung gewünscht ist.
- Sprachaufträge sparsam: jeder startet einen Agentenlauf. Tageslimit steht auf 40, kann gesenkt werden.
- Pi-Zugang läuft über Tailscale-SSH ohne Key; der Auth-Key in der PDF ist wiederverwendbar (bei „key expired“ neuen unter
  login.tailscale.com → Settings → Keys erzeugen: reusable, ohne Ablauf-Verkürzung, und PDF aktualisieren).
