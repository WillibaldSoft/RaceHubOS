import base from './playwright.config.mjs';
export default {
  ...base,
  testDir: '../../scripts/screenshots',
  testMatch: 'track-planner.spec.mjs',
  timeout: 180000,
  outputDir: './test-results/screenshots',
  use: { ...base.use, viewport: { width: 1600, height: 1400 }, deviceScaleFactor: 1 },
};
