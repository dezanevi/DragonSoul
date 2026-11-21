import { cardText, drawBarFill } from './cardText.js';
import { FIELDS, MAGIC_BAR, MAGIC_SCHOOLS } from './cardLayout.js';

// Panely záložky Hrdina, které jen zobrazují data ze stavu hry.
// Nic nepočítají – hodnoty berou tak, jak je uložily herní systémy.

const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const optionalStat = (value) => (value === undefined || value === null ? '—' : number(value));

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
      number(state.magicPower),
      optionalStat(state.speed),
      optionalStat(state.luck),
      optionalStat(state.charisma)
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
export class MagicSchoolsPanel {
  constructor(scene, parent) {
    this.bars = scene.add.graphics();
    parent.add(this.bars);

    this.levels = MAGIC_SCHOOLS.map((school) =>
      cardText(scene, parent, school.x + 36, MAGIC_BAR.levelY - 36, '', {
        size: 22,
        originX: 0.5,
        color: '#ffffff'
      })
    );
  }

  refresh(state) {
    const mastery = state.magicMastery ?? {};

    this.bars.clear();

    MAGIC_SCHOOLS.forEach((school, index) => {
      const data = mastery[school.id] ?? {};
      const level = Math.max(0, number(data.level));
      const exp = Math.max(0, number(data.exp));
      const needed = 20 * (level + 1); // pravidlo z MagicMasterySystem

      this.levels[index].setText(level);
      drawBarFill(
        this.bars,
        {
          x: school.x - MAGIC_BAR.width / 2,
          y: MAGIC_BAR.y,
          w: MAGIC_BAR.width,
          h: MAGIC_BAR.height
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
    const crystals = Math.max(0, number(state.inventory?.basic_crystal));
    const stones = state.magicStones ?? crystals;

    this.gold.setText(Math.max(0, number(state.gold)));
    this.region.setText(state.region || 'Greenvale');
    this.stones.setText(number(stones));
    this.stonesDetail.setText(`Základní krystaly: ${crystals}`);
  }
}
