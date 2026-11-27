import { nineImage, cardText } from './fantasyCard.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';

// Navádění jako v tutoriálu souboje: obrazovka ztmavne, kolem cíle (záložka, tlačítko) je světlé
// okno s pulzujícím zlatým rámečkem a panel Mága s instrukcí. Ztmavení neblokuje kliknutí –
// hráč klikne přímo na zvýrazněný cíl. Vrací { objects, destroy }.
export function showGuide(scene, { rect, text, speaker = 'Mág', depth = 200000 }) {
  const objects = [];
  const pad = 10;
  const x = rect.x - pad;
  const y = rect.y - pad;
  const w = rect.w + pad * 2;
  const h = rect.h + pad * 2;
  const shade = scene.add.graphics().setDepth(depth).setScrollFactor(0);
  shade.fillStyle(0x000000, 0.6);
  shade.fillRect(0, 0, GAME_WIDTH, y);
  shade.fillRect(0, y + h, GAME_WIDTH, GAME_HEIGHT - y - h);
  shade.fillRect(0, y, x, h);
  shade.fillRect(x + w, y, GAME_WIDTH - x - w, h);
  const ring = scene.add.graphics().setDepth(depth + 2).setScrollFactor(0);
  ring.lineStyle(10, 0xffe08a, 0.25).strokeRoundedRect(x - 4, y - 4, w + 8, h + 8, 18);
  ring.lineStyle(4, 0xffe08a, 1).strokeRoundedRect(x, y, w, h, 14);
  const pulse = scene.tweens.add({ targets: ring, alpha: { from: 1, to: 0.35 }, duration: 650, yoyo: true, repeat: -1 });
  objects.push(shade, ring);

  // Panel s instrukcí pod cílem (nebo nad ním, když je cíl dole).
  const pw = 900;
  const ph = 130;
  const px = Math.max(20, Math.min(GAME_WIDTH - pw - 20, rect.x + rect.w / 2 - pw / 2));
  const py = y + h + 24 + ph < GAME_HEIGHT ? y + h + 24 : y - ph - 24;
  const panel = nineImage(scene, 'nu-panel', px, py, pw, ph, 0.6);
  if (panel) objects.push(panel.setDepth(depth + 1).setScrollFactor(0));
  objects.push(cardText(scene, px + 30, py + 18, speaker, { size: 24, bold: true, color: '#ffd76a' }).setDepth(depth + 1).setScrollFactor(0));
  objects.push(cardText(scene, px + 30, py + 52, text, { size: 21, color: '#f3e4bd', wrap: pw - 60 }).setDepth(depth + 1).setScrollFactor(0));

  for (const o of objects) {
    o.setAlpha(0);
    scene.tweens.add({ targets: o, alpha: 1, duration: 260 });
  }
  return {
    objects,
    destroy() {
      pulse.remove();
      for (const o of objects) o.destroy();
    }
  };
}
