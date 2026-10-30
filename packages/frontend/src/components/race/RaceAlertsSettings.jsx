import { tx, useExtensions } from '../../i18n/extensions'
import { useEffect, useState } from 'react'
import { normalizeAlerts } from '../../lib/raceAlerts.mjs'
import { loadAlerts, saveAlerts } from '../../context/RaceAlertsContext'

export default function RaceAlertsSettings() {
  useExtensions()
  const [config, setConfig] = useState(() => normalizeAlerts(null)),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('')
  useEffect(() => {
    let active = true
    loadAlerts()
      .then((v) => {
        if (active) setConfig(v)
      })
      .catch((e) => {
        if (active) setMessage(e.message)
      })
      .finally(() => {
        if (active) setReady(true)
      })
    return () => {
      active = false
    }
  }, [])
  const change = (patch) => {
    setConfig(normalizeAlerts({ ...config, ...patch }))
    setMessage(tx('Ungespeicherte Änderungen'))
  }
  async function save() {
    setBusy(true)
    try {
      await saveAlerts(config)
      setMessage(tx('Tankwarnungen und Unterbrechungsanzeige gespeichert.'))
    } catch (e) {
      setMessage(e.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="rounded-xl border bg-card p-5 space-y-4" aria-label={tx('Tankwarnungen und Unterbrechungen')}>
      <h2 className="text-xl font-semibold">{tx('Tankwarnungen und Unterbrechungen')}</h2>
      <p className="text-sm text-muted-foreground">
        {tx(
          'Warnungen gelten für alle zugewiesenen Regler während einer laufenden Sitzung. Eine Reservewarnung und eine Leermeldung pro Tankzyklus; erneute Warnung erst nach Auftanken über Reserve + 1. Bei fehlenden CU-Daten keine Tankansage.'
        )}
      </p>
      <div className="grid md:grid-cols-2 gap-3">
        {[
          ['enabled', tx('Tankwarnungen anzeigen')],
          ['voice', tx('Tankreserve ansagen')],
          ['emptyVoice', tx('Leeren Tank ansagen')],
          ['interruption', tx('Unterbrechungen anzeigen')],
          ['interruptionVoice', tx('Unterbrechung ansagen')],
          ['overlay', tx('Unterbrechung groß vor den Rennwerten anzeigen')],
        ].map(([key, label]) => (
          <label key={key} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config[key]}
              disabled={!ready}
              onChange={(e) => change({ [key]: e.target.checked })}
            />
            {tx(label)}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-5 items-center">
        <label>
          {tx('Tankreserve ab')}{' '}
          <input
            aria-label={tx('Tankreserve ab')}
            className="border rounded p-1 bg-background w-20"
            type="number"
            min="1"
            max="14"
            disabled={!ready}
            value={config.threshold}
            onChange={(e) => change({ threshold: Number(e.target.value) })}
          />{' '}
          /15
        </label>
        <label>
          {tx('Lautstärke')}{' '}
          <input
            aria-label={tx('Warnlautstärke')}
            type="range"
            min="0"
            max="1"
            step="0.1"
            disabled={!ready}
            value={config.volume}
            onChange={(e) => change({ volume: Number(e.target.value) })}
          />
        </label>
        <label>
          {tx('Schriftgröße')}{' '}
          <input
            aria-label={tx('Warnschriftgröße')}
            className="border rounded p-1 bg-background w-20"
            type="number"
            min="18"
            max="72"
            disabled={!ready}
            value={config.font}
            onChange={(e) => change({ font: Number(e.target.value) })}
          />
        </label>
        {[
          ['color', tx('Reservefarbe')],
          ['emptyColor', tx('Leerfarbe')],
          ['pauseColor', tx('Unterbrechungsfarbe')],
        ].map(([key, label]) => (
          <label key={key} className="flex items-center gap-2">
            {tx(label)}
            <input
              aria-label={label}
              type="color"
              value={config[key]}
              onInput={(e) => change({ [key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {tx(
          'CU-Stopp und Verbindungsverlust werden deutlich gemeldet, halten die Sitzungszeit aber nicht automatisch an. „Sitzung pausieren“ verwendet die vorhandene Pausefunktion. „Fortsetzen vorbereiten“ aktiviert die CU-Startampel; das Rennen nicht blind automatisch fortsetzen.'
        )}
      </p>
      <div className="flex gap-3 flex-wrap">
        <button
          className="bg-primary text-primary-foreground rounded px-4 py-2"
          disabled={!ready || busy}
          onClick={save}
        >
          {tx('Warneinstellungen speichern')}
        </button>
        {[
          ['reserve', tx('Reserve testen')],
          ['empty', tx('Leermeldung testen')],
          ['interruption', tx('Unterbrechung testen')],
          ['voice', tx('Warnstimme testen')],
        ].map(([kind, label]) => (
          <button
            className="border rounded px-3 py-2"
            disabled={!ready}
            key={kind}
            onClick={() => window.dispatchEvent(new CustomEvent('race:alerts-test', { detail: { kind, config } }))}
          >
            {tx(label)}
          </button>
        ))}
      </div>
      {message && <p role="status">{tx(message)}</p>}
    </section>
  )
}
