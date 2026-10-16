import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { type Plugin, defineConfig } from 'vite';

/** Emit sw.js with the list of built files so the installed app works offline from the first visit. */
function serviceWorker(): Plugin {
  return {
    name: 'scaler-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle)
        .filter((f) => !f.endsWith('.map'))
        .map((f) => `./${f}`);
      const template = readFileSync('sw/sw.js', 'utf8');
      const version = createHash('sha256').update(template).update(files.join('|')).digest('hex').slice(0, 10);
      const source = template.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(files));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), serviceWorker()],
  build: {
    chunkSizeWarningLimit: 1600,
  },
});
