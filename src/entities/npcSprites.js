// Postavy NPC v interiérech: pixelové kresby 16 × 24 polí, zvětšené na výšku hrdiny.
// Každý znak v mapě je jedna barva palety, tečka je průhledná.

export const NPC_PIXEL = 4; // 16 × 24 → 64 × 96 px (hrdina v interiéru má ~95 px)

const OUTLINE = 0x1c1410;
const SKIN = 0xf0c8a0;
const SKIN_SHADE = 0xd9a77f;
const EYE = 0x2a1a14;

export const NPC_SPRITES = {
  // Liora, léčitelka z hostince: kaštanové vlasy, bílá róba se zelenou šerpou.
  'npc-liora': {
    palette: {
      O: OUTLINE, S: SKIN, s: SKIN_SHADE, E: EYE, M: 0xc0705a,
      H: 0x9a4a2a, W: 0xe8efe6, w: 0xb9c8bd, G: 0x3f9a62, B: 0x4a3426
    },
    rows: [
      '......OOOO......',
      '....OOHHHHOO....',
      '...OHHHHHHHHO...',
      '..OHHHSSSSHHHO..',
      '..OHHSSSSSSHHO..',
      '..OHHSESSESHHO..',
      '..OHHSSSSSSHHO..',
      '..OHHsSSMSsHHO..',
      '..OHHHsSSsHHHO..',
      '..OHHOWWWWOHHO..',
      '.OHHOWWGGWWOHHO.',
      '.OHOWWWGGWWWOHO.',
      '.OOWWWWGGWWWWOO.',
      '..OsWWWGGWWWsO..',
      '..OSWWGGGGWWSO..',
      '...OWWGGGGWWO...',
      '...OWWWWWWWWO...',
      '...OwWWWWWWwO...',
      '..OwWWWWWWWWwO..',
      '..OwWWWWWWWWwO..',
      '..OwwWWWWWWwwO..',
      '..OOwwwwwwwwOO..',
      '....OBBOOBBO....',
      '....OOO..OOO....'
    ]
  },
  // Starosta Edric: šedé vlasy a vousy, vínový kabát se zlatým řetězem.
  'npc-mayor': {
    palette: {
      O: OUTLINE, S: SKIN, s: SKIN_SHADE, E: EYE,
      G: 0xc4c4bc, C: 0x7a1f2a, c: 0x521219, Y: 0xe0b440, W: 0xe8e0cc,
      T: 0x3a3040, B: 0x2a1c14
    },
    rows: [
      '................',
      '.....OOOOOO.....',
      '....OGGGGGGO....',
      '...OGGSSSSGGO...',
      '...OGSSSSSSGO...',
      '...OSSESSESSO...',
      '...OSSSSSSSSO...',
      '...OSGGGGGGSO...',
      '....OGGGGGGO....',
      '...OCOGGGGOCO...',
      '..OCCCWGGWCCCO..',
      '.OCCCCYWWYCCCCO.',
      '.OCCcCCYYCCcCCO.',
      '.OCCcCCYYCCcCCO.',
      '.OsCcCCCCCCcCsO.',
      '.OSOcCCYYCCcOSO.',
      '..O.OCCCCCCO.O..',
      '....OYYYYYYO....',
      '....OCCCCCCO....',
      '....OTTOOTTO....',
      '....OTTOOTTO....',
      '....OTTOOTTO....',
      '...OBBBOOBBBO...',
      '...OOOOOOOOOO...'
    ]
  }
};

export function createNpcTextures(scene) {
  for (const [key, sprite] of Object.entries(NPC_SPRITES)) {
    if (scene.textures.exists(key)) continue;
    const width = sprite.rows[0].length;
    const height = sprite.rows.length;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });

    sprite.rows.forEach((row, y) => {
      [...row].forEach((char, x) => {
        const color = sprite.palette[char];
        if (color === undefined) return;
        g.fillStyle(color, 1).fillRect(x * NPC_PIXEL, y * NPC_PIXEL, NPC_PIXEL, NPC_PIXEL);
      });
    });

    g.generateTexture(key, width * NPC_PIXEL, height * NPC_PIXEL);
    g.destroy();
  }
}
