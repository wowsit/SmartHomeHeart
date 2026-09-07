"""Sammelstelle für Wake-Word-Aufnahmen (Trainingsdaten für „hey Haus").

Das Dashboard nimmt im Browser auf (16 kHz mono 16-bit WAV, siehe src/components/WakeWord.tsx)
und schickt jede bestätigte Aufnahme hierher; nginx reicht `/wwrec/` an diesen Dienst weiter.
Alles bleibt auf dem Pi: die Dateien landen unter /clips/<schritt>/<schritt>-<zeit>.wav.

  POST /clip   {"step": "fynn_nah", "wav_base64": "..."}  -> {"ok": true, "file": "...", "count": 7}
  POST /undo   {"step": "fynn_nah"}                       -> löscht die neueste Aufnahme des Schritts
  GET  /stats                                             -> {"ok": true, "counts": {...}, "total": 42}

Bewusst nur Standardbibliothek (kein Build), nur im LAN erreichbar, kein Auth – wie die
anderen Helfer auf dem Pi. Grenzen: Dateiname aus Whitelist, max. 4 MB pro Aufnahme,
max. 2000 Dateien insgesamt.
"""
import base64
import json
import os
import re
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

CLIPS = os.environ.get("CLIPS_DIR", "/clips")
MAX_BYTES = 4 * 1024 * 1024
MAX_FILES = 2000
STEP_RE = re.compile(r"^[a-z0-9_]{2,32}$")


def step_dir(step: str) -> str:
    if not STEP_RE.match(step or ""):
        raise ValueError(f"ungültiger Schritt: {step!r}")
    path = os.path.join(CLIPS, step)
    os.makedirs(path, exist_ok=True)
    return path


def counts() -> dict[str, int]:
    out: dict[str, int] = {}
    if not os.path.isdir(CLIPS):
        return out
    for name in sorted(os.listdir(CLIPS)):
        d = os.path.join(CLIPS, name)
        if os.path.isdir(d):
            out[name] = len([f for f in os.listdir(d) if f.endswith(".wav")])
    return out


def total() -> int:
    return sum(counts().values())


def save_clip(step: str, wav: bytes) -> dict:
    if not wav.startswith(b"RIFF") or b"WAVE" not in wav[:16]:
        raise ValueError("keine WAV-Datei")
    if len(wav) > MAX_BYTES:
        raise ValueError("Aufnahme zu groß")
    if total() >= MAX_FILES:
        raise ValueError("Speicherlimit erreicht – bitte Clips abholen und löschen")
    d = step_dir(step)
    name = f"{step}-{time.strftime('%Y%m%d-%H%M%S')}-{int(time.time() * 1000) % 1000:03d}.wav"
    with open(os.path.join(d, name), "wb") as fh:
        fh.write(wav)
    return {"ok": True, "file": name, "count": len([f for f in os.listdir(d) if f.endswith(".wav")])}


def undo(step: str) -> dict:
    d = step_dir(step)
    files = sorted(f for f in os.listdir(d) if f.endswith(".wav"))
    if not files:
        return {"ok": False, "error": "keine Aufnahme vorhanden", "count": 0}
    os.remove(os.path.join(d, files[-1]))
    return {"ok": True, "removed": files[-1], "count": len(files) - 1}


def handle(method: str, path: str, body: dict) -> dict:
    path = path.rstrip("/") or "/"
    if method == "GET" and path in ("/stats", "/"):
        c = counts()
        return {"ok": True, "counts": c, "total": sum(c.values())}
    if method == "POST" and path == "/clip":
        return save_clip(str(body.get("step", "")), base64.b64decode(body.get("wav_base64", "")))
    if method == "POST" and path == "/undo":
        return undo(str(body.get("step", "")))
    return {"ok": False, "error": "unknown path"}


class H(BaseHTTPRequestHandler):
    def reply(self, res: dict):
        data = json.dumps(res, ensure_ascii=False).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)

    def run(self, method: str):
        try:
            n = int(self.headers.get("Content-Length", 0) or 0)
            if n > MAX_BYTES * 2:
                raise ValueError("Anfrage zu groß")
            body = json.loads(self.rfile.read(n) or b"{}") if n else {}
            self.reply(handle(method, self.path, body))
        except Exception as exc:  # noqa: BLE001
            self.reply({"ok": False, "error": str(exc)})

    def do_GET(self):
        self.run("GET")

    def do_POST(self):
        self.run("POST")

    def log_message(self, fmt, *args):
        print(fmt % args, flush=True)


if __name__ == "__main__":
    os.makedirs(CLIPS, exist_ok=True)
    HTTPServer(("0.0.0.0", int(os.environ.get("PORT", 10460))), H).serve_forever()
