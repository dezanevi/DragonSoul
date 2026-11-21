// Kulisy soubojů malované kódem do plátna (canvas 2D) – bez obrázků.
// Každá lokace má vlastní funkci. Zatím je hotová jedna: louka u jeskyně
// Greenvale (zóna setkání). Další lokace se přidají do BACKDROPS.

const WIDTH = 1920;
const HEIGHT = 1080;

export const DEFAULT_BACKDROP = 'greenvale_meadow';

export const BACKDROPS = {
  greenvale_meadow: {
    name: 'Louka u jeskyně – Greenvale',
    paint: paintGreenvaleMeadow,
    // Barvy, které ladí s kulisou (mřížka, částice).
    palette: { grid: 0xdff6e4, glow: 0xffd88a, mote: 0xfff2b8 }
  }
};

export function backdropKey(id) {
  return `battle-backdrop-${id}`;
}

// Vrátí klíč textury kulisy (namaluje ji při prvním použití).
export function ensureBackdrop(scene, id = DEFAULT_BACKDROP) {
  const backdrop = BACKDROPS[id] ?? BACKDROPS[DEFAULT_BACKDROP];
  const key = backdropKey(BACKDROPS[id] ? id : DEFAULT_BACKDROP);
  if (scene.textures.exists(key)) return { key, backdrop };

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  backdrop.paint(canvas.getContext('2d'), WIDTH, HEIGHT);
  scene.textures.addCanvas(key, canvas);
  return { key, backdrop };
}

// ------------------------------------------------------------- pomocníci

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function ridge(ctx, w, baseY, amplitude, roughness, rand, color) {
  ctx.beginPath();
  ctx.moveTo(0, HEIGHT);
  let y = baseY;
  for (let x = 0; x <= w; x += 24) {
    y += (rand() - 0.5) * roughness;
    y = Math.max(baseY - amplitude, Math.min(baseY + amplitude * 0.4, y));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, HEIGHT);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function spruce(ctx, x, baseY, height, color, highlight) {
  const width = height * 0.42;
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const tierTop = baseY - height + height * t * 0.78;
    const tierBottom = tierTop + height * 0.38;
    const tierHalf = width * (0.35 + t * 0.65) * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, tierTop);
    ctx.lineTo(x + tierHalf, tierBottom);
    ctx.lineTo(x - tierHalf, tierBottom);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    if (highlight) {
      ctx.beginPath();
      ctx.moveTo(x, tierTop);
      ctx.lineTo(x + tierHalf, tierBottom);
      ctx.lineTo(x + tierHalf * 0.2, tierBottom);
      ctx.closePath();
      ctx.fillStyle = highlight;
      ctx.fill();
    }
  }
  ctx.fillStyle = color;
  ctx.fillRect(x - height * 0.025, baseY - height * 0.06, height * 0.05, height * 0.08);
}

// ------------------------------------------- louka u jeskyně Greenvale

