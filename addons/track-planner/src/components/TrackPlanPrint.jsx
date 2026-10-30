import { pitlaneLegend } from '@core/components/tracks/pitlaneComponents'
import { BorderPartsList } from './TrackBorders'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { traceTrackPlan, rotateTrackPlan, TRACK_PARTS } from '@racehubos/shared'
import { TrackPlanPreview } from '@core/components/tracks/TrackPlanPreview'
import { trackPartAppearance } from '@core/components/tracks/trackPartAppearance'
import { labelTrackPart } from '@core/components/tracks/trackPartLabel'
import { Button } from '@core/components/ui/button'
export function TrackTypeLegend({ plan, visibleLevel = null }) {
  const segments = traceTrackPlan(plan).segments
  const pitParts =
    visibleLevel === null || segments[plan.pit.entry]?.level === visibleLevel ? pitlaneLegend(plan, segments) : []
  const { t } = useTranslation('tracks')
  const counts = plan.pieces
    .filter((p) => visibleLevel === null || p.level === visibleLevel)
    .reduce((map, p) => ((map[p.type] = (map[p.type] || 0) + 1), map), {})
  return (
    <ul data-testid="track-type-legend" className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {Object.entries(counts).map(([type, n]) => (
        <li key={type} className="flex items-center gap-1">
          <span
            style={{
              background: trackPartAppearance(type).color,
              display: 'inline-block',
              width: 12,
              height: 12,
              border: '1px solid #333',
            }}
          />
          {labelTrackPart(type)} × {n}
        </li>
      ))}
      {pitParts.map((p) => (
        <li key={p.kind} data-testid={`pit-legend-${p.kind}`} className="flex items-center gap-1">
          <span
            style={{
              background: p.color,
              display: 'inline-block',
              width: 12,
              height: 12,
              border: '1px solid #333',
            }}
          />
          {p.short} · {t(`pitParts.${p.kind}`)} · {p.article} × {p.count}
        </li>
      ))}
    </ul>
  )
}
export default function TrackPlanPrint({ plan, name }) {
  const { t } = useTranslation('tracks')
  const [open, setOpen] = useState(false),
    [view, setView] = useState('colors'),
    [format, setFormat] = useState('A4'),
    [orientation, setOrientation] = useState('landscape'),
    [rotation, setRotation] = useState('0')
  const levels = [...new Set(plan.pieces.map((p) => p.level))].sort(),
    data = traceTrackPlan(plan)
  const pages = view === 'levels' ? levels : [null]
  return (
    <>
      <Button
        type="button"
        variant="outline"
        data-testid="track-print-preview"
        disabled={!plan.pieces.length}
        onClick={() => setOpen(true)}
      >
        {t('print.open')}
      </Button>
      {open &&
        createPortal(
          <div
            className="track-print-portal fixed inset-0 z-[100] bg-white text-black overflow-auto p-5"
            role="dialog"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation()
                setOpen(false)
              }
            }}
            aria-modal="true"
            aria-label={t('print.open')}
            data-testid="track-print-dialog"
          >
            <style>{`@media print { @page {size:${format} ${orientation};margin:10mm} body > *:not(.track-print-portal){display:none!important} .track-print-portal{position:static!important;overflow:visible!important;padding:0!important;color:#000!important;background:#fff!important;display:block!important} .track-print-portal .print-tools{display:none!important} .track-print-page{break-after:page} .track-print-page:last-child{break-after:auto} .track-print-portal svg{width:100%!important;height:auto!important;max-height:${orientation === 'landscape' ? '145' : '215'}mm!important} .track-print-portal *{print-color-adjust:exact;-webkit-print-color-adjust:exact} }`}</style>
            <div className="print-tools flex flex-wrap gap-3 mb-4 items-center">
              <label>
                {t('print.view')}{' '}
                <select data-testid="track-print-view" value={view} onChange={(e) => setView(e.target.value)}>
                  {['overview', 'colors', 'assembly', 'levels'].map((k) => (
                    <option key={k} value={k}>
                      {t(`print.${k}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('print.paper')}{' '}
                <select value={format} onChange={(e) => setFormat(e.target.value)}>
                  {['A4', 'A3'].map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </label>
              <label>
                {t('print.orientation')}{' '}
                <select value={orientation} onChange={(e) => setOrientation(e.target.value)}>
                  {['landscape', 'portrait'].map((k) => (
                    <option key={k} value={k}>
                      {t(`print.${k}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('graph.rotation')}{' '}
                <select
                  data-testid="track-print-rotation"
                  value={rotation}
                  onChange={(e) => setRotation(e.target.value)}
                >
                  {['0', '90', '180', '270'].map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>{' '}
                °
              </label>
              <Button type="button" data-testid="track-print-now" onClick={() => window.print()}>
                {t('print.print')}
              </Button>
              <Button type="button" variant="outline" data-testid="track-print-close" onClick={() => setOpen(false)}>
                {t('print.close')}
              </Button>
              <p className="text-sm">{t('print.note')}</p>
            </div>
            {pages.map((level) => (
              <section key={level ?? 'all'} className="track-print-page space-y-3" data-testid="track-print-page">
                <h1 className="text-xl font-bold">
                  {name} · {t(`print.${view}`)}
                  {level !== null ? ` · ${t('editor.level')} ${level}` : ''}
                </h1>
                <p>
                  {t(plan.freePlacement && !data.connectivity.closed ? 'free.material' : 'editor.lanes')}:{' '}
                  {data.laneLengthsM.map((n) => n.toFixed(3)).join(' / ')} m · {t('editor.gap')}:{' '}
                  {plan.freePlacement && !data.connectivity.closed ? '—' : data.gapMm.toFixed(2)} mm ·{' '}
                  {plan.pieces.length} {t('room.parts')}
                </p>
                <TrackPlanPreview
                  plan={rotateTrackPlan(plan, Number(rotation))}
                  colorParts={view !== 'overview'}
                  labels={view === 'overview' ? 'none' : view === 'assembly' ? 'both' : 'types'}
                  visibleLevel={level}
                  light
                />
                <TrackTypeLegend plan={plan} visibleLevel={level} />
                <BorderPartsList plan={plan} visibleLevel={level} />
                {view === 'assembly' && (
                  <ol className="text-xs grid grid-cols-3 gap-x-4">
                    {plan.pieces.map((p, i) => (
                      <li key={i}>
                        {i + 1}. {labelTrackPart(p.type)} · {t('editor.level')} {p.level}
                      </li>
                    ))}
                  </ol>
                )}
                {plan.pieces.some((p) => TRACK_PARTS[p.type].approximateSlots) && (
                  <p className="text-xs">{t('catalogue.approximateSlots')}</p>
                )}
                <p className="text-xs">
                  {t('print.note')}
                  {plan.pit.enabled ? ` · ${t('editor.doublePit')}` : ''}
                </p>
              </section>
            ))}
          </div>,
          document.body
        )}
    </>
  )
}
