import test from 'node:test'
import assert from 'node:assert/strict'
import { sortRailInventoryRows } from '../../../shared/src/railInventoryManagement.js'
test('owned articles always precede zeros in quantity and article order; input remains unchanged', () => {
  const rows = ['20509', '30350', '30351', '30373', '30352'].map((article) => ({ article })),
    original = structuredClone(rows),
    counts = { '20509': 0, '30350': 2, '30351': 9, '30373': 2, '30352': 0 }
  const sorted = (mode) => sortRailInventoryRows(rows, counts, mode).map((p) => p.article)
  assert.deepEqual(sorted('stockDesc'), ['30351', '30350', '30373', '20509', '30352'])
  assert.deepEqual(sorted('stockAsc'), ['30350', '30373', '30351', '20509', '30352'])
  assert.deepEqual(sorted('article'), ['30350', '30351', '30373', '20509', '30352'])
  assert.deepEqual(rows, original)
  assert.throws(() => sorted('unsupported'))
  counts['30350'] = 0
  assert.deepEqual(sorted('stockDesc'), ['30351', '30373', '20509', '30350', '30352'])
})
