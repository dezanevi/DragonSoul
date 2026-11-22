import Phaser from 'phaser';
import Player from '../entities/Player.js';
import NPC from '../entities/NPC.js';
import { createNpcTextures } from '../entities/npcSprites.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../config.js';
import { unlockRegion } from '../systems/RegionSystem.js';
import {
  QUESTS,
  QUEST_STATUS,
  getQuestStatus,
  acceptQuest,
  completeQuest
} from '../systems/QuestSystem.js';
import skillRowsForInterior from '../data/skills.json';

// Interiéry jsou kreslené pro 1920 × 1080 (původní návrh 640 × 360, proto souřadnice
// ve stylu 3 × původní hodnoty).
const FONT = 'Georgia, "Times New Roman", serif';
const TALK_REACH = 230; // i přes stůl před postavou
const BOARD = { x: 312, y: 336, w: 216, h: 84 };
const DOOR = { x: GAME_WIDTH / 2, y: GAME_HEIGHT - 50, w: 300, h: 60 };
const CAVE_QUEST = 'greenvale_cave_slime';

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
    residentName: 'Starosta Edric',
    residentRole: 'mayor',
    residentTexture: 'npc-mayor',
    residentX: 960,
    residentY: 470,
    noticeBoard: true
  },
  greenvale_tavern: {
    title: 'HOSTINEC GREENVALE',
    floorColor: 0x72513a,
    wallColor: 0x432e22,
    residentName: 'Liora, léčitelka',
    residentRole: 'healer',
    residentTexture: 'npc-liora',
    residentX: 960,
    residentY: 470
  },
  greenvale_market: {
    title: 'TRŽIŠTĚ – POTRAVINY',
    floorColor: 0x746044,
    wallColor: 0x4a3828,
    residentName: null,
    futureService: 'Obchod s potravinami zatím není připraven.'
  },
  greenvale_market_wares: {
    title: 'TRŽIŠTĚ – ZBOŽÍ',
    floorColor: 0x746044,
    wallColor: 0x4a3828,
    residentName: null,
    futureService: 'Obchod se zbožím a materiály zatím není připraven.'
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

const label = (scene, x, y, value, size, color = '#f2d28a', options = {}) =>
  scene.add
    .text(x, y, value, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      fontStyle: options.bold === false ? 'normal' : 'bold',
      color,
      stroke: '#0a0603',
      strokeThickness: options.stroke ?? 4,
      backgroundColor: options.background,
      padding: options.padding,
      wordWrap: options.wrap ? { width: options.wrap } : undefined,
      lineSpacing: 6
    })
    .setResolution(2)
    .setOrigin(options.originX ?? 0.5, options.originY ?? 0.5);

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

    createNpcTextures(this);
    this.cameras.main.setBackgroundColor('#211b16');
    this.physics.world.setBounds(60, 100, GAME_WIDTH - 120, GAME_HEIGHT - 160);

    this.drawRoom();

    // Interiérový hráč používá vlastní souřadnice,
    // aby jeho pohyb nepřepsal venkovní pozici v uložené hře.
    this.interiorPlayerPosition = {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT - 150
    };

    this.player = new Player(
      this,
      this.interiorPlayerPosition.x,
      this.interiorPlayerPosition.y,
      this.interiorPlayerPosition,
      this.state.gender // podoba postavy podle volby při vytvoření
    );

    this.resident = null;

    if (this.interior.residentName) {
      this.resident = new NPC(
        this,
        this.interior.residentX,
        this.interior.residentY,
        this.interior.residentTexture ?? 'elder',
        this.interior.residentName,
        []
      );

      this.resident.role = this.interior.residentRole;
      this.physics.add.collider(this.player, this.resident);
    }

    const solids = this.physics.add.staticGroup();
    for (const { x, y, w, h } of this.furnitureRects) {
      solids.add(this.add.zone(x, y, w, h));
    }
    this.physics.add.collider(this.player, solids);

    if (this.resident) {

      // Jméno nad postavou.
      label(this, this.resident.x, this.resident.y - this.resident.displayHeight / 2 - 26,
        this.interior.residentName, 26, '#ffe7ae').setDepth(60);
      this.questMarker = label(this, this.resident.x, this.resident.y - this.resident.displayHeight / 2 - 72,
        '', 46, '#ffd23a', { stroke: 6 }).setDepth(60);
      this.refreshQuestMarker();
    }

    this.cursors = this.input.keyboard.createCursorKeys();

    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D
    });

    // Výzva „E: …“ nad hráčem, když je u postavy, nástěnky nebo dveří.
    this.prompt = label(this, 0, 0, '', 24, '#fff4d6', {
      background: '#2a1a10dd',
      padding: { x: 12, y: 6 },
      stroke: 0,
      originY: 1
    }).setDepth(90).setVisible(false);

    this.dialogPanel = this.add.graphics().setDepth(100).setVisible(false);
    this.dialogPanel.fillStyle(0x10151a, 0.96).fillRoundedRect(40, GAME_HEIGHT - 250, GAME_WIDTH - 80, 220, 18);
    this.dialogPanel.lineStyle(4, 0xd6a23a, 1).strokeRoundedRect(40, GAME_HEIGHT - 250, GAME_WIDTH - 80, 220, 18);

    this.dialogText = label(this, 80, GAME_HEIGHT - 226, '', 30, '#fff2d1', {
      bold: false,
      stroke: 3,
      wrap: GAME_WIDTH - 160,
      originX: 0,
      originY: 0
    }).setDepth(101).setVisible(false);

    label(this, GAME_WIDTH / 2, 22,
      'WASD / šipky: pohyb   |   E / mezerník: mluvit, prohlížet nebo odejít   |   C / T / P / I: karty   |   ESC: menu',
      20, '#e5e5d3', { bold: false, background: '#17251f', padding: { x: 12, y: 6 }, stroke: 0, originY: 0 }
    ).setDepth(90);

    this.onKeyDown = (event) => {
      if (event.repeat) return;
      if (performance.now() < (this.ignoreKeysUntil ?? 0)) return;

      // Karty jdou otevřít i v interiéru: C = hrdina, T = talenty, P = parta.
      const cardKeys = { KeyC: 'Hero', KeyT: 'Talents', KeyP: 'Party', KeyI: 'Inventory' };
      if (cardKeys[event.code] && !this.dialogLines) {
        this.openCard(cardKeys[event.code]);
        return;
      }

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

    // Po zavření karty (C / T / P) by mohly zůstat „držené“ klávesy pohybu.
    // Stejné stisknutí (ESC / C / T), které kartu zavřelo, nesmí hned dostat i interiér
    // (ESC by jinak skočilo do menu) – chvíli po návratu klávesy ignorujeme.
    this.onResume = () => {
      this.input.keyboard.resetKeys();
      this.ignoreKeysUntil = performance.now() + 250;
      this.refreshQuestMarker();
    };
    this.events.on(Phaser.Scenes.Events.RESUME, this.onResume);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.RESUME, this.onResume));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard.off('keydown', this.onKeyDown);
      SaveSystem.save(this.state);
    });

    SaveSystem.save(this.state);
  }

  drawRoom() {
    const g = this.add.graphics();
    g.fillStyle(0x211b16, 1).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Zadní stěna a podlaha.
    g.fillStyle(this.interior.wallColor, 1).fillRect(40, 60, GAME_WIDTH - 80, 200);
    g.fillStyle(this.interior.floorColor, 1).fillRect(40, 260, GAME_WIDTH - 80, GAME_HEIGHT - 300);
    g.lineStyle(10, 0x2a1d13, 1).strokeRect(40, 60, GAME_WIDTH - 80, GAME_HEIGHT - 100);

    // Prkna podlahy.
    g.lineStyle(2, 0x483725, 0.7);
    for (let y = 332; y < GAME_HEIGHT - 40; y += 72) {
      g.lineBetween(45, y, GAME_WIDTH - 45, y);
    }
    for (let row = 0, y = 260; y < GAME_HEIGHT - 40; row += 1, y += 72) {
      for (let x = 45 + (row % 2) * 72; x < GAME_WIDTH - 45; x += 144) {
        g.lineBetween(x, y, x, Math.min(y + 72, GAME_HEIGHT - 40));
      }
    }

    // Trámy ve stěně.
    g.fillStyle(0x2a1d13, 1);
    for (let x = 40; x < GAME_WIDTH - 40; x += 300) g.fillRect(x, 60, 18, 200);
    g.fillRect(40, 250, GAME_WIDTH - 80, 14);

    label(this, GAME_WIDTH / 2, 110, this.interior.title, 36, '#f2d28a');

    // Nábytek je pevný – hrdina ho obchází.
    this.furnitureRects = [];
    const furniture = (x, y, w, h, color = 0x513b28) => {
      this.furnitureRects.push({ x, y, w, h });
      g.fillStyle(0x000000, 0.25).fillRoundedRect(x - w / 2 + 6, y - h / 2 + 8, w, h, 8);
      g.fillStyle(color, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, 8);
      g.lineStyle(4, 0x302316, 1).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 8);
    };

    // Nábytek se liší podle typu interiéru.
    if (this.interiorId === 'greenvale_town_hall') {
      // Starostův stůl před ním.
      furniture(960, 590, 420, 96);
      g.fillStyle(0xe8dcb8, 1).fillRect(880, 566, 70, 46).fillRect(980, 572, 54, 38);
      // Prapor Greenvale na stěně.
      g.fillStyle(0x3f7a3a, 1).fillRect(930, 130, 60, 110);
      g.fillStyle(0xe0b440, 1).fillTriangle(930, 240, 990, 240, 960, 270);
      // Nástěnka úkolů.
      furniture(BOARD.x, BOARD.y, BOARD.w, BOARD.h, 0x392b20);
      g.lineStyle(3, 0x8c6740, 1).strokeRoundedRect(BOARD.x - BOARD.w / 2, BOARD.y - BOARD.h / 2, BOARD.w, BOARD.h, 8);
      label(this, BOARD.x, BOARD.y, 'NÁSTĚNKA', 22);
    } else if (this.interiorId === 'greenvale_tavern') {
      // Liořin léčitelský stůl s lahvičkami.
      furniture(960, 590, 450, 96);
      [[860, 0x4fd2a0], [910, 0xd95a6a], [1010, 0x6aa8ff], [1060, 0x4fd2a0]].forEach(([x, color]) => {
        g.fillStyle(color, 1).fillRoundedRect(x - 10, 556, 20, 30, 6);
        g.fillStyle(0xe8e0cc, 1).fillRect(x - 5, 548, 10, 10);
      });
      furniture(360, 330, 210, 90);
      label(this, 360, 330, 'PULT', 22);
      // Stoly hostince.
      furniture(420, 760, 200, 110);
      furniture(1500, 760, 200, 110);
      furniture(1560, 400, 180, 100);
    } else {
      furniture(960, 560, 354, 102);

      if (this.interior.futureService) {
        label(this, GAME_WIDTH / 2, 380, 'SLUŽBA SE PŘIPRAVUJE', 28);
      }
    }

    // Dveře ven.
    g.fillStyle(0x302316, 1).fillRoundedRect(DOOR.x - DOOR.w / 2, DOOR.y - DOOR.h / 2, DOOR.w, DOOR.h, 8);
    g.lineStyle(4, 0xc99b48, 1).strokeRoundedRect(DOOR.x - DOOR.w / 2, DOOR.y - DOOR.h / 2, DOOR.w, DOOR.h, 8);
    label(this, DOOR.x, DOOR.y, 'DVEŘE — GREENVALE', 22, '#fff1c6');
  }

  update() {
    if (!this.player) return;

    if (this.dialogLines) {
      this.player.body?.setVelocity(0, 0);
      this.prompt.setVisible(false);
      return;
    }

    this.player.updateMovement(this.cursors, this.wasd);

    const target = this.findInteraction();
    if (target) {
      this.prompt
        .setText(target.prompt)
        .setPosition(this.player.x, this.player.y - this.player.displayHeight / 2 - 16)
        .setVisible(true);
    } else {
      this.prompt.setVisible(false);
    }
  }

  // Co je u hráče na dosah: postava, nástěnka, dveře.
  findInteraction() {
    const near = (x, y, reach) =>
      Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y) < reach;

    if (this.resident && near(this.resident.x, this.resident.y, TALK_REACH)) {
      return { type: 'resident', prompt: `E: mluvit – ${this.interior.residentName}` };
    }
    if (this.interior.noticeBoard && near(BOARD.x, BOARD.y, TALK_REACH)) {
      return { type: 'board', prompt: 'E: prohlédnout nástěnku' };
    }
    if (near(DOOR.x, DOOR.y, 140)) {
      return { type: 'door', prompt: 'E: odejít do Greenvale' };
    }
    return null;
  }

  tryInteract() {
    const target = this.findInteraction();

    if (target?.type === 'resident') {
      if (this.resident.role === 'mayor') {
        this.talkToMayor();
      } else if (this.resident.role === 'healer') {
        this.healAtInn();
      }
      return;
    }

    if (target?.type === 'board') {
      const quest = QUESTS[CAVE_QUEST];
      const status = getQuestStatus(this.state, CAVE_QUEST);
      this.showDialog('Nástěnka úkolů', [
        status === QUEST_STATUS.notStarted
          ? `Vyhláška: ${quest.description} Zájemci ať se hlásí u starosty.`
          : `Úkol ${quest.title}: ${status === QUEST_STATUS.done ? 'dokončeno.' : status === QUEST_STATUS.ready ? quest.returnTo : quest.objective}`,
        'Přehled úkolů najdeš i na kartě hrdiny v záložce Úkoly.'
      ]);
      return;
    }

    if (target?.type === 'door') {
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

  // Úkol Jeskynní sliz: zadá ho starosta, odměnou jsou talentové stromy.
  talkToMayor() {
    const name = this.state.playerName ?? 'Arion';
    const status = getQuestStatus(this.state, CAVE_QUEST);

    if (status === QUEST_STATUS.notStarted) {
      acceptQuest(this.state, CAVE_QUEST);
      SaveSystem.save(this.state);
      this.showDialog(this.interior.residentName, [
        `Vítej na radnici, ${name}. Jsi začínající lovec Greenvale.`,
        'Dire Wolfa jsem ti svěřil jako prvního loveckého společníka.',
        'V jeskyni za vesnicí se usadil obří jeskynní sliz. Pohlcuje kamení, zvěř i neopatrné lovce.',
        'Zabij ho a vrať se za mnou. Pak tě naučím, jak se vydat cestou souboje, řemesel nebo magie.',
        'Nový úkol: Jeskynní sliz. (Jeskyně: přijď k vchodu a stiskni E.)'
      ]);
      this.refreshQuestMarker();
      return;
    }

    if (status === QUEST_STATUS.ready) {
      completeQuest(this.state, CAVE_QUEST);
      unlockRegion(this.state, 'Verdant Forest');
      SaveSystem.save(this.state);
      this.showDialog(this.interior.residentName, [
        'Jeskynní sliz je mrtvý? Greenvale ti dluží díky.',
        'Prokázal jsi, že jsi skutečný lovec. Od teď si můžeš zvolit svou cestu.',
        'Odemčeno: talentové stromy. Na kartě Talenty (T) si vyber hlavní specializaci.',
        'A cesta z Greenvale do Verdant Forest je také otevřená.'
      ]);
      this.refreshQuestMarker();
      return;
    }

    if (status === QUEST_STATUS.done) {
      this.showDialog(this.interior.residentName, [
        'Greenvale je díky tobě v bezpečí. Talentové stromy i cesta do Verdant Forest jsou ti otevřené.'
      ]);
      return;
    }

    this.showDialog(this.interior.residentName, [
      'Jeskynní sliz pořád žije. Jeskyně je za vesnicí u skal – přijď k vchodu a stiskni E.',
      'Než vyrazíš, ať tě Liora v hostinci dá do pořádku.'
    ]);
  }

  // „!“ = nový úkol, „?“ = splněno, vrať se. Jen u starosty.
  refreshQuestMarker() {
    if (!this.questMarker) return;
    if (this.resident?.role !== 'mayor') {
      this.questMarker.setText('');
      return;
    }
    const status = getQuestStatus(this.state, CAVE_QUEST);
    this.questMarker.setText(
      status === QUEST_STATUS.notStarted ? '!' : status === QUEST_STATUS.ready ? '?' : ''
    );
  }

  // Karta (Hero, Talents, Party) přes interiér: interiér se pozastaví, postava se zastaví.
  openCard(sceneKey) {
    this.player?.body?.setVelocity(0, 0);
    this.player?.anims?.stop();
    this.prompt?.setVisible(false);
    SaveSystem.save(this.state);
    this.scene.pause();
    // U Liory (hostinec) jde v Party kartě přesouvat monstra mezi partou a úschovnou.
    const storageAccess = this.interior?.residentRole === 'healer';
    this.scene.launch(sceneKey, { state: this.state, returnScene: this.scene.key, storageAccess });
    // Karta se musí kreslit nad interiérem (interiér je v seznamu scén až za kartami).
    this.scene.bringToTop(sceneKey);
  }

  healAtInn() {
    // HP hrdiny je skryté (nikde se nezobrazuje), v uložené hře zůstává.
    this.state.hp = this.state.maxHp;
    this.state.mp = this.state.maxMp;

    // Liora léčí aktivní partu i monstra v úschovně.
    for (const monster of [...(this.state.party ?? []), ...(this.state.monsterStorage ?? [])]) {
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

    const lines = [
      'Pojď blíž, podívám se na tebe i na tvoje společníky.',
      'Obnovila jsem ti manu. Tvoji společníci v partě i v úschovně jsou zase v pořádku.',
      'Monstra mezi partou a úschovnou si u mě přesuneš v kartě Party (P).'
    ];
    if (getQuestStatus(this.state, CAVE_QUEST) === QUEST_STATUS.active) {
      lines.push('Jdeš na toho jeskynního slizu? Jeho útoky jsou těžké jako kámen. Vrať se, kdyby bylo zle.');
    }
    this.showDialog(this.interior.residentName, lines);
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
    // Svět postaví hráče před dveře této budovy (např. po startu nové hry v chatě).
    // Při návratu do pozastaveného světa hráč u dveří už stojí.
    if (!this.fromWorld) this.state.exitDoor = this.interiorId;
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
  // Po léčení u Liory se obnoví počet použití schopností.
  return skillRowsForInterior.find((skill) => skill.id === skillId) ?? null;
}
