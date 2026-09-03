#!/usr/bin/env python3
"""Exportiert den Ist-Stand des Pi „homehole“ (Home Assistant, Container, Dashboard, Netz)
nach docs/IST-STAND.md + docs/ist-stand/ (Rohdateien). Läuft AUF DEM PI, nur Standardbibliothek.

  sudo python3 export-state.py <ausgabeordner>        # z.B. /tmp/ist-stand

Geheimnisse (Tokens, Passwörter, API-Keys, Webhook-IDs, E-Mail-Adressen) werden entfernt bzw.
maskiert. Die Datei .storage/auth* wird gar nicht gelesen. Aufruf von außen: deploy/export-state.sh
"""
from __future__ import annotations

import datetime as dt
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

HOME = Path(os.environ.get("PI_HOME", "/home/wowsit"))
HA = HOME / "homeassistant"
DASH = HOME / "dashboard"
SECRET_KEYS = re.compile(r"(password|passwd|token|secret|api_key|apikey|webhook_id|client_secret|refresh|access_token|auth|key)$", re.I)
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
JWT = re.compile(r"eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}")
LONGKEY = re.compile(r"\b(sk-[\w-]{20,}|gsk_[\w-]{20,}|tskey-[\w-]{10,})\b")


# ---------- Hilfen ----------
def sh(cmd: str, timeout: int = 60) -> str:
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return (r.stdout or r.stderr).strip()
    except Exception as e:  # noqa: BLE001
        return f"<fehler: {e}>"


def scrub_text(s: str) -> str:
    s = EMAIL.sub("<email>", s)
    s = JWT.sub("<token>", s)
    s = LONGKEY.sub("<key>", s)
    return s


def scrub(obj):
    """Rekursiv: Werte unter geheimen Schlüsseln maskieren, E-Mails/Tokens in Strings ersetzen."""
    if isinstance(obj, dict):
        return {k: ("<redacted>" if SECRET_KEYS.search(str(k)) and isinstance(v, (str, int)) else scrub(v)) for k, v in obj.items()}
    if isinstance(obj, list):
        return [scrub(v) for v in obj]
    if isinstance(obj, str):
        return scrub_text(obj)
    return obj


def read(p: Path) -> str | None:
    try:
        return p.read_text(encoding="utf-8", errors="replace")
    except Exception:  # noqa: BLE001
        return None


def storage(name: str) -> dict:
    t = read(HA / ".storage" / name)
    if not t:
        return {}
    try:
        return json.loads(t).get("data", {})
    except json.JSONDecodeError:
        return {}


def scrub_yaml(text: str) -> str:
    out = []
    for line in text.splitlines():
        m = re.match(r"^(\s*[\w.-]*?(?:password|token|secret|api_key|key)\s*:\s*)(\S.*)$", line, re.I)
        out.append(m.group(1) + "<redacted>" if m else scrub_text(line))
    return "\n".join(out) + "\n"


def table(headers: list[str], rows: list[list]) -> str:
    esc = lambda v: str(v).replace("|", "\\|").replace("\n", " ")  # noqa: E731
    lines = ["| " + " | ".join(headers) + " |", "|" + "---|" * len(headers)]
    lines += ["| " + " | ".join(esc(c) for c in r) + " |" for r in rows]
    return "\n".join(lines) if rows else "_keine_"


# ---------- Abschnitte ----------
def sec_system() -> str:
    os_name = sh(". /etc/os-release && echo \"$PRETTY_NAME\"")
    rows = [
        ["Host", sh("hostname")],
        ["OS / Kernel", f"{os_name} / {sh('uname -r')}"],
        ["Modell", sh("tr -d '\\0' < /proc/device-tree/model 2>/dev/null")],
        ["Uptime", sh("uptime -p")],
        ["RAM", sh("free -h | awk '/Mem:/{print $3\" belegt von \"$2}'")],
        ["Disk /", sh("df -h / | awk 'NR==2{print $3\" belegt von \"$2\" (\"$5\")\"}'")],
        ["Docker", sh("docker --version | sed 's/Docker version //'")],
        ["Tailscale", sh("tailscale version | head -1")],
        ["LAN-IP", sh("hostname -I | awk '{print $1}'")],
        ["Tailscale-IP / -Name", f"{sh('tailscale ip -4')} / {sh('tailscale status --json | python3 -c \"import sys,json;print(json.load(sys.stdin)[\\\"Self\\\"][\\\"DNSName\\\"].rstrip(\\\".\\\"))\"')}"],
        ["Apt-Updates ausstehend", sh("apt list --upgradable 2>/dev/null | grep -c upgradable", 120)],
        ["Home Assistant", (read(HA / ".HA_VERSION") or "?").strip()],
    ]
    return table(["Was", "Wert"], rows)


