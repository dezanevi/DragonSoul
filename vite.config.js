import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
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
      ignored: ['**/archiv/**', '**/tools/**']
    }
  }
});
