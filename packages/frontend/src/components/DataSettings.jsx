import { tx, useExtensions, locale } from '../i18n/extensions'
import { useEffect, useState } from 'react'
const base = `${import.meta.env.VITE_API_URL || ''}/api/data`
async function request(route, body) {
  const response = await fetch(
    base + route,
    body instanceof FormData
      ? { method: 'POST', body }
      : body === undefined
        ? {}
        : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  )
  let data
  try {
    data = await response.json()
  } catch {
    throw new Error(tx('Keine gültige Antwort vom Datensicherungsdienst. Bitte Anwendung und Verbindung prüfen.'))
  }
  if (!response.ok || !data.success) throw new Error(tx(data.error || 'Vorgang fehlgeschlagen.'))
  return data
}
export default function DataSettings() {
  useExtensions()
  const [files, setFiles] = useState([]),
    [prepared, setPrepared] = useState(false)
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(() => {
      return sessionStorage.getItem('racehub:data-message') || ''
    })
  const [restorePreview, setRestorePreview] = useState(null),
    [restoreConfirm, setRestoreConfirm] = useState(false)
  const [cockpit, setCockpit] = useState(null),
    [cockpitPreview, setCockpitPreview] = useState(null),
    [cockpitConfirm, setCockpitConfirm] = useState(false)
  const [previous] = useState(() => sessionStorage.getItem('racehub:cockpit-backup') || '')
  const [options, setOptions] = useState({
    drivers: true,
    cars: true,
    tracks: true,
    technology: true,
    maintenance: true,
    history: true,
    includeInactive: false,
  })
  async function refresh() {
    const data = await request('/backups')
    setFiles(data.data)
  }
  useEffect(() => {
    sessionStorage.removeItem('racehub:data-message')
    refresh().catch((e) => setMessage(e.message))
    request('/cockpit/prepared')
      .then((data) => setPrepared(data.available))
      .catch(() => {})
  }, [])
  async function run(action) {
    setBusy(true)
    setMessage(tx('Bitte warten …'))
    try {
      await action()
    } catch (e) {
      sessionStorage.removeItem('racehub:data-message')
      setMessage(e.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="rounded-xl border bg-card p-5 space-y-5" aria-label={tx('Datensicherung und Datenübernahme')}>
      <h2 className="text-xl font-semibold">{tx('Datensicherung und Rücksicherung')}</h2>
      <p className="text-sm text-muted-foreground">
        {tx(
          'Sichert Fahrer, Autos, Strecken, Teams, Sitzungen, Runden, Einstellungen und hochgeladene Bilder. Eine lokale Kopie bleibt auf diesem Rechner; lade zusätzlich eine Datei für einen anderen Datenträger herunter. Programme, Node und Piper-Sprachmodelle sind nicht enthalten. Für Sicherung, Rücksicherung und Import zuerst alle Sitzungen beenden. Diese Funktionen sind lokal am Rennrechner über localhost verfügbar.'
        )}
      </p>
      <button
        className="rounded bg-primary text-primary-foreground px-4 py-2"
        disabled={busy}
        onClick={() =>
          run(async () => {
            await request('/backup', {})
            await refresh()
            setMessage(tx('Datensicherung erstellt. Über „Herunterladen“ auf einem weiteren Datenträger sichern.'))
          })
        }
      >
        {tx('Datensicherung erstellen')}
      </button>
      {files.length > 0 && (
        <details>
          <summary className="cursor-pointer">
            {tx('Vorhandene Sicherungen (')}
            {files.length})
          </summary>
          <ul className="mt-2 space-y-2 max-h-48 overflow-auto">
            {files.map((name) => (
              <li className="flex gap-3 flex-wrap text-sm" key={name}>
                <span>{name}</span>
                <a className="text-primary underline" href={`${base}/download/${encodeURIComponent(name)}`} download>
                  {tx('Herunterladen')}
                </a>
                <button
                  className="underline"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const response = await fetch(`${base}/download/${encodeURIComponent(name)}`)
                      if (!response.ok) throw new Error(tx('Sicherung nicht lesbar.'))
                      const backup = await response.json()
                      setRestoreConfirm(false)
                      setRestorePreview(await request('/restore/preview', { backup }))
                      setMessage(tx('Sicherung geprüft. Vorschau vor dem Ersetzen kontrollieren.'))
                    })
                  }
                >
                  {tx('Rücksicherung prüfen')}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="border-t pt-4 space-y-3">
        <h3 className="font-semibold">{tx('RaceHubOS-Sicherung zurückspielen')}</h3>
        <label className="block">
          {tx('Sicherungsdatei auswählen')}{' '}
          <input
            aria-label={tx('RaceHubOS-Sicherungsdatei')}
            type="file"
            accept=".json"
            disabled={busy}
            onChange={(e) =>
              run(async () => {
                const file = e.target.files?.[0]
                setRestorePreview(null)
                setRestoreConfirm(false)
                if (!file) return
                if (file.size > 50 * 1024 * 1024) throw new Error(tx('Sicherung größer als 50 MB.'))
                let backup
                try {
                  backup = JSON.parse(await file.text())
                } catch {
                  throw new Error(tx('Die Datei ist keine lesbare RaceHubOS-JSON-Sicherung.'))
                }
                setRestorePreview(await request('/restore/preview', { backup }))
                setMessage(tx('Sicherung geprüft. Bitte die Vorschau kontrollieren.'))
              })
            }
          />
        </label>
        {restorePreview && (
          <div className="rounded border p-3 space-y-3">
            <p>
              {tx('Sicherung vom')} {new Date(restorePreview.summary.createdAt).toLocaleString(locale())} ·{' '}
              {restorePreview.summary.images} {tx('Bilder')}
            </p>
            <p className="text-sm">
              {Object.entries(restorePreview.summary.counts)
                .filter(([key]) => ['Driver', 'Car', 'Track', 'Session', 'Lap', 'Preference'].includes(key))
                .map(
                  ([key, n]) =>
                    `${{ Driver: tx('Fahrer'), Car: tx('Autos'), Track: tx('Strecken'), Session: tx('Sitzungen'), Lap: tx('Runden'), Preference: tx('Einstellungen') }[key]}: ${n}`
                )
                .join(' · ')}
            </p>
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={restoreConfirm} onChange={(e) => setRestoreConfirm(e.target.checked)} />
              {tx(
                'Ich möchte den aktuellen RaceHubOS-Datenbestand einschließlich Bildern und Einstellungen durch diese Sicherung ersetzen.'
              )}
            </label>
            <p className="text-sm text-muted-foreground">
              {tx(
                'Vorher wird automatisch eine zusätzliche Sicherung des aktuellen Bestands erstellt. Ungültige oder inkompatible Dateien werden abgewiesen.'
              )}
            </p>
            <button
              className="rounded bg-red-700 text-white px-4 py-2"
              disabled={busy || !restoreConfirm}
              onClick={() =>
                run(async () => {
                  sessionStorage.setItem(
                    'racehub:data-message',
                    tx('Rücksicherung erfolgreich. Der vorherige Datenbestand ist als zusätzliche Sicherung vorhanden.')
                  )
                  await request('/restore', { id: restorePreview.id, confirmed: true })
                  window.location.reload()
                })
              }
            >
              {tx('Bestätigte Rücksicherung ausführen')}
            </button>
          </div>
        )}
      </div>
      <section aria-label={tx('Cockpit-XP-Daten übernehmen')} className="border-t pt-4 space-y-3">
        <h3 className="font-semibold">{tx('Cockpit-XP-Daten übernehmen')}</h3>
        <p className="text-sm text-muted-foreground">
          {tx(
            'Unterstützt Cockpit-XP-ZIP-Sicherungen mit Stammdaten und optionaler Statistikdatenbank. Übernimmt Bilder, Fahrzeugtechnik, Wartungsstände und sicher zuordenbare historische Statistiken gemeinsam. Historie bleibt getrennt gekennzeichnet; aktuelle Einstellungen und Ergebnisse bleiben erhalten. Keine Add-ons, Lizenzen oder Hardwareprofile.'
          )}
        </p>
        <div className="flex flex-wrap gap-4">
          {[
            ['drivers', tx('Fahrer')],
            ['cars', tx('Autos')],
            ['tracks', tx('Strecken')],
            ['technology', tx('Fahrzeugtechnik')],
            ['maintenance', tx('Wartungsstände')],
            ['history', tx('Historische Statistiken')],
            ['includeInactive', tx('Auch deaktivierte Einträge')],
          ].map(([key, label]) => (
            <label className="flex gap-2" key={key}>
              <input
                type="checkbox"
                disabled={busy}
                checked={options[key]}
                onChange={(e) => {
                  setOptions({ ...options, [key]: e.target.checked })
                  setCockpitPreview(null)
                  setCockpitConfirm(false)
                }}
              />
              {tx(label)}
            </label>
          ))}
        </div>
        <label className="block">
          {tx('Cockpit-XP-ZIP auswählen')}{' '}
          <input
            aria-label={tx('Cockpit-XP-Sicherungsdatei')}
            type="file"
            accept=".zip"
            disabled={busy}
            onChange={(e) => {
              setCockpit(e.target.files?.[0] || null)
              setCockpitPreview(null)
              setCockpitConfirm(false)
            }}
          />
        </label>
        <div className="flex gap-3 flex-wrap">
          <button
            className="border rounded px-3 py-2"
            disabled={busy || !cockpit}
            onClick={() =>
              run(async () => {
                if (cockpit.size > 180 * 1024 * 1024) throw new Error(tx('ZIP-Datei größer als 180 MB.'))
                const form = new FormData()
                form.append('file', cockpit)
                form.append('options', JSON.stringify(options))
                setCockpitPreview(await request('/cockpit/preview', form))
                setCockpitConfirm(false)
                setMessage(tx('Cockpit-XP-Vorschau erstellt. Noch keine Daten übernommen.'))
              })
            }
          >
            {tx('ZIP-Sicherung prüfen')}
          </button>
          {prepared && (
            <button
              className="border rounded px-3 py-2"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  setCockpitPreview(await request('/cockpit/prepared', { options }))
                  setCockpitConfirm(false)
                  setMessage(tx('Vorbereitete Sicherung geprüft. Noch keine Daten übernommen.'))
                })
              }
            >
              {tx('Vorbereitete Cockpit-XP-Sicherung prüfen')}
            </button>
          )}
        </div>
        {cockpitPreview && (
          <div className="border rounded p-3 space-y-3">
            <p className="font-semibold">
              {tx('Vorschau:')} {cockpitPreview.summary.source}
            </p>
            {[
              ['drivers', tx('Fahrer')],
              ['cars', tx('Autos')],
              ['tracks', tx('Strecken')],
            ].map(([key, label]) => (
              <p key={key}>
                <strong>
                  {tx(label)}: {cockpitPreview.summary.counts[key]}
                </strong>
                <span className="block text-sm">
                  {cockpitPreview.summary.examples[key].join(' · ') || tx('Keine neuen Einträge')}
                </span>
              </p>
            ))}
            <div className="text-sm space-y-1">
              <p>
                {tx('Fahrzeuge mit Technik-/Wartungsdaten')}: {cockpitPreview.summary.counts.technology}
              </p>
              <p>
                {tx('Neue historische Einträge')}: {cockpitPreview.summary.counts.history}
              </p>
              <p>
                {tx('Bereits importierte Statistik ausgelassen')}: {cockpitPreview.summary.history.duplicates}
              </p>
              <p>
                {tx('Leere Ergebniszeilen ausgelassen')}: {cockpitPreview.summary.history.empty}
              </p>
              <p>
                {tx('Nicht eindeutig zugeordnet')}: {cockpitPreview.summary.history.unresolved}
              </p>
              {cockpitPreview.summary.history.issues.length > 0 && (
                <details>
                  <summary>{tx('Zuordnungsprobleme anzeigen')}</summary>
                  <ul className="max-h-40 overflow-auto">
                    {cockpitPreview.summary.history.issues.map((row, i) => (
                      <li key={i}>
                        {row.name || row.sourceId} ·{' '}
                        {tx(
                          {
                            drivers: 'Fahrer',
                            cars: 'Autos',
                            tracks: 'Strecken',
                            StRennResults: 'Rennergebnisse',
                            StMoreRecords: 'Rekorde und Sektorwerte',
                            StRoundTime: 'Rundenzeiteinträge',
                            StRennCounter: 'Gesamtstände',
                            StWinnerItems: 'Rennen und Siege',
                          }[row.kind] || row.kind
                        )}{' '}
                        · {tx(row.reason === 'ambiguous' ? 'Mehrdeutige Zuordnung' : 'Keine sichere Zuordnung')}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
            <p className="text-sm">
              {tx('Bereits vorhanden/gleichnamig:')} {cockpitPreview.summary.skipped} {tx('· deaktiviert ausgelassen:')}{' '}
              {cockpitPreview.summary.inactive}
            </p>
            <p className="text-sm text-muted-foreground">
              {tx(
                'Bestehende Geschwindigkeit, Bremse, Tankwerte, Reifen und weitere Einstellungen bleiben erhalten. Neue Stammdaten erhalten Standardwerte. Technik wird mit Herkunft gespeichert; Motor und Übersetzung werden nur in leere Felder übernommen. Wartungsstände bleiben historische Stände. Der Import verändert keine Fahrzeuge auf der Bahn.'
              )}
            </p>
            <label className="flex gap-2">
              <input
                data-testid="cockpit-import-confirm"
                type="checkbox"
                checked={cockpitConfirm}
                onChange={(e) => setCockpitConfirm(e.target.checked)}
              />
              {tx(
                'Die aufgeführten Stammdaten und zugeordneten historischen Daten hinzufügen. Bestehende Einstellungen und Ergebnisse bleiben erhalten.'
              )}
            </label>
            <button
              className="rounded bg-primary text-primary-foreground px-4 py-2"
              disabled={busy || !cockpitConfirm || !Object.values(cockpitPreview.summary.counts).some((n) => n > 0)}
              onClick={() =>
                run(async () => {
                  sessionStorage.setItem(
                    'racehub:data-message',
                    tx(
                      'Cockpit-XP-Daten und gekennzeichnete Historie übernommen. Der vorherige RaceHubOS-Bestand ist zusätzlich gesichert.'
                    )
                  )
                  const result = await request('/cockpit/import', { id: cockpitPreview.id, confirmed: true })
                  sessionStorage.setItem('racehub:cockpit-backup', result.previous)
                  window.location.reload()
                })
              }
            >
              {tx('Bestätigte Datenübernahme ausführen')}
            </button>
          </div>
        )}
        {previous && (
          <a className="text-primary underline" href={`${base}/download/${encodeURIComponent(previous)}`} download>
            {tx('Sicherung vor dem Import herunterladen')}
          </a>
        )}
      </section>
      {message && <p role="status">{tx(message)}</p>}
    </section>
  )
}
