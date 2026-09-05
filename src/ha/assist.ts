/**
 * Sprachassistent „Haus“: Browser-Mikro → HA Assist-Pipeline (Wake Word → STT → Claude → TTS).
 * Das Dashboard ist damit selbst der Sprach-Satellit; es braucht kein extra Gerät.
 * Audio wird als 16 kHz / 16-bit / mono PCM binär über den HA-WebSocket gestreamt.
 */
import type { Connection } from 'home-assistant-js-websocket'

import type { AssistLike, AssistState } from './types'
type Listener = (s: AssistState) => void

const TARGET_RATE = 16000

/** Rechnet Float32-Audio des Browsers auf 16 kHz Int16 herunter (einfaches Mittelwert-Resampling). */
function downsample(input: Float32Array, inRate: number): Int16Array {
  if (inRate === TARGET_RATE) return toInt16(input)
  const ratio = inRate / TARGET_RATE
  const outLen = Math.floor(input.length / ratio)
  const out = new Int16Array(outLen)
  for (let i = 0; i < outLen; i++) {
    const start = Math.floor(i * ratio), end = Math.min(input.length, Math.floor((i + 1) * ratio))
    let sum = 0
    for (let j = start; j < end; j++) sum += input[j]
    const v = sum / Math.max(1, end - start)
    out[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)))
  }
  return out
}
function toInt16(f: Float32Array): Int16Array {
  const out = new Int16Array(f.length)
  for (let i = 0; i < f.length; i++) out[i] = Math.max(-32768, Math.min(32767, Math.round(f[i] * 32767)))
  return out
}

export class AssistClient implements AssistLike {
  private conn: Connection
  private haUrl: string
  private listeners = new Set<Listener>()
  private state: AssistState = { phase: 'idle' }
  private level = 0
  private lastLevelAt = 0
  private stream?: MediaStream
  private ctx?: AudioContext
  private handlerId: number | null = null
  private running = false
  private stopped = true
  private audioEl?: HTMLAudioElement
  private unsub?: () => Promise<void> | void
  private pipelineId?: string
  /** Eigene Endpunkt-Erkennung (HA-VAD ist mit 0,7 s Stille fest verdrahtet und schneidet Sätze ab). */
  private speechSeen = false
  private lastLoudAt = 0
  private listeningSince = 0
  /** Läuft ein Dialog mit Rückfrage weiter, hängen Folgesätze an derselben Conversation. */
  private conversationId?: string
  private continueConversation = false

  constructor(conn: Connection, haUrl: string, pipelineId?: string) {
    this.conn = conn; this.haUrl = haUrl; this.pipelineId = pipelineId
  }

  subscribe(cb: Listener) { this.listeners.add(cb); cb(this.state); return () => { this.listeners.delete(cb) } }
  /** Läuft gerade ein eigener Sprachbefehl (Zuhören/Denken/Sprechen)? */
  get active() { return this.state.phase !== 'idle' && this.state.phase !== 'error' }
  private set(patch: Partial<AssistState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach((l) => l(this.state)) }

