import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { HaBackend, EntityMap, ConnState } from './types'
import { MockBackend } from './mock'
import { HaWsBackend } from './ws'

/**
 * Basis-URL von Home Assistant (ohne Slash am Ende) oder undefined (Demo-Modus).
 * 'auto' = HA läuft auf demselben Host wie das Dashboard:
 *  - http  → direkt `http://<host>:8123` (Pi-Kiosk über localhost, Mac im LAN über Pi-IP)
 *  - https → gleiche Origin; nginx reicht `/api/` (REST + WebSocket) an HA weiter,
 *            weil der Browser von einer https-Seite kein http/ws zu HA zulässt (Mixed Content).
 */
export function resolveHaUrl(): string | undefined {
  const url = import.meta.env.VITE_HA_URL as string | undefined
  if (url === 'auto') return location.protocol === 'https:' ? location.origin : `http://${location.hostname}:8123`
  return url?.replace(/\/$/, '')
}

export function createBackend(): HaBackend {
  const params = new URLSearchParams(location.search)
  const url = resolveHaUrl()
  const token = import.meta.env.VITE_HA_TOKEN as string | undefined
  if (params.get('mock') === '1' || !url || !token) return new MockBackend()
  return new HaWsBackend(url, token)
}

export const HaContext = createContext<HaBackend | null>(null)

export function useHa(): HaBackend {
  const ha = useContext(HaContext)
  if (!ha) throw new Error('HaContext fehlt')
  return ha
}

export function useEntities(): EntityMap {
  const ha = useHa()
  const [entities, setEntities] = useState<EntityMap>({})
  useEffect(() => ha.subscribeEntities(setEntities), [ha])
  return entities
}

export function useConnState(): ConnState {
  const ha = useHa()
  const [s, setS] = useState<ConnState>('connecting')
  useEffect(() => ha.subscribeConnection(setS), [ha])
  return s
}

export function useEntity(id: string) {
  const entities = useEntities()
  return useMemo(() => entities[id], [entities, id])
}
