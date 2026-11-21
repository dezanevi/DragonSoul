// Sestaví mapu Greenvale z referenčního obrázku.
//
// 1. Vstup: automaticky převedený grid (tools/map-from-reference.ps1) – pobřeží,
//    útesy, louka a tráva.
// 2. Přes něj se zakreslí ručně zadané prvky v souřadnicích obrázku
//    (obrázek zmenšený na šířku 2000 px): náměstí, parcely, cesty, most, jeskyně.
// 3. Na parcely se postaví budovy a výsledek se zapíše do src/data/maps/greenvale.js.
//
// Použití: node tools/greenvale-layout.mjs <grid.txt>

import { readFileSync, writeFileSync } from 'node:fs';

const TILES = 64;
const TILE = 64;
const WORLD_WIDTH = 3840; // šířka obrázku ve světě (px)
const IMG_W = 7680;
const IMG_H = 4320;
const DISPLAY = 2000 / IMG_W; // obrázek → souřadnice zadání (šířka 2000)

const isoW = TILES * 2 * 64;
const isoH = TILES * 2 * 32;
const worldH = (WORLD_WIDTH * IMG_H) / IMG_W;
const imgLeft = (isoW - WORLD_WIDTH) / 2;
const imgTop = (isoH - worldH) / 2;
const scale = IMG_W / WORLD_WIDTH;
const originX = TILES * TILE;

// Střed pole → souřadnice zadání (2000 × 1125).
function tileToDisplay(tx, ty) {
  const lx = (tx + 0.5) * TILE;
  const ly = (ty + 0.5) * TILE;
  const sx = originX + (lx - ly);
  const sy = (lx + ly) / 2;
  return { x: (sx - imgLeft) * scale * DISPLAY, y: (sy - imgTop) * scale * DISPLAY };
}

// Souřadnice zadání → pole.
function displayToTile(dx, dy) {
  const sx = dx / DISPLAY / scale + imgLeft;
  const sy = dy / DISPLAY / scale + imgTop;
  const a = sx - originX;
  const b = sy * 2;
  return { x: Math.floor((a + b) / 2 / TILE), y: Math.floor((b - a) / 2 / TILE) };
}

const grid = readFileSync(process.argv[2], 'utf8')
  .trim()
  .split(/\r?\n/)
  .map((row) => row.split(''));

const inEllipse = (p, c) => ((p.x - c.x) / c.rx) ** 2 + ((p.y - c.y) / c.ry) ** 2 <= 1;

function distToSegment(p, a, b) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

const nearPolyline = (p, points, width) =>
  points.slice(1).some((b, i) => distToSegment(p, points[i], b) <= width);

const P = (x, y) => ({ x, y });

// ---------------------------------------------------------------- prvky

const plaza = { x: 990, y: 485, rx: 150, ry: 80 };

const plots = {
  greenvale_town_hall: { x: 990, y: 295, rx: 175, ry: 85, size: [6, 5] },
  greenvale_home_1: { x: 645, y: 320, rx: 120, ry: 58, size: [4, 4] },
  greenvale_tavern: { x: 1370, y: 320, rx: 140, ry: 62, size: [5, 4] },
  greenvale_smithy: { x: 475, y: 500, rx: 175, ry: 85, size: [5, 5] },
  greenvale_market: { x: 1575, y: 515, rx: 165, ry: 80, size: [5, 5] },
  greenvale_fishing_hut: { x: 1310, y: 680, rx: 150, ry: 75, size: [5, 4] },
  greenvale_hunter_lodge: { x: 960, y: 765, rx: 175, ry: 85, size: [5, 5] }
};

// Dva domy navíc stojí na trávě mimo parcely.
const extraHomes = {
  greenvale_home_2: { x: 690, y: 690, size: [4, 3] },
  greenvale_home_3: { x: 1240, y: 220, size: [4, 3] }
};

const paths = [
  // od jeskyně k náměstí
  [P(370, 75), P(410, 140), P(450, 210), P(490, 280), P(560, 345), P(700, 410), P(860, 470)],
  // jihozápadní cesta
  [P(860, 505), P(700, 565), P(540, 635), P(400, 695)],
  // severovýchodní cesta
  [P(1120, 465), P(1250, 420), P(1400, 380), P(1520, 345)],
  // východní cesta k pobřeží
  [P(1120, 505), P(1290, 565), P(1440, 615), P(1550, 650)],
  // sever k radnici
  [P(990, 400), P(990, 340)],
  // jih od náměstí
  [P(990, 560), P(990, 680)],
  // okruh kolem jižní parcely
  [P(990, 675), P(820, 690), P(770, 770), P(810, 850), P(960, 880), P(1110, 850), P(1160, 770), P(1150, 700), P(990, 675)],
  // za mostem na protějším břehu
  [P(960, 1040), P(920, 1120)]
];

const bridge = { x0: 895, x1: 1030, y0: 860, y1: 1050 };
const cave = P(372, 58);

// ------------------------------------------------------------- kreslení

for (let ty = 0; ty < TILES; ty++) {
  for (let tx = 0; tx < TILES; tx++) {
    const p = tileToDisplay(tx, ty);
    const here = grid[ty][tx];
    const land = here !== '~' && here !== '^';

    if (p.x >= bridge.x0 && p.x <= bridge.x1 && p.y >= bridge.y0 && p.y <= bridge.y1) {
      grid[ty][tx] = '=';
      continue;
    }

    if (!land) continue;

    // Interiér ostrova je tráva, pokud nejde o louku; cesty a parcely zakreslíme níže.
    grid[ty][tx] = here === ',' ? ',' : '.';

    if (Object.values(plots).some((plot) => inEllipse(p, plot))) grid[ty][tx] = '_';
    if (paths.some((line) => nearPolyline(p, line, 30))) grid[ty][tx] = ':';
    if (inEllipse(p, plaza)) grid[ty][tx] = '#';
  }
}

