import { PitSwitchDetail } from './PitSwitchDetail'
import { pitlaneComponents } from './pitlaneComponents'
import { RailSlotPaths } from './RailSlotPaths'
import { UnitDetails, FuelDetail } from './TrackUnitDetails'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import {
  traceTrackPlan,
  borderShapes,
  trackFootprint,
  softyExtraGeometry,
  extraWorldPose,
  switchGuidePaths,
  nativeFuelBayIndices,
  trackDrawItems,
} from '@racehubos/shared'
import { trackPartAppearance } from './trackPartAppearance'
import { labelTrackPart } from './trackPartLabel'
const line = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(3)} ${y.toFixed(3)}`).join(' ')

export function TrackPlanPreview({
  plan,
  selected = -1,
  selectedIndices = [],
  onSelect,
  embedded = false,
  colorParts = false,
  labels = 'none',
  visibleLevel = null,
  light = false,
  connector,
  onConnect,
  realistic = true,
  selectedPitPart = null,
  onSelectPitPart,
  onSelectBorder,
}) {
  const { t } = useTranslation('tracks')
  const materialId = useId().replaceAll(':', '')
  const { segments } = traceTrackPlan(plan)
  const components = pitlaneComponents(plan, segments)
  const shoulders = borderShapes(plan, segments)
  const fuelIndices = nativeFuelBayIndices(plan, segments)
  const entry = segments[plan.pit.entry]?.start,
    merge = segments[plan.pit.merge]?.end
  const pit = plan.pit
  const all = segments.flatMap((s) => s.points[0])
  if (pit.enabled && !pit.native && entry) {
    ;[
      [0, 49.5],
      [345, 148.5],
      [345 + pit.spacingMm, 247.5],
      [345 + pit.spacingMm + pit.bayLengthMm, 247.5],
    ].forEach(([u, v]) =>
      all.push([
        entry.x + Math.cos(entry.h) * u - Math.sin(entry.h) * v,
        entry.y + Math.sin(entry.h) * u + Math.cos(entry.h) * v,
      ])
    )
  }
  if (!all.length && embedded) return null
  if (!all.length) return <p className="text-sm text-muted-foreground">{t('editor.empty')}</p>
  const xs = all.map((p) => p[0]),
    ys = all.map((p) => p[1])
  const margin = 180
  const xmin = xs.reduce((a, b) => Math.min(a, b), Infinity),
    xmax = xs.reduce((a, b) => Math.max(a, b), -Infinity)
  const ymin = ys.reduce((a, b) => Math.min(a, b), Infinity),
    ymax = ys.reduce((a, b) => Math.max(a, b), -Infinity)
  const footprint = trackFootprint(plan),
    left = Math.min(xmin - margin, footprint.x - 50),
    top = Math.min(ymin - margin, footprint.y - 50)
  const box = [
    left,
    top,
    Math.max(xmax + margin, footprint.x + footprint.width + 50) - left,
    Math.max(ymax + margin, footprint.y + footprint.depth + 50) - top,
  ]
  const drawItems = trackDrawItems(plan, segments, shoulders)
  const schematicDrawing = (
    <>
      {pit.enabled && !pit.native && entry && merge && (visibleLevel === null || visibleLevel === 0) && (
        <g transform={`translate(${entry.x} ${entry.y}) rotate(${(entry.h * 180) / Math.PI}) scale(1 -1)`}>
          {/* Schematic double box: one feeder, split, two parallel bays, merge, one exit. */}
          {(() => {
            const dx = merge.x - entry.x,
              dy = merge.y - entry.y
            const ex = dx * Math.cos(entry.h) + dy * Math.sin(entry.h),
              ey = dx * Math.sin(entry.h) - dy * Math.cos(entry.h)
            const split = 345 + pit.spacingMm,
              end = split + pit.bayLengthMm
            const transition = Math.min(345, pit.bayLengthMm / 3)
            const common = `M0 -49.5 C115 -49.5 230 -148.5 345 -148.5 L${split} -148.5`
            const paths = [
              common,
              `M${split} -148.5 L${end} -148.5`,
              `M${split} -148.5 C${split + transition / 3} -148.5 ${split + (transition * 2) / 3} -247.5 ${split + transition} -247.5 L${end - transition} -247.5 C${end - (transition * 2) / 3} -247.5 ${end - transition / 3} -148.5 ${end} -148.5`,
              `M${end} -148.5 L${Math.max(end, ex - 345)} -148.5 C${ex - 230} -148.5 ${ex - 115} ${ey - 49.5} ${ex} ${ey - 49.5}`,
            ]
            const stages = [
              [0, 345, -49.5, -148.5, 'entrySwitch'],
              [split, split + transition, -148.5, -247.5, 'secondSwitch'],
              [end - transition, end, -247.5, -148.5, 'mergeBays'],
              [ex - 345, ex, -148.5, ey - 49.5, 'sharedExit'],
            ]
            return (
              <>
                {paths.map((d, i) => (
                  <g key={i}>
                    {realistic && <path d={d} fill="none" stroke="#111315" strokeWidth="106" />}
                    <path
                      d={d}
                      fill="none"
                      stroke={realistic ? `url(#${materialId}-surface)` : '#475569'}
                      strokeWidth="99"
                    />
                  </g>
                ))}
                {stages.map(([a, b, from, to, key]) => (
                  <g
                    key={key}
                    data-testid={`pit-${key}`}
                    data-switch-kind={['entrySwitch', 'secondSwitch'].includes(key) ? 'active-entry' : 'passive-merge'}
                  >
                    <title>{t(`editor.${key}`)}</title>
                    <path
                      d={`M${a} ${from - 49.5} v99 M${b} ${to - 49.5} v99`}
                      stroke="#94a3b8"
                      strokeWidth="3"
                      fill="none"
                    />
                    {['entrySwitch', 'secondSwitch'].includes(key) && (
                      <g data-testid={`active-${key}`} data-switch-kind="active-entry">
                        <path d={`M${a + 25} ${from} l35 -7v14z`} fill="#c0c6cb" stroke="#161a1e" strokeWidth="2" />
                        <rect
                          x={a + 65}
                          y={from + 14}
                          width="16"
                          height="12"
                          rx="3"
                          fill="#15191e"
                          stroke="#747c83"
                          strokeWidth="1.5"
                        />
                      </g>
                    )}
                  </g>
                ))}
                {[148.5, 247.5].map((offset, i) => (
                  <g key={offset} data-testid={`pit-bay-${i + 1}`}>
                    <title>{t('editor.lane', { number: i + 1 })} · FUEL · 30361</title>
                    <g transform="scale(1 -1)">
                      <FuelDetail
                        pose={{ xMm: split + pit.bayLengthMm / 2, yMm: offset, headingDegrees: 0 }}
                        index={`bay-${i}`}
                        article="30361"
                      />
                    </g>
                  </g>
                ))}
                <RailSlotPaths paths={paths} materialId={materialId} realistic={realistic} kind="pit-schematic" />
              </>
            )
          })()}
        </g>
      )}

      {!pit.native &&
        (visibleLevel === null || visibleLevel === 0) &&
        components
          .filter((p) => p.extraIndex === undefined)
          .map((part, i) => (
            <g
              key={part.id}
              data-testid={`schematic-component-${part.id}`}
              data-pit-part-id={part.id}
              role={onSelectPitPart ? 'button' : undefined}
              tabIndex={onSelectPitPart ? 0 : undefined}
              aria-label={`${t(`pitParts.${part.kind}`)} · ${part.article}`}
              onClick={(e) => {
                e.stopPropagation()
                onSelectPitPart?.(part.id, e)
              }}
              onKeyDown={(e) => {
                if (['Enter', ' '].includes(e.key)) {
                  e.preventDefault()
                  e.stopPropagation()
                  onSelectPitPart?.(part.id, e)
                }
              }}
            >
              <g transform={`translate(${part.pose.xMm} ${part.pose.yMm}) rotate(${part.pose.headingDegrees})`}>
                <rect
                  x="-172.5"
                  y="-49.5"
                  width="345"
                  height="99"
                  fill={colorParts ? part.color : 'transparent'}
                  fillOpacity={colorParts ? 0.2 : 1}
                  stroke={
                    part.id === selectedPitPart || selectedIndices.includes(part.anchor) ? '#eab308' : 'transparent'
                  }
                  strokeWidth="8"
                  pointerEvents={onSelectPitPart ? 'all' : 'none'}
                />
              </g>
              {labels !== 'none' && (
                <text
                  data-testid={`pit-component-label-${part.id}`}
                  x={part.pose.xMm}
                  y={part.pose.yMm}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  stroke="#0f172a"
                  strokeWidth="6"
                  paintOrder="stroke"
                  fontSize="30"
                  fontWeight="bold"
                  pointerEvents="none"
                >
                  {labels === 'numbers' ? `P${i + 1}` : `${labels === 'both' ? `P${i + 1} · ` : ''}${part.short}`}
                </text>
              )}
            </g>
          ))}
    </>
  )
  const drawing = (
    <>
      <defs>
        <pattern
          id={`${materialId}-border`}
          width="90"
          height="90"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(35)"
        >
          <rect width="90" height="90" fill="#f8fafc" />
          <rect width="45" height="90" fill="#dc2626" />
        </pattern>
        <pattern id={`${materialId}-surface`} width="13" height="13" patternUnits="userSpaceOnUse">
          <rect width="13" height="13" fill="#292b2e" />
          <circle cx="2" cy="4" r=".8" fill="#55585b" />
          <circle cx="10" cy="9" r="1" fill="#151719" />
          <path d="M0 12H13" stroke="#34373a" strokeWidth=".5" />
        </pattern>
        <linearGradient
          id={`${materialId}-metal`}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2="8"
          y2="8"
          spreadMethod="reflect"
        >
          <stop offset="0" stopColor="#6b7278" />
          <stop offset=".3" stopColor="#f3f4f6" />
          <stop offset=".6" stopColor="#8b9299" />
          <stop offset="1" stopColor="#dce1e5" />
        </linearGradient>
      </defs>
      {drawItems
        .filter((s) => visibleLevel === null || s.level === visibleLevel)
        .map((s) =>
          s.drawKind === 'shadow' ? (
            <path
              key={`shadow-${s.index}`}
              d={line(s.points[0])}
              fill="none"
              stroke="#020617"
              strokeWidth="245"
              pointerEvents="none"
            />
          ) : s.drawKind === 'schematic' ? (
            <g key="schematic-pit" data-testid="schematic-pit-drawing" data-draw-layer={s.level + s.drawLayer}>
              {schematicDrawing}
            </g>
          ) : s.drawKind === 'border' ? (
            <path
              key={`border-${s.index}-${s.side}-${s.kind}`}
              data-testid={`border-shape-${s.index}-${s.side}-${s.kind}`}
              data-rail-index={s.index}
              data-border-side={s.side}
              data-draw-layer={s.level + s.drawLayer}
              d={`${line(s.points)} Z`}
              fill={`url(#${materialId}-border)`}
              stroke="#64748b"
              strokeWidth="2"
              onClick={(e) => {
                e.stopPropagation()
                onSelectBorder?.(s.index, s.side, e)
              }}
            >
              <title>
                {s.article} · {t(`borders.${s.side}`)}
              </title>
            </path>
          ) : s.extra ? (
            (() => {
              const g = softyExtraGeometry(s, segments),
                part = components.find((p) => p.extraIndex === s.extraIndex)
              return (
                <g
                  key={`extra-${s.extraIndex}`}
                  data-testid={`native-extra-${s.extraIndex}`}
                  data-pit-part-id={part?.id}
                  role={part && onSelectPitPart ? 'button' : undefined}
                  tabIndex={part && onSelectPitPart ? 0 : undefined}
                  aria-label={part ? `${t(`pitParts.${part.kind}`)} · ${part.article}` : undefined}
                  onKeyDown={(e) => {
                    if (part && onSelectPitPart && ['Enter', ' '].includes(e.key)) {
                      e.preventDefault()
                      e.stopPropagation()
                      onSelectPitPart(part.id, e)
                    }
                  }}
                  data-switch-kind={
                    s.kind === 'pitEntry' ? 'active-entry' : s.kind === 'pitExit' ? 'passive-merge' : undefined
                  }
                  data-native-kind={s.kind}
                  data-draw-layer={s.level + s.drawLayer}
                  data-part-article={fuelIndices.includes(s.extraIndex) ? '30361' : g.article}
                  data-rail-index={s.anchor}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (part && onSelectPitPart) onSelectPitPart(part.id, e)
                    else if (s.anchor !== undefined) onSelect?.(s.anchor, e)
                  }}
                >
                  <title>{fuelIndices.includes(s.extraIndex) ? '30361 · FUEL' : `${g.article} · ${s.kind}`}</title>
                  <path
                    d={`${line(g.polygon)} Z`}
                    fill={
                      g.border
                        ? `url(#${materialId}-border)`
                        : colorParts && part
                          ? part.color
                          : realistic
                            ? `url(#${materialId}-surface)`
                            : '#374151'
                    }
                    stroke={
                      part?.id === selectedPitPart ||
                      (part?.anchor !== undefined && selectedIndices.includes(part.anchor))
                        ? '#eab308'
                        : '#64748b'
                    }
                    strokeWidth={
                      part?.id === selectedPitPart ||
                      (part?.anchor !== undefined && selectedIndices.includes(part.anchor))
                        ? 10
                        : 2
                    }
                  />
                  {fuelIndices.includes(s.extraIndex) && (
                    <FuelDetail pose={extraWorldPose(s, segments)} index={s.extraIndex} article="30361" />
                  )}
                  <RailSlotPaths
                    paths={g.slots.map(line)}
                    materialId={materialId}
                    realistic={realistic}
                    kind="pit-native"
                  />
                  {['pitEntry', 'pitExit'].includes(s.kind) && (
                    <g data-testid={s.kind === 'pitEntry' ? `pit-tongue-${s.extraIndex}` : undefined}>
                      <PitSwitchDetail
                        entry={s.kind === 'pitEntry'}
                        pose={g.pose}
                        materialId={materialId}
                        realistic={realistic}
                        native
                      />
                    </g>
                  )}
                  {part && !g.border && labels !== 'none' && (
                    <text
                      data-testid={`pit-component-label-${part.id}`}
                      x={part.pose.xMm}
                      y={part.pose.yMm}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      stroke="#0f172a"
                      strokeWidth="6"
                      paintOrder="stroke"
                      fontSize="30"
                      fontWeight="bold"
                      pointerEvents="none"
                    >
                      {labels === 'numbers'
                        ? `P${components.indexOf(part) + 1}`
                        : `${labels === 'both' ? `P${components.indexOf(part) + 1} · ` : ''}${part.short}`}
                    </text>
                  )}
                </g>
              )
            })()
          ) : (
            <g
              key={s.index}
              data-testid={`rail-${s.index}`}
              data-draw-layer={s.level + s.drawLayer}
              data-rail-index={s.index}
              tabIndex={onSelect ? 0 : undefined}
              role={onSelect ? 'button' : undefined}
              aria-label={`${s.index + 1}: ${labelTrackPart(s.type)}`}
              aria-pressed={onSelect ? s.index === selected || selectedIndices.includes(s.index) : undefined}
              onKeyDown={(e) => {
                if (onSelect && ['Enter', ' '].includes(e.key)) {
                  e.preventDefault()
                  onSelect(s.index, e)
                }
              }}
              onClick={(e) => {
                e.stopPropagation()
                onSelect?.(s.index, e)
              }}
              style={{ cursor: onSelect ? 'pointer' : 'default' }}
            >
              <title>
                {s.index + 1}: {labelTrackPart(s.type)} · {t('editor.level')} {s.level}
              </title>
              {(s.index === selected || selectedIndices.includes(s.index)) && (
                <path d={line(s.points[0])} fill="none" stroke="#facc15" strokeWidth="228" />
              )}
              {s.roadOutline ? (
                <path
                  data-testid={`special-road-${s.index}`}
                  d={`${line(s.roadOutline)} Z`}
                  fill={
                    colorParts
                      ? trackPartAppearance(s.type).color
                      : realistic
                        ? `url(#${materialId}-surface)`
                        : '#374151'
                  }
                  stroke="#111315"
                  strokeWidth="3"
                />
              ) : (
                <>
                  {realistic && <path d={line(s.points[0])} fill="none" stroke="#111315" strokeWidth="204" />}
                  <path
                    d={line(s.points[0])}
                    fill="none"
                    stroke={
                      colorParts
                        ? trackPartAppearance(s.type).color
                        : realistic
                          ? `url(#${materialId}-surface)`
                          : '#374151'
                    }
                    strokeWidth="198"
                  />
                </>
              )}
              {!s.special && (
                <path d={line(s.points[0])} fill="none" stroke="#cbd5e1" strokeWidth="3" strokeDasharray="30 25" />
              )}
              {s.special && (
                <g clipPath={`url(#${materialId}-special-${s.index})`}>
                  <defs>
                    <clipPath id={`${materialId}-special-${s.index}`}>
                      <path d={`${line(s.roadOutline)} Z`} />
                    </clipPath>
                  </defs>
                  {Array.from({ length: s.modules - 1 }, (_, i) => {
                    const u = (i + 1) * 345,
                      c = Math.cos(s.start.h),
                      n = Math.sin(s.start.h)
                    return (
                      <path
                        key={i}
                        data-testid={`special-seam-${s.index}-${i}`}
                        d={`M${s.start.x + c * u + n * 99} ${s.start.y + n * u - c * 99} l${-n * 198} ${c * 198}`}
                        stroke="#717b85"
                        strokeWidth="2"
                      />
                    )
                  })}
                </g>
              )}
              {s.approximateSlots && <title>{t('catalogue.approximateSlots')}</title>}
              <UnitDetails segment={s} realistic={realistic} />
              <RailSlotPaths
                paths={[1, 2].map((n) => line(s.points[n]))}
                materialId={materialId}
                realistic={realistic}
                kind={['Control_unit', 'Check_lane', 'Multistart', 'AdapterUnit'].includes(s.type) ? 'unit' : 'main'}
              />
              <path
                d={`M${s.start.x - Math.sin(s.start.h) * 99} ${s.start.y + Math.cos(s.start.h) * 99} l${Math.sin(s.start.h) * 198} ${-Math.cos(s.start.h) * 198}`}
                stroke="#94a3b8"
                strokeWidth="3"
              />
              {switchGuidePaths(s, plan.geometryProfile).map((points, i) => (
                <g key={i} data-testid={`switch-guide-${s.index}-${i}`}>
                  <RailSlotPaths paths={[line(points)]} materialId={materialId} realistic={realistic} kind="switch" />
                  {s.type.endsWith('_1') && (
                    <path
                      d={`M${points[0].join(' ')} l${Math.cos(s.start.h) * 28 - Math.sin(s.start.h) * 4} ${Math.sin(s.start.h) * 28 + Math.cos(s.start.h) * 4}`}
                      stroke="#ccd1d5"
                      strokeWidth="5"
                    />
                  )}
                </g>
              ))}
              {(!plan.pit.enabled || ![plan.pit.entry, plan.pit.merge].includes(s.index)) &&
                s.type.startsWith('Pit_stop_weiche_') && (
                  <PitSwitchDetail
                    entry={s.type.endsWith('anfang')}
                    pose={{ xMm: s.start.x, yMm: s.start.y, headingDegrees: (s.start.h * 180) / Math.PI }}
                    materialId={materialId}
                    realistic={realistic}
                    surface
                  />
                )}
              {labels !== 'none' && (
                <text
                  data-testid={`rail-label-${s.index}`}
                  x={s.points[0][16][0]}
                  y={s.points[0][16][1]}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  stroke="#0f172a"
                  strokeWidth="8"
                  paintOrder="stroke"
                  fontSize="44"
                  fontWeight="bold"
                  pointerEvents="none"
                >
                  {labels === 'numbers'
                    ? s.index + 1
                    : `${labels === 'both' ? `${s.index + 1} · ` : ''}${trackPartAppearance(s.type).short}`}
                </text>
              )}
            </g>
          )
        )}
      {connector && (
        <g
          role="button"
          tabIndex="0"
          data-testid="track-connector"
          aria-label={t('graph.place')}
          onClick={(e) => {
            e.stopPropagation()
            onConnect?.()
          }}
          onKeyDown={(e) => {
            if (['Enter', ' '].includes(e.key)) {
              e.preventDefault()
              onConnect?.()
            }
          }}
          style={{ cursor: 'pointer' }}
        >
          <circle cx={connector.x} cy={connector.y} r="75" fill="#fff" stroke="#0f766e" strokeWidth="12" />
          <text
            x={connector.x}
            y={connector.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="95"
            fill="#0f766e"
          >
            +
          </text>
        </g>
      )}
      <circle cx="0" cy="0" r="18" fill="#4ade80" />
    </>
  )
  if (embedded) return <g>{drawing}</g>
  return (
    <svg
      data-testid="track-plan-preview"
      viewBox={box.join(' ')}
      className={`w-full min-h-56 max-h-96 rounded-lg ${light ? 'bg-white' : 'bg-slate-950'}`}
      data-piece-count={plan.pieces.length}
      role="img"
      aria-label={t('editor.title')}
    >
      {drawing}
    </svg>
  )
}
