import Phaser from 'phaser';
import spellRows from '../data/spells.json';
import { SaveSystem } from '../systems/SaveSystem.js';

const SCHOOLS = [
  { id: 'fire', name: 'Fire' },
  { id: 'water', name: 'Water / Ice' },
  { id: 'earth', name: 'Earth' },
  { id: 'air', name: 'Air' },
  { id: 'light', name: 'Light' },
  { id: 'dark', name: 'Dark' }
];

export default class SpellbookScene extends Phaser.Scene {
  constructor() {
    super('Spellbook');
  }

  create(data) {
    this.state = data?.state ?? SaveSystem.load();

    if (!this.state) {
      this.close();
      return;
    }

    this.state.spellbook ??= [];
    this.state.magicMastery ??= {};

    this.selectedSchool = 'air';
    this.selectedSpell = null;
    this.schoolButtons = [];
    this.spellButtons = [];

    this.cameras.main.setBackgroundColor('#171d26');

    this.addText(320, 16, 'SPELLBOOK', {
      fontSize: '24px',
      color: '#f2d28a'
    }).setOrigin(0.5);
    this.closeButton = this.addText(610, 12, 'X', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#59413a',
      padding: { x: 8, y: 4 }
    })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });

    this.closeButton.on('pointerdown', () => this.close());

    this.schoolTitle = this.addText(250, 52, '', {
      fontSize: '17px',
      color: '#f2d28a'
    });

    this.masteryText = this.addText(250, 80, '', {
      fontSize: '13px',
      color: '#d8e4c5'
    });

    this.spellInfo = this.addText(
      250,
      150,
      'Vyber naučené kouzlo.',
      {
        fontSize: '13px',
        color: '#f5ead0',
        wordWrap: { width: 355 }
      }
    );

    this.addText(20, 330, 'Stiskni Esc nebo H pro návrat do hry.'
, {
      fontSize: '12px',
      color: '#b9c5c1'
    });

    this.createSchoolButtons();
    this.showSchool('air');

    this.keyHandler = (event) => {
      if (event.code === 'Escape' || event.code === 'KeyH') {
        this.close();
      }
    };

    this.input.keyboard.on('keydown', this.keyHandler);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard.off('keydown', this.keyHandler);
    });
  }

  addText(x, y, text, style) {
    return this.add.text(x, y, text, style)
      .setResolution(2)
      .setDepth(10);
  }

  createSchoolButtons() {
    SCHOOLS.forEach((school, index) => {
      const button = this.addText(
        25,
        65 + index * 39,
        school.name,
        {
          fontSize: '13px',
          color: '#fff1c6',
          backgroundColor: '#394a38',
          padding: { x: 9, y: 5 }
        }
      )
        .setInteractive({ useHandCursor: true });

      button.on('pointerdown', () => {
        this.showSchool(school.id);
      });

      this.schoolButtons.push({
        id: school.id,
        button
      });
    });
  }

  showSchool(schoolId) {
    this.selectedSchool = schoolId;
    this.selectedSpell = null;

    for (const entry of this.spellButtons) {
      entry.destroy();
    }

    this.spellButtons = [];
    this.spellInfo.setText('Vyber naučené kouzlo.');

    const school = SCHOOLS.find((entry) => entry.id === schoolId);
     const masteryData = this.state.magicMastery[schoolId] ?? {
      level: 0,
      exp: 0
    };

    const mastery = Math.max(0, Math.min(4, Number(masteryData.level) || 0));
    const masteryExp = Number(masteryData.exp) || 0;

    const masteryNames = [
      'Untrained',
      'Apprentice',
      'Adept',
      'Expert',
      'Master'
    ];

    const expNeeded = mastery >= 4 ? 0 : 20 * (mastery + 1);


    this.schoolTitle.setText(`${school.name} Magic`);
       this.masteryText.setText(
      mastery >= 4
        ? `Magic Mastery: ${masteryNames[mastery]} — Level ${mastery}`
        : `Magic Mastery: ${masteryNames[mastery]} — Level ${mastery} | EXP ${masteryExp}/${expNeeded}`
    );

    const knownSpells = spellRows.filter(
      (spell) =>
        spell.school === schoolId &&
        this.state.spellbook.includes(spell.id)
    );

    if (knownSpells.length === 0) {
      const emptyText = this.addText(
        250,
        115,
        'V této škole zatím nemáš žádné naučené kouzlo.',
        {
          fontSize: '13px',
          color: '#aeb8bd'
        }
      );

      this.spellButtons.push(emptyText);
      return;
    }

    knownSpells.forEach((spell, index) => {
      const button = this.addText(
        250,
        112 + index * 30,
        spell.name,
        {
          fontSize: '13px',
          color: '#fff1c6',
          backgroundColor: '#394a38',
          padding: { x: 8, y: 4 }
        }
      )
        .setInteractive({ useHandCursor: true });

      button.on('pointerdown', () => this.showSpell(spell));
      this.spellButtons.push(button);
    });
  }

  showSpell(spell) {
    this.selectedSpell = spell;

    this.spellInfo.setText(
      `${spell.name}\n\n` +
      `${spell.description}\n\n` +
      `Cena many: ${spell.manaCost} MP\n` +
      `Poškození: ${spell.damage}\n` +
      `Dosah: ${spell.range}\n` +
      `Cíl: ${spell.targetType}`
    );
  }

  close() {
    SaveSystem.save(this.state);
    this.scene.stop();
    this.scene.resume('World');
  }
}