function paintGreenvaleMeadow(ctx, w, h) {
  const rand = seeded(7121);

  // Obloha – pozdní odpoledne, teplé světlo zprava.
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.5);
  sky.addColorStop(0, '#16304c');
  sky.addColorStop(0.45, '#3f6f93');
  sky.addColorStop(0.8, '#9fb9b4');
  sky.addColorStop(1, '#f1cf96');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Slunce a jeho záře.
  const sun = ctx.createRadialGradient(w * 0.78, h * 0.3, 10, w * 0.78, h * 0.3, h * 0.55);
  sun.addColorStop(0, 'rgba(255, 240, 200, 0.95)');
  sun.addColorStop(0.08, 'rgba(255, 222, 160, 0.6)');
  sun.addColorStop(0.4, 'rgba(255, 190, 120, 0.12)');
  sun.addColorStop(1, 'rgba(255, 190, 120, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);

  // Oblaka – měkké vrstvy.
  ctx.save();
  ctx.filter = 'blur(18px)';
  for (let i = 0; i < 9; i++) {
    const cx = rand() * w;
    const cy = 60 + rand() * 200;
    ctx.fillStyle = `rgba(255, 236, 214, ${0.08 + rand() * 0.1})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 160 + rand() * 220, 22 + rand() * 30, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Vzdálené hory (opar).
  ridge(ctx, w, 330, 120, 46, rand, '#6f8ea0');
  ridge(ctx, w, 360, 90, 40, rand, '#56778a');

  // Opar nad horami.
  const haze = ctx.createLinearGradient(0, 260, 0, 430);
  haze.addColorStop(0, 'rgba(241, 207, 150, 0)');
  haze.addColorStop(1, 'rgba(241, 207, 150, 0.45)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 260, w, 170);

  // Vzdálený smrkový les.
  for (let i = 0; i < 70; i++) {
    const x = rand() * w;
    spruce(ctx, x, 420 + rand() * 12, 60 + rand() * 50, '#2f5150', null);
  }
  for (let i = 0; i < 46; i++) {
    const x = rand() * w;
    spruce(ctx, x, 440 + rand() * 16, 90 + rand() * 70, '#223f3a', 'rgba(255, 210, 150, 0.08)');
  }

  // Skalní masiv s jeskyní vlevo.
  paintCave(ctx, rand);

  // Louka – tmavá tráva zóny setkání, blíž světlejší.
  const ground = ctx.createLinearGradient(0, 420, 0, h);
  ground.addColorStop(0, '#2f5a33');
  ground.addColorStop(0.35, '#2b5530');
  ground.addColorStop(1, '#1d3d22');
  ctx.fillStyle = ground;
  ctx.beginPath();
  ctx.moveTo(0, 440);
  for (let x = 0; x <= w; x += 40) ctx.lineTo(x, 436 + Math.sin(x * 0.006) * 8 + rand() * 4);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  // Teplé světlo dopadající na louku zprava.
  const light = ctx.createRadialGradient(w * 0.72, 520, 40, w * 0.72, 560, w * 0.6);
  light.addColorStop(0, 'rgba(255, 214, 140, 0.32)');
  light.addColorStop(1, 'rgba(255, 214, 140, 0)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 420, w, h - 420);

  // Stébla trávy – hustší a vyšší směrem k divákovi.
  for (let i = 0; i < 5200; i++) {
    const y = 440 + Math.pow(rand(), 0.8) * (h - 440);
    const x = rand() * w;
    const depth = (y - 440) / (h - 440);
    const len = 4 + depth * 22 * (0.6 + rand() * 0.6);
    const lean = (rand() - 0.5) * len * 0.6;
    const shade = 60 + Math.floor(rand() * 60 + depth * 30);
    ctx.strokeStyle = `rgba(${shade * 0.55 | 0}, ${shade + 40}, ${shade * 0.5 | 0}, ${0.35 + depth * 0.4})`;
    ctx.lineWidth = 1 + depth * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean * 0.3, y - len * 0.6, x + lean, y - len);
    ctx.stroke();
  }

  // Drobné kvítí.
  const flowers = ['#f6e27a', '#f4f1e6', '#c9a7f2', '#f2a0b4'];
  for (let i = 0; i < 260; i++) {
    const y = 450 + rand() * (h - 450);
    const depth = (y - 440) / (h - 440);
    ctx.fillStyle = flowers[Math.floor(rand() * flowers.length)];
    ctx.globalAlpha = 0.5 + depth * 0.4;
    ctx.beginPath();
    ctx.arc(rand() * w, y, 1.2 + depth * 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Smrky na kraji louky (popředí vpravo a vlevo).
  spruce(ctx, w - 70, 720, 420, '#13281f', 'rgba(255, 210, 150, 0.06)');
  spruce(ctx, w - 190, 600, 300, '#173126', 'rgba(255, 210, 150, 0.07)');
  spruce(ctx, 70, 1010, 520, '#0f2219', null);

  // Paprsky světla.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const x = w * 0.55 + i * 120 + rand() * 60;
    const grad = ctx.createLinearGradient(x, 0, x - 260, h);
    grad.addColorStop(0, 'rgba(255, 226, 170, 0.10)');
    grad.addColorStop(1, 'rgba(255, 226, 170, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 60 + rand() * 60, 0);
    ctx.lineTo(x - 160, h);
    ctx.lineTo(x - 320, h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Vinětace.
  const vignette = ctx.createRadialGradient(w / 2, h * 0.55, h * 0.35, w / 2, h * 0.55, h * 1.05);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(4, 10, 14, 0.7)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
}

function paintCave(ctx, rand) {
  // Skalní masiv.
  ctx.save();
  const rock = ctx.createLinearGradient(0, 180, 0, 520);
  rock.addColorStop(0, '#7d7a72');
  rock.addColorStop(1, '#45453f');
  ctx.fillStyle = rock;
  ctx.beginPath();
  ctx.moveTo(-20, 520);
  ctx.lineTo(-20, 230);
  ctx.lineTo(60, 190);
  ctx.lineTo(140, 210);
  ctx.lineTo(210, 160);
  ctx.lineTo(300, 190);
  ctx.lineTo(370, 250);
  ctx.lineTo(450, 300);
  ctx.lineTo(540, 380);
  ctx.lineTo(620, 450);
  ctx.lineTo(660, 520);
  ctx.closePath();
  ctx.fill();

  // Plochy skály (nasvícené a stinné).
  const facets = [
    [[60, 190], [140, 210], [120, 320], [40, 300], '#8d8a80'],
    [[210, 160], [300, 190], [280, 300], [190, 280], '#96928a'],
    [[370, 250], [450, 300], [420, 380], [350, 340], '#6a6860'],
    [[450, 300], [540, 380], [500, 450], [430, 400], '#5c5b54']
  ];
  for (const [a, b, c, d, color] of facets) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineTo(...c); ctx.lineTo(...d);
    ctx.closePath();
    ctx.fill();
  }

  // Mech na hřbetu.
  ctx.fillStyle = '#4f7a3a';
  for (let i = 0; i < 40; i++) {
    const t = rand();
    const x = 20 + t * 560;
    const y = 200 + t * 220 + rand() * 30;
    ctx.beginPath();
    ctx.ellipse(x, y, 18 + rand() * 26, 6 + rand() * 8, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ústí jeskyně se slabým teplým světlem uvnitř.
  ctx.fillStyle = '#16120f';
  ctx.beginPath();
  ctx.moveTo(170, 520);
  ctx.quadraticCurveTo(190, 330, 290, 320);
  ctx.quadraticCurveTo(390, 330, 410, 520);
  ctx.closePath();
  ctx.fill();

  const glow = ctx.createRadialGradient(290, 470, 10, 290, 470, 150);
  glow.addColorStop(0, 'rgba(255, 170, 80, 0.55)');
  glow.addColorStop(1, 'rgba(255, 170, 80, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.moveTo(170, 520);
  ctx.quadraticCurveTo(190, 330, 290, 320);
  ctx.quadraticCurveTo(390, 330, 410, 520);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
