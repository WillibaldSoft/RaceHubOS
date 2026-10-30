import { useEffect, useRef, useState } from 'react'
import { tx, useExtensions } from '../../i18n/extensions'
import {
  createRaceAudio,
  loadRaceSounds,
  normalizeRaceSounds,
  saveRaceSounds,
  soundActivity,
  soundKinds,
} from '../../lib/raceSounds.mjs'

export default function RaceSoundsSettings() {
  useExtensions()
  const [config, setConfig] = useState(() => normalizeRaceSounds(null))
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('')
  const [drivers, setDrivers] = useState(1),
    audio = useRef(null)
  useEffect(() => {
    let active = true
    audio.current = createRaceAudio()
    loadRaceSounds()
      .then((value) => {
        if (active) {
          setConfig(value)
          setReady(true)
        }
      })
      .catch((error) => {
        if (active) setMessage(tx(error.message))
      })
    return () => {
      active = false
      audio.current?.close()
    }
  }, [])
  function change(patch) {
    audio.current?.stop()
    setConfig(normalizeRaceSounds({ ...config, ...patch }))
    setMessage(tx('Ungespeicherte Änderungen'))
  }
  async function save() {
    setBusy(true)
    try {
      await saveRaceSounds(config)
      setMessage(tx('Renngeräusche gespeichert.'))
    } catch (error) {
      setMessage(tx(error.message))
    } finally {
      setBusy(false)
    }
  }
  const activity = soundActivity(config, drivers)
  return (
    <section className="rounded-xl border bg-card p-5 space-y-4" aria-label={tx('Renngeräusche')}>
      <h2 className="text-xl font-semibold">{tx('Renngeräusche')}</h2>
      <p className="text-sm text-muted-foreground">
        {tx(
          'Echte Tonaufnahmen: Zuschauer auf der Tribüne, Applaus, ein vorbeifahrender Formel-1-Wagen und ein Druckluft-Schlagschrauber. Nur während einer laufenden freien Sitzung mit aktiver CU; bei Pause und Stopp ist Ruhe. Ansagen haben Vorrang.'
        )}
      </p>
      <fieldset disabled={!ready || busy} className="space-y-4 disabled:opacity-50">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={config.enabled} onChange={(e) => change({ enabled: e.target.checked })} />
          {tx('Renngeräusche einschalten')}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={config.adaptive} onChange={(e) => change({ adaptive: e.target.checked })} />
          {tx('Automatisch weniger und leisere Zusatzgeräusche bei mehr Fahrern')}
        </label>
        <p className="text-xs text-muted-foreground">
          {tx(
            'Die Automatik zählt die zugewiesenen Fahrerregler der Sitzung. Ein Fahrer: volle Atmosphäre; sechs Fahrer: nur gelegentliche, leise Effekte.'
          )}
        </p>
        <div className="flex flex-wrap gap-6">
          {[
            ['volume', 'Lautstärke'],
            ['intensity', 'Häufigkeit'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              {tx(label)}
              <input
                aria-label={tx('Renngeräusche') + ': ' + tx(label)}
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={config[key]}
                onChange={(e) => change({ [key]: Number(e.target.value) })}
              />
              <span>{Math.round(config[key] * 100)} %</span>
            </label>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          {Object.entries(soundKinds).map(([key, label]) => (
            <div key={key} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={config[key]} onChange={(e) => change({ [key]: e.target.checked })} />
                {tx(label)}
              </label>
              <button
                type="button"
                className="rounded border px-3 py-1 disabled:opacity-50"
                disabled={!config.enabled || !config[key] || config.volume === 0}
                onClick={async () => {
                  await audio.current.unlock()
                  try {
                    await audio.current.play(key, activity.volume)
                  } catch (error) {
                    setMessage(tx(error.message))
                  }
                }}
              >
                {tx('Anhören')}
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {tx(
            'Der Schlagschrauber startet einmal pro Tankstopp, sobald der Tankstand in der Boxengasse steigt. Bei vollem Tank, Boxenausfahrt oder ausbleibendem Tankfortschritt verstummt er. Die Häufigkeit regelt nur die übrigen Geräusche.'
          )}
        </p>
        <div className="rounded-lg bg-muted/40 p-3 space-y-2">
          <label>
            {tx('Fahrerzahl für die Hörprobe')}{' '}
            <select
              className="rounded border bg-background p-1"
              value={drivers}
              onChange={(e) => {
                audio.current.stop()
                setDrivers(Number(e.target.value))
              }}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm">
            {tx('Effektlautstärke')}: {Math.round(activity.volume * 100)} % · {tx('Abstand zwischen Effekten')}:{' '}
            {config.intensity === 0 || !config.enabled ? tx('Aus') : `≈ ${Math.round(activity.delay / 1000)} s`}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="rounded bg-primary text-primary-foreground px-4 py-2" onClick={save}>
            {tx(busy ? 'Wird gespeichert …' : 'Renngeräusche speichern')}
          </button>
          <button type="button" className="rounded border px-4 py-2" onClick={() => audio.current.stop()}>
            {tx('Hörprobe stoppen')}
          </button>
        </div>
      </fieldset>
      <p className="text-xs text-muted-foreground">
        {tx('Tonaufnahmen')}:{' '}
        <a className="underline" href="https://freesound.org/people/LG/sounds/77669/" target="_blank" rel="noreferrer">
          BCR F1 Car 09 · LG
        </a>{' '}
        (
        <a className="underline" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
          CC BY 4.0
        </a>
        , {tx('gekürzt und Lautstärke angepasst')}); {tx('Zuschauer, Applaus und Werkzeug')}: FlatHill, Zeraora,
        sevenbsb (CC0).{' '}
        <a
          className="underline"
          href={`${import.meta.env.BASE_URL}sounds/racing/CREDITS.md`}
          target="_blank"
          rel="noreferrer"
        >
          {tx('Alle Audioquellen')}
        </a>
      </p>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </section>
  )
}
