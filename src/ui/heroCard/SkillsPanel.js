import FantasyButton from './FantasyButton.js';
import { SKILLS, SKILL_BAR } from './cardLayout.js';
import { cardText, drawBarFill } from './cardText.js';
import { skillStateKey, spriteState } from './heroButtonSprites.js';

// Osm tlačítek dovedností. Kliknutí jen vyšle událost – samotné řemeslo
// obslouží jeho systém (crafting zatím není naprogramovaný).
// Grafika: obrázky stavů ze skillsset1.png / skillset2.png – výchozí, modrá pod myší,
// zlatá zakliknutá (vybraná dovednost), šedá zamčená (professions[id].locked).

// O kolik je obrázek větší než klikací plocha (záře kolem tlačítka).
const SPRITE_SCALE_X = 1.03;
const SPRITE_SCALE_Y = 1.13;

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
      const sprite = scene.add.image(x + w / 2, y + h / 2, key).setDisplaySize(w * SPRITE_SCALE_X, h * SPRITE_SCALE_Y);
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
        { size: 15, originX: 0.5, strokeThickness: 4, color: '#ffffff' }
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
      'Systém řemesel se připravuje.'
    ]);
  }

  refresh(state) {
    this.state = state;
    this.bars.clear();

    SKILLS.forEach((skill, index) => {
      const { level, exp, next } = this.skillData(skill.id);
      this.updateSprite(index, this.buttons[index]);

      this.levels[index].setText(this.isLocked(skill.id) ? '' : `Úr. ${level}`);
      if (this.isLocked(skill.id)) return;
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
