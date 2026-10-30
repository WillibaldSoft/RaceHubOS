import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  exportSoftyRoyal,
  exportAutorennbahnTrk,
  importTrackTrk,
  emptyTrackPlan,
  traceTrackPlan,
  importSoftyRoyalExport,
} from '../../../shared/src/index.js'
const template = () =>
  JSON.parse(
    fs.readFileSync(
      new URL('../../../../addons/track-planner/public/track-plans/froehlichring.json', import.meta.url),
      'utf8'
    )
  )
test('Softyroyal SBP has the required preview and native compound switch/pit pieces', () => {
  const p = template(),
    result = exportSoftyRoyal(p, 'Fröhlichring'),
    file = result.file
  assert.equal(file.file, 'sbp')
  assert.equal(file.version, 1)
  assert.equal(typeof file.preview, 'string')
  assert.equal(file.items.length, 62)
  const count = (guid) => file.items.filter((p) => p.guid === guid).length
  assert.equal(count('d33c5415-691d-4941-9f6c-2dc1095279d6'), 2)
  assert.equal(count('3c1bd7b4-8587-4ac6-959d-e281c144718c'), 2)
  assert.equal(count('5030736a-881d-45cc-b549-c765d5d66f10'), 5)
  assert.equal(count('114086b8-5cc0-431f-b965-f5c4b560e922'), 2)
  assert.equal(count('3ace141b-8a0e-4b6a-a6e8-e0126d80904f'), 2)
  assert.equal(count('595c12af-49ba-4d6e-aa7d-ce3de949920f'), 1)
  assert.deepEqual(result.mainLaneLengthsM, traceTrackPlan(p).laneLengthsM)
  assert.ok(file.items.every((i) => Number.isFinite(i.rotation) && Number.isFinite(i.position.x) && !('_level' in i)))
})
test('curve placement uses the native centre and tangent, and elevated rails paint last', () => {
  const p = {
    ...emptyTrackPlan(),
    pieces: [
      { type: 'Kurve_1_60_rechts', level: 1, jointDegrees: 0 },
      { type: 'Standardgerade', level: 0, jointDegrees: 0 },
    ],
  }
  const { file, notices } = exportSoftyRoyal(p)
  const arc = file.items.at(-1)
  assert.equal(arc.guid, 'cc253612-a0cb-4b17-b940-18460c337acb')
  assert.equal(arc.position.x, 5000)
  assert.equal(arc.position.y, 5297)
  assert.equal(arc.rotation, 30)
  assert.ok(notices.some((n) => n.includes('native radii')))
})
test('unsupported pit dimensions fail explicitly instead of replacing native rail lengths', () => {
  const p = template()
  p.pit.spacingMm = 400
  assert.throws(() => exportSoftyRoyal(p), /native345mm/)
})
test('experimental TRK preserves complete RaceHub plan through its explicit extension', () => {
  const p = template(),
    result = exportAutorennbahnTrk(p),
    restored = importTrackTrk(result.text)
  assert.deepEqual(restored.pieces, p.pieces)
  assert.deepEqual(restored.pit, p.pit)
  assert.equal(restored.geometryProfile, p.geometryProfile)
  assert.ok(result.notices.some((n) => n.includes('NOT exported as verified native Windows pit geometry')))
  assert.ok([...result.text].every((c) => c.charCodeAt(0) < 128))
  assert.throws(() => importTrackTrk(result.text.replace('Startampel_3spur_hinten;', 'Standardgerade;')), /disagrees/)
  assert.equal(
    result.text.split('&').find((s) => s.startsWith('ItemNumber_1=')),
    'ItemNumber_1=55'
  )
})

test('SBP own-export round trip preserves double pit and detects native edits', () => {
  const p = template(),
    file = exportSoftyRoyal(p).file
  assert.deepEqual(importSoftyRoyalExport(file).pieces, p.pieces)
  assert.deepEqual(importSoftyRoyalExport(file).pit, p.pit)
  file.items[0].position.x += 1
  assert.throws(() => importSoftyRoyalExport(file), /changed/)
  assert.throws(() => importSoftyRoyalExport({ file: 'sbp', version: 1, items: [] }), /metadata/)
})
