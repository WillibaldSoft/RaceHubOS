import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import fs from 'node:fs';
export default defineConfig({
  root: import.meta.dirname,
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'planner-third-party-notices',
      generateBundle() {
        const roots = new Set();
        for (const id of this.getModuleIds()) {
          const match = id.replaceAll('\\', '/').match(/^(.*\/node_modules\/(?:@[^/]+\/)?[^/]+)/);
          if (match) roots.add(match[1]);
        }
        roots.add(path.resolve(import.meta.dirname, '../../node_modules/@fontsource-variable/inter'));
        let notice = 'RaceHubOS Track Planner third-party notices\n';
        for (const root of [...roots].sort()) {
          if (!fs.existsSync(path.join(root, 'package.json'))) continue;
          const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
          notice += `\n\n===== ${pkg.name} ${pkg.version} (${pkg.license || 'see notice'}) =====\n`;
          for (const name of fs
            .readdirSync(root)
            .filter((name) => /^(licen[cs]e|copying|notice|ofl)(\.|$)/i.test(name))) {
            const file = path.join(root, name);
            if (fs.statSync(file).isFile()) notice += fs.readFileSync(file, 'utf8') + '\n';
          }
        }
        this.emitFile({
          type: 'asset',
          fileName: 'THIRD-PARTY-NOTICES.txt',
          source: notice,
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@core': path.resolve(import.meta.dirname, '../../packages/frontend/src'),
      '@': path.resolve(import.meta.dirname, '../../packages/frontend/src'),
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
