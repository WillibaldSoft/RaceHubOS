import { memo, useMemo } from 'react'
import { Route } from 'lucide-react'
import { readTrackPlan, trackFootprint } from '@racehubos/shared'
import { TrackPlanPreview } from './TrackPlanPreview'
import { getImgUrl } from '../../utils/image'

// Render the saved plan locally; no preview files or network service required.
export const TrackThumbnail = memo(function TrackThumbnail({ track, className = '' }) {
  const plan = useMemo(() => readTrackPlan(track?.layout), [track?.layout])
  const bounds = useMemo(() => (plan ? trackFootprint(plan) : null), [plan])
  return (
    <span
      data-testid={`track-thumbnail-${track.id}`}
      className={`inline-flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-slate-100 ${className}`}
      aria-hidden="true"
    >
      {bounds && bounds.width > 0 && bounds.depth > 0 ? (
        <svg
          className="size-full"
          viewBox={`${bounds.x - 80} ${bounds.y - 80} ${bounds.width + 160} ${bounds.depth + 160}`}
        >
          <TrackPlanPreview plan={plan} embedded />
        </svg>
      ) : track.img ? (
        <img src={getImgUrl(track.img)} alt="" className="size-full object-contain" />
      ) : (
        <Route className="size-6 text-slate-400" />
      )}
    </span>
  )
})
