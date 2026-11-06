import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = process.argv[2] && path.resolve(process.argv[2]);
if (!output || output === root || root.startsWith(output + path.sep) || output.startsWith(root + path.sep))
  throw new Error('Supply a new export directory');
try {
  await fs.access(output);
  throw new Error('Export destination already exists');
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'planner-export-'));
const list = path.join(temporary, 'sources.json');
execFileSync(process.execPath, [path.join(root, 'scripts/build-track-planner.mjs')], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, RACEHUBOS_PLANNER_SOURCE_LIST: list },
});
await fs.mkdir(output, { recursive: true });
async function copy(source, target) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
}
const addon = 'addons/track-planner';
await fs.cp(path.join(root, addon), path.join(output, addon), {
  recursive: true,
  filter: (f) =>
    !['dist', 'test-results', 'node_modules'].includes(path.basename(f)) &&
    !f.endsWith('.racehub-addon.json') &&
    !path.basename(f).startsWith('playwright.') &&
    !f.includes(path.sep + 'tests' + path.sep) &&
    path.basename(f) !== 'tests',
});
// The independent repository owns its UI/shared snapshots and their provenance.
// No RaceHubOS backend, migrations, host application or database are copied.
await fs.cp(path.join(root, 'packages/shared/src'), path.join(output, 'vendor/racehubos/shared/src'), {
  recursive: true,
});
const sources = JSON.parse(await fs.readFile(list, 'utf8'));
const frontend = [
  ...new Set([...sources.filter((f) => f.startsWith('packages/frontend/src/')), 'packages/frontend/src/index.css']),
];
const provenance = [];
const sharedSnapshots = [];
async function recordShared(folder) {
  for (const item of await fs.readdir(folder, { withFileTypes: true })) {
    const file = path.join(folder, item.name);
    if (item.isDirectory()) await recordShared(file);
    else if (item.isFile())
      sharedSnapshots.push({
        source: path.relative(root, file),
        export: path.join('vendor/racehubos/shared/src', path.relative(path.join(root, 'packages/shared/src'), file)),
        sha256: createHash('sha256')
          .update(await fs.readFile(file))
          .digest('hex'),
      });
  }
}
await recordShared(path.join(root, 'packages/shared/src'));
for (const file of frontend) {
  const relative = path.relative('packages/frontend/src', file),
    target = path.join(output, 'vendor/racehubos/ui', relative);
  await copy(path.join(root, file), target);
  provenance.push({
    source: file,
    export: path.relative(output, target),
    sha256: createHash('sha256')
      .update(await fs.readFile(target))
      .digest('hex'),
  });
}
await copy(path.join(root, 'addons/track-planner/LICENSE'), path.join(output, 'LICENSE'));
await copy(path.join(root, 'addons/track-planner/LICENSE'), path.join(output, 'vendor/racehubos/LICENSE'));
await fs.writeFile(
  path.join(output, 'vendor/racehubos/shared/package.json'),
  JSON.stringify(
    { name: '@racehubos/shared', version: '1.0.0', private: true, type: 'module', exports: './src/index.js' },
    null,
    2
  ) + '\n'
);
let config = await fs.readFile(path.join(output, addon, 'vite.config.mjs'), 'utf8');
config = config
  .replaceAll('../../packages/shared/src/index.js', '../../vendor/racehubos/shared/src/index.js')
  .replaceAll('../../packages/frontend/src', '../../vendor/racehubos/ui');
