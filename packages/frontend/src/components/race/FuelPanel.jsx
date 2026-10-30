import { useTranslation } from 'react-i18next'
import { Fuel, Warehouse } from 'lucide-react'

export default function FuelPanel({ telemetry, driverName }) {
  const { t } = useTranslation('race')
  const { available, raw, low, fresh, mode, inPit, pitAvailable } = telemetry
  const color = !available ? 'bg-muted' : low ? 'bg-red-500' : 'bg-emerald-500'
  return (
    <section aria-label={t('fuel.title')} className="rounded-xl border bg-card text-card-foreground p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Fuel className="size-5" />
          {t('fuel.title')}
        </h2>
        <span className="text-sm">{driverName}</span>
      </div>
      <div className="flex items-center gap-4">
        <div
          role="progressbar"
          aria-label={t('fuel.level')}
          aria-valuemin={0}
          aria-valuemax={15}
          aria-valuenow={available ? raw : undefined}
          aria-valuetext={available ? t('fuel.value', { value: raw }) : t('fuel.noData')}
          className="h-7 flex-1 overflow-hidden rounded-full bg-muted"
        >
          <div
            className={`h-full transition-all duration-300 ${color}`}
            style={{ width: available ? `${(raw / 15) * 100}%` : '0%' }}
          />
        </div>
        <strong className="text-2xl tabular-nums">{available ? `${raw}/15` : '—'}</strong>
      </div>
      <p className="text-xs text-muted-foreground">{t('fuel.scale')}</p>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <span>{t('fuel.mode', { mode: t(`fuel.modes.${mode}`) })}</span>
        <span className="flex items-center gap-1">
          <Warehouse className="size-4" />
          {!fresh ? t('fuel.noData') : !pitAvailable ? t('fuel.noPit') : inPit ? t('fuel.inPit') : t('fuel.onTrack')}
        </span>
      </div>
      {!fresh && (
        <p role="status" className="text-amber-600">
          {t('fuel.stale')}
        </p>
      )}
      {fresh && !pitAvailable && (
        <p role="status" className="text-amber-600">
          {t('fuel.noPit')}
        </p>
      )}
      {fresh && mode === 'off' && (
        <p role="status" className="text-amber-600">
          {t('fuel.switchOn')}
        </p>
      )}
      {mode === 'real' && (
        <p role="status" className="text-amber-600">
          {t('fuel.useOn')}
        </p>
      )}
      {low && (
        <p role="status" className="font-semibold text-red-600">
          {raw === 0 ? t('fuel.empty') : t('fuel.low')}
        </p>
      )}
      {inPit && <p className="text-sm">{t('fuel.refuel')}</p>}
    </section>
  )
}
