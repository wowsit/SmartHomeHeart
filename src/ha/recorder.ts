/**
 * Kleiner Aufnehmer für Wake-Word-Trainingsdaten: Browser-Mikro → 16 kHz mono 16-bit WAV.
 * Bewusst dieselbe Signalkette wie der Sprachassistent (getUserMedia + AudioContext, 16 kHz),
 * damit das Modell später genau auf das trainiert, was im Betrieb tatsächlich ankommt.
 */
const TARGET_RATE = 16000

function toInt16(f: Float32Array): Int16Array {
  const out = new Int16Array(f.length)
  for (let i = 0; i < f.length; i++) out[i] = Math.max(-32768, Math.min(32767, Math.round(f[i] * 32767)))
  return out
}

/** Mittelwert-Resampling auf 16 kHz (identisch zum Assist-Pfad in ha/assist.ts). */
export function downsample(input: Float32Array, inRate: number): Int16Array {
  if (inRate === TARGET_RATE) return toInt16(input)
  const ratio = inRate / TARGET_RATE
  const outLen = Math.floor(input.length / ratio)
  const out = new Int16Array(outLen)
  for (let i = 0; i < outLen; i++) {
    const start = Math.floor(i * ratio), end = Math.min(input.length, Math.floor((i + 1) * ratio))
    let sum = 0
    for (let j = start; j < end; j++) sum += input[j]
    out[i] = Math.max(-32768, Math.min(32767, Math.round((sum / Math.max(1, end - start)) * 32767)))
  }
  return out
}

export function encodeWav(pcm: Int16Array, rate = TARGET_RATE): Blob {
  const buf = new ArrayBuffer(44 + pcm.byteLength)
  const v = new DataView(buf)
  const ascii = (off: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)) }
  ascii(0, 'RIFF'); v.setUint32(4, 36 + pcm.byteLength, true); ascii(8, 'WAVEfmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  ascii(36, 'data'); v.setUint32(40, pcm.byteLength, true)
  new Int16Array(buf, 44).set(pcm)
  return new Blob([buf], { type: 'audio/wav' })
}

export async function blobToBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer())
  let s = ''
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(s)
}

export interface Recording { blob: Blob; seconds: number; peak: number }

export class ClipRecorder {
  private stream?: MediaStream
  private ctx?: AudioContext
  private proc?: ScriptProcessorNode
  private chunks: Int16Array[] = []
  private recording = false
  private peak = 0
  onLevel?: (level: number) => void

  async open() {
    if (this.stream) return
    // Ohne Filter aufnehmen: openWakeWord soll die echten Raum- und Mikrofoneigenschaften lernen.
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    })
    this.ctx = new AudioContext()
    const src = this.ctx.createMediaStreamSource(this.stream)
    const proc = this.ctx.createScriptProcessor(4096, 1, 1)
    const rate = this.ctx.sampleRate
    proc.onaudioprocess = (ev) => {
      const input = ev.inputBuffer.getChannelData(0)
      let sum = 0
      for (let i = 0; i < input.length; i++) sum += input[i] * input[i]
      const rms = Math.sqrt(sum / input.length)
      this.onLevel?.(Math.max(0, Math.min(1, (rms - 0.005) / 0.15)))
      if (!this.recording) return
      this.peak = Math.max(this.peak, rms)
      this.chunks.push(downsample(input, rate))
    }
    src.connect(proc); proc.connect(this.ctx.destination)
    this.proc = proc
  }

  /** Nimmt `seconds` Sekunden auf und gibt die fertige WAV zurück. */
  async record(seconds: number): Promise<Recording> {
    await this.open()
    this.chunks = []; this.peak = 0; this.recording = true
    await new Promise((r) => setTimeout(r, seconds * 1000))
    this.recording = false
    const len = this.chunks.reduce((n, c) => n + c.length, 0)
    const all = new Int16Array(len)
    let off = 0
    for (const c of this.chunks) { all.set(c, off); off += c.length }
    this.chunks = []
    return { blob: encodeWav(all), seconds: len / TARGET_RATE, peak: this.peak }
  }

  close() {
    this.recording = false
    try { this.proc?.disconnect() } catch { /* schon zu */ }
    this.stream?.getTracks().forEach((t) => t.stop())
    this.ctx?.close().catch(() => {})
    this.stream = undefined; this.ctx = undefined; this.proc = undefined
  }
}
