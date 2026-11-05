import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@core/components/ui/button'
import { TrackPlanPreview } from '@core/components/tracks/TrackPlanPreview'
import {
  openTrackPorts,
  createPitAssembly,
  appendTrackTemplate,
  replaceWithPitAssembly,
  placeControlUnit,
  extractTrackTemplate,
  validateTrackPlan,
  trackBounds,
  inspectTrackBuild,
  validateRailInventory,
  RAIL_INVENTORY_KEY,
} from '@racehubos/shared'
const storageKey = 'racehubos.planner.templates.v1'
function readLibrary() {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || '[]')
    if (!Array.isArray(value) || value.length > 50) throw new Error()
    return { entries: value.map(readTemplate), error: '' }
  } catch {
    return { entries: [], error: 'templateStorageError' }
  }
}
function readTemplate(value) {
  if (
    value?.kind !== 'racehubos.track-template' ||
    value.version !== 1 ||
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    value.name.length > 100
  )
    throw new Error('templateInvalid')
  const plan = validateTrackPlan(value.plan)
  if (!plan.pieces.length) throw new Error('templateInvalid')
  return {
    kind: value.kind,
    version: 1,
    name: value.name,
    plan: extractTrackTemplate(
      plan,
      plan.pieces.map((_, i) => i)
    ),
  }
}
export default function PlannerTools({
  plan,
  selected,
  indices,
  onChange,
  onSelect,
  onSelectIndices,
  fit,
  endpointKey,
  onEndpoint,
  onInspect,
}) {
  const { t } = useTranslation('tracks')
  const [dialog, setDialog] = useState(null)
  const [error, setError] = useState('')
  const [bays, setBays] = useState(2),
    [otherSide, setOtherSide] = useState(false)
  const [placement, setPlacement] = useState('append'),
    [proposal, setProposal] = useState(null)
  const [library, setLibrary] = useState(readLibrary),
    [templateName, setTemplateName] = useState(''),
    [templateIndex, setTemplateIndex] = useState(0)
  const [stockLoading, setStockLoading] = useState(false)
  const [stock, setStock] = useState(null),
    [audit, setAudit] = useState(null)
  const upload = useRef(null),
    closeButton = useRef(null)
  const ports = dialog ? openTrackPorts(plan) : []
  const port =
    ports.find((p) => `${p.index}:${p.end}` === endpointKey) ||
    ports.find((p) => p.index === selected && p.end === 1) ||
    ports.find((p) => p.index === selected) ||
    ports.at(-1) ||
    null
  useEffect(() => {
    if (dialog) closeButton.current?.focus()
  }, [dialog])
  useEffect(() => {
    if (dialog !== 'audit') return
    setStockLoading(true)
    const controller = new AbortController()
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/preferences/${RAIL_INVENTORY_KEY}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then((data) => {
        if (!controller.signal.aborted) setStock(data.data ? validateRailInventory(data.data) : null)
      })
      .catch(() => {
        if (!controller.signal.aborted) setStock(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setStockLoading(false)
      })
    return () => controller.abort()
  }, [dialog])
  function open(kind) {
    setError('')
    setProposal(null)
    setAudit(null)
    setDialog(kind)
    if (kind === 'box') setPlacement(openTrackPorts(plan).length || !plan.pieces.length ? 'append' : 'replace')
  }
  function attempt(fn) {
    try {
      fn()
      setError('')
    } catch (e) {
      setError(e.message || 'failed')
    }
  }
  function saveLibrary(entries) {
    if (entries.length > 50) throw new Error('templateLimit')
    try {
      localStorage.setItem(storageKey, JSON.stringify(entries))
    } catch {
      throw new Error('templateStorageError')
    }
    setLibrary({ entries, error: '' })
  }
  function previewBox() {
    if (placement === 'append') {
      if (plan.pieces.length && !port) throw new Error('openPort')
      setProposal(appendTrackTemplate(plan, createPitAssembly({ bays }), port, otherSide))
    } else setProposal(replaceWithPitAssembly(plan, selected, { bays, otherSide }))
  }
  function apply(next, index) {
    onChange(next)
    onSelect(index)
    fit()
    setDialog(null)
  }
  const modal =
    dialog &&
    createPortal(
      <div
        className="planner-tools-backdrop"
        onClick={(e) => {
          if (e.target === e.currentTarget) setDialog(null)
        }}
      >
        <section
          className="planner-tools-dialog"
          role="dialog"
          aria-modal="true"
          aria-label={t(`tools.${dialog}`)}
          data-testid="planner-tools-dialog"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation()
              setDialog(null)
            }
            if (e.key === 'Tab') {
              const focusable = [
                ...e.currentTarget.querySelectorAll(
                  'button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]'
                ),
              ].filter((n) => !n.hidden && n.getClientRects().length)
              if (e.shiftKey && document.activeElement === focusable[0]) {
                e.preventDefault()
                focusable.at(-1)?.focus()
              } else if (!e.shiftKey && document.activeElement === focusable.at(-1)) {
                e.preventDefault()
                focusable[0]?.focus()
              }
            }
          }}
        >
          <header>
            <h2>{t(`tools.${dialog}`)}</h2>
            <Button
              ref={closeButton}
              type="button"
              variant="outline"
              data-testid="tools-close"
              onClick={() => setDialog(null)}
            >
              {t('tools.close')}
            </Button>
          </header>
          {error && (
            <p role="alert" data-testid="tools-error">
              {t(`tools.errors.${error}`, { defaultValue: t('tools.errors.failed') })}
            </p>
          )}
          {(dialog === 'box' || dialog === 'templates') && (
            <label>
              {t('tools.connection')}{' '}
              <select
                data-testid="tools-port"
                value={port ? `${port.index}:${port.end}` : ''}
                onChange={(e) => {
                  onEndpoint(e.target.value)
                  setProposal(null)
                }}
              >
                {!ports.length && (
                  <option value="">{t(plan.pieces.length ? 'tools.noOpenPort' : 'tools.origin')}</option>
                )}
                {ports.map((p) => (
                  <option key={`${p.index}:${p.end}`} value={`${p.index}:${p.end}`}>
                    {p.index + 1} · {t(p.end ? 'tools.end' : 'tools.start')} · {p.x.toFixed(0)}, {p.y.toFixed(0)} mm
                  </option>
                ))}
              </select>
            </label>
          )}
          {dialog === 'box' && (
            <>
              <p>{t('tools.boxNote')}</p>
              <label>
                {t('tools.placement')}{' '}
                <select
                  data-testid="box-placement"
                  value={placement}
                  onChange={(e) => {
                    setPlacement(e.target.value)
                    setProposal(null)
                  }}
                >
                  <option value="append">{t('tools.append')}</option>
                  <option value="replace">{t('tools.replaceSix')}</option>
                </select>
              </label>
              <label>
                {t('tools.bays')}{' '}
                <select
                  data-testid="box-bays"
                  value={bays}
                  onChange={(e) => {
                    setBays(Number(e.target.value))
                    setProposal(null)
                  }}
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                </select>
              </label>
              <label>
                {t('tools.side')}{' '}
                <select
                  data-testid="box-side"
                  value={otherSide ? 'other' : 'normal'}
                  onChange={(e) => {
                    setOtherSide(e.target.value === 'other')
                    setProposal(null)
                  }}
                >
                  <option value="normal">{t('tools.normalSide')}</option>
                  <option value="other">{t('tools.otherSide')}</option>
                </select>
              </label>
              <p>{t('tools.reverseNote')}</p>
              <Button type="button" data-testid="box-preview" onClick={() => attempt(previewBox)}>
                {t('tools.preview')}
              </Button>
              {proposal && (
                <>
                  <svg
                    className="planner-tools-preview"
                    data-testid="box-proposal"
                    viewBox={(() => {
                      const b = trackBounds(proposal)
                      return `${b.x - 80} ${b.y - 80} ${b.width + 160} ${b.depth + 160}`
                    })()}
                  >
                    <TrackPlanPreview plan={proposal} embedded />
                  </svg>
                  <p>{t('tools.proposalNote')}</p>
                  <Button
                    type="button"
                    data-testid="box-apply"
                    onClick={() => apply(proposal, placement === 'replace' ? selected : plan.pieces.length)}
                  >
                    {t('tools.apply')}
                  </Button>
                </>
              )}
            </>
          )}
          {dialog === 'templates' && (
            <>
              <p>{t('tools.templatesNote')}</p>
              {library.error && <p role="alert">{t(`tools.errors.${library.error}`)}</p>}
              <label>
                {t('tools.templateName')}{' '}
                <input
                  data-testid="template-name"
                  maxLength={100}
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
              </label>
              <Button
                type="button"
                data-testid="template-save"
                disabled={!indices.length || !templateName.trim()}
                onClick={() =>
                  attempt(() => {
                    saveLibrary([
                      ...library.entries,
                      {
                        kind: 'racehubos.track-template',
                        version: 1,
                        name: templateName.trim(),
                        plan: extractTrackTemplate(plan, indices),
                      },
                    ])
                    setTemplateIndex(library.entries.length)
                    setTemplateName('')
                  })
                }
              >
                {t('tools.saveSelection')}
              </Button>
              <label>
                {t('tools.templates')}{' '}
                <select
                  data-testid="template-select"
                  value={templateIndex}
                  onChange={(e) => setTemplateIndex(Number(e.target.value))}
                >
                  {!library.entries.length && <option value="0">—</option>}
                  {library.entries.map((p, i) => (
                    <option value={i} key={i}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="planner-tools-actions">
                <Button
                  type="button"
                  data-testid="template-insert"
                  disabled={!library.entries[templateIndex] || (plan.pieces.length > 0 && !port)}
                  onClick={() =>
                    attempt(() =>
                      apply(appendTrackTemplate(plan, library.entries[templateIndex].plan, port), plan.pieces.length)
                    )
                  }
                >
                  {t('tools.insertTemplate')}
                </Button>
                <Button
                  type="button"
                  data-testid="template-export"
                  disabled={!library.entries[templateIndex]}
                  onClick={() => {
                    const url = URL.createObjectURL(
                      new Blob([JSON.stringify(library.entries[templateIndex], null, 2)], { type: 'application/json' })
                    )
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'carrera-baugruppe.json'
                    a.click()
                    setTimeout(() => URL.revokeObjectURL(url), 1000)
                  }}
                >
                  {t('tools.exportTemplate')}
                </Button>
                <Button type="button" data-testid="template-import-open" onClick={() => upload.current.click()}>
                  {t('tools.importTemplate')}
                </Button>
                <Button
                  type="button"
                  data-testid="template-delete"
                  variant="outline"
                  disabled={!library.entries[templateIndex]}
                  onClick={() =>
                    attempt(() => {
                      saveLibrary(library.entries.filter((_, i) => i !== templateIndex))
                      setTemplateIndex(0)
                    })
                  }
                >
                  {t('tools.deleteTemplate')}
                </Button>
              </div>
              <input
                hidden
                ref={upload}
                type="file"
                accept=".json"
                data-testid="template-import"
                onChange={async (e) => {
                  const file = e.target.files[0]
                  e.target.value = ''
                  if (!file) return
                  try {
                    if (file.size > 2000000) throw new Error('templateInvalid')
                    const value = readTemplate(JSON.parse(await file.text()))
                    saveLibrary([...library.entries, value])
                    setTemplateIndex(library.entries.length)
                    setError('')
                  } catch (err) {
                    setError(err.message === 'templateStorageError' ? err.message : 'templateInvalid')
                  }
                }}
              />
            </>
          )}
          {dialog === 'audit' && (
            <>
              <p>{t('tools.auditNote')}</p>
              {!stock && !stockLoading && <p>{t('tools.stockUnavailable')}</p>}
              <Button
                type="button"
                data-testid="audit-run"
                disabled={stockLoading}
                onClick={() =>
                  attempt(() => {
                    const result = inspectTrackBuild(plan, stock)
                    setAudit(result)
                    onInspect(
                      result.conflicts.flatMap((p) => p.indices),
                      result.auxiliaryPorts
                    )
                  })
                }
              >
                {t('tools.runAudit')}
              </Button>
              {audit && (
                <div data-testid="audit-result">
                  <p>
                    {t('tools.auditSummary', {
                      open: audit.openPorts.length + audit.auxiliaryPorts.length,
                      conflicts: audit.conflicts.length,
                      components: audit.components,
                    })}
                  </p>
                  <h3>{t('tools.openPorts')}</h3>
                  <ul>
                    {audit.openPorts.map((p) => (
                      <li key={`${p.index}:${p.end}`}>
                        <button
                          type="button"
                          data-testid={`audit-port-${p.index}-${p.end}`}
                          onClick={() => {
                            onEndpoint(`${p.index}:${p.end}`)
                            onSelectIndices([p.index])
                            fit()
                            setDialog(null)
                          }}
                        >
                          {p.index + 1} · {t(p.end ? 'tools.end' : 'tools.start')} · {p.x.toFixed(1)}, {p.y.toFixed(1)}{' '}
                          mm
                        </button>
                      </li>
                    ))}
                  </ul>
                  {!!audit.auxiliaryPorts.length && (
                    <>
                      <h3>{t('tools.auxiliaryPorts')}</h3>
                      <ul>
                        {audit.auxiliaryPorts.map((p, i) => (
                          <li key={i}>
                            <button
                              type="button"
                              data-testid={`audit-auxiliary-${i}`}
                              onClick={() => {
                                if (p.index !== undefined) onSelectIndices([p.index])
                                fit()
                                setDialog(null)
                              }}
                            >
                              P{p.extraIndex + 1} · {p.x.toFixed(1)}, {p.y.toFixed(1)} mm
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <h3>{t('tools.overlaps')}</h3>
                  <ul>
                    {audit.conflicts.map((p, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          data-testid={`audit-conflict-${i}`}
                          onClick={() => {
                            onSelectIndices(p.indices)
                            fit()
                            setDialog(null)
                          }}
                        >
                          {p.a} ↔ {p.b}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <h3>{t('tools.missing')}</h3>
                  {audit.missing === null ? (
                    <p>{t('tools.stockUnavailable')}</p>
                  ) : (
                    <ul>
                      {audit.missing.map((p) => (
                        <li key={p.article}>
                          {p.article}: {p.required - p.available}
                        </li>
                      ))}
                    </ul>
                  )}
                  {!!audit.unresolved.length && (
                    <p>
                      {t('tools.unresolved')}: {audit.unresolved.join(', ')}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>,
      document.body
    )
  return (
    <>
      <div className="planner-tools-launchers">
        <Button type="button" variant="outline" data-testid="tools-box" onClick={() => open('box')}>
          {t('tools.box')}
        </Button>
        <Button
          type="button"
          variant="outline"
          data-testid="tools-cu"
          disabled={plan.pieces[selected]?.type !== 'Standardgerade'}
          onClick={() =>
            attempt(() => {
              onChange(placeControlUnit(plan, selected))
              fit()
            })
          }
        >
          {t('tools.cu')}
        </Button>
        <Button type="button" variant="outline" data-testid="tools-templates" onClick={() => open('templates')}>
          {t('tools.templates')}
        </Button>
        <Button type="button" variant="outline" data-testid="tools-audit" onClick={() => open('audit')}>
          {t('tools.audit')}
        </Button>
        {error && !dialog && (
          <p role="alert">{t(`tools.errors.${error}`, { defaultValue: t('tools.errors.failed') })}</p>
        )}
      </div>
      {modal}
    </>
  )
}
