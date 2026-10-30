import { normalizedCarScale } from './carScale.js';
export const SPEED_DISPLAY_KEY = 'race:speed-display';
export const SPEED_MODES = Object.freeze(['actual', 'scale']);
// Independent preference keeps the existing host speed API compatible.
export const SPEED_SCALE_SOURCE_KEY = 'race:speed-scale-source';
export const SPEED_SCALE_SOURCES = Object.freeze({ CAR: 'car', GLOBAL: 'global' });
export function validateSpeedScaleSource(value) {
  if (!Object.values(SPEED_SCALE_SOURCES).includes(value)) throw new Error('Invalid speed scale source');
  return value;
}
export function normalizedSpeedScaleSource(value) {
  return Object.values(SPEED_SCALE_SOURCES).includes(value) ? value : SPEED_SCALE_SOURCES.CAR;
}

export const SPEED_DEFAULTS = Object.freeze({
  mode: 'actual',
  defaultScale: '1:32',
});
export function validateSpeedDisplay(value) {
  if (!value || !SPEED_MODES.includes(value.mode) || !['1:32', '1:24'].includes(value.defaultScale))
    throw new Error('Invalid speed display settings');
  return { mode: value.mode, defaultScale: value.defaultScale };
}
export function lapDisplaySpeed(lengthM, timeMs, carScale, settings = SPEED_DEFAULTS) {
  const scale =
    (normalizedSpeedScaleSource(settings.scaleSource) === SPEED_SCALE_SOURCES.CAR && normalizedCarScale(carScale)) ||
    normalizedCarScale(settings.defaultScale) ||
    SPEED_DEFAULTS.defaultScale;
  const factor = settings.mode === 'scale' ? (scale === '1:24' ? 24 : 32) : 1;
  const speed =
    Number.isFinite(lengthM) && lengthM > 0 && Number.isFinite(timeMs) && timeMs > 0
      ? ((lengthM * 3600) / timeMs) * factor
      : null;
  return {
    speed: Number.isFinite(speed) ? speed : null,
    scale,
    scaled: settings.mode === 'scale',
  };
}