def sec_containers() -> tuple[str, list[dict]]:
    names = sh("docker ps -a --format '{{.Names}}'").split()
    rows, raw = [], []
    for n in names:
        j = sh(f"docker inspect {n}")
        try:
            d = json.loads(j)[0]
        except Exception:  # noqa: BLE001
            continue
        hc, cfg = d["HostConfig"], d["Config"]
        ports = ", ".join(f"{(b[0]['HostIp'] or '0.0.0.0')}:{b[0]['HostPort']}→{k}" for k, b in (hc.get("PortBindings") or {}).items() if b)
        envkeys = " ".join(sorted(e.split("=", 1)[0] for e in cfg.get("Env") or [] if not e.startswith(("PATH=", "LANG=", "GPG_KEY=", "PYTHON_"))))
        rows.append([n, cfg["Image"], d["State"]["Status"], hc.get("NetworkMode"), hc["RestartPolicy"]["Name"], ports or "–",
                     ", ".join(hc.get("Binds") or []) or "–", " ".join(cfg.get("Cmd") or []) or "–", envkeys or "–"])
        raw.append({"name": n, "image": cfg["Image"], "status": d["State"]["Status"], "network": hc.get("NetworkMode"),
                    "restart": hc["RestartPolicy"]["Name"], "ports": hc.get("PortBindings"), "binds": hc.get("Binds"),
                    "cmd": cfg.get("Cmd"), "env_keys": envkeys.split()})
    return table(["Container", "Image", "Status", "Netz", "Restart", "Ports (Host→Container)", "Mounts", "Cmd", "Env (nur Namen)"], rows), raw


def sec_dashboard(out: Path) -> str:
    rows = []
    ver = read(DASH / "dist" / "VERSION")
    rows.append(["Deployter Build", ver.strip() if ver else "unbekannt (kein dist/VERSION – vor 2026-09-03 deployt)"])
    idx = read(DASH / "dist" / "index.html") or ""
    assets = re.findall(r"/assets/([\w.-]+\.(?:js|css))", idx)
    rows.append(["Assets", ", ".join(assets) or "–"])
    try:
        mt = dt.datetime.fromtimestamp((DASH / "dist" / "index.html").stat().st_mtime).strftime("%Y-%m-%d %H:%M")
    except Exception:  # noqa: BLE001
        mt = "?"
    rows.append(["dist geändert", mt])
    js = " ".join(read(DASH / "dist" / "assets" / a) or "" for a in assets if a.endswith(".js"))
    rows.append(["HA-URL-Modus", "auto (location.hostname:8123 / bei https same-origin)" if "location.origin" in js else ("auto (nur http)" if "location.hostname" in js else "fest eingebrannt / unbekannt")])
    crt = DASH / "tls" / "dashboard.crt"
    if crt.exists():
        rows.append(["TLS-Zertifikat", sh(f"openssl x509 -in {crt} -noout -enddate -ext subjectAltName | tr '\\n' ' ' | sed 's/  */ /g'")])
    rows.append(["Backups", ", ".join(sorted(p.name for p in DASH.glob("dist.bak-*"))) or "–"])
    for name in ("nginx.conf",):
        t = read(DASH / name)
        if t:
            (out / name).write_text(t)
    kiosk = read(HOME / "kiosk.sh")
    rows.append(["Kiosk", "eingerichtet (~/kiosk.sh)" if kiosk else "nicht eingerichtet"])
    if kiosk:
        (out / "kiosk.sh").write_text(scrub_text(kiosk))
    return table(["Was", "Wert"], rows)


