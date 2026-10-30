import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { emptyRailInventory, readTrackPlan, inventoryComparison, sortRailInventoryRows } from '@racehubos/shared'
import RailInventorySort from './RailInventorySort'
import RailInventoryEditor from './RailInventoryEditor'
import { Button } from '@core/components/ui/button'
const api = import.meta.env.VITE_API_URL || ''
export default function TrackPartsManager({ plan, name }) {
  const { t } = useTranslation('tracks')
  const [open, setOpen] = useState(false),
    [tracks, setTracks] = useState([]),
    [source, setSource] = useState(''),
    [error, setError] = useState(false)
  const [sortOrder, setSortOrder] = useState('stockDesc')
  const [stock, setStock] = useState(emptyRailInventory),
    [view, setView] = useState('compare'),
    [printPreview, setPrintPreview] = useState(false)
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    async function load() {
      try {
        const all = []
        for (let offset = 0; offset < 10000; offset += 100) {
          const res = await fetch(`${api}/api/tracks?limit=100&offset=${offset}`, { signal: controller.signal })
          if (!res.ok) throw new Error()
          const data = await res.json()
          all.push(...data.data.filter((p) => readTrackPlan(p.layout)))
          if (!data.hasMore) break
        }
        if (!controller.signal.aborted) {
          setTracks(all)
          setError(false)
        }
      } catch {
        if (!controller.signal.aborted) setError(true)
      }
    }
    load()
    return () => controller.abort()
  }, [open])
  const reference = tracks.find((p) => p.id === source),
    sourcePlan = reference ? readTrackPlan(reference.layout) : plan,
    sourceName = reference?.name || name
  const comparison = inventoryComparison(sourcePlan, stock),
    rows = sortRailInventoryRows(comparison.rows, stock.counts, sortOrder).filter((r) =>
      view === 'stock' ? r.available > 0 : view === 'required' ? r.required > 0 : r.available > 0 || r.required > 0
    )
  return (
    <>
      <Button
        type="button"
        variant="outline"
        data-testid="track-parts-manager"
        onClick={() => {
          setPrintPreview(false)
          setOpen(true)
        }}
      >
        {t('inventory.managePrint')}
      </Button>
      {open &&
        createPortal(
          <div
            className="track-parts-portal fixed inset-0 z-[110] bg-background text-foreground overflow-auto p-5"
            role="dialog"
            aria-modal="true"
            aria-label={t('inventory.managePrint')}
            data-testid="track-parts-dialog"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation()
                setOpen(false)
              }
            }}
          >
            <style>{`@media print{@page{size:A4 portrait;margin:12mm}body>*:not(.track-parts-portal){display:none!important}.track-parts-portal{position:static!important;padding:0!important;overflow:visible!important;background:white!important;color:black!important}.track-parts-portal .parts-tools{display:none!important}.track-parts-portal table{width:100%;border-collapse:collapse;font-size:10pt}.track-parts-portal th,.track-parts-portal td{border-bottom:1px solid #aaa;padding:5px}.track-parts-portal thead{display:table-header-group}.track-parts-portal tr{break-inside:avoid}}`}</style>
            <div className="parts-tools flex flex-wrap items-center gap-3 mb-4">
              <h2 className="text-xl font-bold mr-auto">{t('inventory.managePrint')}</h2>
              <Button
                data-testid="inventory-print-preview"
                type="button"
                variant="outline"
                onClick={() => setPrintPreview((v) => !v)}
              >
                {t(printPreview ? 'inventory.editStock' : 'inventory.printPreview')}
              </Button>
              <Button data-testid="inventory-print" type="button" onClick={() => window.print()}>
                {t('print.print')}
              </Button>
              <Button data-testid="inventory-close" type="button" variant="outline" onClick={() => setOpen(false)}>
                {t('print.close')}
              </Button>
            </div>
            <div className="parts-tools mb-4">
              <label>
                {t('inventory.source')}{' '}
                <select
                  data-testid="inventory-source"
                  className="border rounded p-2"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                >
                  <option value="">
                    {t('inventory.currentPlan')} · {name}
                  </option>
                  {tracks.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              {error && <p role="alert">{t('inventory.sourceError')}</p>}
            </div>
            <div className="parts-tools" hidden={printPreview}>
              <RailInventoryEditor
                standalone
                sortOrder={sortOrder}
                onSortChange={setSortOrder}
                sourcePlan={sourcePlan}
                sourceName={sourceName}
                onStockChange={setStock}
              />
            </div>
            <section className="mt-5" data-testid="inventory-print-sheet">
              <div className="parts-tools mb-3">
                <label>
                  {t('inventory.printList')}{' '}
                  <select
                    data-testid="inventory-print-list"
                    className="border rounded p-2"
                    value={view}
                    onChange={(e) => setView(e.target.value)}
                  >
                    {['compare', 'stock', 'required'].map((v) => (
                      <option key={v} value={v}>
                        {t(`inventory.list_${v}`)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="parts-tools mb-3">
                <RailInventorySort testId="inventory-print-sort" value={sortOrder} onChange={setSortOrder} />
              </div>
              <h2 className="text-xl font-bold">{t(`inventory.list_${view}`)}</h2>
              <p>{sourceName}</p>
              <p className="text-sm mb-3">{t('inventory.countingNote')}</p>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left">{t('inventory.article')}</th>
                    <th className="text-left">{t('inventory.part')}</th>
                    {view !== 'required' && <th>{t('inventory.available')}</th>}
                    {view !== 'stock' && <th>{t('inventory.required')}</th>}
                    {view === 'compare' && <th>{t('inventory.missingQuantity')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.article} data-testid={`inventory-print-row-${r.article}`} className="border-b">
                      <td>{r.article}</td>
                      <td>
                        {t(`inventory.parts.${r.label}`, {
                          defaultValue: r.name || r.label,
                        })}
                      </td>
                      {view !== 'required' && <td className="text-center">{r.available}</td>}
                      {view !== 'stock' && <td className="text-center">{r.required}</td>}
                      {view === 'compare' && <td className="text-center">{Math.max(0, -r.remaining)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && <p>{t('inventory.emptyList')}</p>}
              {comparison.unresolved.length > 0 && view !== 'stock' && (
                <p role="alert">
                  {t('inventory.unresolved')}: {comparison.unresolved.join(', ')}
                </p>
              )}
            </section>
          </div>,
          document.body
        )}
    </>
  )
}
