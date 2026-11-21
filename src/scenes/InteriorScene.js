import Phaser from 'phaser';
import Player from '../entities/Player.js';
import NPC from '../entities/NPC.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { unlockRegion } from '../systems/RegionSystem.js';
import skillRowsForInterior from '../data/skills.json';


const INTERIOR_DEFINITIONS = {
  greenvale_hunter_lodge: {
    title: 'LOVECKÁ CHATA',
    floorColor: 0x71583d,
    wallColor: 0x493929,
    residentName: null
  },
  greenvale_town_hall: {
    title: 'RADNICE GREENVALE',
    floorColor: 0x756044,
    wallColor: 0x4a3828,
    residentName: 'Rychtář Edric',
    residentRole: 'reeve',
    residentX: 320,
    residentY: 132,
    noticeBoard: true
  },
  greenvale_tavern: {
    title: 'HOSTINEC GREENVALE',
    floorColor: 0x72513a,
    wallColor: 0x432e22,
    residentName: 'Liora, léčitelka',
    residentRole: 'healer',
    residentX: 320,
    residentY: 132
  },
  greenvale_market: {
    title: 'TRŽIŠTĚ GREENVALE',
    floorColor: 0x746044,
    wallColor: 0x4a3828,
    residentName: null,
    futureService: 'Obchod zatím není připraven.'
  },
  greenvale_smithy: {
    title: 'KOVÁRNA GREENVALE',
    floorColor: 0x56473a,
    wallColor: 0x342c27,
    residentName: null,
    futureService: 'Kovářství a výroba zatím nejsou připravené.'
  },
  greenvale_fishing_hut: {
    title: 'RYBÁŘSKÁ CHATA',
    floorColor: 0x67543e,
    wallColor: 0x403426,
    residentName: null,
    futureService: 'Rybářský systém zatím není připraven.'
  },
  greenvale_home_1: {
    title: 'DŮM V GREENVALE',
    floorColor: 0x71583d,
    wallColor: 0x493929,
    residentName: null
  },
  greenvale_home_2: {
    title: 'DŮM V GREENVALE',
    floorColor: 0x71583d,
    wallColor: 0x493929,
    residentName: null
  },
  greenvale_home_3: {
    title: 'DŮM V GREENVALE',
    floorColor: 0x71583d,
    wallColor: 0x493929,
    residentName: null
  }
};

export default class InteriorScene extends Phaser.Scene {
  constructor() {
    super('Interior');
  }

