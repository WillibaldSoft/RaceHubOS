import './trackPlanner.css'
import { Route, FolderOpen, Save, Minimize2, Maximize2, Upload, Download, FileJson, ArrowLeft } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  emptyTrackPlan,
  readTrackPlan,
  traceTrackPlan,
  importTrackTrk,
  serializeTrackPlan,
  exportSoftyRoyal,
  exportAutorennbahnTrk,
  importSoftyRoyal,
} from '@racehubos/shared'
import { Button } from '@core/components/ui/button'
import { labelTrackPart as label } from '@core/components/tracks/trackPartLabel'
import GraphicalTrackEditor from './GraphicalTrackEditor'
import RoomPlanner, { SavedRoomPlan } from './RoomPlanner'

import { TrackPlanSummary } from '@core/components/tracks/TrackPlanSummary'

export default function TrackPlanEditor({
  value,
  onChange,
  trackName = 'Streckenplan',
  onNameChange,
  expanded = true,
  onExpandedChange,
  onCancel,
  saving = false,
  statusError = '',
  statusSuccess = '',
  onImportNew,
}) {
  const { t } = useTranslation('tracks')
  const fileInput = useRef(null)
  const [selected, setSelected] = useState(-1)
  const [mode, setMode] = useState('editor')
  const [past, setPast] = useState([])
  const [future, setFuture] = useState([])
  const [error, setError] = useState('')
  const plan = value
  const update = (next) => {
    if (plan) setPast((p) => [...p.slice(-49), plan])
    setFuture([])
    onChange(next)
    setError('')
  }
  function undo() {
    if (!past.length) return
    setFuture((f) => [plan, ...f])
    onChange(past.at(-1))
    setPast((p) => p.slice(0, -1))
    setSelected(-1)
  }
  function redo() {
    if (!future.length) return
    setPast((p) => [...p, plan])
    onChange(future[0])
    setFuture((f) => f.slice(1))
    setSelected(-1)
  }
  function chooseImport(accept = '.json,.trk,.sbp') {
    if (fileInput.current) {
      fileInput.current.accept = accept
      fileInput.current.click()
    }
  }
  async function importFile(file) {
    if (!file) return
    try {
      if (file.size > 2000000) throw new Error()
      const buffer = await file.arrayBuffer()
      const next = file.name.toLowerCase().endsWith('.trk')
        ? importTrackTrk(new TextDecoder('windows-1252').decode(buffer))
        : file.name.toLowerCase().endsWith('.sbp')
          ? importSoftyRoyal(JSON.parse(new TextDecoder().decode(buffer)))
          : readTrackPlan(new TextDecoder().decode(buffer))
      if (!next) throw new Error()
      update(next)
      onImportNew?.(
        `${file.name.replace(/\.[^.]+$/, '').slice(0, 150)} · ${file.name.toLowerCase().endsWith('.sbp') ? 'Softy' : 'Import'}`
      )
      setSelected(-1)
      setMode('editor')
    } catch (e) {
      setError(
        e.message?.startsWith('Unsupported SBP parts:')
          ? `${t('native.unsupported')} ${e.message.slice(23)}`
          : t('editor.importError')
      )
    }
  }
  function exportFile() {
    const url = URL.createObjectURL(new Blob([serializeTrackPlan(plan)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'racehubos-track.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  function exportExternal(format) {
    try {
      const exported =
        format === 'sbp'
          ? JSON.stringify(exportSoftyRoyal(plan, trackName).file, null, 2)
          : exportAutorennbahnTrk(plan).text
      const url = URL.createObjectURL(
        new Blob([exported], {
          type: format === 'sbp' ? 'application/json' : 'text/plain;charset=windows-1252',
        })
      )
      const a = document.createElement('a')
      a.href = url
      a.download = `${trackName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Streckenplan'}.${format}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setError('')
    } catch {
      setError(t('editor.externalError'))
    }
  }
  if (!plan)
    return (
      <Button
        data-testid="enable-track-editor"
        type="button"
        variant="outline"
        onClick={() => update(emptyTrackPlan())}
      >
        {t('editor.enable')}
      </Button>
    )
  return (
    <section
      className={`planner-workspace ${expanded ? 'is-fullscreen' : 'is-compact'}`}
      data-planner-expanded={expanded}
      data-testid="track-plan-editor"
    >
      <header className="planner-header">
        <div className="planner-brand">
          <span className="planner-brand-icon">
            <Route size={23} />
          </span>
          <div>
            <span className="planner-eyebrow">RaceHubOS · {t('work.offline')}</span>
            <input
              className="planner-name"
              title={trackName}
              aria-label={t('work.name')}
              value={trackName}
              readOnly={!onNameChange}
              onChange={(e) => onNameChange?.(e.target.value)}
              placeholder={t('work.name')}
            />
          </div>
        </div>
        <div className="planner-header-actions">
          <select
            data-testid="planner-mode"
            aria-label={t('room.mode')}
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="editor">{t('editor.title')}</option>
            <option value="room">{t('room.title')}</option>
            <option value="files">{t('work.files')}</option>
          </select>
          <Button
            type="button"
            variant={mode === 'files' ? 'secondary' : 'outline'}
            data-testid="planner-files-toggle"
            onClick={() => setMode(mode === 'files' ? 'editor' : 'files')}
          >
            <FolderOpen />
            {t('work.files')}
          </Button>

          {expanded && (
            <>
              <Button type="button" variant="ghost" onClick={onCancel || (() => onExpandedChange?.(false))}>
                <ArrowLeft />
                {t('common:cancel')}
              </Button>
              <Button
                data-testid="planner-save"
                type="submit"
                disabled={saving || !trackName.trim() || !plan.pieces.length}
              >
                <Save />
                {t(saving ? 'common:saving' : 'common:save')}
              </Button>
            </>
          )}
        </div>
      </header>
      <div className="planner-body">
        {(error || statusError || statusSuccess) && (
          <p role={error || statusError ? 'alert' : 'status'} className="planner-notice">
            {error || statusError || statusSuccess}
          </p>
        )}
        {plan.softyImport && (
          <p role="status" data-testid="softy-import-report" className="planner-notice">
            {t('native.report', plan.softyImport)} {t('native.heightNote')} {t('native.copyNote')}
          </p>
        )}
        <div hidden={mode !== 'editor'} className="planner-graph-pane">
          <GraphicalTrackEditor
            plan={plan}
            selected={selected}
            onSelect={setSelected}
            onChange={update}
            undo={undo}
            redo={redo}
            canUndo={!!past.length}
            canRedo={!!future.length}
            name={trackName}
            expanded={expanded}
          />
        </div>
        {mode === 'room' && (
          <div className="planner-room">
            <RoomPlanner
              sourcePlan={plan}
              sourceName={trackName}
              initialRoom={plan.roomPlan}
              onApply={(next) => {
                update(next)
                setSelected(-1)
                setMode('editor')
              }}
            />
          </div>
        )}
        <section hidden={mode !== 'files'} className="planner-files" data-testid="planner-files">
          <div className="planner-section-heading">
            <div>
              <span className="planner-eyebrow">JSON · SBP · TRK</span>
              <h2>{t('work.filesTitle')}</h2>
              <p>{t('work.filesNote')}</p>
            </div>
            <Button type="button" variant="outline" onClick={() => setMode('editor')}>
              <ArrowLeft />
              {t('work.back')}
            </Button>
          </div>
          <div className="planner-import-card">
            <Upload size={28} />
            <div>
              <h3>{t('editor.import')}</h3>
              <p>{t('work.importNote')}</p>
            </div>
            <input
              ref={fileInput}
              data-testid="track-plan-import"
              hidden
              type="file"
              accept=".json,.trk,.sbp"
              onChange={(e) => {
                importFile(e.target.files[0])
                e.target.value = ''
              }}
            />
            <Button type="button" data-testid="planner-import-open" onClick={() => chooseImport()}>
              {t('work.chooseFile')}
            </Button>
          </div>
          <div className="planner-file-grid">
            <article className="planner-file-card">
              <span className="planner-format">
                <FileJson /> JSON
              </span>
              <h3>RaceHubOS</h3>
              <p>{t('work.jsonNote')}</p>
              <Button
                type="button"
                variant="outline"
                data-testid="import-track-json"
                onClick={() => chooseImport('.json')}
              >
                {t('work.importJson')}
              </Button>
              <Button data-testid="export-track-json" type="button" variant="outline" onClick={exportFile}>
                <Download />
                {t('editor.export')}
              </Button>
            </article>
            <article className="planner-file-card">
              <span className="planner-format">
                <Route /> SBP
              </span>
              <h3>Softyroyal</h3>
              <p>{t('work.softyNote')}</p>
              <Button
                type="button"
                variant="outline"
                data-testid="import-softyroyal"
                onClick={() => chooseImport('.sbp')}
              >
                {t('work.importSofty')}
              </Button>
              <Button data-testid="export-softyroyal" type="button" onClick={() => exportExternal('sbp')}>
                <Download />
                {t('editor.exportSofty')}
              </Button>
            </article>
            <article className="planner-file-card">
              <span className="planner-format">
                <Route /> TRK
              </span>
              <h3>Autorennbahnplaner</h3>
              <p>{t('work.trkNote')}</p>
              <Button
                type="button"
                variant="outline"
                data-testid="import-autorennbahn-trk"
                onClick={() => chooseImport('.trk')}
              >
                {t('work.importTrk')}
              </Button>
              <Button
                data-testid="export-autorennbahn-trk"
                type="button"
                variant="outline"
                disabled={!!plan.freePlacement}
                onClick={() => exportExternal('trk')}
              >
                <Download />
                {t('editor.exportTrk')}
              </Button>
              {plan.freePlacement && <p className="planner-format-warning">{t('work.trkFree')}</p>}
            </article>
          </div>
          <details className="planner-details">
            <summary>{t('work.compatibility')}</summary>
            <p>{t('editor.externalNote')}</p>
            <p>{t('editor.importNote')}</p>
          </details>
          <div className="planner-reference">
            <Button
              data-testid="load-froehlichring"
              type="button"
              variant="outline"
              onClick={async () => {
                try {
                  const res = await fetch(new URL('track-plans/froehlichring.json', window.location.href))
                  if (!res.ok) throw new Error()
                  const next = readTrackPlan(await res.json())
                  if (!next) throw new Error()
                  update(next)
                  setSelected(-1)
                  setMode('editor')
                } catch {
                  setError(t('editor.importError'))
                }
              }}
            >
              {t('editor.example')}
            </Button>
            <a href="./track-plans/froehlichring-reference.svg" target="_blank" rel="noreferrer">
              {t('editor.reference')}
            </a>
          </div>
        </section>
        <details className="planner-details" hidden={mode === 'files'}>
          <summary>{t('work.metrics')}</summary>
          <TrackPlanSummary plan={plan} />
          <SavedRoomPlan plan={plan} name={trackName} />
        </details>
        <details className="planner-details">
          <summary>{t('graph.advanced')}</summary>
          <p className="text-xs text-muted-foreground">
            {t(plan.geometryProfile === 'prototype' ? 'editor.prototypeNote' : 'editor.geometryNote')}
          </p>
          <label className="block">
            <input
              type="checkbox"
              checked={plan.pit.enabled}
              disabled={!plan.pieces.length || plan.pit.native}
              onChange={(e) =>
                update({
                  ...plan,
                  pit: { ...plan.pit, enabled: e.target.checked },
                })
              }
            />{' '}
            {t('editor.doublePit')}
          </label>
          {plan.pit.enabled && !plan.pit.native && (
            <div className="grid grid-cols-2 gap-2">
              {['entry', 'merge'].map((key) => (
                <label key={key}>
                  {t(`editor.${key}`)}
                  <select
                    className="w-full border"
                    value={plan.pit[key]}
                    onChange={(e) =>
                      update({
                        ...plan,
                        pit: { ...plan.pit, [key]: Number(e.target.value) },
                      })
                    }
                  >
                    {plan.pieces.map((p, i) => (
                      <option key={i} value={i}>
                        {i + 1}. {label(p.type)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              {['spacingMm', 'bayLengthMm'].map((key) => (
                <label key={key}>
                  {t(`editor.${key}`)}
                  <input
                    className="w-full border"
                    type="number"
                    min="115"
                    max={key === 'spacingMm' ? 3000 : 10000}
                    value={plan.pit[key]}
                    onChange={(e) =>
                      update({
                        ...plan,
                        pit: {
                          ...plan.pit,
                          [key]: Math.max(115, Math.min(key === 'spacingMm' ? 3000 : 10000, Number(e.target.value))),
                        },
                      })
                    }
                  />
                </label>
              ))}
              <p className="col-span-2 text-xs">{t('editor.pitNote')}</p>
            </div>
          )}
          <label className="block">
            <input
              type="checkbox"
              checked={!!plan.measuredLaneLengthsM}
              disabled={!plan.pieces.length}
              onChange={(e) =>
                update({
                  ...plan,
                  measuredLaneLengthsM: e.target.checked ? traceTrackPlan(plan).calculatedLaneLengthsM : null,
                })
              }
            />{' '}
            {t('editor.useMeasured')}
          </label>
          {plan.measuredLaneLengthsM && (
            <div className="flex gap-2">
              {[0, 1].map((i) => (
                <label key={i}>
                  {t('editor.lane', { number: i + 1 })} (m)
                  <input
                    className="border w-24"
                    type="number"
                    min="0.001"
                    step="0.001"
                    max="10000"
                    value={plan.measuredLaneLengthsM[i]}
                    onChange={(e) =>
                      update({
                        ...plan,
                        measuredLaneLengthsM: plan.measuredLaneLengthsM.map((n, j) =>
                          j === i ? Math.max(0.001, Math.min(10000, Number(e.target.value))) : n
                        ),
                      })
                    }
                  />
                </label>
              ))}
            </div>
          )}
        </details>
      </div>
    </section>
  )
}
