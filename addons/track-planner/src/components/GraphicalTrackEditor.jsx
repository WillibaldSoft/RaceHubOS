import { pitlaneComponents } from '@core/components/tracks/pitlaneComponents'
import TrackPartsManager from './TrackPartsManager'
import TrackBorders from './TrackBorders'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  TRACK_PARTS,
  TRACK_ASSEMBLIES,
  CARRERA_MANUFACTURER_ARTICLES,
  SPECIAL_GEOMETRY_AUDIT,
  CARRERA_BORDERS,
  trackArticle,
  editTrackPieces,
  trackSelection,
  traceTrackPlan,
  trackBounds,
  enableFreePlacement,
  freeTrackSelection,
  transformFreeParts,
  snapFreeParts,
  editFreeParts,
  rotateTrackPlan,
  trackRectangleSelection,
  groupTrackParts,
  ungroupTrackParts,
  changeTrackDrawLayer,
  replacePitlaneSwitch,
  rotatePitlaneSwitch,
  editablePitlane,
} from '@racehubos/shared'
import { TrackPlanPreview } from '@core/components/tracks/TrackPlanPreview'
import { labelTrackPart } from '@core/components/tracks/trackPartLabel'
import { Button } from '@core/components/ui/button'
import TrackImageExport from '@core/components/tracks/TrackImageExport'
import TrackPlanPrint, { TrackTypeLegend } from './TrackPlanPrint'

const catalogue = [
  ...Object.keys(TRACK_PARTS)
    .filter((type) => type !== 'Startampel_3spur_hinten' && !Object.values(TRACK_ASSEMBLIES).flat().includes(type))
    .map((type) => ({ id: type, types: [type] })),
  ...Object.entries(TRACK_ASSEMBLIES).map(([id, types]) => ({ id, types })),
]
const partCategory = (p) =>
  TRACK_PARTS[p.types[0]].special
    ? 'specials'
    : Object.hasOwn(TRACK_ASSEMBLIES, p.id) || p.id.startsWith('Pit_stop')
      ? 'switches'
      : p.id.startsWith('Steilkurve_')
        ? 'banked'
        : p.id.startsWith('Kurve_')
          ? 'curves'
          : ['Control_unit', 'AdapterUnit', 'Check_lane', 'Multistart', 'Startampel_3spur_hinten'].includes(p.id)
            ? 'units'
            : 'straights'
