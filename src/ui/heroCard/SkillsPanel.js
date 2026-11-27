import FantasyButton from './FantasyButton.js';
import { SKILLS } from './cardLayout.js';

// Ukazatel úrovně v tlačítku dovednosti (relativně k tlačítku) – větší než namalovaný
// rámeček v podkladu, který překryje: od ikony po pravý okraj, s úrovní a procenty.
const SKILL_BAR = { x: 58, y: 44, w: 114, h: 18 }; // celý uvnitř rámečku dlaždice (nepřekrývá spodní okraj)
import { cardText, drawBarFill } from './cardText.js';
import { skillStateKey, spriteState } from './heroButtonSprites.js';
import { miningClass, MINING_SPECIALIZATIONS } from '../../data/mining.js';
import { herbClass, HERB_SPECIALIZATIONS, HERB_CATALOG } from '../../data/herbalism.js';
import { craftingClass } from '../../data/crafting.js';

// Osm tlačítek dovedností. Kliknutí jen vyšle událost – samotné řemeslo
// obslouží jeho systém (crafting zatím není naprogramovaný).
// Grafika: obrázky stavů ze skillsset1.png / skillset2.png – výchozí, modrá pod myší,
// zlatá zakliknutá (vybraná dovednost), šedá zamčená (professions[id].locked).

// O kolik je obrázek větší než klikací plocha (záře kolem tlačítka).
const SPRITE_SCALE_X = 1.05;
const SPRITE_SCALE_Y = 1.22; // vyšší rámeček, ať ukazatel nesedí na spodním okraji
const SPRITE_SHIFT_Y = 2; // rámeček roste hlavně dolů

export default class SkillsPanel {
  constructor(scene, parent, tooltip, onSkill) {
    this.tooltip = tooltip;
    this.state = null;
    this.selectedId = null;

    // Obrázky pod tlačítky, ukazatele nad nimi.
    this.sprites = SKILLS.map((skill) => {
      const key = skillStateKey(skill.id, 'normal');
      if (!scene.textures.exists(key)) return null;
      const { x, y, w, h } = skill.area;
      const sprite = scene.add.image(x + w / 2, y + h / 2 + SPRITE_SHIFT_Y, key).setDisplaySize(w * SPRITE_SCALE_X, h * SPRITE_SCALE_Y);
      parent.add(sprite);
      return sprite;
    });
    const hasSprites = this.sprites.every(Boolean);

    this.bars = scene.add.graphics();
    parent.add(this.bars);

    this.buttons = SKILLS.map(
      (skill, index) =>
        new FantasyButton(scene, parent, skill.area, {
          label: skill.label,
          radius: 10,
          drawHover: !hasSprites,
          drawActive: !hasSprites,
          onClick: () => {
            this.select(skill.id);
            onSkill?.(skill);
          },
          onHover: () => this.showTooltip(skill),
          onOut: () => this.tooltip.hide(),
          onStateChange: (button) => this.updateSprite(index, button)
        })
    );

    this.levels = SKILLS.map((skill) =>
      cardText(
        scene,
        parent,
        skill.area.x + SKILL_BAR.x + SKILL_BAR.w / 2,
        skill.area.y + SKILL_BAR.y + SKILL_BAR.h / 2,
        '',
        { size: 16, bold: true, originX: 0.5, strokeThickness: 4, color: '#ffffff' }
      )
    );
  }

  isLocked(id) {
    return Boolean(this.state?.professions?.[id]?.locked);
  }

  updateSprite(index, button) {
    const sprite = this.sprites?.[index];
    if (!sprite) return;
    const skill = SKILLS[index];
    const state = spriteState(button, { locked: this.isLocked(skill.id), selected: this.selectedId === skill.id });
    const { w, h } = skill.area;
    sprite.setTexture(skillStateKey(skill.id, state)).setDisplaySize(w * SPRITE_SCALE_X, h * SPRITE_SCALE_Y);
  }

  select(id) {
    this.selectedId = id;
    this.buttons.forEach((button, index) => {
      button.setActive(SKILLS[index].id === id);
      this.updateSprite(index, button);
    });
  }

  skillData(id) {
    const data = this.state?.professions?.[id] ?? {};
    return {
      level: Math.max(0, Number(data.level) || 0),
      exp: Math.max(0, Number(data.exp) || 0),
      next: Math.max(1, Number(data.next) || 100)
    };
  }

