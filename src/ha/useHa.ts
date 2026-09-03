import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { HaBackend, EntityMap, ConnState } from './types'
import { MockBackend } from './mock'
import { HaWsBackend } from './ws'

export function createBackend(): HaBackend {
  const params = new URLSearchParams(location.search)
  let url = import.meta.env.VITE_HA_URL as string | undefined
  const token = import.meta.env.VITE_HA_TOKEN as string | undefined
  // 'auto' = HA läuft auf demselben Host wie das Dashboard (Port 8123).
  // Funktioniert so vom Pi-Kiosk (localhost) und vom Mac im LAN (Pi-IP) mit demselben Build.
  if (url === 'auto') url = `${location.protocol}//${location.hostname}:8123`
  if (params.get('mock') === '1' || !url || !token) return new MockBackend()
  return new HaWsBackend(url.replace(/\/$/, ''), token)
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