const supportedArticles = new Set([
  ...Object.keys(TRACK_PARTS).map(trackArticle),
  ...CARRERA_BORDERS.map((p) => p.article),
])
function PartIcon({ types }) {
  const p = {
    kind: 'racehubos.track-plan',
    version: 1,
    pieces: types.map((type) => ({ type, level: 0, jointDegrees: 0 })),
    pit: {
      enabled: false,
      entry: 0,
      merge: 0,
      spacingMm: 345,
      bayLengthMm: 1035,
    },
  }
  if (types.length === 1 && types[0].startsWith('Pit_stop_weiche_')) {
    const entry = types[0].endsWith('anfang')
    return (
      <svg
        aria-hidden="true"
        className="w-20 h-12 shrink-0"
        viewBox="-353 -206 361 313"
        data-pit-preview-heading="180"
        data-testid={entry ? 'pit-entry-symbol' : 'pit-exit-symbol'}
        data-switch-kind={entry ? 'active-entry' : 'passive-merge'}
      >
        <g transform="rotate(180)" data-testid={entry ? 'pit-symbol-actuator' : undefined}>
          <TrackPlanPreview plan={p} embedded />
        </g>
      </svg>
    )
  }
  const bounds = trackBounds(p)
  return (
    <svg
      aria-hidden="true"
      viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.depth}`}
      className="w-20 h-12 shrink-0"
    >
      <TrackPlanPreview plan={p} embedded colorParts />
    </svg>
  )
}
export default function GraphicalTrackEditor({
  plan: storedPlan,
  selected,
  onSelect: onPrimarySelect,
  onChange,
  undo,
  redo,
  canUndo,
  canRedo,
  name,
  expanded = false,
}) {
  const { t } = useTranslation('tracks')
  const [draft, setDraft] = useState(null),
    [snapEnabled, setSnapEnabled] = useState(true),
    [snapHint, setSnapHint] = useState(null),
    [realistic, setRealistic] = useState(true),
    [frame, setFrame] = useState(null)
  const plan = draft ?? storedPlan
  const [part, setPart] = useState('Standardgerade'),
    [search, setSearch] = useState(''),
    [side, setSide] = useState('after'),
    [category, setCategory] = useState('all')
  const [colors, setColors] = useState(false),
    [labels, setLabels] = useState('none'),
    [level, setLevel] = useState('all'),
    [background, setBackground] = useState('paper')
  const [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 })
  const canvasRef = useRef(null),
    wheelHandler = useRef(null)
  useEffect(() => {
    const svg = canvasRef.current,
      listener = (e) => wheelHandler.current?.(e)
    svg.addEventListener('wheel', listener, { passive: false })
    return () => svg.removeEventListener('wheel', listener)
  }, [])
  const dragging = useRef(null),
    suppressClick = useRef(false),
    gridId = useId().replaceAll(':', '')
  const [picked, setPicked] = useState([]),
    [selectedPitPart, setSelectedPitPart] = useState(null),
    [layerTarget, setLayerTarget] = useState('rails')
  const [pointerMode, setPointerMode] = useState('box'),
    [marquee, setMarquee] = useState(null)
  function selectIndices(indices) {
    setSelectedPitPart(null)
    setLayerTarget('rails')
    setPicked(indices)
    onPrimarySelect(indices.at(-1) ?? -1)
  }
  function selectAll() {
    setLevel('all')
    selectIndices(storedPlan.pieces.map((_, i) => i))
  }
  const pickedIndices =
    selected < 0
      ? []
      : picked.includes(selected)
        ? picked.filter((i) => plan.pieces[i])
        : plan.pieces[selected]
          ? [selected]
          : []
  function onSelect(index, event) {
    if (event?.type === 'click' && suppressClick.current) {
      suppressClick.current = false
      return
    }
    setSelectedPitPart(null)
    setLayerTarget('rails')
    const toggle = event?.ctrlKey || event?.metaKey
    const next =
      index < 0
        ? []
        : toggle
          ? pickedIndices.includes(index)
            ? pickedIndices.filter((i) => i !== index)
            : [...pickedIndices, index]
          : [index]
    setPicked(next)
    onPrimarySelect(next.at(-1) ?? -1)
  }
  const selection = trackSelection(plan, selected),
    motion = selectedPitPart ? [] : [...new Set(pickedIndices.flatMap((i) => freeTrackSelection(plan, i)))],
    active = selectedPitPart ? null : plan.pieces[selected],
    chosen = catalogue.find((p) => p.id === part)
  const bounds =
    frame ?? (storedPlan.pieces.length ? trackBounds(storedPlan) : { x: -800, y: -600, width: 1600, depth: 1200 })
  const w = Math.max(1200, bounds.width + 200) / zoom,
    h = Math.max(900, bounds.depth + 200) / zoom
  const calculatedBox = [bounds.x + bounds.width / 2 - w / 2 + pan.x, bounds.y + bounds.depth / 2 - h / 2 + pan.y, w, h]
  const box = dragging.current?.kind === 'pan' ? calculatedBox : (dragging.current?.box ?? calculatedBox)
  const trace = traceTrackPlan(plan),
    activeSegment = trace.segments[selected],
    join = side === 'before' ? trace.segments[selection[0]]?.start : trace.segments[selection.at(-1)]?.end
  const pitParts = pitlaneComponents(plan, trace.segments),
    pitPart = pitParts.find((p) => p.id === selectedPitPart)
  const nativePitSwitch = !!pitPart && ['entry', 'exit'].includes(pitPart.kind)
  const pitSwitchLocked = nativePitSwitch && plan.partGroups?.groups.some((g) => g.includes(pitPart.anchor))
  const pitReplacement =
    nativePitSwitch && !pitSwitchLocked && ['Pit_stop_weiche_anfang', 'Pit_stop_weiche_ende'].includes(part)
  function selectPitPart(id, event) {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    const p = pitParts.find((p) => p.id === id)
    if (!p) return
    if ((event?.ctrlKey || event?.metaKey) && p.anchor !== undefined) {
      onSelect(p.anchor, event)
      return
    }
    setPicked([])
    onPrimarySelect(-1)
    setSelectedPitPart(id)
  }
  const drawTarget = pitPart ? (pitPart.extraIndex !== undefined ? 'extra' : 'pit') : layerTarget
  const drawObjects = pitPart
    ? [pitPart.extraIndex !== undefined ? plan.trackExtras[pitPart.extraIndex] : plan.pit]
    : pickedIndices.flatMap((i) =>
        layerTarget === 'rails'
          ? [plan.pieces[i]]
          : layerTarget === 'borders'
            ? Object.values(plan.pieces[i].borders || {})
            : plan.pieces[i].borders?.[layerTarget]
              ? [plan.pieces[i].borders[layerTarget]]
              : []
      )
  const drawValues = pitPart
    ? [
        pitPart.extraIndex !== undefined
          ? (plan.pieces[plan.trackExtras[pitPart.extraIndex].anchor]?.level ??
              plan.trackExtras[pitPart.extraIndex].level) +
            (plan.trackExtras[pitPart.extraIndex].drawLayer ??
              plan.pieces[plan.trackExtras[pitPart.extraIndex].anchor]?.drawLayer ??
              0)
          : (plan.pit.drawLayer ?? 0),
      ]
    : pickedIndices.flatMap((i) => {
        const p = plan.pieces[i]
        if (layerTarget === 'rails') return [p.level + (p.drawLayer ?? 0)]
        return ['left', 'right']
          .filter((side) => (layerTarget === 'borders' || layerTarget === side) && p.borders?.[side])
          .map((side) => p.level + (p.borders[side].drawLayer ?? p.drawLayer ?? 0))
      })
  function drawStep(delta) {
    onChange(
      changeTrackDrawLayer(
        plan,
        {
          indices: pickedIndices,
          target: drawTarget,
          extraIndex: pitPart?.extraIndex,
        },
        delta
      )
    )
  }
  function selectBorder(index, side, event) {
    onSelect(index, event)
    setLayerTarget(side)
  }
  const activeHeading = activeSegment
    ? (((((activeSegment.start.h * 180) / Math.PI + 180) % 360) + 360) % 360) - 180
    : 0
  const connector = join ?? trace.segments.at(-1)?.end ?? { x: 0, y: 0 }
  function edit(action) {
    if (action === 'replace' && pitReplacement) {
      const prepared = editablePitlane(plan),
        index = pitPart.extraIndex ?? prepared.ids[pitPart.id]
      onChange(replacePitlaneSwitch(prepared.plan, index, part))
      setSelectedPitPart(`extra-${index}`)
      return
    }
    const result = (plan.freePlacement ? editFreeParts : editTrackPieces)(plan, selected, action, chosen.types)
    onChange(result.plan)
    onSelect(result.selected)
  }
  function patch(patch) {
    onChange({
      ...plan,
      ...(patch.level !== undefined && plan.softyImport
        ? { softyImport: { ...plan.softyImport, paintOrder: false } }
        : {}),
      measuredLaneLengthsM: null,
      pieces: plan.pieces.map((p, i) =>
        (patch.level !== undefined ? motion : selection).includes(i) &&
        (!('jointDegrees' in patch) || i === selection[0])
          ? { ...p, ...patch }
          : p
      ),
    })
  }
  function fit() {
    setFrame(null)
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }
  function keyboard(e) {
    if (e.target.closest('input,select,textarea,[contenteditable=true]')) return
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault()
      selectAll()
      return
    }
    if ((e.ctrlKey || e.metaKey) && ['z', 'y'].includes(e.key.toLowerCase())) {
      e.preventDefault()
      if (e.key.toLowerCase() === 'y' || e.shiftKey) redo()
      else undo()
      return
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (
      ['Delete', 'Backspace'].includes(e.key) &&
      active &&
      pickedIndices.length === 1 &&
      !plan.partGroups?.groups.some((g) => g.includes(selected))
    ) {
      e.preventDefault()
      edit('delete')
    }
    if (e.key === 'Escape') {
      dragging.current = null
      setDraft(null)
      setMarquee(null)
      setSnapHint(null)
      onSelect(-1)
    }
    if (e.key.toLowerCase() === 'r' && active) rotate(e.shiftKey ? -15 : 15)
    if (e.key.toLowerCase() === 'c') setColors((v) => !v)
    if (e.key.toLowerCase() === 'l') setLabels((v) => (v === 'none' ? 'both' : 'none'))
    if (e.key.toLowerCase() === 'a') fit()
    if (e.key === '+') setZoom((v) => Math.min(8, v * 1.25))
    if (e.key === '-') setZoom((v) => Math.max(0.4, v / 1.25))
  }
  const points = motion.flatMap((i) => trace.segments[i]?.points[0] ?? [])
  const center = points.length
    ? {
        x: (Math.min(...points.map((p) => p[0])) + Math.max(...points.map((p) => p[0]))) / 2,
        y: (Math.min(...points.map((p) => p[1])) + Math.max(...points.map((p) => p[1]))) / 2,
      }
    : null
  const pivot = dragging.current?.kind === 'rotate' ? dragging.current.pivot : center
  const handle =
    pivot && activeSegment
      ? {
          x: pivot.x + Math.cos(activeSegment.start.h - Math.PI / 2) * 270,
          y: pivot.y + Math.sin(activeSegment.start.h - Math.PI / 2) * 270,
        }
      : null
  function rotate(delta) {
    if (!pivot) return
    onChange(
      transformFreeParts(plan, motion, {
        degrees: delta,
        pivotX: pivot.x,
        pivotY: pivot.y,
      })
    )
  }
  wheelHandler.current = (e) => {
    if (dragging.current || !e.deltaY) return
    e.preventDefault()
    const next = Math.max(0.4, Math.min(8, zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)))
    if (next === zoom) return
    const a = world(e),
      ratio = zoom / next,
      cx = box[0] + box[2] / 2,
      cy = box[1] + box[3] / 2
    setZoom(next)
    setPan({
      x: a.x + (cx - a.x) * ratio - (bounds.x + bounds.width / 2),
      y: a.y + (cy - a.y) * ratio - (bounds.y + bounds.depth / 2),
    })
  }
  function world(e, inverse = e.currentTarget.getScreenCTM().inverse()) {
    const svg = e.currentTarget,
      p = svg.createSVGPoint()
    p.x = e.clientX
    p.y = e.clientY
    return p.matrixTransform(inverse)
  }
  return (
    <section
      data-testid="graphical-track-editor"
      tabIndex="0"
      onKeyDown={keyboard}
      className={`planner-graphical ${expanded ? 'is-expanded' : ''}`}
    >
      <p className="planner-hint">{t('graph.help')}</p>
      <div className="planner-toolbar">
        <Button
          type="button"
          variant={pointerMode === 'box' ? 'secondary' : 'outline'}
          data-testid="track-box-mode"
          aria-pressed={pointerMode === 'box'}
          onClick={() => setPointerMode('box')}
        >
          {t('graph.boxSelect')}
        </Button>
        <Button
          type="button"
          variant={pointerMode === 'pan' ? 'secondary' : 'outline'}
          data-testid="track-pan-mode"
          aria-pressed={pointerMode === 'pan'}
          onClick={() => setPointerMode('pan')}
        >
          {t('graph.panMode')}
        </Button>
        <Button
          type="button"
          variant="outline"
          data-testid="track-select-all"
          disabled={!plan.pieces.length}
          onClick={selectAll}
        >
          {t('graph.selectAll')}
        </Button>
        <Button type="button" variant="outline" data-testid="track-undo" disabled={!canUndo} onClick={undo}>
          {t('graph.undo')}
        </Button>
        <Button type="button" variant="outline" data-testid="track-redo" disabled={!canRedo} onClick={redo}>
          {t('graph.redo')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setZoom((v) => Math.max(0.4, v / 1.25))}
          aria-label={t('graph.zoomOut')}
        >
          −
        </Button>
        <span data-testid="track-zoom-percent">{Math.round(zoom * 100)}%</span>
        <input
          data-testid="track-zoom-slider"
          type="range"
          min="40"
          max="800"
          step="5"
          aria-label={t('graph.zoom')}
          value={Math.round(zoom * 100)}
          onChange={(e) => setZoom(Number(e.target.value) / 100)}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => setZoom((v) => Math.min(8, v * 1.25))}
          aria-label={t('graph.zoomIn')}
        >
          +
        </Button>
        <Button type="button" variant="outline" data-testid="track-fit" onClick={fit}>
          {t('graph.fit')}
        </Button>
        <label>
          <input
            data-testid="free-track-snap"
            type="checkbox"
            checked={snapEnabled}
            onChange={(e) => setSnapEnabled(e.target.checked)}
          />{' '}
          {t('free.snap')}
        </label>
        <label>
          <input
            data-testid="realistic-track"
            type="checkbox"
            checked={realistic}
            onChange={(e) => setRealistic(e.target.checked)}
          />{' '}
          {t('free.realistic')}
        </label>
        <label>
          {t('graph.background')}{' '}
          <select value={background} onChange={(e) => setBackground(e.target.value)}>
            {['paper', 'dark', 'green'].map((k) => (
              <option key={k} value={k}>
                {t(`graph.${k}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('graph.layers')}{' '}
          <select data-testid="track-layer-filter" value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="all">{t('graph.allLayers')}</option>
            {[0, 1, 2].map((n) => (
              <option key={n} value={n}>
                {t('editor.level')} {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            data-testid="track-type-colors"
            type="checkbox"
            checked={colors}
            onChange={(e) => setColors(e.target.checked)}
          />{' '}
          {t('graph.colors')}
        </label>
        <label>
          {t('graph.labels')}{' '}
          <select data-testid="track-labels" value={labels} onChange={(e) => setLabels(e.target.value)}>
            {['none', 'types', 'numbers', 'both'].map((k) => (
              <option key={k} value={k}>
                {t(`graph.${k}`)}
              </option>
            ))}
          </select>
        </label>
        <TrackPlanPrint plan={plan} name={name} />
        <TrackPartsManager plan={plan} name={name} />
      </div>
      {plan.pieces.some((p) => TRACK_PARTS[p.type].approximateSlots) && (
        <p role="note" data-testid="special-geometry-warning" className="border rounded p-2 text-sm">
          {t('catalogue.approximateSlots')}
        </p>
      )}
      <p data-testid="catalogue-geometry-note" className="text-xs text-muted-foreground">
        {t('catalogue.geometryNote')}
      </p>
      <div className="planner-layout">
        <aside className="planner-catalogue" data-testid="planner-catalogue-sidebar">
          <h3 className="font-semibold">{t('graph.catalogue')}</h3>
          <div className="planner-catalogue-tabs" role="tablist" aria-label={t('graph.catalogue')}>
            {['all', 'straights', 'curves', 'banked', 'specials', 'switches', 'units', 'borders', 'manufacturer'].map(
              (key) => (
                <button
                  type="button"
                  role="tab"
                  key={key}
                  id={`${gridId}-tab-${key}`}
                  data-testid={`catalogue-tab-${key}`}
                  aria-selected={category === key}
                  aria-controls={`${gridId}-catalogue-panel`}
                  onClick={() => setCategory(key)}
                >
                  {t(`graph.categories.${key}`)}
                </button>
              )
            )}
          </div>
          <div role="tabpanel" id={`${gridId}-catalogue-panel`} aria-labelledby={`${gridId}-tab-${category}`}>
            <div hidden={category === 'borders' || category === 'manufacturer'}>
              <input
                data-testid="track-catalogue-search"
                className="border rounded p-2 w-full"
                aria-label={t('graph.search')}
                placeholder={t('graph.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="planner-parts" data-testid="track-catalogue">
                {catalogue
                  .filter(
                    (p) =>
                      (category === 'all' || partCategory(p) === category) &&
                      (
                        labelTrackPart(p.types[0]) +
                        ' ' +
                        p.id +
                        ' ' +
                        trackArticle(p.types[0]) +
                        ' ' +
                        (Object.hasOwn(TRACK_ASSEMBLIES, p.id) ? t(`graph.${p.id}`) : '')
                      )
                        .toLowerCase()
                        .includes(search.toLowerCase())
                  )
                  .map((p) => (
                    <button
                      type="button"
                      data-testid={`palette-${p.id}`}
                      key={p.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/x-racehub-track-part', p.id)
                        e.dataTransfer.effectAllowed = 'copy'
                      }}
                      aria-pressed={p.id === part}
                      className={`planner-part ${p.id === part ? 'is-selected' : ''}`}
                      onClick={() => setPart(p.id)}
                      onDoubleClick={() => {
                        if (plan.pieces.length + p.types.length > 2000) return
                        const result = (plan.freePlacement ? editFreeParts : editTrackPieces)(
                          plan,
                          selected,
                          side,
                          p.types
                        )
                        onChange(result.plan)
                        onSelect(result.selected)
                      }}
                    >
                      <PartIcon types={p.types} />
                      <span>
                        {p.types.length > 1 ? t(`graph.${p.id}`) : labelTrackPart(p.types[0])}
                        <small className="block text-muted-foreground">
                          {trackArticle(p.types[0])}
                          {TRACK_PARTS[p.types[0]].banked ? ' · 2D' : ''}
                          {TRACK_PARTS[p.types[0]].approximateSlots ? ` · ${t('catalogue.approximateShort')}` : ''}
                        </small>
                      </span>
                    </button>
                  ))}
              </div>
            </div>
            <div hidden={category !== 'manufacturer'} data-testid="manufacturer-catalogue" className="space-y-3">
              <p className="text-xs">{t('catalogue.referenceNote')}</p>
              <input
                data-testid="manufacturer-search"
                className="border rounded p-2 w-full"
                aria-label={t('graph.search')}
                placeholder={t('graph.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {CARRERA_MANUFACTURER_ARTICLES.filter((p) =>
                (p.article + ' ' + p.name).toLowerCase().includes(search.toLowerCase())
              ).map((p) => (
                <article
                  key={p.article}
                  data-testid={`manufacturer-${p.article}`}
                  className="border rounded p-2 text-sm"
                >
                  <strong>{p.article}</strong>
                  <p>{p.name}</p>
                  {SPECIAL_GEOMETRY_AUDIT[p.article] && (
                    <p data-testid={`geometry-audit-${p.article}`} className="text-xs my-2">
                      {t(`catalogue.audit.${SPECIAL_GEOMETRY_AUDIT[p.article].note}`)}
                    </p>
                  )}
                  <small className="block">
                    {t(supportedArticles.has(p.article) ? 'catalogue.supported' : 'catalogue.referenceOnly')}
                  </small>
                  <a href={p.source} target="_blank" rel="noopener noreferrer" className="underline">
                    {t('catalogue.source')}
                  </a>
                </article>
              ))}
            </div>
            <div hidden={category !== 'borders'} className="planner-border-submenu">
              <p data-testid="catalogue-border-selection">{t('graph.multiple', { count: pickedIndices.length })}</p>
              <TrackBorders
                plan={plan}
                selected={selected}
                onChange={(next) => {
                  onChange(next)
                  setFrame(null)
                }}
                selectedIndices={pickedIndices}
              />
            </div>
          </div>
        </aside>
        <div className="planner-stage">
          <div className="planner-selection-toolbar">
            <strong className="text-sm" data-testid="selected-track-piece">
              {pitPart
                ? `${pitPart.short} · ${t(`pitParts.${pitPart.kind}`)} · ${pitPart.article}`
                : active
                  ? `${selected + 1}. ${labelTrackPart(active.type)}${['Standardgerade', 'Startampel_3spur_hinten'].includes(active.type) ? ` · ${t('pitParts.twoLane')}` : ''}`
                  : t('graph.noSelection')}
            </strong>
            <select
              data-testid="track-insert-side"
              aria-label={t('graph.insertSide')}
              value={side}
              onChange={(e) => setSide(e.target.value)}
            >
              <option value="after">{t('graph.after')}</option>
              <option value="before">{t('graph.before')}</option>
            </select>
            <Button
              type="button"
              data-testid="add-track-piece"
              disabled={!!pitPart || plan.pieces.length + chosen.types.length > 2000}
              onClick={() => edit(side)}
            >
              {t('graph.place')}
            </Button>
            <Button
              type="button"
              variant="outline"
              data-testid="replace-track-piece"
              disabled={
                !pitReplacement &&
                (!active ||
                  pickedIndices.length > 1 ||
                  plan.partGroups?.groups.some((g) => g.includes(selected)) ||
                  plan.pieces.length - selection.length + chosen.types.length > 2000)
              }
              onClick={() => edit('replace')}
            >
              {t('editor.replace')}
            </Button>
            <Button
              type="button"
              variant="outline"
              data-testid="delete-track-piece"
              disabled={
                !active || pickedIndices.length > 1 || plan.partGroups?.groups.some((g) => g.includes(selected))
              }
              onClick={() => edit('delete')}
            >
              {t('editor.remove')}
            </Button>
            {nativePitSwitch && (
              <Button
                type="button"
                variant="outline"
                data-testid="rotate-pit-component"
                disabled={pitSwitchLocked}
                onClick={() => {
                  const prepared = editablePitlane(plan),
                    index = pitPart.extraIndex ?? prepared.ids[pitPart.id]
                  onChange(rotatePitlaneSwitch(prepared.plan, index))
                  setSelectedPitPart(`extra-${index}`)
                }}
              >
                {t('pitParts.rotate')}
              </Button>
            )}
            {active && (
              <>
                <label>
                  {t('editor.level')}{' '}
                  <select
                    data-testid="selected-track-level"
                    value={active.level}
                    onChange={(e) => patch({ level: Number(e.target.value) })}
                  >
                    {[0, 1, 2].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
                {active.type.startsWith('Kurve_') && pickedIndices.length === 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      patch({
                        type: active.type.endsWith('links')
                          ? active.type.replace('links', 'rechts')
                          : active.type.replace('rechts', 'links'),
                      })
                    }
                  >
                    {t('graph.flip')}
                  </Button>
                )}
                {pickedIndices.length === 1 && (
                  <>
                    <Button type="button" variant="outline" onClick={() => onSelect(Math.max(0, selected - 1))}>
                      ←
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onSelect(Math.min(plan.pieces.length - 1, selected + 1))}
                    >
                      →
                    </Button>
                  </>
                )}
              </>
            )}
          </div>

          <div
            className="planner-group-controls border rounded-lg p-2 flex flex-wrap items-center gap-2"
            data-testid="track-group-controls"
          >
            <strong>{t('group.title')}</strong>
            <span className="text-xs" data-testid="combination-status">
              {pitPart ? t('group.singlePart') : t('group.members', { count: motion.length })}
              {motion.length > 0 && pitParts.some((p) => motion.includes(p.anchor))
                ? ` · ${t('group.boxMembers', { count: pitParts.filter((p) => motion.includes(p.anchor)).length })}`
                : ''}
            </span>
            <Button
              type="button"
              variant={pickedIndices.length >= 2 ? 'default' : 'outline'}
              data-testid="group-track-parts"
              disabled={pickedIndices.length < 2}
              title={t('group.note')}
              onClick={() => {
                const next = groupTrackParts(plan, motion)
                onChange(next)
                selectIndices(motion)
              }}
            >
              <span aria-hidden="true">▦</span> {t('group.combine')}
            </Button>
            <Button
              type="button"
              variant={motion.length >= 2 ? 'secondary' : 'outline'}
              data-testid="ungroup-track-parts"
              disabled={motion.length < 2}
              onClick={() => {
                const next = ungroupTrackParts(plan, motion)
                onChange(next)
                selectIndices(selected < 0 ? [] : [selected])
              }}
            >
              <span aria-hidden="true">⤢</span> {t('group.release')}
            </Button>
            {pitParts.length > 0 && (
              <Button
                type="button"
                data-testid="select-whole-pit-combination"
                disabled={pitPart?.anchor === undefined}
                onClick={() => {
                  if (pitPart?.anchor !== undefined) selectIndices(freeTrackSelection(plan, pitPart.anchor))
                }}
              >
                {t('group.selectCombination')}
              </Button>
            )}
          </div>
          {(active || pitPart) && (
            <div
              data-testid="drawing-layer-controls"
              className="flex flex-wrap items-center gap-2 border rounded-lg p-2 text-sm"
            >
              <strong>{t('drawLayers.title')}</strong>
              {!pitPart && (
                <select
                  data-testid="drawing-layer-target"
                  value={layerTarget}
                  onChange={(e) => setLayerTarget(e.target.value)}
                >
                  {['rails', 'left', 'right', 'borders'].map((v) => (
                    <option key={v} value={v}>
                      {t(`drawLayers.${v}`)}
                    </option>
                  ))}
                </select>
              )}
              {pitPart && (
                <span>{t(pitPart.extraIndex === undefined ? 'drawLayers.pit' : 'drawLayers.component')}</span>
              )}
              <Button
                type="button"
                variant="outline"
                data-testid="drawing-layer-down"
                disabled={!drawObjects.length}
                onClick={() => drawStep(-1)}
              >
                {t('drawLayers.down')}
              </Button>
              <Button
                type="button"
                variant="outline"
                data-testid="drawing-layer-up"
                disabled={!drawObjects.length}
                onClick={() => drawStep(1)}
              >
                {t('drawLayers.up')}
              </Button>
              <Button
                type="button"
                variant="outline"
                data-testid="drawing-layer-reset"
                disabled={!drawObjects.length}
                onClick={() => drawStep(null)}
              >
                {t('drawLayers.reset')}
              </Button>
              <span data-testid="drawing-layer-value">
                {drawValues.filter((n, i, a) => a.indexOf(n) === i).join(' / ')}
              </span>
              <small>{t('drawLayers.note')}</small>
            </div>
          )}
          <TrackImageExport name={name}>
            <svg
              ref={canvasRef}
              data-testid="graph-track-canvas"
              data-piece-count={plan.pieces.length}
              data-selected-count={pickedIndices.length}
              viewBox={box.join(' ')}
              role="img"
              tabIndex="0"
              aria-label={t('graph.canvas')}
              className="planner-canvas touch-none"
              style={{
                background: background === 'paper' ? '#f8fafc' : background === 'green' ? '#14532d' : '#0f172a',
              }}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes('application/x-racehub-track-part')) {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'copy'
                }
              }}
              onDrop={(e) => {
                const item = catalogue.find((p) => p.id === e.dataTransfer.getData('application/x-racehub-track-part'))
                if (!item || plan.pieces.length + item.types.length > 2000) return
                e.preventDefault()
                const point = world(e)
                setFrame(bounds)
                const result = editFreeParts(plan, -1, 'after', item.types, {
                  xMm: point.x,
                  yMm: point.y,
                  headingDegrees: 0,
                })
                const indices = trackSelection(result.plan, result.selected),
                  snapped = snapEnabled
                    ? snapFreeParts(result.plan, indices, {
                        distanceMm: Math.max(20, w / 25),
                      })
                    : { plan: result.plan, snap: null }
                onChange(snapped.plan)
                onSelect(result.selected)
                setPart(item.id)
                setSnapHint(snapped.snap)
              }}
              onPointerDown={(e) => {
                suppressClick.current = false
                if (![0, 1].includes(e.button) || ((e.ctrlKey || e.metaKey) && !e.shiftKey)) return
                const borderHit = e.target.closest('[data-border-side]')
                if (borderHit && e.button === 0 && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                  e.preventDefault()
                  selectBorder(Number(borderHit.dataset.railIndex), borderHit.dataset.borderSide, e)
                  suppressClick.current = true
                  return
                }
                const pitHit = e.target.closest('[data-pit-part-id]')
                if (pitHit && e.button === 0 && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                  e.preventDefault()
                  e.currentTarget.focus({ preventScroll: true })
                  selectPitPart(pitHit.dataset.pitPartId, e)
                  suppressClick.current = true
                  return
                }
                const rail = e.target.closest('[data-rail-index]'),
                  rotation = e.target.closest('[data-rotation-handle]')
                if (e.target.closest('[data-testid=track-connector]') && !e.shiftKey) return
                e.preventDefault()
                e.currentTarget.focus({ preventScroll: true })
                const index = rail ? Number(rail.dataset.railIndex) : selected,
                  point = world(e),
                  matrix = e.currentTarget.getScreenCTM()
                const kind =
                  e.button === 1 ? 'pan' : e.shiftKey ? 'box' : rotation ? 'rotate' : rail ? 'move' : pointerMode
                const indices = pickedIndices.includes(index) ? motion : freeTrackSelection(storedPlan, index)
                setFrame(bounds)
                dragging.current = {
                  kind,
                  index,
                  id: e.pointerId,
                  x: e.clientX,
                  y: e.clientY,
                  point,
                  pan,
                  sx: 1 / matrix.a,
                  sy: 1 / matrix.d,
                  box: [...box],
                  inverse: matrix.inverse(), // Selection controls can move the canvas during a drag.
                  base: enableFreePlacement(storedPlan),
                  indices,
                  pivot: center,
                  additive: e.ctrlKey || e.metaKey,
                  previous: pickedIndices,
                }
                if (kind === 'box') setMarquee({ a: point, b: point })
                if (['move', 'rotate'].includes(kind) && !pickedIndices.includes(index)) onSelect(index)
                e.currentTarget.setPointerCapture(e.pointerId)
              }}
              onPointerMove={(e) => {
                const d = dragging.current
                if (!d) return
                if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 3 && !d.moved) return
                d.moved = true
                if (d.kind === 'pan') {
                  setPan({
                    x: d.pan.x - (e.clientX - d.x) * d.sx,
                    y: d.pan.y - (e.clientY - d.y) * d.sy,
                  })
                  return
                }
                const point = world(e, d.inverse)
                if (d.kind === 'box') {
                  setMarquee({ a: d.point, b: point })
                  return
                }
                let changed
                if (d.kind === 'rotate') {
                  let delta =
                    ((Math.atan2(point.y - d.pivot.y, point.x - d.pivot.x) -
                      Math.atan2(d.point.y - d.pivot.y, d.point.x - d.pivot.x)) *
                      180) /
                    Math.PI
                  if (e.shiftKey) delta = Math.round(delta / 5) * 5
                  changed = transformFreeParts(d.base, d.indices, {
                    degrees: delta,
                    pivotX: d.pivot.x,
                    pivotY: d.pivot.y,
                  })
                } else
                  changed = transformFreeParts(d.base, d.indices, {
                    dx: point.x - d.point.x,
                    dy: point.y - d.point.y,
                  })
                const snapped = snapEnabled
                  ? snapFreeParts(changed, d.indices, {
                      distanceMm: Math.max(20, d.box[2] / 25),
                    })
                  : { plan: changed, snap: null }
                d.result = snapped.plan
                setDraft(snapped.plan)
                setSnapHint(snapped.snap)
              }}
              onPointerUp={(e) => {
                const d = dragging.current
                if (d?.kind === 'box' && d.moved) {
                  const indices = trackRectangleSelection(
                    d.base,
                    d.point,
                    world(e, d.inverse),
                    level === 'all' ? null : Number(level)
                  )
                  selectIndices([...new Set([...(d.additive ? d.previous : []), ...indices])])
                  suppressClick.current = true
                } else if (d?.moved && d.result) {
                  suppressClick.current = true
                  onChange(d.result)
                } else if (d?.kind === 'move') onSelect(d.index)
                else if (d && !d.moved && ['box', 'pan'].includes(d.kind)) {
                  if (!storedPlan.pieces.length) {
                    const p = world(e),
                      result = editFreeParts(storedPlan, -1, 'after', chosen.types, {
                        xMm: p.x,
                        yMm: p.y,
                        headingDegrees: 0,
                      })
                    onChange(result.plan)
                    onSelect(result.selected)
                  } else onSelect(-1)
                }
                dragging.current = null
                setDraft(null)
                setMarquee(null)
                if (d?.kind === 'pan') setPan((p) => ({ ...p }))
              }}
              onPointerCancel={() => {
                dragging.current = null
                setDraft(null)
                setMarquee(null)
                setSnapHint(null)
              }}
            >
              <defs>
                <pattern id={gridId} width="100" height="100" patternUnits="userSpaceOnUse">
                  <path
                    d="M100 0H0V100"
                    fill="none"
                    stroke={background === 'paper' ? '#cbd5e1' : '#64748b'}
                    strokeWidth="2"
                  />
                </pattern>
              </defs>
              <rect x={box[0]} y={box[1]} width={w} height={h} fill={`url(#${gridId})`} />
              <TrackPlanPreview
                plan={plan}
                embedded
                selected={pitPart ? -1 : selected}
                selectedIndices={motion}
                selectedPitPart={selectedPitPart}
                onSelectPitPart={selectPitPart}
                onSelectBorder={selectBorder}
                realistic={realistic}
                onSelect={onSelect}
                colorParts={colors}
                labels={labels}
                visibleLevel={level === 'all' ? null : Number(level)}
                connector={plan.pieces.length + chosen.types.length <= 2000 ? connector : null}
                onConnect={() => edit(side)}
              />
              {marquee && (
                <rect
                  data-testid="track-selection-rectangle"
                  x={Math.min(marquee.a.x, marquee.b.x)}
                  y={Math.min(marquee.a.y, marquee.b.y)}
                  width={Math.abs(marquee.b.x - marquee.a.x)}
                  height={Math.abs(marquee.b.y - marquee.a.y)}
                  fill="#0d948833"
                  stroke="#0f766e"
                  strokeWidth={(3 * w) / 1200}
                  strokeDasharray={`${(12 * w) / 1200} ${(6 * w) / 1200}`}
                  pointerEvents="none"
                />
              )}
              {snapHint && (
                <circle
                  data-testid="free-snap-indicator"
                  cx={snapHint.x}
                  cy={snapHint.y}
                  r="65"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="12"
                  pointerEvents="none"
                />
              )}
              {handle && pivot && (
                <g>
                  <line
                    x1={pivot.x}
                    y1={pivot.y}
                    x2={handle.x}
                    y2={handle.y}
                    stroke="#dc2626"
                    strokeWidth="6"
                    pointerEvents="none"
                  />
                  <circle
                    data-testid="free-rotation-handle"
                    data-rotation-handle="true"
                    cx={handle.x}
                    cy={handle.y}
                    r="55"
                    fill="#dc2626"
                    stroke="white"
                    strokeWidth="8"
                    style={{ cursor: 'grab' }}
                  >
                    <title>{t('free.rotate')}</title>
                  </circle>
                </g>
              )}
              {!plan.pieces.length && (
                <text
                  x="0"
                  y="-180"
                  textAnchor="middle"
                  fontSize="50"
                  fill={background === 'paper' ? '#334155' : '#fff'}
                  pointerEvents="none"
                >
                  {t('graph.start')}
                </text>
              )}
            </svg>
          </TrackImageExport>
          {plan.freePlacement && (
            <p role="status" data-testid="free-track-status">
              {t(trace.connectivity.closed ? 'free.closed' : 'free.open', {
                count: trace.connectivity.openPorts.length,
                ambiguous: trace.connectivity.ambiguousPorts,
                components: trace.connectivity.components,
              })}
            </p>
          )}
          <p data-testid="graphic-track-status" className="text-sm">
            {t(plan.freePlacement && !trace.connectivity.closed ? 'free.material' : 'editor.lanes')}:{' '}
            {trace.laneLengthsM.map((n) => n.toFixed(3)).join(' / ')} m ·{' '}
            {plan.freePlacement
              ? t('free.connections', {
                  count: trace.connectivity.openPorts.length,
                })
              : `${t('editor.gap')}: ${trace.gapMm.toFixed(2)} mm`}
          </p>
          <p className="text-xs text-muted-foreground">{t('graph.gridNote')}</p>
          {colors && <TrackTypeLegend plan={plan} />}
          {pitParts.length > 0 && (
            <section data-testid="pitlane-component-selection" className="border rounded p-2 text-sm space-y-2">
              <strong>{t('pitParts.combination')}</strong>
              <p>{t('pitParts.combinationNote')}</p>
              <div className="flex flex-wrap gap-2">
                {pitParts.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    data-testid={`select-pit-component-${p.id}`}
                    aria-pressed={selectedPitPart === p.id}
                    className={`border rounded px-2 py-1 ${selectedPitPart === p.id ? 'bg-teal-100 text-teal-950' : ''}`}
                    onClick={() => selectPitPart(p.id)}
                  >
                    {p.short} · {p.article}
                  </button>
                ))}
              </div>
              {pitPart && (
                <p data-testid="selected-pit-component">
                  {t(`pitParts.${pitPart.kind}`)} · {pitPart.article} · {t('pitParts.componentSelection')}
                  {pitPart.anchor !== undefined && (
                    <Button
                      type="button"
                      variant="outline"
                      data-testid="select-pit-carrier"
                      onClick={() => onSelect(pitPart.anchor)}
                    >
                      {t('pitParts.carrier')}
                    </Button>
                  )}
                </p>
              )}
            </section>
          )}
          <section
            className="planner-transform-panel"
            data-testid="track-transform-controls"
            aria-label={t('graph.transformControls')}
          >
            <p data-testid="track-selection-count" className="text-sm">
              {t('graph.multiple', { count: pickedIndices.length })}
            </p>
            <div className="planner-pose">
              <label>
                {t('graph.rotation')}{' '}
                <input
                  data-testid="track-rotation"
                  type="number"
                  className="border rounded w-20"
                  min="-360"
                  max="360"
                  step="any"
                  value={plan.startHeadingDegrees}
                  onChange={(e) => onChange(rotateTrackPlan(plan, Number(e.target.value) - plan.startHeadingDegrees))}
                />{' '}
                °
              </label>
              {active && activeSegment && (
                <>
                  <label>
                    X (mm){' '}
                    <input
                      data-testid="free-part-x"
                      type="number"
                      step="any"
                      className="border rounded w-24"
                      value={Number(activeSegment.start.x.toFixed(2))}
                      onChange={(e) =>
                        onChange(
                          transformFreeParts(plan, motion, {
                            dx: Math.max(-1000000, Math.min(1000000, Number(e.target.value))) - activeSegment.start.x,
                          })
                        )
                      }
                    />
                  </label>
                  <label>
                    Y (mm){' '}
                    <input
                      data-testid="free-part-y"
                      type="number"
                      step="any"
                      className="border rounded w-24"
                      value={Number(activeSegment.start.y.toFixed(2))}
                      onChange={(e) =>
                        onChange(
                          transformFreeParts(plan, motion, {
                            dy: Math.max(-1000000, Math.min(1000000, Number(e.target.value))) - activeSegment.start.y,
                          })
                        )
                      }
                    />
                  </label>
                  <label>
                    {t('free.angle')}{' '}
                    <input
                      data-testid="free-part-angle"
                      type="number"
                      min="-360"
                      max="360"
                      step="any"
                      className="border rounded w-20"
                      value={Number(activeHeading.toFixed(2))}
                      onChange={(e) => rotate(Number(e.target.value) - activeHeading)}
                    />
                  </label>
                  <Button
                    type="button"
                    data-testid="free-snap-now"
                    variant="outline"
                    onClick={() => {
                      const result = snapFreeParts(plan, motion, {
                        distanceMm: Math.max(20, w / 25),
                      })
                      onChange(result.plan)
                      setSnapHint(result.snap)
                    }}
                  >
                    {t('free.snapNow')}
                  </Button>
                </>
              )}
              {active && !plan.freePlacement && (
                <label>
                  {t('editor.joint')}{' '}
                  <input
                    type="number"
                    className="border rounded w-20"
                    min="-5"
                    max="5"
                    step="any"
                    value={active.jointDegrees}
                    onChange={(e) =>
                      patch({
                        jointDegrees: Math.max(-5, Math.min(5, Number(e.target.value))),
                      })
                    }
                  />
                </label>
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  )
}
