import Phaser from 'phaser';

// Interaktivní vrstva nad namalovaným tlačítkem v podkladu.
// Grafiku tlačítka nepřekresluje, jen přes ni kreslí stav:
// normal (nic), hover (zlatá záře), active (jasně modrá), disabled (šedá), focus (bílý obrys).

const STYLE = {
  hover: { stroke: 0xffdf74, glow: 0xffc436, fill: 0xffce39, fillAlpha: 0.1 },
  active: { stroke: 0x43ccff, glow: 0x08aaff, fill: 0x078bff, fillAlpha: 0.14 },
  pressed: { stroke: 0xffffff, glow: 0x43ccff, fill: 0x078bff, fillAlpha: 0.24 }
};

export default class FantasyButton {
  constructor(scene, parent, area, options = {}) {
    this.scene = scene;
    this.area = area;
    this.label = options.label ?? '';
    this.radius = options.radius ?? 10;
    this.onClick = options.onClick ?? (() => {});
    this.onHover = options.onHover ?? null;
    this.onOut = options.onOut ?? null;

    this.active = Boolean(options.active);
    // false = aktivní stav kreslí někdo jiný (např. modrý obrázek záložky).
    this.drawActive = options.drawActive ?? true;
    this.disabled = Boolean(options.disabled);
    this.hovered = false;
    this.pressed = false;
    this.focused = false;

    this.graphics = scene.add.graphics();
    this.zone = scene.add
      .zone(area.x, area.y, area.w, area.h)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });

    parent.add([this.graphics, this.zone]);

    this.zone.on('pointerover', () => {
      this.hovered = true;
      this.redraw();
      this.onHover?.(this);
    });
    this.zone.on('pointerout', () => {
      this.hovered = false;
      this.pressed = false;
      this.redraw();
      this.onOut?.(this);
    });
    this.zone.on('pointerdown', () => {
      if (this.disabled) return;
      this.pressed = true;
      this.redraw();
    });
    this.zone.on('pointerup', () => {
      if (!this.pressed) return;
      this.pressed = false;
      this.redraw();
      this.activate();
    });

    this.redraw();
  }

  activate() {
    if (this.disabled) return;
    this.onClick(this);
  }

  setActive(value) {
    this.active = Boolean(value);
    this.redraw();
    return this;
  }

  setDisabled(value) {
    this.disabled = Boolean(value);
    if (this.zone.input) this.zone.input.cursor = this.disabled ? 'not-allowed' : 'pointer';
    this.redraw();
    return this;
  }

  setFocused(value) {
    this.focused = Boolean(value);
    this.redraw();
    return this;
  }

  setVisible(value) {
    this.graphics.setVisible(value);
    this.zone.setVisible(value);
    if (value) this.zone.setInteractive();
    else this.zone.disableInteractive();
    return this;
  }

  redraw() {
    const g = this.graphics;
    const { x, y, w, h } = this.area;
    const r = this.radius;

    g.clear();

    if (this.disabled) {
      // Šedý závoj tlumí barvy namalovaného tlačítka.
      g.fillStyle(0x3a3a3a, 0.62).fillRoundedRect(x, y, w, h, r);
      g.lineStyle(2, 0x9a9a9a, 0.8).strokeRoundedRect(x + 1, y + 1, w - 2, h - 2, r);
    } else {
      const showActive = this.active && this.drawActive;
      const style = this.pressed
        ? STYLE.pressed
        : showActive
          ? STYLE.active
          : this.hovered
            ? STYLE.hover
            : null;

      if (style) {
        // Měkká záře ven z tlačítka.
        for (let i = 4; i >= 1; i -= 1) {
          g.lineStyle(i * 3, style.glow, 0.09);
          g.strokeRoundedRect(x - i, y - i, w + i * 2, h + i * 2, r + i);
        }
        g.fillStyle(style.fill, style.fillAlpha).fillRoundedRect(x, y, w, h, r);
        g.lineStyle(showActive && !this.hovered ? 3 : 2, style.stroke, 1);
        g.strokeRoundedRect(x + 1.5, y + 1.5, w - 3, h - 3, r);

        // Aktivní prvek pod myší dostane navíc zlatý vnitřní lem.
        if (showActive && this.hovered && !this.pressed) {
          g.lineStyle(2, STYLE.hover.stroke, 0.9);
          g.strokeRoundedRect(x + 5, y + 5, w - 10, h - 10, Math.max(2, r - 4));
        }
      }
    }

    if (this.focused) {
      g.lineStyle(3, 0xffffff, 0.95);
      g.strokeRoundedRect(x - 4, y - 4, w + 8, h + 8, r + 3);
    }
  }

  destroy() {
    this.graphics.destroy();
    this.zone.destroy();
  }
}

export function clamp01(value) {
  return Phaser.Math.Clamp(Number(value) || 0, 0, 1);
}
