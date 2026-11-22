import { cardText, drawBarFill } from './cardText.js';
import { FIELDS, MAGIC_SCHOOLS } from './cardLayout.js';
import FantasyButton from './FantasyButton.js';
import { getItemCount } from '../../systems/InventorySystem.js';
import { magicStateKey, spriteState } from './heroButtonSprites.js';

// Karty magických škol: plocha karty, velikost obrázku stavu a ukazatel zkušeností v něm.
const MAGIC_CARD = { y: 437, h: 136, spriteW: 104, spriteH: 122, barY: 547, barW: 66, barH: 12 };
import { getHeroSpeed, getHeroLuck, getHeroCharisma } from '../../systems/HeroStatsSystem.js';
import { getEffectiveSpellPower } from '../../systems/TalentSystem.js';

// Panely záložky Hrdina, které jen zobrazují data ze stavu hry.
// Nic nepočítají – hodnoty berou tak, jak je uložily herní systémy.

const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};


// Jméno, úroveň, zkušenosti a mana.
export class HeroOverview {
  constructor(scene, parent) {
    this.bars = scene.add.graphics();
    parent.add(this.bars);

    this.name = cardText(scene, parent, FIELDS.name.x, FIELDS.name.y, '', { size: 34 });
    this.level = cardText(scene, parent, FIELDS.level.x, FIELDS.level.y, '', { size: 32 });
    this.exp = cardText(scene, parent, FIELDS.expText.x, FIELDS.expText.y, '', {
      size: 22,
      originX: 1
    });
    this.mana = cardText(scene, parent, FIELDS.manaText.x, FIELDS.manaText.y, '', {
      size: 22,
      originX: 1,
      color: '#bfe6ff'
    });
  }

  refresh(state) {
    const level = Math.max(1, number(state.level, 1));
    const exp = Math.max(0, number(state.exp));
    const expNeeded = level * 20; // stejné pravidlo jako postup po boji
    const mp = Math.max(0, number(state.mp));
    const maxMp = Math.max(0, number(state.maxMp));

    this.name.setText(state.playerName || 'Arion');
    this.level.setText(level);
    this.exp.setText(`${exp} / ${expNeeded}`);
    this.mana.setText(`${mp} / ${maxMp}`);

    this.bars.clear();
    drawBarFill(this.bars, FIELDS.expBar, exp / Math.max(1, expNeeded), 0xd99a22, 0xffe08a);
    drawBarFill(this.bars, FIELDS.manaBar, maxMp > 0 ? mp / maxMp : 0, 0x1f7fe0, 0x8fd2ff);
  }
}

// Statistiky hrdiny a velitelské statistiky.
export class HeroStats {
  constructor(scene, parent) {
    const style = { size: 28, originX: 1, color: '#fff2c4' };

    this.heroValues = FIELDS.heroStats.rows.map((y) =>
      cardText(scene, parent, FIELDS.heroStats.x, y, '', style)
    );
    this.commanderValues = FIELDS.commanderStats.rows.map((y) =>
      cardText(scene, parent, FIELDS.commanderStats.x, y, '', style)
    );
  }

  refresh(state) {
    const hero = [
      number(state.intellect),
      getEffectiveSpellPower(state), // včetně talentů Kouzelníka
      getHeroSpeed(state), // včetně pasivního bonusu monster v partě
      getHeroLuck(state),
      getHeroCharisma(state)
    ];
    const commander = [
      number(state.attack),
      number(state.magicAttack),
      number(state.defense),
      number(state.magicResistance)
    ];

    hero.forEach((value, index) => this.heroValues[index].setText(value));
    commander.forEach((value, index) => this.commanderValues[index].setText(value));
  }
}

