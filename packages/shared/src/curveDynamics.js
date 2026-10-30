import { TRACK_PARTS } from './trackPlan.js';

// A geometric course-character metric, not a vehicle/grip or speed simulation.
export function analyseCurveDynamics(plan) {
  const radii = plan.pieces.map((p) => {
    const s = TRACK_PARTS[p.type];
    return s.radius ? s.radius - (plan.geometryProfile === 'prototype' ? 2 : 0) : null;
  });
  const curvature = radii.map((r, i) => (r ? Math.sign(TRACK_PARTS[plan.pieces[i].type].angle) / r : 0));
  let transitionCost = 0,
    directReversals = 0,
    radiusChanges = 0,
    openingTransitions = 0,
    tighteningTransitions = 0;
  for (let i = 0; i < curvature.length; i++) {
    const j = (i + curvature.length - 1) % curvature.length,
      a = curvature[j],
      b = curvature[i];
    transitionCost += ((b - a) * 297) ** 2;
    if (a * b < 0) directReversals++;
    if (a * b > 0 && radii[i] !== radii[j]) {
      radiusChanges++;
      if (radii[i] > radii[j]) openingTransitions++;
      else tighteningTransitions++;
    }
  }
  const curves = radii.filter(Boolean);
  return {
    transitionCost,
    directReversals,
    radiusChanges,
    openingTransitions,
    tighteningTransitions,
    minRadiusMm: curves.length ? Math.min(...curves) : null,
    maxRadiusMm: curves.length ? Math.max(...curves) : null,
  };
}
export function curveDynamicsScore(dynamics, style = 'balanced') {
  if (style === 'dynamic')
    return (
      -8 * dynamics.transitionCost +
      2 * dynamics.radiusChanges +
      2 * Math.min(dynamics.openingTransitions, dynamics.tighteningTransitions) +
      (dynamics.maxRadiusMm - dynamics.minRadiusMm) / 100
    );
  if (style === 'flowing') return -12 * dynamics.transitionCost;
  if (style === 'technical') return 4 * dynamics.directReversals + (dynamics.maxRadiusMm - dynamics.minRadiusMm) / 100;
  return 0;
}
