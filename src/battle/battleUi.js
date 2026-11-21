// Prvky rozhraní souboje: skleněné panely, tlačítka, plovoucí čísla, tooltip.

export const UI_FONT = '"Segoe UI", "Trebuchet MS", system-ui, sans-serif';

export const UI_COLORS = {
  panel: 0x0b1620,
  panelEdge: 0x9fd3ff,
  text: '#eef6ff',
  muted: '#9fb3c4',
  gold: '#ffd98a',
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
      stroke: options.stroke ?? undefined,
      strokeThickness: options.stroke ? options.strokeThickness ?? 4 : 0
    })
    .setOrigin(options.originX ?? 0, options.originY ?? 0)
    .setResolution(2);
}

// Skleněný panel: tmavá průsvitná plocha, jemný světlý okraj a horní odlesk.
export function drawGlass(g, x, y, w, h, options = {}) {
  const radius = options.radius ?? 14;
  const edge = options.edge ?? UI_COLORS.panelEdge;
  g.fillStyle(0x000000, 0.28).fillRoundedRect(x + 3, y + 6, w, h, radius);
  g.fillStyle(options.fill ?? UI_COLORS.panel, options.alpha ?? 0.78).fillRoundedRect(x, y, w, h, radius);
  g.fillStyle(0xffffff, 0.05).fillRoundedRect(x + 2, y + 2, w - 4, Math.min(h * 0.45, 40), { tl: radius, tr: radius, bl: 4, br: 4 });
  g.lineStyle(options.edgeWidth ?? 1.5, edge, options.edgeAlpha ?? 0.35).strokeRoundedRect(x, y, w, h, radius);
}

export function glassPanel(scene, x, y, w, h, options) {
  const g = scene.add.graphics();
  drawGlass(g, x, y, w, h, options);
  return g;
}

// Tlačítko s akcentním proužkem vlevo, titulkem, podtitulkem a klávesou.
export class BattleButton {
  constructor(scene, x, y, w, h, options = {}) {
    this.scene = scene;
    this.w = w;
    this.h = h;
    this.accent = options.accent ?? 0x9fd3ff;
    this.onClick = options.onClick ?? (() => {});
    this.onHover = options.onHover ?? null;
    this.onOut = options.onOut ?? null;
    this.selected = false;
    this.disabled = false;
    this.hovered = false;

    this.container = scene.add.container(x, y);
    this.bg = scene.add.graphics();
    this.title = uiText(scene, 18, options.sub ? 12 : h / 2, options.label ?? '', {
      size: options.titleSize ?? 19,
      bold: true,
      originY: options.sub ? 0 : 0.5
    });
    this.sub = uiText(scene, 18, h - 12, options.sub ?? '', { size: 14, color: UI_COLORS.muted, originY: 1 });
    this.key = uiText(scene, w - 10, 8, options.hotkey ?? '', { size: 13, color: UI_COLORS.muted, originX: 1 });

    this.hit = scene.add.zone(0, 0, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    this.container.add([this.bg, this.title, this.sub, this.key, this.hit]);

    this.hit.on('pointerover', () => { this.hovered = true; this.redraw(); this.onHover?.(this); });
    this.hit.on('pointerout', () => { this.hovered = false; this.redraw(); this.onOut?.(this); });
    this.hit.on('pointerdown', (pointer, lx, ly, event) => {
      event?.stopPropagation?.();
      if (!this.disabled) this.onClick(this);
    });

    this.redraw();
  }

  setContent(label, sub = '', hotkey = null) {
    this.title.setText(label);
    this.sub.setText(sub);
    if (hotkey !== null) this.key.setText(hotkey);
    this.title.setY(sub ? 12 : this.h / 2).setOrigin(0, sub ? 0 : 0.5);
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

    const base = this.disabled ? 0x1a2028 : this.selected ? 0x15324a : this.hovered ? 0x15283a : 0x0e1b27;
    g.fillStyle(0x000000, 0.3).fillRoundedRect(2, 5, w, h, 12);
    g.fillStyle(base, 0.92).fillRoundedRect(0, 0, w, h, 12);
    g.fillStyle(0xffffff, this.hovered && !this.disabled ? 0.08 : 0.04).fillRoundedRect(2, 2, w - 4, h * 0.42, { tl: 11, tr: 11, bl: 3, br: 3 });

    const accentAlpha = this.disabled ? 0.25 : 1;
    g.fillStyle(this.accent, accentAlpha).fillRoundedRect(6, 10, 5, h - 20, 3);

    if (this.selected && !this.disabled) {
      g.lineStyle(2.5, this.accent, 1).strokeRoundedRect(0, 0, w, h, 12);
      g.lineStyle(8, this.accent, 0.12).strokeRoundedRect(-3, -3, w + 6, h + 6, 14);
    } else {
      g.lineStyle(1.5, this.hovered && !this.disabled ? this.accent : 0x9fd3ff, this.hovered ? 0.8 : 0.22).strokeRoundedRect(0, 0, w, h, 12);
    }

    this.title.setAlpha(this.disabled ? 0.4 : 1);
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

// Plovoucí karta s informacemi (jednotka, schopnost).
export class Tooltip {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(9500).setVisible(false);
    this.bg = scene.add.graphics();
    this.title = uiText(scene, 16, 12, '', { size: 20, bold: true, color: UI_COLORS.gold });
    this.body = uiText(scene, 16, 42, '', { size: 16, color: UI_COLORS.text, wrap: 320, lineSpacing: 4 });
    this.container.add([this.bg, this.title, this.body]);
  }

  show(x, y, title, lines, accent = UI_COLORS.panelEdge) {
    this.title.setText(title);
    this.body.setText(lines.join('\n'));
    const w = Math.max(this.title.width, this.body.width) + 32;
    const h = 42 + this.body.height + 14;
    this.bg.clear();
    drawGlass(this.bg, 0, 0, w, h, { edge: accent, edgeAlpha: 0.7, alpha: 0.92, radius: 12 });

    const px = Math.min(Math.max(12, x - w / 2), 1920 - w - 12);
    const py = Math.max(12, y - h - 12);
    this.container.setPosition(px, py).setVisible(true);
  }

  hide() {
    this.container.setVisible(false);
  }
}
