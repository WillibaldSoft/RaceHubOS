import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { traceTrackPlan, lapDisplaySpeed } from '@racehubos/shared'
export function TrackPlanSummary({ plan }) {
  const { t } = useTranslation('tracks')
  const [seconds, setSeconds] = useState('10')
  const [mode, setMode] = useState('actual')
  const { t: addonText } = useTranslation('addons')
  const data = traceTrackPlan(plan)
  return (
    <div className="space-y-2 text-sm" data-testid="track-plan-summary">
      {plan.freePlacement && (
        <p data-testid="free-plan-summary">
          {t(data.connectivity.closed ? 'free.closed' : 'free.open', {
            count: data.connectivity.openPorts.length,
            ambiguous: data.connectivity.ambiguousPorts,
            components: data.connectivity.components,
          })}
        </p>
      )}
      <p>
        {t(plan.freePlacement && !data.connectivity.closed ? 'free.material' : 'editor.lanes')}:{' '}
        <strong>{data.laneLengthsM.map((n) => n.toFixed(3)).join(' / ')} m</strong> ·{' '}
        {t(plan.measuredLaneLengthsM ? 'editor.measured' : 'editor.calculated')}
      </p>
      <p>
        {t('editor.gap')}: {plan.freePlacement && !data.connectivity.closed ? '—' : data.gapMm.toFixed(2)} mm ·{' '}
        {data.headingErrorDegrees.toFixed(2)}°
      </p>
      <label className="flex items-center gap-2">
        {t('editor.lapSeconds')}
        <input
          className="border rounded p-1 w-24"
          type="number"
          min="0.001"
          step="0.001"
          value={seconds}
          onChange={(e) => setSeconds(e.target.value)}
        />
      </label>
      <label>
        {addonText('speedMode')}{' '}
        <select
          data-testid="planner-speed-mode"
          className="rounded border bg-background p-1"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="actual">{addonText('actual')}</option>
          <option value="1:32">1:32</option>
          <option value="1:24">1:24</option>
        </select>
      </label>
      {(!plan.freePlacement || data.connectivity.closed) && (
        <p data-testid="planner-speed-result">
          {t('editor.speed')}:{' '}
          {data.laneLengthsM
            .map(
              (n) =>
                lapDisplaySpeed(n, Number(seconds) * 1000, mode, {
                  mode: mode === 'actual' ? 'actual' : 'scale',
                  defaultScale: '1:32',
                }).speed?.toFixed(2) ?? '—'
            )
            .join(' / ')}{' '}
          km/h · {mode === 'actual' ? addonText('actualLabel') : addonText('scaledLabel', { scale: mode })}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t('editor.speedNote')}</p>
    </div>
  )
}
