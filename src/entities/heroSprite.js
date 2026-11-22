// Spritesheet hrdiny: 3 snímky chůze × 8 řad, každý snímek 192 × 256 px.
// Postava stojí nohama 8 px nad spodním okrajem snímku.
//
// Původní soubor z generátoru je v hero-walk-source.png. Po vygenerování
// nové verze ho přebal příkazem:
//   powershell -File tools/repack-sprite.ps1 -Source public/assets/hero/hero-walk-source.png -Target public/assets/hero/hero-walk.png

export const HERO_TEXTURE = 'hero-walk';
export const HERO_SHEET_PATH = 'assets/hero/hero-walk.png';

// Podoba hrdiny podle pohlaví zvoleného při vytvoření postavy (state.gender).
// Oba listy mají stejnou mřížku a stejné pořadí řad; ženský list má pod nohama
// 6 px místo 8 (jeden snímek je vyšší).
export const HERO_VARIANTS = {
  male: { texture: HERO_TEXTURE, path: HERO_SHEET_PATH, feetPadding: 8 },
  female: { texture: 'hero-female-walk', path: 'assets/hero/hero-female-walk.png', feetPadding: 6 }
};

export function heroVariant(gender) {
  return HERO_VARIANTS[gender] ?? HERO_VARIANTS.male;
}

export function heroTexture(gender) {
  return heroVariant(gender).texture;
}

// Svislý počátek sprite tak, aby bod (x, y) byl u nohou.
export function heroFeetOriginY(gender) {
  return (HERO_FRAME_HEIGHT - heroVariant(gender).feetPadding) / HERO_FRAME_HEIGHT;
}

export const HERO_FRAME_WIDTH = 192;
export const HERO_FRAME_HEIGHT = 256;
export const HERO_FEET_PADDING = 8;
export const HERO_FRAMES_PER_DIRECTION = 3;

// Výška hrdiny ve hře (px). Pole má 64 px. Ladí se v okně /lab.html.
export const HERO_DISPLAY_HEIGHT = 112;

// Řady ve spritesheetu. Řady 6 a 7 nejsou použité: řada 6 se dívá
// na východ místo na západ a řada 7 skoro rovně dopředu.
// Západní směry proto vznikají zrcadlením východních.
export const HERO_DIRECTIONS = {
  south: { row: 0, flipX: false },
  southeast: { row: 1, flipX: false },
  east: { row: 2, flipX: false },
  northeast: { row: 3, flipX: false },
  north: { row: 4, flipX: false },
  northwest: { row: 3, flipX: true },
  west: { row: 2, flipX: true },
  southwest: { row: 1, flipX: true }
};

export function loadHeroSprite(scene) {
  for (const variant of Object.values(HERO_VARIANTS)) {
    if (scene.textures.exists(variant.texture)) continue;
    scene.load.spritesheet(variant.texture, variant.path, {
      frameWidth: HERO_FRAME_WIDTH,
      frameHeight: HERO_FRAME_HEIGHT
    });
  }
}

export function createHeroAnimations(scene) {
  for (const [gender, variant] of Object.entries(HERO_VARIANTS)) {
    if (!scene.textures.exists(variant.texture)) continue;

    for (const [name, direction] of Object.entries(HERO_DIRECTIONS)) {
      const key = heroAnimationKey(name, gender);
      if (scene.anims.exists(key)) continue;

      const first = direction.row * HERO_FRAMES_PER_DIRECTION;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(variant.texture, {
          frames: [first, first + 1, first, first + 2]
        }),
        frameRate: 8,
        repeat: -1
      });
    }
  }
}

// Mužská animace má klíč hero-walk-<směr>, ženská hero-female-walk-<směr>.
export function heroAnimationKey(directionName, gender = 'male') {
  return `${heroTexture(gender)}-${directionName}`;
}

export function heroIdleFrame(directionName) {
  return HERO_DIRECTIONS[directionName].row * HERO_FRAMES_PER_DIRECTION;
}
