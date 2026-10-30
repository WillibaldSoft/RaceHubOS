import { SessionStatus } from '@racehubos/shared'
import { tx, useExtensions } from '../i18n/extensions'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useSession } from './SessionContext'
import { useDevice } from './DeviceContext'
import { useVoice } from './VoiceContext'
import { fuelTelemetry } from '../lib/fuelTelemetry.mjs'
import { normalizeAlerts, fuelWarning, interruptionReason } from '../lib/raceAlerts.mjs'

const Context = createContext(null)
const url = `${import.meta.env.VITE_API_URL || ''}/api/preferences/raceAlerts`
export async function loadAlerts() {
  const response = await fetch(url)
  const data = await response.json()
  if (!response.ok || !data.success) throw new Error(tx('Warneinstellungen konnten nicht geladen werden.'))
  return normalizeAlerts(data.data)
}
export async function saveAlerts(value) {
  const config = normalizeAlerts(value)
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: config }),
  })
  if (!response.ok || !(await response.json()).success)
    throw new Error(tx('Warneinstellungen konnten nicht gespeichert werden.'))
  window.dispatchEvent(new CustomEvent('race:alerts-saved', { detail: config }))
}
export function RaceAlertsProvider({ children }) {
  useExtensions()
  const { session, entries } = useSession(),
    device = useDevice(),
    { speak } = useVoice()
  const [config, setConfig] = useState(() => normalizeAlerts(null)),
    [ready, setReady] = useState(false)
  const [now, setNow] = useState(Date.now()),
    [demo, setDemo] = useState(null)
  const latches = useRef(new Map()),
    queue = useRef([]),
    lastSession = useRef(null),
    lastReason = useRef(null)
  const demoTimer = useRef(null)
  useEffect(() => {
    let active = true
    loadAlerts()
      .then((value) => {
        if (active) setConfig(value)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true)
      })
    const update = (event) => {
      setConfig(event.detail)
      queue.current = []
    }
    const test = (event) => {
      setDemo({ kind: event.detail.kind, config: normalizeAlerts(event.detail.config) })
      clearTimeout(demoTimer.current)
      demoTimer.current = setTimeout(() => setDemo(null), 8000)
      if (event.detail.kind === 'voice')
        speak(tx('Testansage: Testfahrer, Tank auf Reserve. Bitte tanken.'), { volume: event.detail.config.volume })
    }
    const timer = setInterval(() => setNow(Date.now()), 1000)
    window.addEventListener('race:alerts-saved', update)
    window.addEventListener('race:alerts-test', test)
    return () => {
      active = false
      clearInterval(timer)
      clearTimeout(demoTimer.current)
      window.removeEventListener('race:alerts-saved', update)
      window.removeEventListener('race:alerts-test', test)
    }
  }, [speak])
  const active = ['active', 'finishing'].includes(session?.status)
  const warnings =
    active && config.enabled
      ? entries
          .map((entry) => {
            const telemetry = fuelTelemetry({
              connected: device.connected,
              socketConnected: device.socketConnected,
              status: device.cuStatus,
              receivedAt: device.lastStatusAt,
              now: Math.max(now, device.lastStatusAt || 0),
              controller: entry.controller,
            })
            return {
              controller: entry.controller,
              name: entry.driver?.name || tx('Regler {{v0}}', { v0: entry.controller + 1 }),
              raw: telemetry.enabled ? telemetry.raw : null,
              kind: telemetry.raw === 0 ? 'empty' : 'reserve',
            }
          })
          .filter((w) => w.raw !== null && w.raw <= config.threshold)
      : []
  const reason = config.interruption ? interruptionReason(session, device) : null
  useEffect(() => {
    if (!ready) return
    if (lastSession.current !== session?.id) {
      lastSession.current = session?.id
      latches.current.clear()
      queue.current = []
      lastReason.current = null
    }
    if (!active || !config.enabled) queue.current = queue.current.filter((q) => q.reason)
    for (const warning of warnings) {
      const result = fuelWarning(latches.current.get(warning.controller), warning.raw, config.threshold)
      latches.current.set(warning.controller, result.state)
      for (const kind of result.events)
        if ((kind === 'empty' && config.emptyVoice) || (kind === 'reserve' && config.voice))
          queue.current.push({
            controller: warning.controller,
            kind,
            text: `${warning.name}: ${kind === 'empty' ? tx('Tank leer. Bitte sofort tanken.') : tx('Tank auf Reserve. Bitte tanken.')}`,
          })
    }
    // Refuelling rearms only with fresh CU data, never on a page change/disconnect.
    if (active && device.connected)
      for (const entry of entries) {
        const raw = device.cuStatus?.fuel?.[entry.controller]
        if (Number.isInteger(raw) && raw > config.threshold + 1)
          latches.current.set(
            entry.controller,
            fuelWarning(latches.current.get(entry.controller), raw, config.threshold).state
          )
      }
    if (reason?.key !== lastReason.current) {
      if (reason && config.interruptionVoice) queue.current.unshift({ reason: reason.key, text: tx(reason.title) })
      lastReason.current = reason?.key || null
    }
    queue.current = queue.current.filter((item) =>
      item.reason
        ? item.reason === reason?.key && config.interruptionVoice
        : active && warnings.some((w) => w.controller === item.controller && (item.kind !== 'empty' || w.raw === 0))
    )
    const next = queue.current[0]
    if (next && speak(next.text, { volume: config.volume })) queue.current.shift()
  }, [now, session?.id, session?.status, config, device.lastStatusAt, device.connectionState, ready])
  return (
    <Context.Provider value={{ config, warnings, reason, demo, dismissDemo: () => setDemo(null) }}>
      {children}
    </Context.Provider>
  )
}
export function useRaceAlerts() {
  return useContext(Context)
}

