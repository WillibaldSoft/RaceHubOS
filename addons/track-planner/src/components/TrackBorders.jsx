import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  applyTrackBorders,
  setFreeBorderEnds,
  borderEndConnections,
  borderArticle,
  pitBorderSideBlocked,
  trackFootprint,
  borderConflicts,
  railRequirements,
  CARRERA_BORDERS,
  roomTrackArea,
  trackBounds,
} from '@racehubos/shared'
import { Button } from '@core/components/ui/button'

export function BorderPartsList({ plan, visibleLevel = null }) {
  // Preserve geometry indices and pit anchors when counting a printed level.
  const countPlan =
    visibleLevel === null
      ? plan
      : {
          ...plan,
          pieces: plan.pieces.map((p) => (p.level === visibleLevel ? p : { ...p, borders: undefined })),
          trackExtras: plan.trackExtras?.map((e) =>
            (e.level ?? plan.pieces[e.anchor]?.level ?? 0) === visibleLevel ? e : { ...e, hidden: true }
          ),
        }
  const { t } = useTranslation('tracks'),
    counts = railRequirements(countPlan).counts,
    rows = CARRERA_BORDERS.filter((p) => counts[p.article])
  if (!rows.length) return null
  return (
    <section data-testid="border-parts-list" className="text-sm">
      <h3 className="font-semibold">{t('borders.list')}</h3>
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left">{t('inventory.article')}</th>
            <th className="text-left">{t('inventory.part')}</th>
            <th>{t('inventory.required')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.article} data-testid={`border-count-${p.article}`}>
              <td>{p.article}</td>
              <td>{t(`inventory.parts.${p.label}`)}</td>
              <td className="text-center">{counts[p.article]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs">{t('borders.quantities')}</p>
    </section>
  )
}
export default function TrackBorders({ plan, selected, selectedIndices = [], onChange }) {
  const { t } = useTranslation('tracks'),
    [scope, setScope] = useState('selected'),
    piece = plan.pieces[selected]
  const marked = selectedIndices.length ? selectedIndices : piece ? [selected] : []
  const ports = marked.length > 1 ? borderEndConnections(plan) : []
  const indices =
    scope === 'selected'
      ? marked
      : plan.pieces.flatMap((p, i) =>
          scope === 'all' ||
          p.type.startsWith('Kurve_') ||
          p.type.startsWith('Steilkurve_') ||
          /^Kurvenweiche_.*_2$/.test(p.type)
            ? [i]
            : []
        )
  const bare = trackFootprint(plan, false),
    actual = trackFootprint(plan),
    conflicts = borderConflicts(plan),
    bounds = trackBounds(plan),
    area = plan.roomPlan ? roomTrackArea(plan.roomPlan) : null
  const fits = !area || (bounds.width <= area.width && bounds.depth <= area.depth)
  function sideChange(side, enabled, key) {
    if (key && marked.length > 1) {
      onChange(setFreeBorderEnds(plan, marked, { side, edge: key, enabled }))
      return
    }
    const pieces = plan.pieces.map((p, i) => {
      if (!marked.includes(i) || (enabled && (!borderArticle(p.type, side) || pitBorderSideBlocked(plan, i, side))))
        return p
      const borders = { ...p.borders }
      if (key) {
        if (!borders[side]) return p
        borders[side] = { ...borders[side], [key]: enabled }
      } else if (enabled) borders[side] = { startCap: false, endCap: false }
      else delete borders[side]
      const { borders: old, ...rest } = p
      void old
      return Object.keys(borders).length ? { ...rest, borders } : rest
    })
    onChange({ ...plan, pieces })
  }
  function capValues(side, key, applicable) {
    const capable = applicable.filter((i) => !plan.pieces[i].type.startsWith('Steilkurve_'))
    const eligible =
      marked.length > 1
        ? capable.filter((i) => ports.some((p) => p.index === i && p.side === side && p.key === key && !p.connected))
        : capable
    return eligible.map((i) => !!plan.pieces[i].borders?.[side]?.[key])
  }
  function checkbox(id, values, disabled, onChange) {
    const checked = values.length > 0 && values.every(Boolean),
      mixed = values.some(Boolean) && !checked
    return (
      <input
        data-testid={id}
        type="checkbox"
        checked={checked}
        aria-checked={mixed ? 'mixed' : checked}
        ref={(e) => {
          if (e) e.indeterminate = mixed
        }}
        disabled={disabled}
        onChange={onChange}
      />
    )
  }

  return (
    <details data-testid="track-borders" className="border rounded p-2 space-y-2">
      <summary className="font-semibold">{t('borders.title')}</summary>
      <p className="text-sm">{t('borders.note')}</p>
      <div className="flex flex-wrap gap-2 items-center">
        <label>
          {t('borders.scope')}{' '}
          <select data-testid="border-scope" value={scope} onChange={(e) => setScope(e.target.value)}>
            {['selected', 'curves', 'all'].map((v) => (
              <option value={v} key={v}>
                {t(`borders.${v}`)}
              </option>
            ))}
          </select>
        </label>
        {['outside', 'both', 'none'].map((mode) => (
          <Button
            key={mode}
            type="button"
            data-testid={`border-apply-${mode}`}
            variant="outline"
            disabled={!indices.length}
            onClick={() => onChange(applyTrackBorders(plan, indices, mode))}
          >
            {t(`borders.${mode}`)}
          </Button>
        ))}
        <Button
          data-testid="border-auto-ends"
          type="button"
          disabled={!indices.length}
          onClick={() => onChange(setFreeBorderEnds(plan, indices))}
        >
          {t('borders.autoEnds')}
        </Button>
      </div>
      {marked.length > 0 && (
        <fieldset className="border rounded p-2 space-y-1">
          <legend>{t('borders.selection', { count: marked.length })}</legend>
          {['left', 'right'].map((side) => {
            const applicable = marked.filter(
                (i) => borderArticle(plan.pieces[i].type, side) && !pitBorderSideBlocked(plan, i, side)
              ),
              configs = applicable.map((i) => plan.pieces[i].borders?.[side]),
              articles = [...new Set(applicable.map((i) => borderArticle(plan.pieces[i].type, side)))]
            return (
              <div key={side} className="flex flex-wrap gap-3 text-sm">
                <label>
                  {checkbox(`border-${side}`, configs.map(Boolean), !applicable.length, (e) =>
                    sideChange(side, e.target.checked)
                  )}{' '}
                  {t(`borders.${side}`)} · {articles.join(', ')}
                </label>
                {['startCap', 'endCap'].map((key) => (
                  <label key={key}>
                    {checkbox(
                      `border-${side}-${key}`,
                      capValues(side, key, applicable),
                      !configs.some(Boolean) || !capValues(side, key, applicable).length,
                      (e) => sideChange(side, e.target.checked, key)
                    )}{' '}
                    {t(`borders.${key}`)}
                  </label>
                ))}
                {applicable.length < marked.length && <span>{t('borders.pit')}</span>}
              </div>
            )
          })}
        </fieldset>
      )}

      <p data-testid="border-footprint" className="text-sm">
        {t('borders.footprint')}: {(actual.width / 1000).toFixed(3)} × {(actual.depth / 1000).toFixed(3)} m ·{' '}
        {t('borders.bare')}: {(bare.width / 1000).toFixed(3)} × {(bare.depth / 1000).toFixed(3)} m
      </p>
      <p className="text-xs">{t('borders.reserve')}</p>
      {!fits && (
        <p data-testid="border-room-warning" role="alert">
          {t('borders.noRoom')}
        </p>
      )}
      {conflicts.length > 0 && (
        <p data-testid="border-conflicts" role="alert">
          {t('borders.conflicts')}:{' '}
          {conflicts
            .slice(0, 12)
            .map((c) => `${c.border + 1} ↔ ${c.otherPit ? t('editor.doublePit') : c.other + 1}`)
            .join(', ')}
          {conflicts.length > 12 ? ' …' : ''}
        </p>
      )}
      <p className="text-xs">{t('borders.special')}</p>
      <BorderPartsList plan={plan} />
    </details>
  )
}
