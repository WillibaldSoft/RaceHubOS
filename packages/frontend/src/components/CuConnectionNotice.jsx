import { tx, useExtensions } from '../i18n/extensions'
import { useEffect, useState } from 'react'
import { useDevice } from '../context/DeviceContext'

export default function CuConnectionNotice() {
  useExtensions()
  const { connected, socketConnected, deviceType, connectionState, diagnosis, loadStatus } = useDevice()
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (connected) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [connected])
  if (connected || deviceType === 'simulator') return null
  const waiting = diagnosis?.code === 'connecting' && now - diagnosis.updatedAt > 20000
  const data = waiting
    ? {
        title: tx('CU-Verbindungsaufbau dauert zu lange'),
        message: tx(
          'Die CU-Verbindung ist noch nicht vollständig bereit. Andere Carrera-Apps schließen. Bleibt der Zustand bestehen, CU mit AppConnect etwa fünf Sekunden aus- und wieder einschalten. RaceHubOS versucht die Verbindung weiter automatisch.'
        ),
      }
    : !socketConnected
      ? {
          title: tx('Verbindung zu RaceHubOS unterbrochen'),
          message: tx(
            'Der Browser verbindet sich automatisch erneut. Bleibt dieser Hinweis bestehen, prüfen, ob RaceHubOS auf diesem Rechner läuft. Ein CU-Neustart behebt keine fehlende Serververbindung.'
          ),
        }
      : diagnosis?.code && diagnosis.code !== 'live'
        ? diagnosis
        : {
            title: connectionState === 'stale' ? tx('CU-Daten sind veraltet') : tx('CU getrennt'),
            message: tx(
              'Verbindung und Tankdaten werden geprüft. Falls die CU bereits läuft, andere Carrera-Apps schließen. Bei anhaltendem Problem CU mit AppConnect etwa fünf Sekunden aus- und wieder einschalten.'
            ),
          }
  async function retry() {
    setChecking(true)
    setError('')
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/bluetooth/retry`, {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
      })
      const result = await response.json()
      if (!response.ok || !result.success)
        throw new Error(result.error || tx('Verbindungsprüfung konnte nicht gestartet werden.'))
      await loadStatus()
    } catch (e) {
      setError(e.message)
    } finally {
      setChecking(false)
    }
  }
  return (
    <section
      role="status"
      aria-live="polite"
      aria-label={tx('CU-Verbindungsdiagnose')}
      className="m-3 rounded-lg border border-amber-500 bg-amber-50 p-3 text-amber-950 dark:bg-amber-950 dark:text-amber-100"
    >
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <strong>{tx(data.title)}</strong>
        <button
          className="border rounded px-3 py-1 disabled:opacity-50"
          disabled={!socketConnected || checking || diagnosis?.code === 'connecting'}
          onClick={retry}
        >
          {checking ? tx('Prüfung wird gestartet …') : tx('Erneut prüfen')}
        </button>
      </div>
      <p className="text-sm mt-1">{tx(data.message)}</p>
      {socketConnected && diagnosis?.nextRetryAt && (
        <p className="text-xs mt-1">
          {tx('Automatischer Neuversuch geplant · Versuch')} {diagnosis.attempt || 1}
          {tx('. Nach dem CU-Neustart ist kein Neuladen des Browsers nötig.')}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm mt-1">
          {tx(error)}
        </p>
      )}
    </section>
  )
}
