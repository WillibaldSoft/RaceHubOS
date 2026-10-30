import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CARRERA_RAILS,
  RAIL_INVENTORY_KEY,
  emptyRailInventory,
  validateRailInventory,
  transferRailRequirements,
  sortRailInventoryRows,
} from '@racehubos/shared'
import RailInventorySort from './RailInventorySort'
import { Button } from '@core/components/ui/button'
const endpoint = `${import.meta.env.VITE_API_URL || ''}/api/preferences/${RAIL_INVENTORY_KEY}`

export default function RailInventoryEditor({
  inventory,
  onChange,
  sourcePlan,
  sourceName,
  standalone = false,
  onStockChange,
  sortOrder,
  onSortChange,
}) {
  const { t } = useTranslation('tracks')
  const [stock, setStock] = useState(inventory || emptyRailInventory())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [unresolved, setUnresolved] = useState([])
  const [localSort, setLocalSort] = useState('stockDesc')
  const ordering = sortOrder ?? localSort
  const [transferMode, setTransferMode] = useState('replace'),
    [search, setSearch] = useState('')
  useEffect(() => {
    onStockChange?.(stock)
  }, [stock, onStockChange])
  useEffect(() => {
    const controller = new AbortController()
    fetch(endpoint, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error()
        const data = await res.json()
        if (!inventory && data.data) setStock(validateRailInventory(data.data))
      })
      .catch(() => {
        if (!controller.signal.aborted) setMessage('loadError')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
    // A saved room's inventory is a snapshot; it must not silently follow global edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  function update(next) {
    setStock(next)
    setMessage('unsaved')
    if (inventory) onChange?.(next)
  }
  function seed() {
    try {
      const result = transferRailRequirements(stock, sourcePlan, transferMode)
      setUnresolved(result.unresolved)
      update(result.inventory)
    } catch {
      setMessage('importError')
    }
  }
  async function save() {
    setSaving(true)
    try {
      const value = validateRailInventory(stock)
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      })
      if (!res.ok) throw new Error()
      setMessage('saved')
    } catch {
      setMessage('saveError')
    } finally {
      setSaving(false)
    }
  }
  function exportFile() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(stock, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'Carrera-Schienenbestand.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function importFile(file) {
    if (!file) return
    try {
      if (file.size > 100000) throw new Error()
      update(validateRailInventory(JSON.parse(await file.text())))
      setUnresolved([])
    } catch {
      setMessage('importError')
    }
  }
  return (
    <details className="border rounded p-2 space-y-2" data-testid="rail-inventory-editor" open>
      <summary className="font-semibold">{t('inventory.title')}</summary>
      <p className="text-sm">{t('inventory.note')}</p>
      {!standalone && (
        <label className="block">
          <input
            data-testid="use-rail-inventory"
            type="checkbox"
            disabled={loading}
            checked={!!inventory}
            onChange={(e) => onChange(e.target.checked ? stock : null)}
          />{' '}
          {t('inventory.restrict')}
        </label>
      )}
      <fieldset disabled={loading || saving} className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <label>
            {t('inventory.transferMode')}{' '}
            <select
              data-testid="inventory-transfer-mode"
              value={transferMode}
              onChange={(e) => setTransferMode(e.target.value)}
            >
              <option value="replace">{t('inventory.replace')}</option>
              <option value="add">{t('inventory.add')}</option>
            </select>
          </label>
          <Button
            data-testid="seed-rail-inventory"
            disabled={!sourcePlan?.pieces.length}
            type="button"
            variant="outline"
            onClick={seed}
          >
            {t('inventory.seed', { name: sourceName })}
          </Button>
          <Button data-testid="save-rail-inventory" type="button" onClick={save}>
            {t('inventory.save')}
          </Button>
        </div>
        <RailInventorySort
          value={ordering}
          onChange={(value) => {
            setLocalSort(value)
            onSortChange?.(value)
          }}
        />
        <input
          data-testid="inventory-search"
          className="border rounded p-2 w-full"
          aria-label={t('graph.search')}
          placeholder={t('graph.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="max-h-72 overflow-auto border rounded">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background">
              <tr>
                <th className="text-left p-1">{t('inventory.article')}</th>
                <th className="text-left p-1">{t('inventory.part')}</th>
                <th className="p-1">{t('inventory.available')}</th>
              </tr>
            </thead>
            <tbody>
              {sortRailInventoryRows(CARRERA_RAILS, stock.counts, ordering)
                .filter((p) =>
                  (
                    p.article +
                    ' ' +
                    (p.aliases || []).join(' ') +
                    ' ' +
                    t(`inventory.parts.${p.label}`, {
                      defaultValue: p.name || p.label,
                    })
                  )
                    .toLowerCase()
                    .includes(search.toLowerCase())
                )
                .map((p) => (
                  <tr key={p.article} data-testid={`inventory-row-${p.article}`} className="border-t">
                    <td className="p-1">{[p.article, ...(p.aliases || [])].join(' / ')}</td>
                    <td className="p-1">
                      <label htmlFor={`stock-${p.article}`}>
                        {t(`inventory.parts.${p.label}`, {
                          defaultValue: p.name || p.label,
                        })}
                      </label>
                    </td>
                    <td className="p-1">
                      <input
                        id={`stock-${p.article}`}
                        data-testid={`stock-${p.article}`}
                        className="border rounded p-1 w-20"
                        type="number"
                        min="0"
                        max="2000"
                        step="1"
                        value={stock.counts[p.article]}
                        onChange={(e) =>
                          update({
                            ...stock,
                            counts: {
                              ...stock.counts,
                              [p.article]: Math.min(2000, Math.max(0, Math.trunc(Number(e.target.value) || 0))),
                            },
                          })
                        }
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={exportFile}>
            {t('inventory.export')}
          </Button>
          <label className="text-sm">
            {t('inventory.import')}
            <input
              data-testid="rail-inventory-import"
              type="file"
              accept=".json"
              onChange={(e) => {
                importFile(e.target.files[0])
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </fieldset>
      {unresolved.length > 0 && (
        <p role="alert" className="text-sm">
          {t('inventory.unresolved')}: {unresolved.join(', ')}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm">
          {t(`inventory.${message}`)}
        </p>
      )}
      <a
        className="text-xs underline"
        href="https://backend.carrera-toys.com/api/cms/download/333683"
        target="_blank"
        rel="noreferrer"
      >
        {t('inventory.catalogue')}
      </a>
    </details>
  )
}

export { RailRequirementsTable } from '@core/components/tracks/RailRequirementsTable'
