import { tx, useExtensions } from '../i18n/extensions'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { allNavItems, navLabel } from '../lib/navItems'
import { normalizeNavigation, originalNavigation } from '../lib/navigationAppearance.mjs'
import { loadNavigation, saveNavigation, symbols, NavigationSymbol } from './NavigationSymbols'

export default function NavigationSettings() {
  useExtensions()
  const { t } = useTranslation('layout')
  const [config, setConfig] = useState(() => normalizeNavigation(null))
  const [ready, setReady] = useState(false),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState(tx('Symbole werden geladen …'))
  useEffect(() => {
    const abort = new AbortController()
    loadNavigation(abort.signal)
      .then((value) => {
        setConfig(value)
        setMessage('')
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setMessage(error.message)
      })
      .finally(() => {
        if (!abort.signal.aborted) setReady(true)
      })
    return () => abort.abort()
  }, [])
  function change(path, patch) {
    setConfig((previous) => ({
      ...previous,
      original: false,
      items: { ...previous.items, [path]: { ...previous.items[path], ...patch } },
    }))
    setMessage(tx('Ungespeicherte Änderungen'))
  }
  async function reset() {
    const original = originalNavigation()
    setSaving(true)
    try {
      await saveNavigation(original)
      setConfig(original)
      setMessage(tx('Originalsymbole von Anselmes Erstinstallation wiederhergestellt und gespeichert.'))
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving(false)
    }
  }
  async function save() {
    setSaving(true)
    try {
      await saveNavigation(config)
      setMessage(tx('Navigationssymbole gespeichert. Die Seitenleiste ist aktualisiert.'))
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <section className="rounded-xl border bg-card p-5 space-y-4" aria-label={tx('Navigationssymbole anpassen')}>
      <h2 className="text-xl font-semibold">{tx('Navigationssymbole anpassen')}</h2>
      <p className="text-sm text-muted-foreground">
        {tx(
          'Wähle für jeden Menüpunkt ein farbiges Symbol oder ein Emoji. Gespeicherte Änderungen bleiben nach einem Neustart erhalten. Die Vorschau steht jeweils links neben dem Namen.'
        )}
      </p>
      <div className="flex flex-wrap items-center gap-6">
        <label>
          {tx('Symbolgröße')}{' '}
          <input
            aria-label={tx('Symbolgröße')}
            className="border rounded p-1 w-20 bg-background ml-2"
            type="number"
            min="16"
            max="32"
            value={config.size}
            disabled={!ready}
            onChange={(e) => {
              setConfig(normalizeNavigation({ ...config, original: false, size: Number(e.target.value) }))
              setMessage(tx('Ungespeicherte Änderungen'))
            }}
          />{' '}
          px
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.badges}
            disabled={!ready}
            onChange={(e) => {
              setConfig({ ...config, original: false, badges: e.target.checked })
              setMessage(tx('Ungespeicherte Änderungen'))
            }}
          />
          {tx('Farbige Hintergrundkacheln')}
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {allNavItems.map((item) => {
          const label = navLabel(t, item)
          return (
            <div key={item.to} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <NavigationSymbol path={item.to} config={config} />
                <span className="font-medium">{tx(label)}</span>
                {item.adminOnly && <small className="text-muted-foreground">Admin</small>}
              </div>
              <div className="flex gap-2 items-center">
                <label className="flex-1 min-w-0">
                  <span className="sr-only">
                    {tx('Symbol für')} {tx(label)}
                  </span>
                  <select
                    className="border rounded p-2 bg-background w-full"
                    aria-label={tx('Symbol für {{v0}}', { v0: label })}
                    disabled={!ready}
                    value={config.items[item.to].icon}
                    onChange={(e) => change(item.to, { icon: e.target.value })}
                  >
                    {Object.entries(symbols).map(([id, [, name]]) => (
                      <option key={id} value={id}>
                        {tx(name)}
                      </option>
                    ))}
                  </select>
                </label>
                <input
                  type="color"
                  aria-label={tx('Symbolfarbe für {{v0}}', { v0: label })}
                  title={tx('Symbolfarbe für {{v0}}', { v0: label })}
                  disabled={!ready}
                  value={config.items[item.to].color}
                  onInput={(e) => change(item.to, { color: e.target.value })}
                />
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {tx(
          'Bei Emojis bestimmt dein Browser die Motivfarben; die gewählte Farbe färbt deren Hintergrundkachel. Admin-Menüpunkte bleiben nur im Administratormodus sichtbar.'
        )}
      </p>
      <div className="flex gap-3 flex-wrap">
        <button
          type="button"
          className="rounded border px-4 py-2 disabled:opacity-50"
          disabled={!ready || saving}
          onClick={reset}
          title={tx('Originalsymbole von Anselmes Erstinstallation wiederherstellen')}
        >
          Reset
        </button>
        <button
          className="rounded bg-primary text-primary-foreground px-4 py-2 disabled:opacity-50"
          disabled={!ready || saving}
          onClick={save}
        >
          {saving ? tx('Wird gespeichert …') : tx('Navigationssymbole speichern')}
        </button>
        <button
          className="rounded border px-4 py-2"
          disabled={!ready}
          onClick={() => {
            setConfig(normalizeNavigation(null))
            setMessage(tx('Farbige Standardsymbole wiederhergestellt · noch nicht gespeichert'))
          }}
        >
          {tx('Farbige Standardsymbole wiederherstellen')}
        </button>
      </div>
      {message && (
        <p role="status" className="text-sm">
          {tx(message)}
        </p>
      )}
    </section>
  )
}