  /** Mikro öffnen und Dauerschleife mit Wake Word starten. Muss aus einer Nutzeraktion oder auf Kiosk (Autoplay erlaubt) kommen. */
  async start() {
    if (!this.stopped) return
    this.stopped = false
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
    } catch {
      this.set({ phase: 'error', error: 'Kein Mikrofonzugriff (Browser braucht https oder localhost).' })
      this.stopped = true
      return
    }
    this.ctx = new AudioContext()
    const src = this.ctx.createMediaStreamSource(this.stream)
    // ScriptProcessor ist veraltet, läuft aber in Chromium/Safari ohne separate Worklet-Datei stabil.
    const proc = this.ctx.createScriptProcessor(4096, 1, 1)
    const rate = this.ctx.sampleRate
    proc.onaudioprocess = (ev) => {
      const input = ev.inputBuffer.getChannelData(0)
      this.reportLevel(input)
      if (this.handlerId == null) return
      this.endpoint()
      const pcm = downsample(input, rate)
      const buf = new Uint8Array(pcm.byteLength + 1)
      buf[0] = this.handlerId
      buf.set(new Uint8Array(pcm.buffer), 1)
      this.rawSocket()?.send(buf)
    }
    src.connect(proc); proc.connect(this.ctx.destination)
    this.loop('wake_word')
  }

  /** Mikrofon-Pegel (RMS, geglättet) höchstens ~12x/s melden – nur so bewegen sich die Wellen bei echtem Ton. */
  private reportLevel(input: Float32Array) {
    let sum = 0
    for (let i = 0; i < input.length; i++) sum += input[i] * input[i]
    const rms = Math.sqrt(sum / input.length)
    // Sprache liegt grob bei RMS 0.01–0.2; darunter ist Raumrauschen.
    const norm = Math.max(0, Math.min(1, (rms - 0.006) / 0.12))
    this.level = this.level * 0.6 + norm * 0.4
    const now = Date.now()
    if (now - this.lastLevelAt < 80) return
    this.lastLevelAt = now
    const rounded = Math.round(this.level * 100) / 100
    if (Math.abs((this.state.level ?? 0) - rounded) > 0.02) this.set({ level: rounded })
  }

  /**
   * Beendet das Zuhören selbst: nach SILENCE_MS Stille (statt HAs fest verdrahteten 0,7 s),
   * spätestens nach MAX_MS. Ein leerer Binär-Chunk signalisiert HA das Ende des Audio-Streams.
   */
  private endpoint() {
    if (this.state.phase !== 'listening' || this.handlerId == null) return
    const SILENCE_MS = 1800, LEAD_IN_MS = 6000, MAX_MS = 25000
    const now = Date.now()
    if (!this.listeningSince) this.listeningSince = now
    if (this.level > 0.06) { this.speechSeen = true; this.lastLoudAt = now }
    const spoke = this.speechSeen && now - this.lastLoudAt > SILENCE_MS
    const nobody = !this.speechSeen && now - this.listeningSince > LEAD_IN_MS
    const tooLong = now - this.listeningSince > MAX_MS
    if (spoke || nobody || tooLong) this.endAudio()
  }

  /** Leerer Chunk = Ende der Aufnahme; HA schickt das Transkript dann an den LLM weiter. */
  private endAudio() {
    if (this.handlerId == null) return
    const buf = new Uint8Array(1)
    buf[0] = this.handlerId
    this.rawSocket()?.send(buf)
    this.handlerId = null
    this.speechSeen = false
    this.listeningSince = 0
  }

  private armListening() {
    this.speechSeen = false
    this.lastLoudAt = Date.now()
    this.listeningSince = Date.now()
  }

  stop() {
    this.stopped = true
    this.conversationId = undefined
    this.continueConversation = false
    this.level = 0
    this.handlerId = null
    this.unsubSafe()
    this.stream?.getTracks().forEach((t) => t.stop())
    this.ctx?.close()
    this.set({ phase: 'idle', heard: undefined, answer: undefined })
  }

  /** Ohne Wake Word direkt zuhören (Tipp auf den Button). */
  async listenNow() {
    if (this.stopped) { await this.start(); if (this.stopped) return }
    if (this.running) { this.unsubSafe(); this.running = false }
    this.loop('stt')
  }

  private unsubSafe() { try { const r = this.unsub?.(); (r as Promise<void> | undefined)?.catch(() => {}) } catch { /* Lauf ist schon beendet */ } this.unsub = undefined }

  private rawSocket(): WebSocket | undefined {
    return (this.conn as any).socket as WebSocket | undefined
  }

  private async loop(startStage: 'wake_word' | 'stt') {
    if (this.stopped || this.running) return
    this.running = true
    this.handlerId = null
    if (startStage === 'stt') this.armListening()
    else this.conversationId = undefined
    if (startStage === 'stt') this.set({ phase: 'listening', heard: undefined, answer: undefined, source: 'local' })
    else this.set({ phase: 'idle', heard: undefined, answer: undefined, source: 'local' })
    try {
      this.unsub = await this.conn.subscribeMessage((msg: any) => this.onEvent(msg), {
        type: 'assist_pipeline/run',
        start_stage: startStage,
        end_stage: 'tts',
        // input.timeout = 0: kein VAD-Timeout in der Wake-Word-Phase (sonst bricht HA nach 3 s Stille ab).
        // no_vad: HAs VAD beendet die Aufnahme nach 0,7 s Stille (nicht einstellbar) und schneidet
        // dadurch mitten im Satz ab – wir erkennen das Satzende selbst (siehe endpoint()).
        input: { sample_rate: TARGET_RATE, no_vad: true, ...(startStage === 'wake_word' ? { timeout: 0 } : {}) },
        ...(this.conversationId ? { conversation_id: this.conversationId } : {}),
        ...(this.pipelineId ? { pipeline: this.pipelineId } : {}),
        // Gesamtlaufzeit; HA beendet den Lauf danach mit error 'timeout' → wir starten einfach neu.
        timeout: startStage === 'wake_word' ? 300 : 60,
      })
    } catch (e: any) {
      this.running = false
      this.set({ phase: 'error', error: String(e?.message ?? e) })
      this.retry(5000)
    }
  }

  private retry(ms: number) {
    if (this.stopped) return
    setTimeout(() => { if (!this.stopped && !this.running) this.loop('wake_word') }, ms)
  }

  private onEvent(ev: { type: string; data: any }) {
    const d = ev.data ?? {}
    switch (ev.type) {
      case 'run-start':
        this.handlerId = d.runner_data?.stt_binary_handler_id ?? null
        break
      case 'wake_word-end':
        this.armListening()
        this.set({ phase: 'listening', heard: undefined, answer: undefined })
        break
      case 'stt-start':
        this.armListening()
        if (this.state.phase !== 'listening') this.set({ phase: 'listening' })
        break
      case 'stt-end':
        this.handlerId = null
        this.set({ phase: 'thinking', heard: d.stt_output?.text || '…' })
        break
      case 'intent-progress': {
        // Claude streamt die Antwort Wort für Wort → Live-Untertitel
        const delta = d.chat_log_delta?.content
        if (typeof delta === 'string' && delta) this.set({ answer: (this.state.answer ?? '') + delta })
        break
      }
      case 'intent-end': {
        const out = d.intent_output ?? {}
        // Stellt der Assistent eine Rückfrage, hält HA die Conversation offen → danach direkt wieder zuhören.
        this.continueConversation = !!out.continue_conversation
        this.conversationId = this.continueConversation ? out.conversation_id : undefined
        this.set({ answer: out.response?.speech?.plain?.speech ?? this.state.answer ?? '' })
        break
      }
      case 'tts-end': {
        const url: string | undefined = d.tts_output?.url
        if (url) this.play(url.startsWith('http') ? url : this.haUrl + url)
        else this.finish(2500)
        break
      }
      case 'error':
        this.handlerId = null
        if (d.code === 'wake-word-timeout' || d.code === 'timeout' || d.code === 'stt-no-text-recognized') {
          // normal: niemand hat gesprochen → still neu starten
          this.running = false; this.unsubSafe()
          if (d.code === 'stt-no-text-recognized') this.finish(1500); else this.retry(50)
        } else {
          this.set({ phase: 'error', error: d.message ?? d.code })
          this.running = false; this.unsubSafe()
          this.retry(4000)
        }
        break
      case 'run-end':
        this.running = false; this.unsubSafe()
        // Wake-Word-Lauf ist ohne Treffer ausgelaufen → sofort neuer Lauf; nach Antwort kümmert sich play()/finish().
        if (this.state.phase === 'idle') this.retry(50)
        break
    }
  }

  private play(url: string) {
    this.set({ phase: 'speaking' })
    this.handlerId = null
    const a = this.audioEl ?? (this.audioEl = new Audio())
    a.src = url
    a.onended = () => this.finish(3500)
    a.onerror = () => this.finish(3500)
    a.play().catch(() => this.finish(3500))
  }

  /** Antwort kurz stehen lassen; nach einer Rückfrage geht das Mikro direkt wieder auf, sonst zurück aufs Wake Word. */
  private finish(ms: number) {
    const followUp = this.continueConversation
    this.continueConversation = false
    setTimeout(() => {
      if (this.stopped) return
      if (followUp) {
        this.set({ phase: 'idle', answer: this.state.answer })
        if (!this.running) this.loop('stt')
        return
      }
      this.set({ phase: 'idle', heard: undefined, answer: undefined })
      if (!this.running) this.loop('wake_word')
    }, ms)
  }
}
