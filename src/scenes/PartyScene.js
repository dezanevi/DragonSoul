import Phaser from 'phaser';
import { SaveSystem } from '../systems/SaveSystem.js';
import { getMonsterSkills } from '../systems/MonsterSkillSystem.js';
import {
  addTrainingPoints,
  getTotalTrainingPoints
} from '../systems/TrainingSystem.js';

const TRAINING_POINTS_PER_STAT_UP = 5;

const STAT_LABELS = {
  vitality: 'Vitalita',
  force: 'Síla',
  armor: 'Zbroj',
  aether: 'Éter',
  resolve: 'Odolnost vůle',
  tempo: 'Tempo',
  precision: 'Přesnost'
};

export default class PartyScene extends Phaser.Scene {
  constructor() {
    super('Party');
  }

  create(data) {
    this.state = data?.state ?? SaveSystem.load();

    if (!this.state) {
      this.scene.stop();
      this.scene.resume('World');
      return;
    }

    this.state.party ??= [];
    this.state.monsterStorage ??= [];

    this.selected = null;
    this.storageOffset = 0;
    this.listObjects = [];
    this.cardObjects = [];
    this.cardOpen = false;
    this.releasePending = false;

    this.cameras.main.setBackgroundColor('#17251f');

    this.addText(320, 16, 'MONSTER PARTY', {
      fontSize: '22px',
      color: '#f2d28a'
    }).setOrigin(0.5);

    this.addText(320, 40, 'Klikni na monstrum, abys otevřel jeho kartu.', {
      fontSize: '12px',
      color: '#d8e4c5'
    }).setOrigin(0.5);

    this.add.rectangle(165, 158, 290, 215, 0x263b30, 0.95);
    this.add.rectangle(475, 158, 290, 215, 0x263b30, 0.95);

    this.partyTitle = this.addText(30, 54, '', {
      fontSize: '14px',
      color: '#f2d28a'
    });

    this.storageTitle = this.addText(340, 54, '', {
      fontSize: '14px',
      color: '#f2d28a'
    });

    this.detailText = this.addText(22, 275, 'Vyber monstrum ze seznamu.', {
      fontSize: '12px',
      color: '#f5ead0',
      wordWrap: { width: 596 }
    });

    this.messageText = this.addText(22, 316, '', {
      fontSize: '11px',
      color: '#ffe28b'
    });

    this.closeButton = this.addText(610, 12, 'Zavřít  X', {
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#59413a',
      padding: { x: 7, y: 4 }
    })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });

    this.closeButton.on('pointerdown', () => this.close());

    this.upButton = this.addText(605, 54, '▲', {
      fontSize: '13px',
      color: '#ffffff',
      backgroundColor: '#394a38',
      padding: { x: 5, y: 2 }
    })
      .setInteractive({ useHandCursor: true });

    this.upButton.on('pointerdown', () => {
      this.storageOffset = Math.max(0, this.storageOffset - 1);
      this.renderLists();
    });

    this.downButton = this.addText(605, 239, '▼', {
      fontSize: '13px',
      color: '#ffffff',
      backgroundColor: '#394a38',
      padding: { x: 5, y: 2 }
    })
      .setInteractive({ useHandCursor: true });

    this.downButton.on('pointerdown', () => {
      const maxOffset = Math.max(0, this.state.monsterStorage.length - 6);
      this.storageOffset = Math.min(maxOffset, this.storageOffset + 1);
      this.renderLists();
    });

    this.keyHandler = (event) => {
      if (event.repeat) return;

      if (event.code === 'Escape') {
        if (this.cardOpen) {
          this.closeMonsterCard();
        } else {
          this.close();
        }
        return;
      }

      if (event.code === 'KeyP' && !this.cardOpen) {
        this.close();
      }
    };

    this.input.keyboard.on('keydown', this.keyHandler);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard.off('keydown', this.keyHandler);
    });

    this.renderLists();
  }

  addText(x, y, text, style) {
    return this.add.text(x, y, text, style)
      .setResolution(2)
      .setDepth(10);
  }

  renderLists() {
    for (const object of this.listObjects) {
      object.destroy();
    }

    this.listObjects = [];

    this.partyTitle.setText(`PARTY (${this.state.party.length}/4)`);
    this.storageTitle.setText(`ÚSCHOVNA (${this.state.monsterStorage.length})`);

    for (let i = 0; i < 4; i++) {
      const monster = this.state.party[i];
      const y = 92 + i * 40;

      if (!monster) {
        this.addListRow(30, y, '— prázdné místo —', null);
        continue;
      }

      const selected =
        this.selected?.type === 'party' &&
        this.selected.index === i;

      const label =
        `${monster.name}  Lv.${monster.level}  ` +
        `HP ${monster.currentHp}/${monster.stats.vitality}`;

      this.addListRow(
        30,
        y,
        label,
        () => this.selectMonster('party', i),
        selected
      );
    }

    for (let i = 0; i < 6; i++) {
      const storageIndex = this.storageOffset + i;
      const monster = this.state.monsterStorage[storageIndex];
      const y = 84 + i * 28;

      if (!monster) {
        if (i === 0 && this.state.monsterStorage.length === 0) {
          this.addListRow(340, y, 'Úschovna je prázdná.', null);
        }
        continue;
      }

      const selected =
        this.selected?.type === 'storage' &&
        this.selected.index === storageIndex;

      const label =
        `${monster.name}  Lv.${monster.level}  ` +
        `HP ${monster.currentHp}/${monster.stats.vitality}`;

      this.addListRow(
        340,
        y,
        label,
        () => this.selectMonster('storage', storageIndex),
        selected
      );
    }
  }

  addListRow(x, y, label, callback, selected = false) {
    const row = this.addText(x, y, label, {
      fontSize: '11px',
      color: selected ? '#ffe28b' : '#f5ead0',
      backgroundColor: selected ? '#536b45' : '#304338',
      padding: { x: 5, y: 4 }
    });

    if (callback) {
      row.setInteractive({ useHandCursor: true });
      row.on('pointerdown', callback);
    }

    this.listObjects.push(row);
  }

  selectMonster(type, index) {
    this.selected = { type, index };

    const list =
      type === 'party'
        ? this.state.party
        : this.state.monsterStorage;

    if (!list[index]) return;

    this.openMonsterCard();
    this.renderLists();
  }

  openMonsterCard() {
    this.closeMonsterCard();
    this.cardOpen = true;
    this.releasePending = false;
    this.cardObjects = [];
    this.cardStatTexts = {};
    this.cardPlusButtons = {};

    const panel = this.add.rectangle(320, 180, 590, 330, 0x101820, 0.98)
      .setStrokeStyle(2, 0xc99b48)
      .setDepth(60)
      .setInteractive();

    this.cardObjects.push(panel);

    this.cardTitle = this.addText(42, 24, '', {
      fontSize: '18px',
      color: '#f2d28a'
    }).setDepth(61);
    this.cardObjects.push(this.cardTitle);

    this.cardInfoText = this.addText(335, 67, '', {
      fontSize: '11px',
      color: '#f5ead0',
      wordWrap: { width: 245 }
    }).setDepth(61);
    this.cardObjects.push(this.cardInfoText);

    this.cardMessageText = this.addText(335, 285, '', {
      fontSize: '10px',
      color: '#ffe28b',
      wordWrap: { width: 245 }
    }).setDepth(61);
    this.cardObjects.push(this.cardMessageText);

    for (const [index, stat] of Object.keys(STAT_LABELS).entries()) {
      const y = 83 + index * 30;

      const statText = this.addText(42, y, '', {
        fontSize: '10px',
        color: '#f5ead0'
      }).setDepth(61);

      this.cardStatTexts[stat] = statText;
      this.cardObjects.push(statText);

      const plusButton = this.addText(287, y - 3, '+1', {
        fontSize: '11px',
        color: '#fff1c6',
        backgroundColor: '#394a38',
        padding: { x: 6, y: 3 }
      })
        .setDepth(62)
        .setInteractive({ useHandCursor: true });

      plusButton.on('pointerdown', () => this.spendTrainingPoint(stat));
      this.cardPlusButtons[stat] = plusButton;
      this.cardObjects.push(plusButton);
    }

    this.cardCloseButton = this.addText(580, 22, 'Zavřít  X', {
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#59413a',
      padding: { x: 7, y: 4 }
    })
      .setOrigin(1, 0)
      .setDepth(62)
      .setInteractive({ useHandCursor: true });

    this.cardCloseButton.on('pointerdown', () => this.closeMonsterCard());
    this.cardObjects.push(this.cardCloseButton);

    this.cardReleaseButton = this.addText(200, 320, 'Propustit monstrum', {
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#8a302a',
      padding: { x: 10, y: 6 }
    })
      .setOrigin(0.5)
      .setDepth(62)
      .setInteractive({ useHandCursor: true });

    this.cardReleaseButton.on('pointerdown', () => this.requestReleaseMonster());
    this.cardObjects.push(this.cardReleaseButton);

    this.cardMoveButton = this.addText(450, 320, '', {
      fontSize: '12px',
      color: '#fff1c6',
      backgroundColor: '#394a38',
      padding: { x: 10, y: 6 }
    })
      .setOrigin(0.5)
      .setDepth(62)
      .setInteractive({ useHandCursor: true });

    this.cardMoveButton.on('pointerdown', () => this.moveSelectedMonster());
    this.cardObjects.push(this.cardMoveButton);

    this.refreshMonsterCard();
  }

  refreshMonsterCard() {
    if (!this.cardOpen || !this.selected) return;

    const list =
      this.selected.type === 'party'
        ? this.state.party
        : this.state.monsterStorage;

    const monster = list[this.selected.index];

    if (!monster) {
      this.closeMonsterCard();
      return;
    }

    monster.unspentTrainingPoints ??= 0;

    const freePoints = Math.max(
      0,
      Math.min(100, Number(monster.unspentTrainingPoints) || 0)
    );

    const stats = monster.stats;
    const potential = monster.geneticPotential ?? {};
    const training = monster.trainingPoints ?? {};
    const totalTraining = getTotalTrainingPoints(monster);

    this.cardMoveButton.setText(
      this.selected.type === 'party'
        ? 'Přesunout do úschovny'
        : 'Přesunout do party'
    );

    this.cardReleaseButton.setText(
      this.releasePending
        ? 'Potvrdit propuštění'
        : 'Propustit monstrum'
    );

    this.cardTitle.setText(
      `${monster.name}  |  Level ${monster.level}  |  ${monster.element}`
    );

    const skills = getMonsterSkills(monster);
    const skillText = skills.length > 0
      ? skills
          .map((skill) =>
            `${skill.name}: ${skill.remainingUses}/${skill.maxUses}`
          )
          .join('\n')
      : 'Žádné naučené schopnosti';

    this.cardInfoText.setText(
      `HP: ${monster.currentHp}/${stats.vitality}\n` +
      `Bond: ${monster.bond ?? 0}\n` +
      `Volné Training Pointy: ${freePoints}/100\n` +
      `Použité tréninkové body: ${totalTraining}/510\n\n` +
      `Schopnosti:\n${skillText}`
    );

    for (const [stat, label] of Object.entries(STAT_LABELS)) {
      const value = Number(stats[stat]) || 0;
      const gene = Number(potential[stat]) || 0;
      const invested = Number(training[stat]) || 0;
      const progress = invested % TRAINING_POINTS_PER_STAT_UP;

      this.cardStatTexts[stat].setText(
        `${label}: ${value} | geny ${gene} | trénink ${progress}/${TRAINING_POINTS_PER_STAT_UP}`
      );

      const canSpend =
        freePoints > 0 &&
        invested < 255 &&
        totalTraining < 510;

      this.cardPlusButtons[stat].setStyle({
        color: canSpend ? '#fff1c6' : '#888888',
        backgroundColor: canSpend ? '#394a38' : '#30343a'
      });
    }
  }

  spendTrainingPoint(stat) {
    if (!this.selected) return;

    const list =
      this.selected.type === 'party'
        ? this.state.party
        : this.state.monsterStorage;

    const monster = list[this.selected.index];
    if (!monster) return;

    monster.unspentTrainingPoints ??= 0;

    if (monster.unspentTrainingPoints <= 0) {
      this.cardMessageText.setText('Toto monstrum nemá volné Training Pointy.');
      return;
    }

    const result = addTrainingPoints(monster, stat, 1);

    if (result.added <= 0) {
      this.cardMessageText.setText('Tato statistika už dosáhla limitu tréninku.');
      return;
    }

    monster.unspentTrainingPoints -= result.added;
    SaveSystem.save(this.state);

    // Karta zůstává otevřená; hodnoty se hned překreslí.
    this.renderLists();
    this.refreshMonsterCard();

    this.cardMessageText.setText(
      `${monster.name}: přidán 1 bod do statistiky ${STAT_LABELS[stat]}.`
    );
  }

  requestReleaseMonster() {
    if (!this.selected) return;

    const list =
      this.selected.type === 'party'
        ? this.state.party
        : this.state.monsterStorage;

    const monster = list[this.selected.index];
    if (!monster) return;

    if (this.selected.type === 'party' && this.state.party.length <= 1) {
      this.cardMessageText.setText(
        'Nemůžeš propustit poslední monstrum aktivního týmu.'
      );
      return;
    }

    if (!this.releasePending) {
      this.releasePending = true;
      this.refreshMonsterCard();

      this.cardMessageText.setText(
        `Opravdu propustit ${monster.name}? Klikni znovu na červené tlačítko pro potvrzení. Zavřením karty akci zrušíš.`
      );
      return;
    }

    this.releaseSelectedMonster();
  }

  releaseSelectedMonster() {
    if (!this.selected) return;

    const list =
      this.selected.type === 'party'
        ? this.state.party
        : this.state.monsterStorage;

    const monster = list[this.selected.index];
    if (!monster) return;

    if (this.selected.type === 'party' && this.state.party.length <= 1) {
      this.cardMessageText.setText(
        'Nemůžeš propustit poslední monstrum aktivního týmu.'
      );
      return;
    }

    list.splice(this.selected.index, 1);

    const message = `${monster.name} bylo propuštěno. Záznam v Bestiary zůstává zachován.`;

    this.selected = null;
    this.closeMonsterCard();

    this.detailText.setText(message);
    this.messageText.setText(message);

    SaveSystem.save(this.state);
    this.renderLists();
  }

  closeMonsterCard() {
    for (const object of this.cardObjects ?? []) {
      object.destroy();
    }

    this.cardObjects = [];
    this.cardOpen = false;
    this.releasePending = false;
  }

  moveSelectedMonster() {
    if (!this.selected) {
      this.messageText.setText('Nejdřív vyber monstrum.');
      return;
    }

    let movedMonster;
    let message;

    if (this.selected.type === 'party') {
      movedMonster = this.state.party.splice(this.selected.index, 1)[0];
      if (!movedMonster) return;

      this.state.monsterStorage.push(movedMonster);
      message = `${movedMonster.name} bylo přesunuto do úschovny.`;
    } else {
      if (this.state.party.length >= 4) {
        const fullMessage =
          'Aktivní tým je plný (4 monstra). Nejdřív jedno přesuň do úschovny.';

        this.cardMessageText.setText(fullMessage);
        return;
      }

      movedMonster = this.state.monsterStorage.splice(
        this.selected.index,
        1
      )[0];
      if (!movedMonster) return;

      this.state.party.push(movedMonster);
      this.storageOffset = Math.min(
        this.storageOffset,
        Math.max(0, this.state.monsterStorage.length - 6)
      );

      message = `${movedMonster.name} bylo přidáno do aktivního týmu.`;
    }

    this.selected = null;
    this.closeMonsterCard();
    this.detailText.setText(message);
    this.messageText.setText(message);

    SaveSystem.save(this.state);
    this.renderLists();
  }

  close() {
    SaveSystem.save(this.state);
    this.scene.stop();
    this.scene.resume('World');
  }
}
