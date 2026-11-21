import { TEXT_FONT } from './cardLayout.js';

// Text vrstvy karty: stejné písmo a obrys jako namalované popisky.
export function cardText(scene, parent, x, y, value, options = {}) {
  const text = scene.add
    .text(x, y, String(value ?? ''), {
      fontFamily: TEXT_FONT,
      fontSize: `${options.size ?? 26}px`,
      fontStyle: options.bold === false ? 'normal' : 'bold',
      color: options.color ?? '#fbe7b0',
      stroke: options.stroke ?? '#120a04',
      strokeThickness: options.strokeThickness ?? 5,
      align: options.align ?? 'left'
    })
    .setOrigin(options.originX ?? 0, options.originY ?? 0.5)
    .setResolution(2);

  if (options.shadow !== false) {
    text.setShadow(0, 2, '#000000', 4, true, true);
  }

  parent.add(text);
  return text;
}

// Výplň prázdného rámečku ukazatele namalovaného v podkladu.
export function drawBarFill(graphics, area, ratio, color, highlight) {
  const fill = Math.round(area.w * Math.max(0, Math.min(1, ratio)));

  if (fill <= 0) return;

  const radius = Math.min(area.h / 2, 6);

  graphics.fillStyle(color, 0.95).fillRoundedRect(area.x, area.y, fill, area.h, radius);
  graphics
    .fillStyle(highlight, 0.55)
    .fillRoundedRect(area.x + 2, area.y + 2, Math.max(0, fill - 4), Math.max(2, area.h * 0.35), radius / 2);
}
