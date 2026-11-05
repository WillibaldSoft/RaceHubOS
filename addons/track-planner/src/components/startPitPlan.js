import { emptyTrackPlan, validateTrackPlan, enableFreePlacement } from '@racehubos/shared'

// Six 345 mm modules: entry + common lane + three bay modules + exit.
// The existing pit model supplies two parallel fuel bays and movement grouping.
export function createStartPitPlan(input = emptyTrackPlan()) {
  if (input.pieces.length || input.trackExtras?.length) throw new Error('Start setup requires an empty plan')
  return enableFreePlacement(
    validateTrackPlan({
      ...input,
      pieces: [
        'Pit_stop_weiche_anfang',
        'Standardgerade',
        'Control_unit',
        'Standardgerade',
        'Standardgerade',
        'Pit_stop_weiche_ende',
      ].map((type) => ({ type, level: 0, jointDegrees: 0 })),
      pit: { enabled: true, entry: 0, merge: 5, spacingMm: 345, bayLengthMm: 1035 },
      measuredLaneLengthsM: null,
    })
  )
}