export function RaceAlertDisplay({ screen = false }) {
  useExtensions()
  const { config, warnings, reason, demo, dismissDemo } = useRaceAlerts()
  const { session, pauseSession, resumeSession } = useSession()
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const c = demo?.config || config
  const interruption =
    demo?.kind === 'interruption'
      ? {
          title: tx('TEST · Rennen unterbrochen'),
          text: tx('Beispielanzeige – keine Sitzung oder CU wurde verändert.'),
        }
      : reason
  const fuel =
    demo && ['reserve', 'empty', 'voice'].includes(demo.kind)
      ? [
          {
            controller: 0,
            name: tx('TEST · Testfahrer'),
            kind: demo.kind === 'empty' ? 'empty' : 'reserve',
            raw: demo.kind === 'empty' ? 0 : c.threshold,
          },
        ]
      : warnings
  if (!interruption && !fuel.length) return null
  async function action() {
    setBusy(true)
    setError('')
    const result =
      session?.status === SessionStatus.PAUSED ? await resumeSession(session.id) : await pauseSession(session.id)
    if (!result.success) setError(tx('Aktion fehlgeschlagen. Bitte Verbindung und Sitzung prüfen.'))
    setBusy(false)
  }
  return (
    <aside
      role="alert"
      aria-label={tx('Rennwarnungen')}
      style={{
        position: screen ? 'absolute' : 'relative',
        bottom: screen && !interruption ? '1%' : undefined,
        left: screen && !(interruption && c.overlay) ? '2%' : undefined,
        right: screen && !(interruption && c.overlay) ? '2%' : undefined,
        top: screen && interruption && !c.overlay ? '1%' : undefined,
        inset: screen && interruption && c.overlay ? '15% 8%' : undefined,
        zIndex: 50,
        background: '#101827f5',
        color: 'white',
        border: `3px solid ${interruption ? c.pauseColor : fuel.some((w) => w.kind === 'empty') ? c.emptyColor : c.color}`,
        borderRadius: 12,
        padding: screen ? '2%' : 12,
        fontSize: screen ? `clamp(20px, ${c.font / 19.2}cqw, 72px)` : Math.min(c.font, 28),
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      {interruption && (
        <>
          <strong style={{ color: c.pauseColor }}>{tx(interruption.title)}</strong>
          <p style={{ fontSize: '.6em', whiteSpace: 'normal' }}>{tx(interruption.text)}</p>
        </>
      )}
      {fuel.map((w) => (
        <div key={w.controller} style={{ color: w.kind === 'empty' ? c.emptyColor : c.color }}>
          {w.name} {tx('· Regler')} {w.controller + 1}:{' '}
          <strong>{w.kind === 'empty' ? tx('TANK LEER') : tx('TANKRESERVE')}</strong> ({w.raw}/15)
        </div>
      ))}
      {demo ? (
        <button className="underline text-base" onClick={dismissDemo}>
          {tx('Testanzeige schließen')}
        </button>
      ) : (
        interruption &&
        session?.id && (
          <button className="border rounded px-3 py-2 text-base" disabled={busy} onClick={action}>
            {busy
              ? tx('Bitte warten …')
              : session.status === SessionStatus.PAUSED
                ? tx('Fortsetzen vorbereiten')
                : tx('Sitzung pausieren')}
          </button>
        )
      )}
      {error && <p className="text-base">{tx(error)}</p>}
    </aside>
  )
}
