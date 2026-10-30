import { useState } from 'react'
import { SPEED_SCALE_SOURCES } from '@racehubos/shared'
import { useTranslation } from 'react-i18next'
import { useFeatures } from './FeatureState'
import { Button } from '../components/ui/button'
export default function FeatureSettings() {
  const { t } = useTranslation('addons')
  const { planner, activate, refresh, speed, speedReady, saveSpeed, saveScaleSource } = useFeatures()
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  async function run(action) {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch {
      setError(t('saveError'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="rounded-xl border p-5 space-y-4" data-testid="addon-settings">
      <h2 className="font-bold text-lg">{t('title')}</h2>
      <p role="status">
        {t(
          planner.loading
            ? 'loading'
            : planner.error
              ? 'statusError'
              : !planner.installed
                ? 'notInstalled'
                : !planner.compatible
                  ? 'incompatible'
                  : planner.enabled
                    ? 'enabled'
                    : 'disabled'
        )}
      </p>
      <p className="text-sm text-muted-foreground">{t('installHelp')}</p>
      <div className="flex flex-wrap gap-3">
        <Button
          data-testid="toggle-planner-addon"
          disabled={busy || planner.loading || !planner.compatible}
          onClick={() => run(() => activate(!planner.enabled))}
        >
          {t(planner.enabled ? 'disable' : 'enable')}
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => run(refresh)}>
          {t('refresh')}
        </Button>
      </div>
      <h3 className="font-semibold">{t('speedTitle')}</h3>
      <p className="text-sm text-muted-foreground">{t('speedHelp')}</p>
      <div className="flex flex-wrap gap-4">
        <label>
          {t('speedMode')}{' '}
          <select
            data-testid="speed-mode"
            className="rounded border bg-background p-2"
            value={speed.mode}
            disabled={busy || !speedReady}
            onChange={(e) => run(() => saveSpeed({ ...speed, mode: e.target.value }))}
          >
            <option value="actual">{t('actual')}</option>
            <option value="scale">{t('scaled')}</option>
          </select>
        </label>
        <label>
          {t('scaleSource')}{' '}
          <select
            data-testid="speed-scale-source"
            className="rounded border bg-background p-2"
            value={speed.scaleSource}
            disabled={busy || !speedReady}
            onChange={(e) => run(() => saveScaleSource(e.target.value))}
          >
            <option value={SPEED_SCALE_SOURCES.CAR}>{t('scaleFromCar')}</option>
            <option value={SPEED_SCALE_SOURCES.GLOBAL}>{t('scaleFromGlobal')}</option>
          </select>
        </label>
        <label>
          {t('defaultScale')}{' '}
          <select
            data-testid="speed-default-scale"
            className="rounded border bg-background p-2"
            value={speed.defaultScale}
            disabled={busy || !speedReady}
            onChange={(e) => run(() => saveSpeed({ ...speed, defaultScale: e.target.value }))}
          >
            <option value="1:32">1:32</option>
            <option value="1:24">1:24</option>
          </select>
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
