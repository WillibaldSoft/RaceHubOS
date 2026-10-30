import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_ROOM, planRoom, trackBounds, readTrackPlan } from '@racehubos/shared'
import { Button } from '@core/components/ui/button'
import { TrackPlanPreview } from '@core/components/tracks/TrackPlanPreview'
import TrackImageExport from '@core/components/tracks/TrackImageExport'
import RailInventoryEditor, { RailRequirementsTable } from './RailInventoryEditor'

import { RoomPlanPreview, CurveDynamics } from '@core/components/tracks/SavedRoomPlan'
export { SavedRoomPlan } from '@core/components/tracks/SavedRoomPlan'
export default function RoomPlanner({ onApply, initialRoom, sourcePlan, sourceName }) {
  const { t } = useTranslation('tracks')
  const [room, setRoom] = useState(initialRoom || DEFAULT_ROOM)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(false)
  const [searching, setSearching] = useState(false)
  const [progress, setProgress] = useState(0)
  const [accepted, setAccepted] = useState(0)
  const workerRef = useRef(null)
  const lastSeedRef = useRef(null)
  const [repeatSearch, setRepeatSearch] = useState(false)
  useEffect(
    () => () => {
      workerRef.current?.terminate()
      workerRef.current = null
    },
    []
  )
  useEffect(() => {
    if (workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
      setSearching(false)
      setResult(null)
    }
  }, [sourcePlan])
  function cancelSearch() {
    workerRef.current?.terminate()
    workerRef.current = null
    setSearching(false)
    setResult(null)
  }
  const search = room.detailedSearch || {
    enabled: false,
    attempts: 800,
    seed: 87654321,
    jointDegrees: 0.5,
  }
  function changeSearch(patch) {
    if ('seed' in patch) lastSeedRef.current = null
    setRoom({ ...room, detailedSearch: { ...search, ...patch } })
    setResult(null)
  }

  const [references, setReferences] = useState([])
  const [referenceId, setReferenceId] = useState(initialRoom?.reference ? 'saved' : '')
  const [referenceError, setReferenceError] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const tracks = []
        for (let offset = 0; offset < 10000; offset += 100) {
          const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/tracks?limit=100&offset=${offset}`, {
            signal: controller.signal,
          })
          if (!res.ok) throw new Error('Track list')
          const data = await res.json()
          tracks.push(...data.data.filter((track) => readTrackPlan(track.layout)?.pieces.length))
          if (!data.hasMore) break
        }
        if (!controller.signal.aborted) setReferences(tracks)
      } catch {
        if (!controller.signal.aborted) setReferenceError(true)
      }
    }
    load()
    return () => controller.abort()
  }, [])
  function selectReference(id) {
    setReferenceId(id)
    setResult(null)
    const track = references.find((track) => track.id === id)
    if (!track) {
      const next = { ...room }
      delete next.reference
      setRoom(next)
      return
    }
    const bounds = trackBounds(readTrackPlan(track.layout))
    setRoom({
      ...room,
      reference: {
        name: track.name.slice(0, 200),
        widthM: Math.ceil(bounds.width / 10) / 100,
        depthM: Math.ceil(bounds.depth / 10) / 100,
      },
    })
  }
  const fields = [
    'widthM',
    'depthM',
    'drivers',
    'driverWidthM',
    'driverDepthM',
    'aisleM',
    'edgeM',
    'levelHeightMm',
    'maxGradePercent',
  ]
  const limits = {
    widthM: [1, 30],
    depthM: [1, 30],
    drivers: [1, 6],
    driverWidthM: [0.4, 2],
    driverDepthM: [0.4, 3],
    aisleM: [0.4, 3],
    edgeM: [0.1, 2],
    levelHeightMm: [100, 500],
    maxGradePercent: [1, 25],
  }
  function generate() {
    if (!search.enabled) {
      try {
        setResult(planRoom(room))
        setError(false)
      } catch {
        setError(true)
        setResult(null)
      }
      return
    }
    setResult(null)
    setError(false)
    setSearching(true)
    setProgress(0)
    setAccepted(0)
    try {
      const worker = new Worker(new URL('../workers/trackSearch.worker.js', import.meta.url), { type: 'module' })
      workerRef.current = worker
      worker.onmessage = ({ data }) => {
        if (workerRef.current !== worker) return
        if (data.type === 'progress') {
          setProgress(data.progress)
          setAccepted(data.accepted)
          return
        }
        worker.terminate()
        workerRef.current = null
        setSearching(false)
        if (data.type === 'result') {
          lastSeedRef.current = data.result.room.detailedSearch.seed
          setResult(data.result)
        } else setError(true)
      }
      worker.onerror = () => {
        if (workerRef.current === worker) {
          worker.terminate()
          workerRef.current = null
          setSearching(false)
          setError(true)
        }
      }
      const reference = readTrackPlan(references.find((track) => track.id === referenceId)?.layout) || sourcePlan
      const seed =
        !repeatSearch && lastSeedRef.current === search.seed
          ? (Math.imul(search.seed, 1664525) + 1013904223) >>> 0 || 1
          : search.seed
      const searchRoom = { ...room, detailedSearch: { ...search, seed } }
      setRoom(searchRoom)
      worker.postMessage({ room: searchRoom, sourcePlan: reference })
    } catch {
      workerRef.current?.terminate()
      workerRef.current = null
      setSearching(false)
      setError(true)
    }
  }

  return (
    <section data-testid="room-planner" className="space-y-3 border rounded p-3">
      <h3 className="font-bold">{t('room.title')}</h3>
      <p className="text-sm">{t('room.description')}</p>
      <fieldset disabled={searching} className="space-y-3">
        <label className="block text-sm">
          {t('room.reference')}
          <select
            data-testid="room-reference"
            className="block border rounded p-1 w-full"
            value={referenceId}
            onChange={(e) => selectReference(e.target.value)}
          >
            <option value="">{t('room.noReference')}</option>
            {referenceId === 'saved' && <option value="saved">{room.reference?.name}</option>}
            {references.map((track) => (
              <option key={track.id} value={track.id}>
                {track.name}
              </option>
            ))}
          </select>
        </label>
        {referenceError && <p role="alert">{t('room.referenceError')}</p>}
        {room.reference && (
          <div className="space-y-2">
            <p className="text-sm">{t('room.referenceNote', { name: room.reference.name })}</p>
            <div className="grid grid-cols-2 gap-2">
              {['widthM', 'depthM'].map((key) => (
                <label key={key}>
                  {t(`room.reference_${key}`)}
                  <input
                    data-testid={`reference-${key}`}
                    className="block border rounded p-1 w-full"
                    type="number"
                    min="0.1"
                    max="1000"
                    step="0.01"
                    value={room.reference[key]}
                    onChange={(e) => {
                      setRoom({
                        ...room,
                        reference: {
                          ...room.reference,
                          [key]: Number(e.target.value),
                        },
                      })
                      setResult(null)
                    }}
                  />
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {fields.map((key) => (
            <label key={key} className="text-sm">
              {t(`room.${key}`)}
              <input
                data-testid={`room-${key}`}
                className="block border rounded p-1 w-full"
                type="number"
                min={limits[key][0]}
                max={limits[key][1]}
                step={key === 'drivers' || key === 'levelHeightMm' ? 1 : 0.1}
                value={room[key]}
                onChange={(e) => {
                  setRoom({ ...room, [key]: Number(e.target.value) })
                  setResult(null)
                }}
              />
            </label>
          ))}
          <label>
            {t('room.maxLevels')}
            <select
              data-testid="room-maxLevels"
              className="block border rounded p-1 w-full"
              value={room.maxLevels}
              onChange={(e) => {
                setRoom({ ...room, maxLevels: Number(e.target.value) })
                setResult(null)
              }}
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          {t('borders.proposals')}{' '}
          <select
            data-testid="room-border-mode"
            value={room.borderMode || 'none'}
            onChange={(e) => {
              setRoom({ ...room, borderMode: e.target.value })
              setResult(null)
            }}
          >
            {['none', 'outside', 'both'].map((v) => (
              <option key={v} value={v}>
                {t(`borders.${v}`)}
              </option>
            ))}
          </select>
        </label>
        <RailInventoryEditor
          inventory={room.inventory}
          sourcePlan={readTrackPlan(references.find((track) => track.id === referenceId)?.layout) || sourcePlan}
          sourceName={references.find((track) => track.id === referenceId)?.name || sourceName}
          onChange={(inventory) => {
            const next = { ...room }
            if (inventory) next.inventory = inventory
            else {
              delete next.inventory
              delete next.allowAdditionalParts
            }
            setRoom(next)
            setResult(null)
          }}
        />
        <label className="block text-sm">
          <input
            data-testid="allow-additional-parts"
            type="checkbox"
            disabled={!room.inventory}
            checked={!!room.allowAdditionalParts}
            onChange={(e) => {
              setRoom({ ...room, allowAdditionalParts: e.target.checked })
              setResult(null)
            }}
          />{' '}
          {t('inventory.allowAdditional')}
        </label>
        <p className="text-xs text-muted-foreground">{t('inventory.additionalNote')}</p>
        <label className="block text-sm">
          {t('dynamics.style')}
          <select
            data-testid="curve-style"
            className="block border rounded p-1 w-full"
            value={room.curveStyle || 'dynamic'}
            onChange={(e) => {
              setRoom({ ...room, curveStyle: e.target.value })
              setResult(null)
            }}
          >
            {['dynamic', 'balanced', 'flowing', 'technical'].map((style) => (
              <option key={style} value={style}>
                {t(`dynamics.${style}`)}
              </option>
            ))}
          </select>
        </label>
        <section className="border rounded p-2 space-y-2" data-testid="detailed-search-settings">
          <label className="block font-semibold">
            <input
              data-testid="enable-detailed-search"
              type="checkbox"
              checked={search.enabled}
              onChange={(e) => {
                setRoom({
                  ...room,
                  maxLevels: e.target.checked ? Math.max(2, room.maxLevels) : room.maxLevels,
                  detailedSearch: { ...search, enabled: e.target.checked },
                })
                setResult(null)
              }}
            />{' '}
            {t('search.title')}
          </label>
          {search.enabled && (
            <>
              <p className="text-sm">{t('search.description')}</p>
              <div className="grid grid-cols-2 gap-2">
                <label>
                  {t('search.attempts')}
                  <input
                    data-testid="search-attempts"
                    className="border rounded p-1 w-full"
                    type="number"
                    min="100"
                    max="5000"
                    step="100"
                    value={search.attempts}
                    onChange={(e) => changeSearch({ attempts: Number(e.target.value) })}
                  />
                </label>
                <label>
                  {t('search.seed')}
                  <input
                    data-testid="search-seed"
                    className="border rounded p-1 w-full"
                    type="number"
                    min="1"
                    max="4294967295"
                    step="1"
                    value={search.seed}
                    onChange={(e) => changeSearch({ seed: Number(e.target.value) })}
                  />
                </label>
                <label>
                  {t('search.joint')}
                  <input
                    data-testid="search-joint"
                    className="border rounded p-1 w-full"
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={search.jointDegrees}
                    onChange={(e) => changeSearch({ jointDegrees: Number(e.target.value) })}
                  />
                </label>
              </div>
              <label className="block text-sm">
                <input
                  data-testid="repeat-track-search"
                  type="checkbox"
                  checked={repeatSearch}
                  onChange={(e) => setRepeatSearch(e.target.checked)}
                />{' '}
                {t('search.repeat')}
              </label>
              <p className="text-xs text-muted-foreground">{t('search.diversity')}</p>
            </>
          )}
        </section>
      </fieldset>
      <Button data-testid="generate-room-plan" disabled={searching} type="button" onClick={generate}>
        {t('room.generate')}
      </Button>
      {searching && (
        <div role="status" data-testid="search-progress">
          <progress className="w-full" max="1" value={progress} />
          <p>
            {t('search.progress', {
              percent: Math.round(progress * 100),
              accepted,
            })}
          </p>
          <Button data-testid="cancel-track-search" type="button" variant="outline" onClick={cancelSearch}>
            {t('search.cancel')}
          </Button>
        </div>
      )}
      {error && <p role="alert">{t('room.invalid')}</p>}
      {result && !result.proposals.length && (
        <p role="alert">
          {t(
            search.enabled && result.reason === 'inventory'
              ? 'search.noFit_inventory'
              : result.reason && ['source', 'levels', 'clearance', 'ramps', 'search'].includes(result.reason)
                ? `search.noFit_${result.reason}`
                : `room.noFit_${result.reason}`
          )}
        </p>
      )}
      {result?.proposals.length > 0 && search.enabled && result.proposals.length < 3 && (
        <p data-testid="search-fewer-variants" role="status">
          {t('search.fewer')}
        </p>
      )}
      {result?.proposals.map((p, i) => (
        <RoomProposal
          key={i}
          proposal={p}
          room={result.room}
          variantIndex={result.proposals.slice(0, i).filter((other) => other.kind === p.kind).length}
          onApply={onApply}
        />
      ))}
      {result && !search.enabled && room.maxLevels > 1 && !result.proposals.some((p) => p.kind === 'bridge') && (
        <p className="text-sm">{t('room.noBridge')}</p>
      )}
      <p className="text-xs text-muted-foreground">{t('room.note')}</p>
    </section>
  )
}

function RoomProposal({ proposal, room, onApply, variantIndex = 0 }) {
  const { t } = useTranslation('tracks')
  return (
    <div
      className="border rounded p-2 space-y-2"
      data-testid={`room-proposal-${proposal.kind}${variantIndex ? `-${variantIndex + 1}` : ''}`}
    >
      <h4 className="font-semibold">
        {t(`room.${proposal.kind}`)}
        {room.inventory ? ` · ${t('inventory.variant', { number: variantIndex + 1 })}` : ''}
      </h4>
      <TrackImageExport name={`Carrera-Raumplan-${proposal.kind}`}>
        <RoomPlanPreview proposal={proposal} room={room} title={t(`room.${proposal.kind}`)} />
      </TrackImageExport>
      <p>
        {t('room.footprint')}: {(proposal.bounds.width / 1000).toFixed(2)} × {(proposal.bounds.depth / 1000).toFixed(2)}{' '}
        m · {t('editor.lanes')}: {proposal.lengthsM.map((n) => n.toFixed(3)).join(' / ')} m ·{' '}
        {proposal.plan.pieces.length} {t('room.parts')}
      </p>
      {proposal.kind === 'detailed' && (
        <p className="text-sm">
          {t(proposal.pattern === 'new-crossing' ? 'search.newResultNote' : 'search.resultNote', {
            changed: proposal.changedRails,
            joint: proposal.maxJointDegrees.toFixed(2),
            crossings: proposal.crossings.length,
          })}
        </p>
      )}
      {proposal.kind === 'bridge' && (
        <p className="text-sm">
          {t('room.bridgeNote', {
            joint: proposal.maxJointDegrees.toFixed(2),
            run: (proposal.rampRunMm / 1000).toFixed(2),
          })}
        </p>
      )}
      <CurveDynamics plan={proposal.plan} />
      <RailRequirementsTable
        plan={proposal.plan}
        inventory={room.inventory}
        allowAdditionalParts={room.allowAdditionalParts}
      />
      <Button
        data-testid={`apply-room-${proposal.kind}${variantIndex ? `-${variantIndex + 1}` : ''}`}
        type="button"
        variant="outline"
        onClick={() => onApply(proposal.plan)}
      >
        {t('room.apply')}
      </Button>
    </div>
  )
}
