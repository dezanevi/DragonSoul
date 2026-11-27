import { resolve } from 'node:path';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// Hlášení chyb ze hry (Pauza → Nahlásit chybu) – jen při vývoji (npm run dev): POST
// /__bug-report zapíše report do bug-reports/ (jeden .json + souhrn REPORTY.md).
// Sestavená hra (GitHub Pages) žádný server nemá, reporty tam zůstanou v prohlížeči.
const bugReportPlugin = () => ({
  name: 'aurion-bug-report',
  configureServer(server) {
    server.middlewares.use('/__bug-report', (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
      let body = '';
      req.on('data', (chunk) => { body += chunk; if (body.length > 200000) req.destroy(); });
      req.on('end', () => {
        try {
          const report = JSON.parse(body);
          const dir = resolve(import.meta.dirname, 'bug-reports');
          mkdirSync(dir, { recursive: true });
          const stamp = String(report.createdAt ?? new Date().toISOString()).replace(/[:.]/g, '-');
          writeFileSync(resolve(dir, `${stamp}.json`), JSON.stringify(report, null, 2));
          const c = report.context ?? {};
          appendFileSync(resolve(dir, 'REPORTY.md'),
            `\n## ${report.createdAt} – ${c.region ?? ''}${c.interior ? ` (${c.interior})` : ''}\n\n${report.text}\n\n` +
            `- Poloha ${c.position?.x ?? '?'}, ${c.position?.y ?? '?'} · úroveň ${c.level ?? '?'} · úkol ${c.trackedQuest ?? '–'} · ${c.screen ?? ''}\n`);
          res.statusCode = 200;
          res.end('ok');
        } catch {
          res.statusCode = 400;
          res.end('bad report');
        }
      });
    });
  }
});

export default defineConfig({
  plugins: [bugReportPlugin()],
  // Relativní cesty: hra pak běží i z podadresáře (GitHub Pages /dragon-souls/).
  // Proto jsou i cesty k obrázkům v kódu bez úvodního lomítka ('assets/...').
  base: './',
  build: {
    rollupOptions: {
      input: {
        game: resolve(import.meta.dirname, 'index.html'),
        // Laboratoř terénů – samostatné okno pro ladění grafiky.
        lab: resolve(import.meta.dirname, 'lab.html')
      }
    }
  },
  server: {
    watch: {
      // Archivy verzí a nástroje nejsou součástí hry – nesledovat je.
      ignored: ['**/archiv/**', '**/tools/**', '**/bug-reports/**']
    }
  }
});
