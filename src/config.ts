/**
 * Dashboard-Konfiguration: welche HA-Entities wo angezeigt werden.
 * Im Demo-Modus (kein Token) existieren genau diese IDs als simulierte Geräte.
 * Für die echte HA-Instanz einfach die entity_ids anpassen.
 */
export interface RoomConfig {
  name: string
  entities: string[] // light.*, switch.*, climate.*
}

export type CalColor = 'green' | 'blue' | 'orange' | 'purple' | 'pink' | 'grey'
export interface CalendarConfig {
  entity: string // HA calendar entity, z. B. calendar.max (Google/CalDAV/… läuft über HA)
  name: string
  color: CalColor
}

export const config = {
  /** Wetter-Entity aus HA. Der Standort (Sandkrug, Fichtenweg 10A, 26209 Hatten) wird in HA gesetzt: Einstellungen → System → Allgemein → Standort. */
  weather: 'weather.forecast_home', // Met.no, in HA vorhanden (Stand 2026-09-03)
  locationName: 'Sandkrug',
  /** Die wichtigsten Lichter für das Widget auf der Übersicht.
   *  Echte HA-Entities (Stand 2026-09-04): beide Lampen hängen an Schaltsteckdosen, sind also `switch.*`
   *  (kein Dimmen). `switch.licht_wohnen` ist die HA-Helfer-Gruppe aus beiden. */
  lights: [
    { entity: 'switch.licht_wohnen', name: 'Licht Wohnen' },
    { entity: 'switch.wohnzimmer', name: 'Wohnzimmer' },
    { entity: 'switch.esszimmer', name: 'Esszimmer' },
  ] as { entity: string; name?: string }[],
  /** Kalender-Entities aus Home Assistant. Reihenfolge = Reihenfolge in der Legende. */
  calendars: [
    // iCloud über HA-CalDAV (Entities aus HA, Stand 2026-09-03). 'calendar.untitled' ist leer und bewusst nicht gelistet.
    { entity: 'calendar.hjem', name: 'Hjem', color: 'green' },
    { entity: 'calendar.arbeid', name: 'Arbeid', color: 'blue' },
    // Zweiter iCloud-Account (vt92@gmx.de, CalDAV-Eintrag seit 2026-09-03) – alle pink (Wunsch). 'Schule' etc. sind dort Erinnerungslisten (todo.*), keine Kalender.
    { entity: 'calendar.kalender', name: 'Kalender', color: 'pink' },
    { entity: 'calendar.arbeit', name: 'Arbeit', color: 'pink' },
    { entity: 'calendar.privat', name: 'Privat', color: 'pink' },
    { entity: 'calendar.familie', name: 'Familie', color: 'pink' },
  ] as CalendarConfig[],
  /** TODO: In HA gibt es noch keinen abspielfähigen Player (der LG-TV unterstützt kein play_media). Bis Music Assistant steht, bleibt die Medien-Kachel leer. */
  mediaPlayer: 'media_player.wohnzimmer',
  /** In HA sind noch keine Szenen angelegt (scenes.yaml leer) – daher leer statt Platzhalter. */
  scenes: [] as { id: string; name: string }[],
  rooms: [
    { name: 'Wohnzimmer', entities: ['switch.wohnzimmer'] },
    { name: 'Esszimmer', entities: ['switch.esszimmer'] },
  ] as RoomConfig[],
  /** Sekunden ohne Berührung bis der Uhr-Bildschirmschoner erscheint (0 = aus) */
  /** Display-Ausrichtung: 'portrait' = 1080×1920 (Wandmontage hochkant), 'landscape' = 1920×1080 */
  orientation: 'portrait' as 'portrait' | 'landscape',
  /** Seite nach dem Start / nach dem Bildschirmschoner */
  startPage: 'home' as 'home' | 'smarthome' | 'music',
  screensaverAfter: 300,
  /** Sprachassistent: Assist-Pipeline-ID aus HA (leer = bevorzugte Pipeline). Wake Word läuft in HA (openWakeWord). */
  assistPipeline: '',
  /** Name, der in der Sprechblase steht */
  assistName: 'Haus',
  /** Beim Start automatisch aufs Wake Word lauschen (Kiosk). Im Browser am Mac erst nach Antippen des Mikro-Buttons. */
  assistAutoStart: true,
}