const caveTile = displayToTile(cave.x, cave.y);
grid[caveTile.y][caveTile.x] = 'C';
// Pod vchodem do jeskyně musí být průchozí pole.
for (const [dx, dy] of [[1, 0], [0, 1], [1, 1]]) {
  if (grid[caveTile.y + dy]?.[caveTile.x + dx] === '^') grid[caveTile.y + dy][caveTile.x + dx] = ':';
}

// --------------------------------------------------------------- budovy

const names = {
  greenvale_town_hall: 'Radnice',
  greenvale_home_1: 'Dům',
  greenvale_home_2: 'Dům',
  greenvale_home_3: 'Dům',
  greenvale_tavern: 'Hostinec',
  greenvale_smithy: 'Kovárna',
  greenvale_market: 'Tržiště',
  greenvale_fishing_hut: 'Rybářská chata',
  greenvale_hunter_lodge: 'Lovecká chata'
};

const buildings = [];
for (const [id, place] of Object.entries({ ...plots, ...extraHomes })) {
  const center = displayToTile(place.x, place.y);
  const [w, h] = place.size;
  const x = center.x - Math.floor(w / 2);
  const y = center.y - Math.floor(h / 2);
  // Dveře na východní straně uprostřed (obrázky budov mají vchod vpravo).
  const door = { x: x + w, y: y + Math.floor(h / 2) };
  if (grid[door.y][door.x] === '^' || grid[door.y][door.x] === '~') grid[door.y][door.x] = ':';
  buildings.push({ id, name: names[id], x, y, width: w, height: h, door });
}

const spawnTile = displayToTile(962, 960);
const fishing = [displayToTile(1560, 660), displayToTile(1830, 560)];

// ------------------------------------------------------------- výstup

const rows = grid.map((row) => `    '${row.join('')}'`).join(',\n');
const buildingLines = buildings
  .map((b) =>
    `    { id: '${b.id}', name: '${b.name}', x: ${b.x}, y: ${b.y}, width: ${b.width}, height: ${b.height}, door: { x: ${b.door.x}, y: ${b.door.y} } }`
  )
  .join(',\n');

const file = `// Mapa vesnice Greenvale: ${TILES} × ${TILES} polí na logické mřížce.
// Ve hře se vykresluje izometricky (kamera z jihovýchodu, pole 128 × 64 px).
//
// Rozložení vychází z referenčního obrázku public/assets/greenvale/greenvale-map.png
// (vygenerováno skripty tools/map-from-reference.ps1 a tools/greenvale-layout.mjs,
// dál se může upravovat ručně).
//
// Každý znak v \`ground\` je jedno pole. Význam znaků najdeš v src/data/tiles.js:
//   .  tráva        ,  louka        :  cesta        #  dlažba
//   _  parcela      =  most         ~  voda         ^  útes
//   T  strom        C  jeskyně      F  vodopád
//
// Souřadnice polí: x = sloupec (0 vlevo), y = řádek (0 nahoře) v logické mřížce.
// Na obrazovce je pole 0,0 nahoře, osa x vede doprava dolů a osa y doleva dolů.
// Ve hře zapni klávesou G mřížku – ukazuje souřadnice pole pod myší.
// Klávesa R přepne průhledný referenční obrázek.

export const GREENVALE_MAP = {
  id: 'Greenvale',
  name: 'Greenvale',

  // Referenční obrázek leží uprostřed izometrického kosočtverce mapy
  // a ve světě je široký \`width\` px.
  reference: {
    key: 'reference-greenvale',
    path: '/assets/greenvale/greenvale-map.png',
    width: ${WORLD_WIDTH}
  },

  ground: [
${rows}
  ],

  // Hráč začíná na mostě, pokud nemá platnou uloženou pozici.
  spawn: { x: ${spawnTile.x}, y: ${spawnTile.y} },

  // Budovy stojí na parcelách (_). x, y = severozápadní roh půdorysu v polích,
  // width × height = půdorys, přes který se nedá projít.
  // door = pole, na kterém hráč stojí, když vchází dovnitř (klávesa E).
  buildings: [
${buildingLines}
  ],

  // Zajímavá místa – zatím jen značky v ladicím režimu.
  points: [
    { id: 'cave', name: 'Jeskyně', x: ${caveTile.x}, y: ${caveTile.y} },
    { id: 'fishing_1', name: 'Rybářské místo', x: ${fishing[0].x}, y: ${fishing[0].y} },
    { id: 'fishing_2', name: 'Rybářské místo', x: ${fishing[1].x}, y: ${fishing[1].y} }
  ]
};
`;

writeFileSync(new URL('../src/data/maps/greenvale.js', import.meta.url), file);
console.log(`Zapsáno: ${buildings.length} budov, start ${spawnTile.x},${spawnTile.y}, jeskyně ${caveTile.x},${caveTile.y}`);
for (const b of buildings) console.log(`  ${b.name.padEnd(15)} ${b.x},${b.y} ${b.width}x${b.height} dveře ${b.door.x},${b.door.y} (${grid[b.door.y][b.door.x]})`);
