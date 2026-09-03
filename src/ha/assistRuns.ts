/**
 * Live-Untertitel für Sprachbefehle von anderen Geräten (Handy-App, Satelliten).
 *
 * HA sendet Pipeline-Ereignisse nur an den Client, der den Lauf gestartet hat. Für alle anderen gibt es die
 * Debug-Schnittstelle `assist_pipeline/pipeline_debug/{list,get}`, die die letzten Läufe jeder Pipeline samt
 * Ereignissen (stt-end = gehörter Satz, intent-progress = gestreamte Antwort, tts-end, error) im Speicher hält
 * und *während* des Laufs wächst. Wir fragen sie im Leerlauf 1×/s ab, während eines Laufs alle 350 ms.
 */
import type { Connection } from 'home-assistant-js-websocket'
import type { AssistState } from './types'

interface RunRef { pipeline_run_id: string; timestamp: string }
interface RunEvent { type: string; timestamp: string; data?: any }

const IDLE_MS = 1000
const ACTIVE_MS = 350
/** Wie lange der letzte Untertitel nach Ende des Laufs stehen bleibt (Lesezeit ≈ TTS-Dauer). */
function holdMs(answer: string) { return Math.min(12000, 3000 + answer.length * 70) }

export function watchAssistRuns(conn: Connection, cb: (s: AssistState) => void, opts: { ignoreOwn?: () => boolean } = {}) {
  let alive = true
  let timer: ReturnType<typeof setTimeout> | undefined
  let pipelines: string[] = []
  let current: { id: string; pipeline: string } | undefined
  const seenEnded = new Set<string>()      // beendete Läufe, die schon angezeigt wurden
  let last: AssistState = { phase: 'idle' }
  let hideAt = 0

  const emit = (s: AssistState) => {
    if (JSON.stringify(s) === JSON.stringify(last)) return
    last = s; cb(s)
  }

  const idle = () => emit({ phase: 'idle', source: 'remote' })

  /** Ereignisliste eines Laufs → Anzeigezustand (oder null, wenn nichts Zeigenswertes: reiner Wake-Word-Lauf). */
  const toState = (events: RunEvent[]): { state: AssistState | null; ended: boolean } => {
    let heard: string | undefined, answer = '', error: string | undefined, ended = false
    let sttStarted = false, sttEnded = false, intentEnded = false, ttsEnded = false, final: string | undefined
    for (const e of events) {
      const d = e.data ?? {}
      switch (e.type) {
        case 'stt-start': sttStarted = true; break
        case 'stt-end': sttEnded = true; heard = d.stt_output?.text || undefined; break
        case 'intent-start': sttStarted = true; sttEnded = true; heard = heard ?? (d.intent_input || undefined); break // auch Text-Eingaben (HA-App-Chat)
        case 'intent-progress': { const c = d.chat_log_delta?.content; if (typeof c === 'string') answer += c; break }
        case 'intent-end': intentEnded = true; final = d.intent_output?.response?.speech?.plain?.speech; break
        case 'tts-end': ttsEnded = true; break
        case 'error': error = d.code === 'stt-no-text-recognized' ? 'Nichts verstanden.' : (d.message ?? d.code); ended = true; break
        case 'run-end': ended = true; break
      }
    }
    if (!sttStarted) return { state: null, ended }              // Wake-Word-Lauf ohne Sprache/Text
    if (error && !heard) return { state: { phase: 'error', error, source: 'remote' }, ended }
    if (!sttEnded) return { state: { phase: 'listening', source: 'remote' }, ended }
    const text = final ?? answer
    const phase = ttsEnded || intentEnded ? 'speaking' : 'thinking'
    return { state: { phase, heard, answer: text || undefined, source: 'remote' }, ended }
  }

  const listRuns = async (pipeline: string): Promise<RunRef[]> => {
    const r = await conn.sendMessagePromise<{ pipeline_runs: RunRef[] }>({ type: 'assist_pipeline/pipeline_debug/list', pipeline_id: pipeline })
    return r.pipeline_runs ?? []
  }
  const getRun = async (pipeline: string, id: string): Promise<RunEvent[]> => {
    const r = await conn.sendMessagePromise<{ events: RunEvent[] }>({ type: 'assist_pipeline/pipeline_debug/get', pipeline_id: pipeline, pipeline_run_id: id })
    return r.events ?? []
  }

  const tick = async () => {
    if (!alive) return
    let next = IDLE_MS
    try {
      if (!pipelines.length) {
        const r = await conn.sendMessagePromise<{ pipelines: { id: string }[] }>({ type: 'assist_pipeline/pipeline/list' })
        pipelines = r.pipelines.map((p) => p.id)
      }
      if (opts.ignoreOwn?.()) {
        // Das Dashboard spricht gerade selbst – seinen eigenen Lauf nicht doppelt zeigen, aber als „gesehen“ merken.
        for (const p of pipelines) for (const run of await listRuns(p)) seenEnded.add(run.pipeline_run_id)
        current = undefined; idle()
      } else {
        if (!current) {
          // neuesten, noch nicht gezeigten Lauf über alle Pipelines suchen
          let newest: { id: string; pipeline: string; ts: string } | undefined
          for (const p of pipelines) {
            for (const run of await listRuns(p)) {
              if (seenEnded.has(run.pipeline_run_id)) continue
              if (!newest || run.timestamp > newest.ts) newest = { id: run.pipeline_run_id, pipeline: p, ts: run.timestamp }
            }
          }
          // Läufe, die vor dem Start des Watchers lagen, nur berücksichtigen, wenn sie jünger als 20 s sind
          if (newest && Date.now() - Date.parse(newest.ts) > 20000) { seenEnded.add(newest.id); newest = undefined }
          if (newest) current = { id: newest.id, pipeline: newest.pipeline }
        }
        if (current) {
          const { state, ended } = toState(await getRun(current.pipeline, current.id))
          if (state) emit(state)
          if (ended) {
            seenEnded.add(current.id); current = undefined
            if (state) { hideAt = Date.now() + (state.phase === 'error' ? 2000 : holdMs(state.answer ?? '')); next = ACTIVE_MS }
            else idle()
          } else next = ACTIVE_MS
        } else if (hideAt && Date.now() >= hideAt) { hideAt = 0; idle() }
        else if (hideAt) next = ACTIVE_MS
      }
      if (seenEnded.size > 200) seenEnded.clear()
    } catch (e) {
      console.warn('assistRuns', e); pipelines = []; next = 5000
    }
    if (alive) timer = setTimeout(tick, next)
  }
  tick()
  return () => { alive = false; clearTimeout(timer) }
}