// Šest magických škol: úroveň v rohu karty a postup v prázdném ukazateli.
// Zamčené školy (odemykají se postupně během hry) jsou ztmavené s nápisem Zamčeno.
export class MagicSchoolsPanel {
  // onSelect(school, info) – klik na školu (zlatý výběr); info = { level, exp, needed, unlocked }.
  constructor(scene, parent, onSelect = null) {
    this.onSelect = onSelect;
    this.selectedId = null;
    this.mastery = {};

    // Výchozí podklad karet škol je namalovaný vysoký, obrázky stavů jsou čtvercové –
    // namalovanou kartu překryje tmavý podklad a přes něj obrázek ve správném stavu.
    const hasSprites = MAGIC_SCHOOLS.every((school) => scene.textures.exists(magicStateKey(school.id, 'normal')));
    this.plates = scene.add.graphics();
    parent.add(this.plates);
    this.sprites = MAGIC_SCHOOLS.map((school) => {
      if (!hasSprites) return null;
      this.plates.fillStyle(0x0a1322, 1).fillRoundedRect(school.x - 50, MAGIC_CARD.y - 3, 100, MAGIC_CARD.h + 6, 8);
      const sprite = scene.add.image(school.x, MAGIC_CARD.y + MAGIC_CARD.h / 2, magicStateKey(school.id, 'normal'));
      sprite.setDisplaySize(MAGIC_CARD.spriteW, MAGIC_CARD.spriteH);
      parent.add(sprite);
      return sprite;
    });

    this.bars = scene.add.graphics();
    this.locks = scene.add.graphics();
    parent.add([this.bars, this.locks]);

    this.buttons = MAGIC_SCHOOLS.map((school, index) =>
      new FantasyButton(scene, parent, { x: school.x - 48, y: MAGIC_CARD.y, w: 96, h: MAGIC_CARD.h }, {
        label: school.label,
        radius: 10,
        drawHover: !hasSprites,
        drawActive: !hasSprites,
        onClick: () => this.select(school.id),
        onStateChange: (button) => this.updateSprite(index, button)
      })
    );

    this.levels = MAGIC_SCHOOLS.map((school) =>
      cardText(scene, parent, school.x, MAGIC_CARD.barY + MAGIC_CARD.barH / 2, '', {
        size: 13,
        originX: 0.5,
        color: '#ffffff',
        strokeThickness: 4
      })
    );
    this.lockLabels = MAGIC_SCHOOLS.map((school) =>
      cardText(scene, parent, school.x, MAGIC_CARD.barY + MAGIC_CARD.barH / 2, 'Zamčeno', {
        size: 13,
        originX: 0.5,
        color: '#c9d3dd',
        strokeThickness: 4
      })
    );
  }

  info(id) {
    const data = this.mastery[id] ?? {};
    const level = Math.max(0, number(data.level));
    return {
      level,
      exp: Math.max(0, number(data.exp)),
      needed: 20 * (level + 1), // pravidlo z MagicMasterySystem
      unlocked: data.unlocked ?? level > 0
    };
  }

  updateSprite(index, button) {
    const sprite = this.sprites?.[index];
    if (!sprite) return;
    const school = MAGIC_SCHOOLS[index];
    const state = spriteState(button, { locked: !this.info(school.id).unlocked, selected: this.selectedId === school.id });
    sprite.setTexture(magicStateKey(school.id, state)).setDisplaySize(MAGIC_CARD.spriteW, MAGIC_CARD.spriteH);
  }

  select(id) {
    this.selectedId = id;
    this.buttons.forEach((button, index) => {
      button.setActive(MAGIC_SCHOOLS[index].id === id);
      this.updateSprite(index, button);
    });
    const school = MAGIC_SCHOOLS.find((s) => s.id === id);
    this.onSelect?.(school, this.info(id));
  }

  refresh(state) {
    this.mastery = state.magicMastery ?? {};

    this.bars.clear();
    this.locks.clear();
    const hasSprites = this.sprites.every(Boolean);

    MAGIC_SCHOOLS.forEach((school, index) => {
      const { level, exp, needed, unlocked } = this.info(school.id);
      this.updateSprite(index, this.buttons[index]);

      this.lockLabels[index].setVisible(!unlocked);
      this.levels[index].setVisible(unlocked);
      if (!unlocked) {
        if (!hasSprites) {
          this.locks.fillStyle(0x04070d, 0.72).fillRoundedRect(school.x - 47, 437, 94, 136, 8);
        }
        return;
      }

      this.levels[index].setText(`Úr. ${level}`);
      drawBarFill(
        this.bars,
        {
          x: school.x - MAGIC_CARD.barW / 2,
          y: MAGIC_CARD.barY,
          w: MAGIC_CARD.barW,
          h: MAGIC_CARD.barH
        },
        exp / needed,
        0x7a5cff,
        0xd6c8ff
      );
    });
  }
}

// Zlato, oblast a magické kameny.
export class GameInfoPanel {
  constructor(scene, parent) {
    this.gold = cardText(scene, parent, FIELDS.gold.x, FIELDS.gold.y, '', {
      size: 32,
      originX: 1,
      color: '#ffd76a'
    });
    this.region = cardText(scene, parent, FIELDS.region.x, FIELDS.region.y, '', {
      size: 26,
      color: '#ffffff'
    });
    this.stones = cardText(scene, parent, FIELDS.magicStones.x, FIELDS.magicStones.y, '', {
      size: 32,
      originX: 1,
      color: '#bfe6ff'
    });
    this.stonesDetail = cardText(
      scene,
      parent,
      FIELDS.magicStonesDetail.x,
      FIELDS.magicStonesDetail.y,
      '',
      { size: 20, color: '#d8e7f5', bold: false }
    );
  }

  refresh(state) {
    const crystals = getItemCount(state, 'basic_crystal');
    const stones = state.magicStones ?? crystals;

    this.gold.setText(Math.max(0, number(state.gold)));
    this.region.setText(state.region || 'Greenvale');
    this.stones.setText(number(stones));
    this.stonesDetail.setText(`Základní krystaly: ${crystals}`);
  }
}
