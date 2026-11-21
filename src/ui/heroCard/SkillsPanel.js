import FantasyButton from './FantasyButton.js';
import { SKILLS, SKILL_BAR } from './cardLayout.js';
import { cardText, drawBarFill } from './cardText.js';

// Osm tlačítek dovedností. Kliknutí jen vyšle událost – samotné řemeslo
// obslouží jeho systém (crafting zatím není naprogramovaný).
export default class SkillsPanel {
  constructor(scene, parent, tooltip, onSkill) {
    this.tooltip = tooltip;
    this.state = null;

    this.bars = scene.add.graphics();
    parent.add(this.bars);

    this.buttons = SKILLS.map(
      (skill) =>
        new FantasyButton(scene, parent, skill.area, {
          label: skill.label,
          radius: 10,
          onClick: () => onSkill?.(skill),
          onHover: () => this.showTooltip(skill),
          onOut: () => this.tooltip.hide()
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
      `Úroveň ${level} • zkušenosti ${exp} / ${next}`,
      'Systém řemesel se připravuje.'
    ]);
  }

  refresh(state) {
    this.state = state;
    this.bars.clear();

    SKILLS.forEach((skill, index) => {
      const { level, exp, next } = this.skillData(skill.id);

      this.levels[index].setText(`Úr. ${level}`);
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