  create(data) {
    this.state = data?.state ?? SaveSystem.load();

    if (!this.state) {
      this.scene.start('Menu');
      return;
    }

    this.interiorId =
      data?.interiorId ??
      this.state.interiorId ??
      'greenvale_hunter_lodge';

    this.interior = INTERIOR_DEFINITIONS[this.interiorId];

    if (!this.interior) {
      console.error(`Neznámý interiér: ${this.interiorId}`);
      this.state.interiorId = null;
      this.scene.start('World', { state: this.state });
      return;
    }

    this.state.interiorId = this.interiorId;
    this.fromWorld = Boolean(data?.fromWorld);
    this.dialogLines = null;
    this.dialogIndex = 0;
    this.dialogSpeaker = '';

    this.cameras.main.setBackgroundColor('#211b16');
    this.physics.world.setBounds(24, 34, GAME_WIDTH - 48, GAME_HEIGHT - 58);

    this.drawRoom();

    // Interiérový hráč používá vlastní souřadnice,
// aby jeho pohyb nepřepsal venkovní pozici v uložené hře.
this.interiorPlayerPosition = {
  x: GAME_WIDTH / 2,
  y: GAME_HEIGHT - 100
};

this.player = new Player(
  this,
  this.interiorPlayerPosition.x,
  this.interiorPlayerPosition.y,
  this.interiorPlayerPosition
);

    this.resident = null;

    if (this.interior.residentName) {
      this.resident = new NPC(
        this,
        this.interior.residentX,
        this.interior.residentY,
        'elder',
        this.interior.residentName,
        []
      );

      this.resident.role = this.interior.residentRole;
      this.physics.add.collider(this.player, this.resident);
    }

    this.cursors = this.input.keyboard.createCursorKeys();

    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D
    });

    this.dialogPanel = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT - 56,
      GAME_WIDTH - 32,
      82,
      0x10151a,
      0.97
    )
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);

    this.dialogText = this.add.text(
      22,
      GAME_HEIGHT - 91,
      '',
      {
        fontSize: '10px',
        color: '#fff2d1',
        wordWrap: { width: GAME_WIDTH - 44 }
      }
    )
      .setResolution(2)
      .setScrollFactor(0)
      .setDepth(101)
      .setVisible(false);

    this.add.text(
      GAME_WIDTH / 2,
      8,
      'WASD / šipky: pohyb  |  E / mezerník: mluvit, prohlížet nebo odejít',
      {
        fontSize: '8px',
        color: '#e5e5d3',
        backgroundColor: '#17251f',
        padding: { x: 5, y: 3 }
      }
    )
      .setResolution(2)
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(90);

   this.onKeyDown = (event) => {
  if (event.repeat) return;

 if (event.code === 'Escape') {
  SaveSystem.save(this.state);

  // Pokud byl interiér otevřený z vesnice, zastavíme i pozastavenou
  // WorldScene. Menu pak nebude překryté pozastaveným světem.
if (this.fromWorld) {
  this.scene.stop('World');
}

  this.scene.start('Menu', { state: this.state });
  return;
}


  if (event.code !== 'KeyE' && event.code !== 'Space') return;

  if (this.dialogLines) {
    this.advanceDialog();
  } else {
    this.tryInteract();
  }
};


    this.input.keyboard.on('keydown', this.onKeyDown);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard.off('keydown', this.onKeyDown);
      SaveSystem.save(this.state);
    });

    SaveSystem.save(this.state);
  }

  drawRoom() {
    this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x211b16
    );

    this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH - 40,
      GAME_HEIGHT - 58,
      this.interior.floorColor
    )
      .setStrokeStyle(6, this.interior.wallColor);

    const floorLines = this.add.graphics();

    floorLines.lineStyle(1, 0x483725, 0.7);

    for (let y = 62; y < GAME_HEIGHT - 30; y += 24) {
      floorLines.lineBetween(22, y, GAME_WIDTH - 22, y);
    }

    for (let x = 46; x < GAME_WIDTH; x += 48) {
      floorLines.lineBetween(x, 34, x, GAME_HEIGHT - 24);
    }

    this.add.text(
      GAME_WIDTH / 2,
      38,
      this.interior.title,
      {
        fontSize: '10px',
        color: '#f2d28a'
      }
    )
      .setResolution(2)
      .setOrigin(0.5);

    // Nábytek se liší podle typu interiéru.
    if (this.interiorId === 'greenvale_town_hall') {
      this.add.rectangle(320, 218, 118, 34, 0x513b28)
        .setStrokeStyle(2, 0x302316);

      this.add.rectangle(104, 112, 72, 28, 0x392b20)
        .setStrokeStyle(2, 0x8c6740);

      this.add.text(104, 112, 'NÁSTĚNKA', {
        fontSize: '7px',
        color: '#f2d28a'
      })
        .setResolution(2)
        .setOrigin(0.5);
    } else if (this.interiorId === 'greenvale_tavern') {
      this.add.rectangle(320, 218, 150, 36, 0x513b28)
        .setStrokeStyle(2, 0x302316);

      this.add.rectangle(120, 105, 70, 30, 0x513b28)
        .setStrokeStyle(2, 0x302316);

      this.add.text(120, 105, 'PULT', {
        fontSize: '7px',
        color: '#f2d28a'
      })
        .setResolution(2)
        .setOrigin(0.5);
    } else {
      this.add.rectangle(320, 218, 118, 34, 0x513b28)
        .setStrokeStyle(2, 0x302316);

      if (this.interior.futureService) {
        this.add.text(
          GAME_WIDTH / 2,
          112,
          'SLUŽBA SE PŘIPRAVUJE',
          {
            fontSize: '8px',
            color: '#f2d28a'
          }
        )
          .setResolution(2)
          .setOrigin(0.5);
      }
    }

    const doorY = GAME_HEIGHT - 41;

    this.add.rectangle(
      GAME_WIDTH / 2,
      doorY,
      100,
      22,
      0x302316
    )
      .setStrokeStyle(2, 0xc99b48);

    this.add.text(
      GAME_WIDTH / 2,
      doorY,
      'DVEŘE — GREENVALE',
      {
        fontSize: '7px',
        color: '#fff1c6'
      }
    )
      .setResolution(2)
      .setOrigin(0.5);
  }

 update() {
  if (!this.player) return;

  if (this.dialogLines) {
    this.player.body?.setVelocity(0, 0);
    return;
  }

  this.player.updateMovement(this.cursors, this.wasd);
}


  tryInteract() {
    if (this.resident) {
      const residentDistance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        this.resident.x,
        this.resident.y
      );

      if (residentDistance < 48) {
        if (this.resident.role === 'reeve') {
          this.talkToReeve();
        } else if (this.resident.role === 'healer') {
          this.healAtInn();
        }

        return;
      }
    }

    if (this.interior.noticeBoard) {
      const boardDistance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        104,
        112
      );

      if (boardDistance < 48) {
        this.showDialog('Nástěnka úkolů', [
          'Na nástěnce budou hlavní a vedlejší úkoly.',
          'Úkolový deník zatím není implementovaný.'
        ]);
        return;
      }
    }

    const doorDistance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      GAME_WIDTH / 2,
      GAME_HEIGHT - 41
    );

    if (doorDistance < 62) {
      this.leaveInterior();
      return;
    }

    this.showDialog(
      this.interior.title,
      [
        this.interior.futureService ??
          'Rozhlížíš se po místnosti. Zatím tu není nic dalšího k použití.'
      ]
    );
  }

  talkToReeve() {
    this.state.flags ??= {};

    if (!this.state.flags.greenvaleHunterTrialAccepted) {
      this.state.flags.greenvaleHunterTrialAccepted = true;

      this.showDialog(this.interior.residentName, [
        `Jsi začínající lovec Greenvale, ${this.state.playerName ?? 'Arion'}.`,
        'Dire Wolfa jsem ti svěřil jako prvního loveckého společníka.',
        'V jeskyni poblíž vesnice se usídlil nebezpečný miniboss.',
        'Poraz ho a vrať se za mnou. Teprve potom ti povolím opustit Greenvale.'
      ]);

      SaveSystem.save(this.state);
      return;
    }

    if (
      this.state.flags.greenvaleCaveBossDefeated &&
      !this.state.flags.greenvaleHunterPermitGranted
    ) {
      this.state.flags.greenvaleHunterPermitGranted = true;
      unlockRegion(this.state, 'Verdant Forest');

      this.showDialog(this.interior.residentName, [
        'Loveckou zkoušku jsi splnil.',
        'Propouštím tě z místní lovecké služby.',
        'Cesta do Verdant Forest je nyní otevřená.'
      ]);

      SaveSystem.save(this.state);
      return;
    }

    if (this.state.flags.greenvaleHunterPermitGranted) {
      this.showDialog(this.interior.residentName, [
        'Povolení máš. Cesta z Greenvale do Verdant Forest je otevřená.'
      ]);
      return;
    }

    this.showDialog(this.interior.residentName, [
      'Nejdřív poraz minibosse v jeskyni a potom se vrať za mnou.'
    ]);
  }

  healAtInn() {
    this.state.hp = this.state.maxHp;
    this.state.mp = this.state.maxMp;

    for (const monster of this.state.party ?? []) {
      if (monster.stats) {
        monster.currentHp = monster.stats.vitality;
      }

      monster.skillUses ??= {};

      for (const skillId of monster.skills ?? []) {
        const skill = getSkillForInterior(skillId);

        if (skill) {
          monster.skillUses[skillId] = skill.maxUses;
        }
      }
    }

    SaveSystem.save(this.state);

    this.showDialog(this.interior.residentName, [
      'Obnovila jsem tvé zdraví a manu.',
      'Tvoji aktivní společníci jsou také v pořádku.'
    ]);
  }

  showDialog(speaker, lines) {
    this.player?.body?.setVelocity(0, 0);
    this.dialogSpeaker = speaker;
    this.dialogLines = lines;
    this.dialogIndex = 0;

    this.dialogPanel.setVisible(true);
    this.dialogText.setVisible(true);

    this.showDialogLine();
  }

  showDialogLine() {
    const line = this.dialogLines[this.dialogIndex];

    this.dialogText.setText(
      `${this.dialogSpeaker}\n${line}\n\n[E / mezerník] pokračovat`
    );
  }

  advanceDialog() {
    this.dialogIndex += 1;

    if (this.dialogIndex >= this.dialogLines.length) {
      this.dialogLines = null;
      this.dialogSpeaker = '';
      this.dialogPanel.setVisible(false);
      this.dialogText.setVisible(false);
      return;
    }

    this.showDialogLine();
  }

  leaveInterior() {
    this.state.interiorId = null;
    SaveSystem.save(this.state);

    if (this.fromWorld) {
      this.scene.stop();
      this.scene.resume('World');
      return;
    }

    this.scene.start('World', { state: this.state });
  }
}

function getSkillForInterior(skillId) {
  // Importujeme systém schopností dynamicky, aby se obnovily jejich použití
  // po léčení v hostinci.
  return skillRowsForInterior.find((skill) => skill.id === skillId) ?? null;
}