def sec_ha(out: Path) -> str:
    parts = []
    # Integrationen
    entries = storage("core.config_entries").get("entries", [])
    rows = [[e["domain"], scrub_text(str(e.get("title", ""))), e.get("source", ""), e.get("state", ""),
             ", ".join(sorted(e.get("data", {}).keys())) or "–",
             "; ".join(f"{s.get('title')} ({s.get('subentry_type')})" for s in e.get("subentries", [])) or "–"] for e in entries]
    parts.append("### Integrationen (config_entries)\n\n" + table(["Domain", "Titel", "Quelle", "State", "Daten-Schlüssel (Werte nicht exportiert)", "Unter-Einträge"], sorted(rows)))
    # Claude-Prompt aus Anthropic-Subentry
    for e in entries:
        if e["domain"] == "anthropic":
            for s in e.get("subentries", []):
                p = s.get("data", {}).get("prompt")
                if p:
                    (out / "claude_prompt.live.txt").write_text(scrub_text(p) + "\n")
                    opts = {k: v for k, v in s.get("data", {}).items() if k != "prompt"}
                    parts.append(f"### Anthropic „{s.get('title')}“\n\nOptionen: `{json.dumps(scrub(opts), ensure_ascii=False)}` – Prompt ({len(p)} Zeichen): [`ist-stand/claude_prompt.live.txt`](ist-stand/claude_prompt.live.txt)")
    # Assist-Pipelines
    pl = storage("assist_pipeline.pipelines")
    pref = pl.get("preferred_item")
    rows = [[("★ " if p["id"] == pref else "") + p["name"], p.get("language"), p.get("conversation_engine"), p.get("stt_engine") or "–",
             (p.get("tts_engine") or "–") + (f" ({p['tts_voice']})" if p.get("tts_voice") else ""), "ja" if p.get("prefer_local_intents") else "nein",
             f"{p.get('wake_word_entity') or '–'} / {p.get('wake_word_id') or '–'}"] for p in pl.get("items", [])]
    parts.append("### Assist-Pipelines (★ = bevorzugt)\n\n" + table(["Name", "Sprache", "Konversation", "STT", "TTS (Stimme)", "Lokale Intents", "Wake-Word Entity / ID"], rows))
    # Exposed entities
    ex = storage("homeassistant.exposed_entities").get("exposed_entities", {})
    exposed = sorted(k for k, v in ex.items() if any(a.get("should_expose") for a in v.get("assistants", {}).values()))
    parts.append("### Für Assist freigegebene Entitäten (explizit)\n\n" + (", ".join(f"`{e}`" for e in exposed) if exposed else "_keine expliziten Einträge – es gilt die Standard-Freigabe der Entitäten (siehe Spalte „Assist“ unten)_"))
    # HTTP / CORS
    http = storage("http").get("stable", {})
    parts.append("### HTTP (.storage/http)\n\n" + table(["Einstellung", "Wert"], [[k, json.dumps(v, ensure_ascii=False)] for k, v in http.items() if k not in ("created_at", "error", "error_message")]))
    # Areas, Personen
    areas = {a["id"]: a["name"] for a in storage("core.area_registry").get("areas", [])}
    parts.append("### Bereiche\n\n" + (", ".join(f"{v} (`{k}`)" for k, v in areas.items()) or "_keine_"))
    persons = storage("person").get("items", [])
    parts.append("### Personen\n\n" + table(["Name", "Device-Tracker"], [[p["name"], ", ".join(p.get("device_trackers", []))] for p in persons]))
    # Entities
    ents = storage("core.entity_registry").get("entities", [])
    devs = {d["id"]: d for d in storage("core.device_registry").get("devices", [])}
    rows = []
    for e in sorted(ents, key=lambda e: (e["platform"], e["entity_id"])):
        area = e.get("area_id") or (devs.get(e.get("device_id"), {}).get("area_id"))
        opts = (e.get("options") or {}).get("conversation", {})
        rows.append([e["platform"], f"`{e['entity_id']}`", scrub_text(e.get("name") or e.get("original_name") or ""), areas.get(area, "–"),
                     "aus: " + e["disabled_by"] if e.get("disabled_by") else "aktiv", "ja" if opts.get("should_expose") else "–"])
    parts.append(f"### Entitäten ({len(rows)})\n\n" + table(["Integration", "Entity-ID", "Name", "Bereich", "Status", "Assist"], rows))
    # YAML-Dateien
    files = []
    for name in ("configuration.yaml", "automations.yaml", "scripts.yaml", "scenes.yaml"):
        t = read(HA / name)
        if t is not None:
            (out / name).write_text(scrub_yaml(t))
            files.append(f"- [`ist-stand/{name}`](ist-stand/{name}) ({len(t.splitlines())} Zeilen)")
    parts.append("### YAML-Konfiguration (Kopien, Geheimnisse maskiert)\n\n" + "\n".join(files))
    # Skripte-Übersicht
    scripts = read(HA / "scripts.yaml") or ""
    rows = re.findall(r"^([\w-]+):\n(?:.*\n)*?\s+alias:\s*(.+)", scripts, re.M)
    parts.append("### Skripte\n\n" + table(["script.*", "Alias"], [[f"`script.{k}`", v.strip()] for k, v in rows]))
    # Automationen
    auto = read(HA / "automations.yaml") or ""
    rows = re.findall(r"^\s*-\s*id:.*\n\s*alias:\s*(.+)", auto, re.M) or re.findall(r"alias:\s*(.+)", auto)
    parts.append("### Automationen\n\n" + ("\n".join(f"- {a.strip()}" for a in rows) if rows else "_keine_"))
    # Repo vs. live
    diffs = []
    repo = Path(os.environ.get("REPO_DIR", "")) if os.environ.get("REPO_DIR") else None
    if repo and repo.exists():
        for live, src in (("scripts.yaml", "assistant/homeassistant/scripts.yaml"), ("claude_prompt.live.txt", "assistant/homeassistant/claude_prompt.txt"), ("nginx.conf", "deploy/nginx.conf")):
            a, b = read(out / live), read(repo / src)
            if a is not None and b is not None:
                norm = lambda t: ' '.join(re.sub(r'^\s*#.*$', '', t, flags=re.M).split())  # noqa: E731
                diffs.append(f"- `{src}` ↔ live: {'identisch ✅' if norm(a) == norm(b) else '**abweichend** ⚠️ (Repo-Datei oder Pi aktualisieren)'}")
    if diffs:
        parts.append("### Repo ↔ Pi\n\n" + "\n".join(diffs))
    # Log-Fehler
    log = read(HA / "home-assistant.log") or ""
    errs = [scrub_text(l) for l in log.splitlines() if " ERROR " in l or " WARNING " in l][-15:]
    parts.append("### Letzte Warnungen/Fehler im HA-Log\n\n" + ("```\n" + "\n".join(errs) + "\n```" if errs else "_keine_"))
    return "\n\n".join(parts)


