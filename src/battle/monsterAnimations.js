// Animace monster z obrázků (public/assets/monsters/<druh>/animations/<animace>.png).
// List = snímky vedle sebe na bílém pozadí. Při startu hry se snímky vyříznou, bílé pozadí
// zprůhlední a všechny snímky se oříznou na společný obdélník, aby tlapy zůstaly na místě.
// Druh bez animace dál používá jednoduchý kreslený model (monsterModels.js).

import { clearWhiteFromEdges } from '../ui/heroCard/tabSprites.js';

export const MONSTER_ANIMATIONS = {
  dire_wolf: {
    idle: {
      path: 'assets/monsters/dire_wolf/animations/Idle.png',
      frames: 4,
      frameRate: 3,
      // Délka těla v jednotkách modelu (kreslené modely mají ~100).
      displayWidth: 150,
      // Vlk na obrázku kouká doprava (stejně jako monstra hráče).
      facesRight: true,
      // Hlava z prvního snímku pro miniaturu (souřadnice v listu, čtverec).
      head: { x: 356, y: 176, w: 168, h: 168 }
    }
  }
};

const sheetKey = (species, anim) => `monster-sheet-${species}-${anim}`;
const frameKey = (species, anim, i) => `monster-${species}-${anim}-${i}`;
export const animationKey = (species, anim) => `monster-${species}-${anim}`;
const headKey = (species) => `monster-${species}-head`;

export function loadMonsterAnimations(scene) {
  for (const [species, anims] of Object.entries(MONSTER_ANIMATIONS)) {
    for (const [anim, def] of Object.entries(anims)) scene.load.image(sheetKey(species, anim), def.path);
  }
}

export function prepareMonsterAnimations(scene) {
  for (const [species, anims] of Object.entries(MONSTER_ANIMATIONS)) {
    for (const [anim, def] of Object.entries(anims)) {
      const key = sheetKey(species, anim);
      if (!scene.textures.exists(key) || scene.textures.exists(frameKey(species, anim, 0))) continue;
      const source = scene.textures.get(key).getSourceImage();
      const fw = Math.floor(source.width / def.frames);
      const fh = source.height;

      // 1) Snímky s průhledným pozadím a jejich obsah.
      const frames = [];
      let x0 = fw, y0 = fh, x1 = -1, y1 = -1;
      for (let i = 0; i < def.frames; i++) {
        const canvas = document.createElement('canvas');
        canvas.width = fw;
        canvas.height = fh;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(source, i * fw, 0, fw, fh, 0, 0, fw, fh);
        clearWhiteFromEdges(ctx, fw, fh);
        const data = ctx.getImageData(0, 0, fw, fh).data;
        for (let y = 0; y < fh; y++) {
          for (let x = 0; x < fw; x++) {
            if (data[(y * fw + x) * 4 + 3] > 24) {
              if (x < x0) x0 = x;
              if (x > x1) x1 = x;
              if (y < y0) y0 = y;
              if (y > y1) y1 = y;
            }
          }
        }
        frames.push(canvas);
      }

      // 2) Společný ořez pro všechny snímky (pohyb uvnitř animace zůstane zachovaný).
      // Hlava z prvního snímku (miniatura na kartě Party).
      if (def.head) {
        const { x, y, w: hw, h: hh } = def.head;
        const head = document.createElement('canvas');
        head.width = hw;
        head.height = hh;
        head.getContext('2d').drawImage(frames[0], x, y, hw, hh, 0, 0, hw, hh);
        scene.textures.addCanvas(headKey(species), head);
      }

      const w = x1 - x0 + 1;
      const h = y1 - y0 + 1;
      frames.forEach((canvas, i) => {
        const out = document.createElement('canvas');
        out.width = w;
        out.height = h;
        out.getContext('2d').drawImage(canvas, x0, y0, w, h, 0, 0, w, h);
        scene.textures.addCanvas(frameKey(species, anim, i), out);
      });

      if (!scene.anims.exists(animationKey(species, anim))) {
        scene.anims.create({
          key: animationKey(species, anim),
          frames: frames.map((_, i) => ({ key: frameKey(species, anim, i) })),
          frameRate: def.frameRate,
          repeat: -1
        });
      }
      scene.textures.remove(key);
    }
  }
}

// Animovaný sprite pro model monstra, nebo null (druh nemá animaci).
export function createAnimatedBody(scene, speciesId, side) {
  const def = MONSTER_ANIMATIONS[speciesId]?.idle;
  if (!def || !scene.textures.exists(frameKey(speciesId, 'idle', 0))) return null;
  const sprite = scene.add.sprite(0, 4, frameKey(speciesId, 'idle', 0)).setOrigin(0.5, 1);
  sprite.setScale(def.displayWidth / sprite.width);
  // Monstra nepřítele koukají doleva (zrcadlový obrázek).
  const enemy = side === 'enemy';
  const faceLeft = enemy === def.facesRight;
  if (faceLeft) sprite.setFlipX(true);

  const key = animationKey(speciesId, 'idle');
  if (enemy) {
    // Nepřítel se od party liší: náhodný začátek cyklu a trochu jiná rychlost.
    sprite.play({ key, startFrame: Math.floor(Math.random() * def.frames) });
    sprite.anims.timeScale = 0.8 + Math.random() * 0.3;
  } else {
    // Monstra hráče jedou synchronně: snímek i začátek se odvodí od společných hodin hry.
    const msPerFrame = 1000 / def.frameRate;
    const now = scene.time.now;
    const tick = Math.floor(now / msPerFrame);
    sprite.play({ key, startFrame: (tick + 1) % def.frames, delay: msPerFrame - (now % msPerFrame) });
  }
  return sprite;
}

// Hlava z prvního snímku idle animace, nebo null.
export function monsterHeadKey(scene, speciesId) {
  const key = headKey(speciesId);
  return scene.textures.exists(key) ? key : null;
}

// První snímek idle animace (celé monstrum bez pohybu), nebo null.
export function monsterStillKey(scene, speciesId) {
  const key = frameKey(speciesId, 'idle', 0);
  return MONSTER_ANIMATIONS[speciesId]?.idle && scene.textures.exists(key) ? key : null;
}