await fs.writeFile(path.join(output, addon, 'vite.config.mjs'), config);
let css = await fs.readFile(path.join(output, addon, 'src/styles.css'), 'utf8');
css = css.replaceAll('../../../packages/frontend/src', '../../../vendor/racehubos/ui');
await fs.writeFile(path.join(output, addon, 'src/styles.css'), css);
await fs.mkdir(path.join(output, 'scripts'), { recursive: true });
await copy(path.join(root, 'scripts/build-track-planner.mjs'), path.join(output, 'scripts/build-track-planner.mjs'));
await copy(path.join(root, 'scripts/package-track-planner.py'), path.join(output, 'scripts/package-track-planner.py'));
const names = [
  'react',
  'react-dom',
  'i18next',
  'react-i18next',
  'i18next-browser-languagedetector',
  'lucide-react',
  'class-variance-authority',
  'clsx',
  'tailwind-merge',
  'radix-ui',
  '@fontsource-variable/inter',
  'tailwindcss',
  '@tailwindcss/vite',
  '@vitejs/plugin-react',
  'vite',
  'tw-animate-css',
  'shadcn',
];
const dependencies = {};
for (const name of names) {
  const pkg = JSON.parse(await fs.readFile(path.join(root, 'node_modules', name, 'package.json'), 'utf8'));
  dependencies[name] = pkg.version;
}
await fs.writeFile(
  path.join(output, 'package.json'),
  JSON.stringify(
    {
      name: 'carrera-track-planner',
      version: '1.0.0',
      private: true,
      type: 'module',
      license: 'Apache-2.0',
      engines: { node: '>=22.13' },
      workspaces: ['vendor/racehubos/shared'],
      scripts: {
        build: 'node scripts/build-track-planner.mjs',
        start: 'node addons/track-planner/launcher.mjs',
        test: 'node --test tests/*.test.mjs',
      },
      dependencies,
    },
    null,
    2
  ) + '\n'
);
await fs.mkdir(path.join(output, 'tests'), { recursive: true });
for (const file of [
  'plannerViewport.test.mjs',
  'followingTrackReplacement.test.mjs',
  'joinTrackSections.test.mjs',
  'plannerIntegration.test.mjs',
]) {
  let test = await fs.readFile(path.join(root, 'packages/frontend/tests/unit', file), 'utf8');
  test = test
    .replaceAll('../../../../addons/', '../addons/')
    .replaceAll('../../../shared/src/', '../vendor/racehubos/shared/src/');
  await fs.writeFile(path.join(output, 'tests', file), test);
}
const commit =
  process.env.PLANNER_SOURCE_COMMIT ||
  execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Invalid source commit');
await fs.writeFile(
  path.join(output, 'PROVENANCE.json'),
  JSON.stringify(
    {
      sourceRepository: 'https://github.com/WillibaldSoft/RaceHubOS',
      upstreamRepository: 'https://github.com/AnselmeSDR/RaceHubOS',
      sourceCommit: commit,
      workingTreeIncluded: true,
      license: 'Apache-2.0',
      frontendSnapshots: provenance,
      sharedSnapshots,
    },
    null,
    2
  ) + '\n'
);
await fs.writeFile(
  path.join(output, '.gitignore'),
  'node_modules/\naddons/track-planner/dist/\n*.racehub-addon.json\ntest-results/\n'
);
await fs.writeFile(
  path.join(output, 'README.md'),
  `# Carrera Track Planner\n\nIndependent source repository prepared for Anselme’s future RaceHubOS plugin interface. The official interface is pending; no host patch is required to build or run this planner.\n\nNode 22.13+: npm install, npm test, npm run build, npm start. Runtime is loopback-only and stores plans separately from RaceHubOS.\n\nThe existing experimental iframe adapter is isolated in addons/track-planner/src/host/legacyBridge.js. It is compatibility code, not the upcoming official plugin API. The planner-owned layout handoff proposal includes geometry, lane lengths and optional sector anchors.\n\nUI primitives, theme tokens and rendering/geometry snapshots from RaceHubOS are owned vendor sources under Apache-2.0, with source hashes in PROVENANCE.json. There are no imports from a parent RaceHubOS checkout and no backend, database or migrations. The initial export preserves paths for straightforward review; later consolidation can move these directories without changing the contract.\n\nThis repository is prepared locally; no new public GitHub repository is created by the exporter.\n`
);
await fs.mkdir(path.join(output, 'docs'), { recursive: true });
for (const name of ['TRACK-PLANNER-INTEGRATION-20261106.md', 'ANSELME-NACHRICHT-DE.md'])
  await copy(path.join(root, 'docs', name), path.join(output, 'docs', name));
await fs.writeFile(
  path.join(output, addon, 'README.md'),
  '# Carrera Track Planner\n\nIndependent build and usage: [repository guide](../../README.md). Integration status and responsibilities: [integration preparation](../../docs/TRACK-PLANNER-INTEGRATION-20261106.md).\n'
);
console.log('Independent planner repository:', output);
