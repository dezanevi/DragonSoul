// Prvky rozhraní souboje ve stylu zbytku hry (karty, Řemesla): tmavé panely se zlatavým
// okrajem, dlaždicová tlačítka se zlatým výběrem, písmo karet. Plovoucí čísla, tooltip.

import { CARD_FONT } from '../ui/fantasyCard.js';
import { LOOK } from '../ui/craftLook.js';

export const UI_FONT = CARD_FONT;

export const UI_COLORS = {
  panel: 0x08111d,
  panelEdge: 0x8a6a30,
  text: '#f3e4bd',
  muted: '#b8a890',
  gold: '#ffd76a',
  player: 0x52e0ff,
  enemy: 0xff5468,
  move: 0x3fe0c5,
  inRangeAll: 0xff4d5e,
  inRangeSome: 0xffb340,
  skillRange: 0x9b7bff,
  support: 0x6dffa8,
  physical: 0xff9b4a,
  magical: 0xa98bff,
  healing: 0x5fe39a,
  buff: 0x59b8ff
};

export function uiText(scene, x, y, text, options = {}) {
  return scene.add
    .text(x, y, text, {
      fontFamily: UI_FONT,
      fontSize: `${options.size ?? 20}px`,
      fontStyle: options.bold ? 'bold' : 'normal',
      color: options.color ?? UI_COLORS.text,
      align: options.align ?? 'left',
      wordWrap: options.wrap ? { width: options.wrap } : undefined,
      lineSpacing: options.lineSpacing ?? 2,
      // Tmavý obrys jako u textů karet (čitelné i přes bojiště).
      stroke: options.stroke ?? '#0a0603',
      strokeThickness: options.strokeThickness ?? (options.stroke ? 4 : 3)
    })
    .setOrigin(options.originX ?? 0, options.originY ?? 0)
    .setResolution(2);
}

// Panel: tmavá plocha, zlatavý okraj a jemná vnitřní zlatá linka (jako darkPanel v kartách).
// options.edge = barevný akcent (popover, tooltip) – tenká linka uvnitř zlatého okraje.
export function drawGlass(g, x, y, w, h, options = {}) {
  const radius = options.radius ?? 12;
  g.fillStyle(0x000000, 0.3).fillRoundedRect(x + 3, y + 5, w, h, radius);
  g.fillStyle(options.fill ?? UI_COLORS.panel, Math.max(0.86, options.alpha ?? 0.9)).fillRoundedRect(x, y, w, h, radius);
  g.lineStyle(options.edgeWidth ?? 2, UI_COLORS.panelEdge, 0.95).strokeRoundedRect(x, y, w, h, radius);
  const inner = options.edge && options.edge !== UI_COLORS.panelEdge ? options.edge : LOOK.gold;
  const innerAlpha = options.edge && options.edge !== UI_COLORS.panelEdge ? Math.min(0.75, (options.edgeAlpha ?? 0.6) + 0.1) : 0.16;
  if (w > 16 && h > 16) g.lineStyle(1, inner, innerAlpha).strokeRoundedRect(x + 5, y + 5, w - 10, h - 10, Math.max(4, radius - 3));
}

export function glassPanel(scene, x, y, w, h, options) {
  const g = scene.add.graphics();
  drawGlass(g, x, y, w, h, options);
  return g;
}

