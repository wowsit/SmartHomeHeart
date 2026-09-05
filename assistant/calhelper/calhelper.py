"""Tiny CalDAV helper for Home Assistant (delete / move events).

HA's caldav integration can only create events, so this sidecar exposes:
  POST /delete  {"calendar": "hjem", "title": "Zahnarzt", "date": "2026-09-05"}
  POST /move    {..., "new_start": "2026-09-07 10:00:00", "new_end": optional}
  POST /find    {"calendar", "title"?, "date"?}  -> list of matching events
Env: CALDAV_URL, CALDAV_USER, CALDAV_PASS, optional CALDAV_USER2/CALDAV_PASS2 (zweiter
     iCloud-Account), TZ (default Europe/Berlin), PORT.
"""
import json
import os
import unicodedata
from datetime import date, datetime, timedelta
from http.server import BaseHTTPRequestHandler, HTTPServer
from zoneinfo import ZoneInfo

import caldav

TZ = ZoneInfo(os.environ.get("TZ", "Europe/Berlin"))


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "").lower()
    return "".join(c for c in s if c.isalnum())


def accounts():
    """Alle konfigurierten iCloud-Accounts: CALDAV_USER/PASS plus CALDAV_USER2/PASS2 usw."""
    url = os.environ["CALDAV_URL"]
    out = [(os.environ["CALDAV_USER"], os.environ["CALDAV_PASS"])]
    i = 2
    while os.environ.get(f"CALDAV_USER{i}"):
        out.append((os.environ[f"CALDAV_USER{i}"], os.environ[f"CALDAV_PASS{i}"]))
        i += 1
    return [(u, caldav.DAVClient(url=url, username=u, password=p)) for u, p in out]


def all_calendars():
    """(Account, Kalender) ueber alle Accounts hinweg; Fehler eines Accounts blockieren die anderen nicht."""
    found, errors = [], []
    for user, cl in accounts():
        try:
            found.extend((user, c) for c in cl.principal().calendars())
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{user}: {exc}")
    if not found and errors:
        raise ValueError("Kein CalDAV-Account erreichbar: " + "; ".join(errors))
    return found


def get_calendar(name: str):
    cals = all_calendars()
    for _user, c in cals:
        if norm(str(c.name)) == norm(name):
            return c
    raise ValueError(f"Kalender '{name}' nicht gefunden. Vorhanden: {[str(c.name) for _u, c in cals]}")


def to_local(dt):
    if isinstance(dt, datetime):
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=TZ)
        return dt.astimezone(TZ)
    return datetime(dt.year, dt.month, dt.day, tzinfo=TZ)  # all-day


def parse_dt(s: str) -> datetime:
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M"):
        try:
            return datetime.strptime(s, fmt).replace(tzinfo=TZ)
        except ValueError:
            pass
    raise ValueError(f"Ungültige Zeit: {s}")


def find_events(cal, title: str | None, day: str | None):
    if day:
        d = date.fromisoformat(day)
        start = datetime(d.year, d.month, d.day, tzinfo=TZ)
        end = start + timedelta(days=1)
    else:
        start = datetime.now(TZ) - timedelta(days=1)
        end = start + timedelta(days=60)
    out = []
    for ev in cal.search(start=start, end=end, event=True, expand=False):
        comp = ev.icalendar_component
        summary = str(comp.get("summary", ""))
        if title and norm(title) not in norm(summary) and norm(summary) not in norm(title):
            continue
        out.append((ev, comp, summary))
    return out


def describe(comp, summary):
    ds = to_local(comp["dtstart"].dt)
    de = to_local(comp["dtend"].dt) if "dtend" in comp else None
    return {"summary": summary, "start": ds.isoformat(), "end": de.isoformat() if de else None,
            "recurring": "rrule" in comp}


def search_all(title, day):
    """Sucht in allen Kalendern aller Accounts."""
    out = []
    for _user, cal in all_calendars():
        try:
            out.extend(find_events(cal, title, day))
        except Exception:  # noqa: BLE001  einzelner Kalender kaputt/leer -> weitersuchen
            pass
    return out


def handle(path: str, body: dict) -> dict:
    title = body.get("title")
    day = body.get("date")
    wanted = (body.get("calendar") or "").strip()
    if wanted:
        cal = get_calendar(wanted)
        matches = find_events(cal, title, day)
        if not matches:
            # Termin liegt oft in einem anderen Kalender als vermutet -> ueberall nachsehen
            matches = search_all(title, day)
    else:
        matches = search_all(title, day)
    if path == "/find":
        return {"ok": True, "events": [describe(c, s) for _, c, s in matches]}
    if not title or not day:
        return {"ok": False, "error": "title und date sind nötig"}
    if not matches:
        others = [describe(c, s) for _, c, s in search_all(None, day)]
        return {"ok": False, "error": f"Kein Termin '{title}' am {day} gefunden", "events_that_day": others}
    if len(matches) > 1:
        return {"ok": False, "error": "Mehrere passende Termine, bitte genauer", "candidates": [describe(c, s) for _, c, s in matches]}
    ev, comp, summary = matches[0]
    info = describe(comp, summary)
    if info["recurring"]:
        return {"ok": False, "error": "Serientermin – bitte manuell ändern", "event": info}
    if path == "/delete":
        ev.delete()
        return {"ok": True, "deleted": info}
    if path == "/move":
        new_start = parse_dt(body["new_start"])
        old_start = to_local(comp["dtstart"].dt)
        old_end = to_local(comp["dtend"].dt) if "dtend" in comp else old_start + timedelta(hours=1)
        new_end = parse_dt(body["new_end"]) if body.get("new_end") else new_start + (old_end - old_start)
        comp["dtstart"].dt = new_start
        if "dtend" in comp:
            comp["dtend"].dt = new_end
        else:
            comp.add("dtend", new_end)
        if body.get("new_title"):
            comp["summary"] = body["new_title"]
        ev.save()
        return {"ok": True, "moved": info, "new": {"start": new_start.isoformat(), "end": new_end.isoformat(),
                                                    "summary": body.get("new_title") or summary}}
    return {"ok": False, "error": "unknown path"}


class H(BaseHTTPRequestHandler):
    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        try:
            body = json.loads(self.rfile.read(n) or b"{}")
            res = handle(self.path, body)
            code = 200
        except Exception as e:  # noqa: BLE001
            res, code = {"ok": False, "error": str(e)}, 200
        data = json.dumps(res, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        print(fmt % args, flush=True)


if __name__ == "__main__":
    HTTPServer(("0.0.0.0", int(os.environ.get("PORT", 10400))), H).serve_forever()
