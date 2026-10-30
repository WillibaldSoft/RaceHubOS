import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { readTrackPlan, traceTrackPlan } from '@racehubos/shared'
import { formatDecimal } from '../../lib/formatDecimal'

export const TrackLaneLengths = memo(function TrackLaneLengths({ track }) {
  const { t } = useTranslation('tracks')
  const info = useMemo(() => {
    const plan = readTrackPlan(track.layout)
    if (!plan?.pieces.length) return null
    const result = traceTrackPlan(plan)
    return {
      lengths: result.laneLengthsM,
      open: plan.freePlacement && !result.connectivity.closed,
      measured: !!plan.measuredLaneLengthsM,
    }
  }, [track.layout])
  const title = info
    ? t(info.open ? 'free.material' : info.measured ? 'editor.measured' : 'editor.calculated')
    : undefined
  return (
    <span
      data-testid={`track-lane-lengths-${track.id}`}
      className="block text-xs font-normal text-muted-foreground"
      title={title}
    >
      {[0, 1].map((i) => (
        <span key={i} className="block">
          {t('editor.lane', { number: i + 1 })}: {info ? `${formatDecimal(info.lengths[i])} m` : '—'}
        </span>
      ))}
    </span>
  )
})