// Tlačítko jako dlaždice v kartách: tmavé, pod myší zlatavý okraj, vybrané zlaté;
// barevný proužek vlevo = druh (schopnost, kouzlo, akce), titulek, podtitulek a klávesa.
export class BattleButton {
  constructor(scene, x, y, w, h, options = {}) {
    this.scene = scene;
    this.w = w;
    this.h = h;
    this.accent = options.accent ?? LOOK.gold;
    this.onClick = options.onClick ?? (() => {});
    this.onHover = options.onHover ?? null;
    this.onOut = options.onOut ?? null;
    this.selected = false;
    this.disabled = false;
    this.hovered = false;

    this.container = scene.add.container(x, y);
    this.bg = scene.add.graphics();
    this.title = uiText(scene, 20, options.sub ? 9 : h / 2, options.label ?? '', {
      size: options.titleSize ?? 19,
      bold: true,
      originY: options.sub ? 0 : 0.5
    });
    this.sub = uiText(scene, 20, h - 9, options.sub ?? '', { size: 14, color: UI_COLORS.muted, originY: 1 });
    this.key = uiText(scene, w - 9, 6, options.hotkey ?? '', { size: 13, color: UI_COLORS.muted, originX: 1 });

    this.hit = scene.add.zone(0, 0, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    this.container.add([this.bg, this.title, this.sub, this.key, this.hit]);

    this.hit.on('pointerover', () => { this.hovered = true; this.redraw(); this.onHover?.(this); });
    this.hit.on('pointerout', () => { this.hovered = false; this.redraw(); this.onOut?.(this); });
    this.hit.on('pointerdown', (pointer, lx, ly, event) => {
      event?.stopPropagation?.();
      if (!this.disabled) this.onClick(this);
    });

    this.fitText();
    this.redraw();
  }

  // Písmo karet je širší – dlouhý text se zmenší, aby se vešel do tlačítka.
  fitText() {
    const room = this.w - 30 - (this.key.text ? this.key.width + 4 : 0);
    this.title.setScale(1);
    if (this.title.width > room) this.title.setScale(room / this.title.width);
    this.sub.setScale(1);
    if (this.sub.width > this.w - 28) this.sub.setScale((this.w - 28) / this.sub.width);
  }

  setContent(label, sub = '', hotkey = null) {
    this.title.setText(label);
    this.sub.setText(sub);
    if (hotkey !== null) this.key.setText(hotkey);
    this.title.setY(sub ? 9 : this.h / 2).setOrigin(0, sub ? 0 : 0.5);
    this.fitText();
    return this;
  }

  setAccent(color) { this.accent = color; this.redraw(); return this; }
  setSelected(value) { this.selected = Boolean(value); this.redraw(); return this; }
  setDisabled(value) {
    this.disabled = Boolean(value);
    this.hit.input.cursor = this.disabled ? 'not-allowed' : 'pointer';
    this.redraw();
    return this;
  }
  setVisible(value) { this.container.setVisible(value); return this; }

  redraw() {
    const g = this.bg;
    const { w, h } = this;
    g.clear();
    const active = this.selected && !this.disabled;
    const hover = this.hovered && !this.disabled;
    const fill = this.disabled ? 0x121820 : active ? LOOK.activeFill : hover ? LOOK.hoverFill : LOOK.fill;
    g.fillStyle(0x000000, 0.3).fillRoundedRect(2, 4, w, h, 10);
    g.fillStyle(fill, this.disabled ? 0.8 : 0.94).fillRoundedRect(0, 0, w, h, 10);
    g.lineStyle(active ? 2.5 : 1.5, active ? LOOK.gold : hover ? LOOK.hoverLine : LOOK.line, this.disabled ? 0.5 : 1).strokeRoundedRect(0, 0, w, h, 10);
    if (active) g.lineStyle(6, LOOK.gold, 0.14).strokeRoundedRect(-3, -3, w + 6, h + 6, 12);
    // Proužek druhu vlevo.
    g.fillStyle(this.accent, this.disabled ? 0.25 : 1).fillRoundedRect(6, 9, 5, h - 18, 2);

    this.title.setAlpha(this.disabled ? 0.4 : 1).setColor(active ? '#ffe7ae' : UI_COLORS.text);
    this.sub.setAlpha(this.disabled ? 0.4 : 1);
  }
}

// Číslo poškození / léčení, které vyletí nad jednotkou a zmizí.
export function floatingText(scene, x, y, text, color = '#ffffff', size = 34) {
  const label = uiText(scene, x, y, text, {
    size,
    bold: true,
    color,
    originX: 0.5,
    originY: 1,
    stroke: '#05080c',
    strokeThickness: 6
  }).setDepth(7000).setScale(0.6); // pod rozhraním a oknem výsledku

  scene.tweens.add({ targets: label, scale: 1, duration: 140, ease: 'Back.easeOut' });
  scene.tweens.add({
    targets: label,
    y: y - 70,
    alpha: 0,
    delay: 450,
    duration: 700,
    ease: 'Cubic.easeIn',
    onComplete: () => label.destroy()
  });
}

// Plovoucí karta s informacemi (jednotka, schopnost) – menší písmo a užší sloupec.
export class Tooltip {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(9500).setVisible(false);
    this.bg = scene.add.graphics();
    this.title = uiText(scene, 14, 10, '', { size: 17, bold: true, color: UI_COLORS.gold });
    this.body = uiText(scene, 14, 36, '', { size: 14, color: UI_COLORS.text, wrap: 270, lineSpacing: 3 });
    this.container.add([this.bg, this.title, this.body]);
  }

  layout(title, lines, accent) {
    this.title.setText(title);
    this.body.setText(lines.join('\n'));
    const w = Math.max(this.title.width, this.body.width) + 28;
    const h = 36 + this.body.height + 12;
    this.bg.clear();
    drawGlass(this.bg, 0, 0, w, h, { edge: accent, edgeAlpha: 0.6, radius: 10 });
    return { w, h };
  }

  // Nad bodem (x = střed, y = horní okraj prvku).
  show(x, y, title, lines, accent = UI_COLORS.panelEdge) {
    const { w, h } = this.layout(title, lines, accent);
    const px = Math.min(Math.max(12, x - w / 2), 1920 - w - 12);
    const py = Math.max(12, y - h - 12);
    this.container.setPosition(px, py).setVisible(true);
  }

  // Vedle prvku (vpravo od něj, jinak vlevo) – nezakryje sousední tlačítka v nabídce.
  showBeside(left, top, right, title, lines, accent = UI_COLORS.panelEdge) {
    const { w, h } = this.layout(title, lines, accent);
    const px = right + 12 + w <= 1908 ? right + 12 : Math.max(12, left - w - 12);
    const py = Math.min(Math.max(12, top), 1080 - h - 12);
    this.container.setPosition(px, py).setVisible(true);
  }

  hide() {
    this.container.setVisible(false);
  }
}