  showTooltip(skill) {
    const { level, exp, next } = this.skillData(skill.id);
    this.tooltip.show(skill.area, skill.label, [
      this.isLocked(skill.id) ? 'Zamčeno – dovednost se odemkne později.' : `Úroveň ${level} • zkušenosti ${exp} / ${next}`,
      skill.id === 'fishing'
        ? `Deník: ${Object.keys(this.state?.fishing?.log ?? {}).length} chycených druhů. Rybaří se u vody (modrý kruh, E).`
        : skill.id === 'mining'
          ? `Třída ${miningClass(level).id} – ${miningClass(level).name}. Vytěžených nalezišť: ${Object.keys(this.state?.mining?.log ?? {}).length}. Naleziště: hnědý kruh, E. Hornický mistr je v kovárně.${this.state?.mining?.specialization ? ` Specializace: ${MINING_SPECIALIZATIONS.find((s) => s.id === this.state.mining.specialization)?.name}.` : ''}`
        : skill.id === 'herbalism'
          ? `Třída ${herbClass(level).id} – ${herbClass(level).name}. Herbář: ${Object.keys(this.state?.herbalism?.log ?? {}).length} / ${HERB_CATALOG.length} rostlin. Naleziště: zelený kruh, E. Bylinkářka bydlí v Greenvale.${this.state?.herbalism?.specialization ? ` Specializace: ${HERB_SPECIALIZATIONS.find((s) => s.id === this.state.herbalism.specialization)?.name}.` : ''}`
        : skill.id === 'crafting'
          ? `Třída ${craftingClass(level).id} – ${craftingClass(level).name}. Vyrobeno receptů: ${Object.keys(this.state?.crafting?.made ?? {}).length} / 107. Řemeslná dílna je u radnice, Soul Crystaly v Hvězdárně.`
        : skill.id === 'smithing'
          ? `Vykováno receptů: ${Object.keys(this.state?.smithing?.made ?? {}).length}. Výheň je v kovárně Greenvale.${this.state?.reinforcement ? ` Výztuha: ${this.state.reinforcement.name} (${this.state.reinforcement.battlesLeft} soubojů).` : ''}`
        : skill.id === 'alchemy'
          ? `Vyrobeno receptů: ${Object.keys(this.state?.alchemy?.made ?? {}).length}. Alchymistický stůl je v Alchymistickém obchodě.${this.state?.elixir ? ` Elixír: ${this.state.elixir.name}.` : ''}`
          : skill.id === 'cooking'
          ? `Uvařeno receptů: ${Object.keys(this.state?.cooking?.cooked ?? {}).length}. Vaří se u ohniště (V ve světě), sporáku nebo v hostinci.${this.state?.meal ? ` Najedený: ${this.state.meal.name}.` : ''}`
          : 'Systém řemesel se připravuje.'
    ]);
  }

  refresh(state) {
    this.state = state;
    this.bars.clear();

    SKILLS.forEach((skill, index) => {
      const { level, exp, next } = this.skillData(skill.id);
      this.updateSprite(index, this.buttons[index]);

      this.levels[index].setText(this.isLocked(skill.id) ? "" : level >= 100 ? `Úr. ${level} · max.` : `Úr. ${level} · ${Math.floor((exp / next) * 100)} %`);
      if (this.isLocked(skill.id)) return;
      const bx = skill.area.x + SKILL_BAR.x;
      const by = skill.area.y + SKILL_BAR.y;
      this.bars.fillStyle(0x05080c, 0.95).fillRoundedRect(bx - 2, by - 2, SKILL_BAR.w + 4, SKILL_BAR.h + 4, 7);
      this.bars.lineStyle(1.5, 0xd6a23a, 0.95).strokeRoundedRect(bx - 2, by - 2, SKILL_BAR.w + 4, SKILL_BAR.h + 4, 7);
      drawBarFill(
        this.bars,
        {
          x: skill.area.x + SKILL_BAR.x,
          y: skill.area.y + SKILL_BAR.y,
          w: SKILL_BAR.w,
          h: SKILL_BAR.h
        },
        exp / next,
        0x2f9b45,
        0xa6f0a0
      );
    });
  }
}
