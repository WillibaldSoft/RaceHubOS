import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { emptyTrackPlan, readTrackPlan, trackPlanFields } from '@racehubos/shared'
import TrackPlanEditor from './components/TrackPlanEditor'
import { Button } from '@core/components/ui/button'
export default function StandalonePlanner() {
  const { t, i18n } = useTranslation('addons')
  const [tracks, setTracks] = useState([]),
    [id, setId] = useState(''),
    [plan, setPlan] = useState(emptyTrackPlan),
    [name, setName] = useState(''),
    [opened, setOpened] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(''),
    [success, setSuccess] = useState('')
  async function load() {
    const r = await fetch('/api/tracks')
    if (!r.ok) throw new Error()
    const result = await r.json()
    setTracks(result.data)
  }
  useEffect(() => {
    queueMicrotask(() => load().catch(() => setError(t('loadError'))))
  }, [t])
  function choose(value) {
    setId(value)
    setError('')
    setSuccess('')
    const track = tracks.find((row) => row.id === value)
    setPlan(readTrackPlan(track?.layout) || emptyTrackPlan())
    setName(track?.name || '')
    setOpened(true)
  }
  async function save() {
    if (!name.trim() || !plan.pieces.length) {
      setError(t('standaloneMissing'))
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const r = await fetch(`/api/tracks${id ? '/' + id : ''}`, {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), ...trackPlanFields(plan) }),
      })
      if (!r.ok) throw new Error()
      const result = await r.json()
      setId(result.data.id)
      await load()
      setSuccess(t('standaloneSaved'))
    } catch {
      setError(t('saveError'))
    } finally {
      setSaving(false)
    }
  }
  return (
    <main>
      {opened ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <TrackPlanEditor
            value={plan}
            onChange={setPlan}
            trackName={name}
            onNameChange={setName}
            onImportNew={(newName) => {
              setId('')
              setName(newName)
            }}
            expanded
            onExpandedChange={() => {}}
            onCancel={() => setOpened(false)}
            saving={saving}
            statusError={error}
            statusSuccess={success}
          />
        </form>
      ) : (
        <section className="mx-auto max-w-3xl p-6 space-y-6" data-testid="standalone-home">
          <h1 className="text-2xl font-bold">{t('standaloneTitle')}</h1>
          <p>{t('standaloneHelp')}</p>
          <label>
            {t('language')}{' '}
            <select
              data-testid="standalone-language"
              className="rounded border bg-background p-2"
              value={i18n.resolvedLanguage}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
            >
              <option value="de">Deutsch</option>
              <option value="en">English</option>
              <option value="fr">Français</option>
            </select>
          </label>
          <div>
            <Button data-testid="standalone-new" onClick={() => choose('')}>
              {t('standaloneNew')}
            </Button>
          </div>
          <label className="block">
            {t('standaloneOpen')}{' '}
            <select
              data-testid="standalone-track"
              className="rounded border bg-background p-2 max-w-full"
              value=""
              onChange={(e) => choose(e.target.value)}
            >
              <option value="">—</option>
              {tracks.map((track) => (
                <option value={track.id} key={track.id}>
                  {track.name}
                </option>
              ))}
            </select>
          </label>
          {error && <p role="alert">{error}</p>}
        </section>
      )}
    </main>
  )
}
