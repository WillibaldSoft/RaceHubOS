import { lapDisplaySpeed, validateSpeedDisplay, SPEED_DEFAULTS, trackLapDistanceM } from '@racehubos/shared';
const scaled = { mode: 'scale', defaultScale: '1:32' };
test('actual speed is metres per millisecond converted to kilometres per hour', () => {
  expect(lapDisplaySpeed(20, 10000, '1:24', SPEED_DEFAULTS)).toMatchObject({
    speed: 7.2,
    scaled: false,
  });
  expect(lapDisplaySpeed(20, 5000, null, SPEED_DEFAULTS).speed).toBe(14.4);
});
test('per-car scale overrides global fallback; unrecognized scales use fallback', () => {
  expect(lapDisplaySpeed(20, 10000, '1:24', scaled)).toMatchObject({
    speed: 172.8,
    scale: '1:24',
    scaled: true,
  });
  expect(lapDisplaySpeed(20, 10000, 'D132', { ...scaled, defaultScale: '1:24' }).speed).toBe(230.4);
  expect(lapDisplaySpeed(20, 10000, null, scaled).speed).toBe(230.4);
  expect(lapDisplaySpeed(20, 10000, 'unknown', { ...scaled, defaultScale: '1:24' }).speed).toBe(172.8);
});
test('invalid times and lengths never produce misleading speeds', () => {
  for (const value of [null, undefined, 0, -1, NaN, Infinity, '20']) {
    expect(lapDisplaySpeed(value, 10000, '1:32', scaled).speed).toBeNull();
    expect(lapDisplaySpeed(20, value, '1:32', scaled).speed).toBeNull();
  }
  expect(lapDisplaySpeed(Number.MAX_VALUE, 0.00001, null, scaled).speed).toBeNull();
});
test('manual track length works independently of a plan and overrides an old plan distance', () => {
  expect(trackLapDistanceM({ length: 20 })).toBe(20);
  expect(trackLapDistanceM({ length: 20, layout: 'corrupt legacy layout' })).toBe(20);
  expect(trackLapDistanceM({ length: null })).toBeNull();
});
test('shared preference validator accepts only supported settings', () => {
  expect(validateSpeedDisplay({ ...scaled, other: 'ignored' })).toEqual(scaled);
  for (const value of [null, {}, { mode: 'instant', defaultScale: '1:32' }, { mode: 'actual', defaultScale: '1:43' }])
    expect(() => validateSpeedDisplay(value)).toThrow();
});
