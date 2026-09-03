"""Wyoming STT server that forwards audio to Groq's Whisper API (whisper-large-v3-turbo).

Env: GROQ_API_KEY (required), GROQ_MODEL (default whisper-large-v3-turbo),
     STT_LANGUAGE (default de), STT_PROMPT (vocabulary hint; default below), PORT (default 10301),
     STT_MIN_SECONDS (default 0.6), STT_MAX_COMPRESSION (default 2.4), STT_MIN_LOGPROB (default -1.0).

Halluzinationsfilter: Whisper erfindet bei Stille/Rauschen Text ("Amen.", "Untertitelung des ZDF",
Wortschleifen wie "Lich, Gitarren, Lich, Gitarren"). Wir holen verbose_json und verwerfen Segmente mit
hoher compression_ratio (Wiederholung), sehr niedrigem avg_logprob oder bekannten Floskeln, damit der
Agent nicht auf Müll reagiert (leerer Text = HA sagt nur "Ich habe nichts verstanden").
"""
import re
import asyncio
import io
import json
import logging
import os
import urllib.request
import uuid
import wave

from wyoming.asr import Transcribe, Transcript
from wyoming.audio import AudioChunk, AudioStop
from wyoming.event import Event
from wyoming.info import AsrModel, AsrProgram, Attribution, Describe, Info
from wyoming.server import AsyncEventHandler, AsyncServer

_LOG = logging.getLogger("groq_stt")
API = "https://api.groq.com/openai/v1/audio/transcriptions"
MODEL = os.environ.get("GROQ_MODEL", "whisper-large-v3-turbo")
LANG = os.environ.get("STT_LANGUAGE", "de")
PROMPT = os.environ.get("STT_PROMPT", "Hey Jarvis. Zahnarzt, Termin, Kalender, Hjem, Arbeid, Einkaufsliste, "
                        "Licht, Heizung, Ofen, Wetter, morgen, übermorgen, Uhr, verschieben, löschen.")
MIN_SECONDS = float(os.environ.get("STT_MIN_SECONDS", "0.6"))
MAX_COMPRESSION = float(os.environ.get("STT_MAX_COMPRESSION", "2.4"))
MIN_LOGPROB = float(os.environ.get("STT_MIN_LOGPROB", "-1.0"))
# Typische Whisper-Halluzinationen bei Stille (Trainingsdaten-Artefakte)
HALLUCINATIONS = re.compile(
    r"^(amen|untertitel(ung)?( des zdf| im auftrag des zdf)?.*|vielen dank( fürs zuschauen)?|"
    r"das war's|bis zum nächsten mal|tschüss|copyright.*|www\..*|und|so|ja|hm+|äh+|ok(ay)?)[.!?\s]*$", re.I)


def clean_transcript(data: dict) -> str:
    """Filter verbose_json result; returns '' if it looks like a hallucination."""
    kept = []
    for seg in data.get("segments") or [{"text": data.get("text", ""), "avg_logprob": 0, "compression_ratio": 0}]:
        t = seg.get("text", "").strip()
        if not t:
            continue
        if seg.get("compression_ratio", 0) > MAX_COMPRESSION:
            _LOG.warning("drop segment (repetition, cr=%.2f): %r", seg["compression_ratio"], t); continue
        if seg.get("avg_logprob", 0) < MIN_LOGPROB:
            _LOG.warning("drop segment (low confidence, lp=%.2f): %r", seg["avg_logprob"], t); continue
        kept.append(t)
    text = " ".join(kept).strip()
    if HALLUCINATIONS.match(text):
        _LOG.warning("drop transcript (known hallucination): %r", text); return ""
    words = re.findall(r"\w+", text.lower())
    if len(words) >= 6 and len(set(words)) / len(words) < 0.6:  # z. B. "Lich, Gitarren, Lich, Gitarren, ..."
        _LOG.warning("drop transcript (word loop): %r", text); return ""
    return text

INFO = Info(asr=[AsrProgram(
    name="groq-whisper", description="Groq Whisper large-v3-turbo (cloud)",
    attribution=Attribution(name="Groq", url="https://groq.com"), installed=True, version="1.0",
    models=[AsrModel(name=MODEL, description=MODEL, attribution=Attribution(name="OpenAI", url="https://openai.com"),
                     installed=True, version="3", languages=[LANG, "en"])],
)])


def transcribe(pcm: bytes, rate: int, width: int, channels: int, language: str) -> str:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(channels); w.setsampwidth(width); w.setframerate(rate); w.writeframes(pcm)
    if os.environ.get("DEBUG_SAVE"):  # keep the last request for inspection: docker cp groq_stt:/tmp/last.wav .
        open("/tmp/last.wav", "wb").write(buf.getvalue())
    boundary = uuid.uuid4().hex
    fields = {"model": MODEL, "language": language, "response_format": "verbose_json", "temperature": "0"}
    if PROMPT:
        fields["prompt"] = PROMPT
    body = b""
    for k, v in fields.items():
        body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
    body += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"audio.wav\"\r\n"
             "Content-Type: audio/wav\r\n\r\n").encode() + buf.getvalue() + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(API, data=body, method="POST", headers={
        "Authorization": f"Bearer {os.environ['GROQ_API_KEY']}",
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "User-Agent": "groq-stt-wyoming/1.0"})  # Cloudflare blocks default Python-urllib UA (error 1010)
    with urllib.request.urlopen(req, timeout=30) as r:
        return clean_transcript(json.loads(r.read()))


class Handler(AsyncEventHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, **kw)
        self.pcm = bytearray(); self.rate = 16000; self.width = 2; self.channels = 1; self.language = LANG

    async def handle_event(self, event: Event) -> bool:
        if Describe.is_type(event.type):
            await self.write_event(INFO.event()); return True
        if Transcribe.is_type(event.type):
            t = Transcribe.from_event(event)
            if t.language: self.language = t.language
            return True
        if AudioChunk.is_type(event.type):
            c = AudioChunk.from_event(event)
            self.rate, self.width, self.channels = c.rate, c.width, c.channels
            self.pcm.extend(c.audio); return True
        if AudioStop.is_type(event.type):
            secs = len(self.pcm) / (self.rate * self.width * self.channels)
            text = ""
            if secs >= MIN_SECONDS:
                try:
                    text = await asyncio.get_running_loop().run_in_executor(
                        None, transcribe, bytes(self.pcm), self.rate, self.width, self.channels, self.language)
                except Exception as e:  # noqa: BLE001
                    _LOG.error("Groq error: %s", e)
            _LOG.info("%.1fs audio -> %r", secs, text)
            await self.write_event(Transcript(text=text).event())
            self.pcm.clear(); return False
        return True


async def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    server = AsyncServer.from_uri(f"tcp://0.0.0.0:{os.environ.get('PORT', '10301')}")
    _LOG.info("groq_stt ready (model=%s, lang=%s)", MODEL, LANG)
    await server.run(Handler)


if __name__ == "__main__":
    asyncio.run(main())
