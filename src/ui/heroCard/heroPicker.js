import { cardText, cardButton } from '../fantasyCard.js';
import { darkPanel, tileRow, headingLine, itemIcon } from '../craftLook.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../../config.js';

// Malé okno nad kartou hrdiny (výběr výbavy pro slot, kouzla školy).
// rows: [{ itemId?, title, sub?, color?, dim?, onClick? }]. Klik mimo okno ho zavře (Esc řeší karta).
// Vrací { close }.
const ROW_H = 58;
const W = 460;

export function openHeroPicker(scene, { x, y, title, rows, emptyText = '', footer = null }) {
  const layer = scene.add.container(0, 0).setDepth(9000);
  const close = () => {
    layer.destroy();
    if (scene.heroPicker === api) scene.heroPicker = null;
  };
  const api = { close };
  scene.heroPicker?.close();
  scene.heroPicker = api;

  const shown = rows.slice(0, 8);
  const h = 64 + Math.max(1, shown.length) * (ROW_H + 6) + (rows.length > 8 ? 30 : 0) + (footer ? 70 : 0) + 10;
  const px = Math.min(Math.max(16, x), GAME_WIDTH - W - 16);
  const py = Math.min(Math.max(16, y), GAME_HEIGHT - h - 16);

  // Průhledná plocha přes celou obrazovku: klik mimo okno ho zavře.
  const outside = scene.add.zone(0, 0, GAME_WIDTH, GAME_HEIGHT).setOrigin(0).setInteractive();
  outside.on('pointerdown', close);
  const block = scene.add.zone(px, py, W, h).setOrigin(0).setInteractive();
  // Neprůhledný podklad pod panelem – karta pod oknem nesmí prosvítat.
  const solid = scene.add.graphics();
  solid.fillStyle(0x000000, 0.35).fillRoundedRect(px + 4, py + 6, W, h, 12);
  solid.fillStyle(0x08111d, 1).fillRoundedRect(px, py, W, h, 12);
  layer.add([outside, solid, darkPanel(scene, px, py, W, h), block]);

  const heading = cardText(scene, px + 20, py + 16, title, { size: 22, bold: true, color: '#ffe7ae' });
  layer.add([heading, headingLine(scene, heading, px + 20, W - 40)]);

  if (!shown.length) {
    layer.add(cardText(scene, px + W / 2, py + 64 + ROW_H / 2, emptyText, { size: 20, color: '#9fb3c8', originX: 0.5, originY: 0.5 }));
  }
  shown.forEach((row, i) => {
    const ry = py + 60 + i * (ROW_H + 6);
    layer.add(tileRow(scene, px + 14, ry, W - 28, ROW_H, false, () => { if (row.onClick) { close(); row.onClick(); } }));
    let tx = px + 30;
    if (row.itemId) {
      const icon = itemIcon(scene, row.itemId, px + 44, ry + ROW_H / 2, 40);
      if (icon) layer.add(icon.setAlpha(row.dim ? 0.5 : 1));
      tx = px + 76;
    }
    const name = cardText(scene, tx, ry + (row.sub ? 7 : ROW_H / 2), row.title, {
      size: 19, bold: true, color: row.dim ? '#7d8590' : row.color ?? '#f3e4bd', originY: row.sub ? 0 : 0.5
    });
    if (name.width > px + W - 30 - tx) name.setScale((px + W - 30 - tx) / name.width);
    layer.add(name);
    if (row.sub) {
      const sub = cardText(scene, tx, ry + 33, row.sub, { size: 15, color: row.dim ? '#6c7480' : '#b8a890' });
      if (sub.width > px + W - 30 - tx) sub.setScale((px + W - 30 - tx) / sub.width);
      layer.add(sub);
    }
  });
  if (rows.length > 8) layer.add(cardText(scene, px + 20, py + 60 + 8 * (ROW_H + 6), `… a ${rows.length - 8} dalších`, { size: 17, color: '#9fb3c8' }));
  if (footer) {
    const fy = py + h - 74;
    layer.add(cardButton(scene, null, px + 14, fy, W - 28, 58, footer.label, () => { close(); footer.onClick(); }, { size: 20, danger: footer.danger }).objects);
  }
  return api;
}
