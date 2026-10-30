import { tx, useExtensions } from '../i18n/extensions'
import { useEffect, useState } from 'react'
import {
  Home,
  BarChart3,
  Flag,
  Trophy,
  Clock,
  Map,
  Users,
  Users2,
  UserRound,
  Car,
  ChartNoAxesCombined,
  Scale,
  LayoutGrid,
  Terminal,
  Settings,
  Gauge,
  Route,
  Fuel,
  Wrench,
  Medal,
  Zap,
} from 'lucide-react'
import { allNavItems } from '../lib/navItems'
import { normalizeNavigation } from '../lib/navigationAppearance.mjs'

const url = `${import.meta.env.VITE_API_URL || ''}/api/preferences/navigationAppearance`
export const symbols = {
  users: [Users, 'Fahrergruppe'],
  home: [Home, 'Haus'],
  dashboard: [BarChart3, 'Übersicht'],
  flag: [Flag, 'Flagge'],
  trophy: [Trophy, 'Pokal'],
  clock: [Clock, 'Uhr'],
  map: [Map, 'Karte'],
  teams: [Users2, 'Team'],
  driver: [UserRound, 'Fahrer'],
  car: [Car, 'Auto'],
  stats: [ChartNoAxesCombined, 'Diagramm'],
  scale: [Scale, 'Waage'],
  grid: [LayoutGrid, 'Kacheln'],
  terminal: [Terminal, 'Konsole'],
  settings: [Settings, 'Zahnrad'],
  gauge: [Gauge, 'Tacho'],
  route: [Route, 'Strecke'],
  fuel: [Fuel, 'Zapfsäule'],
  wrench: [Wrench, 'Werkzeug'],
  medal: [Medal, 'Medaille'],
  zap: [Zap, 'Blitz'],
  emojiFlag: ['🏁', '🏁 Zielflagge'],
  emojiCar: ['🏎️', '🏎️ Rennwagen'],
  emojiTrophy: ['🏆', '🏆 Siegerpokal'],
  emojiClock: ['⏱️', '⏱️ Stoppuhr'],
  emojiMap: ['🗺️', '🗺️ Streckenkarte'],
  emojiTeam: ['👥', '👥 Team'],
  emojiDriver: ['👤', '👤 Fahrer'],
  emojiStats: ['📊', '📊 Statistik'],
  emojiSettings: ['⚙️', '⚙️ Einstellungen'],
  emojiFuel: ['⛽', '⛽ Tanken'],
}
export async function loadNavigation(signal) {
  const response = await fetch(url, { signal, cache: 'no-store' })
  if (!response.ok) throw new Error(tx('Navigationssymbole konnten nicht geladen werden.'))
  const data = await response.json()
  if (!data.success) throw new Error(tx('Navigationssymbole konnten nicht geladen werden.'))
  return normalizeNavigation(data.data)
}
export async function saveNavigation(config) {
  const value = normalizeNavigation(config)
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  })
  if (!response.ok || !(await response.json()).success)
    throw new Error(tx('Speichern fehlgeschlagen. Bitte erneut versuchen.'))
  window.dispatchEvent(new CustomEvent('navigation:appearance', { detail: value }))
  try {
    localStorage.setItem('racehub:navigation-updated', JSON.stringify({ at: Date.now(), value }))
  } catch {
    /* Focus refresh still works when storage is unavailable. */
  }
}
export function useNavigationAppearance() {
  const [config, setConfig] = useState(() => normalizeNavigation(null))
  useEffect(() => {
    const abort = new AbortController()
    let revision = 0
    const refresh = () => {
      const request = ++revision
      loadNavigation(abort.signal)
        .then((value) => {
          if (!abort.signal.aborted && request === revision) setConfig(value)
        })
        .catch(() => {})
    }
    const update = (event) => {
      revision++
      setConfig(normalizeNavigation(event.detail))
    }
    const visibility = () => {
      if (!document.hidden) refresh()
    }
    const storage = (event) => {
      if (event.key === 'racehub:navigation-updated') refresh()
    }
    window.addEventListener('navigation:appearance', update)
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', storage)
    document.addEventListener('visibilitychange', visibility)
    refresh()
    return () => {
      abort.abort()
      window.removeEventListener('navigation:appearance', update)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('storage', storage)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [])
  return config
}
export function NavigationSymbol({ path, config }) {
  useExtensions()
  if (config.original) {
    const OriginalIcon = allNavItems.find((item) => item.to === path)?.Icon
    return OriginalIcon ? (
      <OriginalIcon aria-hidden="true" data-navigation-symbol={path} className="size-4 shrink-0" />
    ) : null
  }
  const item = config.items[path]
  const [Icon] = symbols[item.icon]
  return (
    <span
      className="group-data-[collapsible=icon]:size-4! group-data-[collapsible=icon]:text-base! group-data-[collapsible=icon]:[&>svg]:size-4!"
      aria-hidden="true"
      data-navigation-symbol={path}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        width: config.size + 8,
        height: config.size + 8,
        borderRadius: 8,
        color: item.color,
        backgroundColor: config.badges ? item.color + '20' : 'transparent',
        fontSize: config.size,
        lineHeight: 1,
      }}
    >
      {typeof Icon === 'string' ? Icon : <Icon style={{ width: config.size, height: config.size }} strokeWidth={2.2} />}
    </span>
  )
}