def sec_voice() -> str:
    rows = [
        ["openwakeword custom models", sh(f"ls {HOME}/openwakeword/custom 2>/dev/null | tr '\\n' ' '") or "–"],
        ["whisper-Modelle (Fallback)", sh(f"ls {HOME}/whisper-data 2>/dev/null | tr '\\n' ' '") or "–"],
        ["groq_stt letzte Aufnahme", sh("docker exec groq_stt ls -la /tmp/last.wav 2>/dev/null | awk '{print $5\" Bytes, \"$6\" \"$7\" \"$8}'") or "–"],
        ["TTS-Cache", sh(f"ls {HA}/tts 2>/dev/null | wc -l") + " Dateien"],
    ]
    return table(["Was", "Wert"], rows)


def sec_network() -> str:
    return "```\n" + sh("ss -tlnp 2>/dev/null | awk 'NR>1{print $4\"  \"$6}' | sed 's/users:((\"\\([^\"]*\\)\".*/\\1/' | sort -u") + "\n```"


def main() -> None:
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/ist-stand")
    if out.exists():
        shutil.rmtree(out)
    raw = out / "ist-stand"
    raw.mkdir(parents=True)
    now = dt.datetime.now().astimezone().strftime("%Y-%m-%d %H:%M %Z")
    containers_md, containers_raw = sec_containers()
    (raw / "containers.json").write_text(json.dumps(containers_raw, indent=2, ensure_ascii=False) + "\n")
    md = f"""# Ist-Stand `homehole` – automatisch exportiert

> Erzeugt am **{now}** von `deploy/export-state.py` direkt auf dem Pi. **Nicht von Hand bearbeiten** – wird bei jedem Deploy
> neu erzeugt (`deploy/export-state.sh`). Geheimnisse (Tokens, Passwörter, API-Keys, E-Mail-Adressen) sind maskiert.
> Rohdateien liegen in [`docs/ist-stand/`](ist-stand/). Architektur & Aufbau-Anleitung: [`AUFBAU.md`](AUFBAU.md), Sprachassistent: [`../assistant/README.md`](../assistant/README.md).

## System

{sec_system()}

## Container

{containers_md}

## Dashboard (nginx `pi-dashboard`)

{sec_dashboard(raw)}

nginx-Konfiguration: [`ist-stand/nginx.conf`](ist-stand/nginx.conf)

## Home Assistant

{sec_ha(raw)}

## Sprachassistent

{sec_voice()}

## Offene Ports (Host)

{sec_network()}
"""
    (out / "IST-STAND.md").write_text(md)
    print(f"OK → {out}/IST-STAND.md ({len(md)} Zeichen), Rohdateien: {sorted(p.name for p in raw.iterdir())}")


if __name__ == "__main__":
    main()
