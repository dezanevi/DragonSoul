import Phaser from 'phaser';
import speciesRows from '../data/monsters.json';
import { SaveSystem } from '../systems/SaveSystem.js';

export default class BestiaryScene extends Phaser.Scene {
  constructor() {
    super('Bestiary');
  }

  create(data) {
    this.state = data?.state ?? SaveSystem.load();

    if (!this.state) {
      this.close();
      return;
    }

    this.state.bestiary ??= {};
    this.offset = 0;
    this.visibleRows = 8;
    this.rowObjects = [];
    this.selectedSpecies = null;

    this.cameras.main.setBackgroundColor('#17251f');

    this.addText(320, 16, 'BESTIÁŘ', {
      fontSize: '24px',
      color: '#f2d28a'
    }).setOrigin(0.5);

    this.addText(20, 48, 'Objevená monstra', {
      fontSize: '14px',
      color: '#d8e4c5'
    });
    this.closeButton = this.addText(610, 12, 'X', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#59413a',
      padding: { x: 8, y: 4 }
    })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });

    this.closeButton.on('pointerdown', () => this.close());

    this.detailText = this.addText(
      340,
      72,
      'Vyber objevené monstrum ze seznamu.',
      {
        fontSize: '13px',
        color: '#f5ead0',
        wordWrap: { width: 275 }
      }
    );

    this.progressText = this.addText(340, 320, '', {
      fontSize: '12px',
      color: '#f2d28a'
    });

    this.addText(20, 335, 'Esc nebo B: návrat do hry', {
      fontSize: '11px',
      color: '#b9c5c1'
    });

    this.upButton = this.addText(265, 48, '▲', {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#394a38',
      padding: { x: 7, y: 3 }
    }).setInteractive({ useHandCursor: true });

    this.upButton.on('pointerdown', () => this.scroll(-1));

    this.downButton = this.addText(265, 304, '▼', {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#394a38',
      padding: { x: 7, y: 3 }
    }).setInteractive({ useHandCursor: true });

    this.downButton.on('pointerdown', () => this.scroll(1));

    this.keyHandler = (event) => {
      if (event.code === 'Escape' || event.code === 'KeyB') {
        this.close();
      }

      if (event.code === 'ArrowUp') {
        this.scroll(-1);
      }

      if (event.code === 'ArrowDown') {
        this.scroll(1);
      }
    };

    this.input.keyboard.on('keydown', this.keyHandler);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard.off('keydown', this.keyHandler);
    });

    this.renderList();
  }

  addText(x, y, text, style) {
    return this.add.text(x, y, text, style)
      .setResolution(2)
      .setDepth(10);
  }

  isDiscovered(species) {
    const record = this.state.bestiary[species.id];
    return Boolean(record && (record.seen > 0 || record.caught > 0));
  }

  renderList() {
    for (const object of this.rowObjects) {
      object.destroy();
    }

    this.rowObjects = [];

    const discoveredCount = speciesRows.filter(
      (species) => this.isDiscovered(species)
    ).length;

    this.progressText.setText(
      `Objeveno: ${discoveredCount} / ${speciesRows.length}`
    );

    for (let row = 0; row < this.visibleRows; row++) {
      const speciesIndex = this.offset + row;
      const species = speciesRows[speciesIndex];

      if (!species) continue;

      const discovered = this.isDiscovered(species);
      const selected =
        this.selectedSpecies?.id === species.id;

      const label = discovered
        ? `${String(speciesIndex + 1).padStart(2, '0')}. ${species.name}`
        : `${String(speciesIndex + 1).padStart(2, '0')}. ???`;

      const item = this.addText(20, 78 + row * 28, label, {
        fontSize: '12px',
        color: selected ? '#ffe28b' : discovered ? '#f5ead0' : '#778078',
        backgroundColor: selected ? '#536b45' : '#263b30',
        padding: { x: 5, y: 3 }
      });

      if (discovered) {
        item.setInteractive({ useHandCursor: true });
        item.on('pointerdown', () => this.selectSpecies(species));
      }

      this.rowObjects.push(item);
    }
  }

  selectSpecies(species) {
    this.selectedSpecies = species;

    const record = this.state.bestiary[species.id] ?? {
      seen: 0,
      caught: 0,
      defeated: 0
    };

    this.detailText.setText(
      `${species.name}\n\n` +
      `Element: ${species.element}\n` +
      `Oblast: ${species.region}\n` +
      `Rarita: ${species.rarity}\n\n` +
      `Pozorováno: ${record.seen}\n` +
      `Získáno: ${record.caught}\n` +
      `Poraženo: ${record.defeated}`
    );

    this.renderList();
  }

  scroll(amount) {
    const maxOffset = Math.max(0, speciesRows.length - this.visibleRows);

    this.offset = Phaser.Math.Clamp(
      this.offset + amount,
      0,
      maxOffset
    );

    this.renderList();
  }

  close() {
    SaveSystem.save(this.state);
    this.scene.stop();
    this.scene.resume('World');
  }
}
