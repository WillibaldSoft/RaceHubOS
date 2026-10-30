import { RailRequirementsTable } from './RailRequirementsTable'
import { useTranslation } from 'react-i18next'
import { trackBounds, roomTrackArea, analyseCurveDynamics } from '@racehubos/shared'
import { TrackPlanPreview } from './TrackPlanPreview'
import TrackImageExport from './TrackImageExport'
export function RoomPlanPreview({ proposal, room, title }) {
  const { t } = useTranslation('tracks')
  const width = room.widthM * 1000,
    depth = room.depthM * 1000,
    edge = room.edgeM * 1000
  const driverY = depth - edge - room.driverDepthM * 1000
  const bounds = proposal.bounds
  const dx = edge + (width - 2 * edge - bounds.width) / 2 - bounds.x
  const dy = edge + (driverY - room.aisleM * 1000 - edge - bounds.depth) / 2 - bounds.y
  return (
    <svg
      data-testid="room-plan-preview"
      viewBox={`-100 -250 ${width + 200} ${depth + 400}`}
      className="w-full max-h-96 rounded bg-slate-950"
      role="img"
      aria-label={t('room.title')}
    >
      <rect width={width} height={depth} fill="#0f172a" stroke="#e2e8f0" strokeWidth="15" />
      <text x="40" y="-75" fill="white" fontSize="100">
        {title} · {room.widthM} × {room.depthM} m
      </text>
      <rect
        x={edge}
        y={driverY - room.aisleM * 1000}
        width={width - 2 * edge}
        height={room.aisleM * 1000}
        fill="#164e63"
      />
      <text x={edge + 20} y={driverY - 80} fill="white" fontSize="90">
        {t('room.aisleM')}: {room.aisleM} m
      </text>
      {Array.from({ length: room.drivers }, (_, i) => (
        <g key={i}>
          <rect
            x={edge + i * room.driverWidthM * 1000}
            y={driverY}
            width={room.driverWidthM * 1000}
            height={room.driverDepthM * 1000}
            fill="#14532d"
            stroke="#86efac"
            strokeWidth="8"
          />
          <text x={edge + i * room.driverWidthM * 1000 + 30} y={driverY + 150} fill="white" fontSize="90">
            {t('room.driver', { number: i + 1 })}
          </text>
        </g>
      ))}
      <g transform={`translate(${dx} ${dy})`}>
        <TrackPlanPreview plan={proposal.plan} embedded />
      </g>
    </svg>
  )
}

export function SavedRoomPlan({ plan, name }) {
  const { t } = useTranslation('tracks')
  if (!plan.roomPlan) return null
  const room = plan.roomPlan,
    bounds = trackBounds(plan)
  const available = roomTrackArea(room)
  const fits = bounds.width <= available.width && bounds.depth <= available.depth
  return (
    <details className="border rounded p-2" data-testid="saved-room-plan">
      <summary>
        {t('room.title')} · {room.widthM} × {room.depthM} m · {room.drivers} {t('room.driversShort')}
      </summary>
      {!fits && <p role="alert">{t('room.changed')}</p>}
      <TrackImageExport name={`${name}-Raumplan`}>
        <RoomPlanPreview proposal={{ bounds, plan }} room={room} title={name} />
      </TrackImageExport>
      <CurveDynamics plan={plan} />
      <RailRequirementsTable plan={plan} inventory={room.inventory} allowAdditionalParts={room.allowAdditionalParts} />
      <p className="text-xs">{t('room.note')}</p>
    </details>
  )
}

export function CurveDynamics({ plan }) {
  const { t } = useTranslation('tracks')
  const d = analyseCurveDynamics(plan)
  return (
    <div data-testid="curve-dynamics" className="text-sm">
      <p>
        {t('dynamics.result', {
          min: d.minRadiusMm ?? '—',
          max: d.maxRadiusMm ?? '—',
          reversals: d.directReversals,
          changes: d.radiusChanges,
          opening: d.openingTransitions,
          tightening: d.tighteningTransitions,
        })}
      </p>
      <p className="text-xs text-muted-foreground">{t('dynamics.note')}</p>
    </div>
  )
}
