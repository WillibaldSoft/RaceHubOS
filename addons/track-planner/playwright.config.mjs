import { defineConfig } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
const packagedDirectory = process.env.RACEHUBOS_PLANNER_PACKAGE_DIR;
export default defineConfig({
  testDir: './tests',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3181',
    locale: 'de-DE',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: packagedDirectory ? './node standalone-server.mjs' : 'node standalone-server.mjs',
    cwd: packagedDirectory || import.meta.dirname,
    url: 'http://127.0.0.1:3181',
    reuseExistingServer: false,
    env: {
      PORT: '3181',
      RACEHUBOS_PLANNER_DATA_DIR: path.join(os.tmpdir(), 'racehub-planner-browser-' + randomUUID()),
    },
  },
});
