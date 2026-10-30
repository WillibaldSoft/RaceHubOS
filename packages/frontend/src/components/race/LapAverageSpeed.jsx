import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { trackLapDistanceM, lapDisplaySpeed } from '@racehubos/shared'
import { formatDecimal } from '../../lib/formatDecimal'
import { useFeatures } from '../../addons/FeatureState'
export default function LapAverageSpeed({ track, lapTimeMs, lapNumber, carScale, compact = false }) {
  const { t } = useTranslation('addons')
  const { speed: settings, speedReady } = useFeatures()
  const length = useMemo(() => trackLapDistanceM(track), [track])
  const { speed, scale, scaled } = lapDisplaySpeed(length, lapTimeMs, carScale, settings)
  const value = speedReady ? speed : null
  const mode = t(scaled ? 'scaledLabel' : 'actualLabel', { scale })
  const explanation = length == null ? t('noLength') : t('speedExplanation', { length: formatDecimal(length), mode })
  return (
    <div
      data-testid="lap-average-speed"
      aria-label={t('lastLapSpeed')}
      title={explanation}
      className={compact ? '' : 'text-xs text-muted-foreground mt-1'}
      style={compact ? { fontSize: '.38em', lineHeight: 1.25 } : undefined}
    >
      <span>{compact ? 'Ø' : t('lastLapShort')} </span>
      <span className="font-mono tabular-nums">{value == null ? '—' : `≈ ${formatDecimal(value, 2)} km/h`}</span>
      <span> · {compact ? (scaled ? scale : t('actualShort')) : mode}</span>
      {!compact && lapNumber > 0 && <span> · {t('lap', { number: lapNumber })}</span>}
    </div>
  )
}
