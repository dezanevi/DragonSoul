// Izometrická projekce světa.
//
// Logika hry (mapa, kolize, pozice hráče, uložená hra) zůstává na čtvercové
// logické mřížce: jedno pole = TILE_SIZE (64) logických jednotek.
// Na obrazovku se pole vykreslí jako kosočtverec ISO_TILE_WIDTH × ISO_TILE_HEIGHT
// (128 × 64 px, poměr 2 : 1).
//
// Kamera stojí na jihovýchodě a míří na severozápad:
//   - horní roh pole = jeho severozápadní roh,
//   - logická osa x (východ) vede na obrazovce doprava dolů,
//   - logická osa y (jih) vede na obrazovce doleva dolů.

import { TILE_SIZE } from '../data/tiles.js';

export const ISO_TILE_WIDTH = 128;
export const ISO_TILE_HEIGHT = 64;

const KX = ISO_TILE_WIDTH / 2 / TILE_SIZE; // 1
const KY = ISO_TILE_HEIGHT / 2 / TILE_SIZE; // 0.5

export function createIsoProjection(mapWidthTiles, mapHeightTiles) {
  const originX = mapHeightTiles * TILE_SIZE * KX;
  const width = (mapWidthTiles + mapHeightTiles) * (ISO_TILE_WIDTH / 2);
  const height = (mapWidthTiles + mapHeightTiles) * (ISO_TILE_HEIGHT / 2);

  // Logické souřadnice → obrazovka.
  const toScreen = (lx, ly) => ({
    x: originX + (lx - ly) * KX,
    y: (lx + ly) * KY
  });

  // Obrazovka → logické souřadnice.
  const toLogical = (sx, sy) => {
    const a = (sx - originX) / KX; // lx - ly
    const b = sy / KY; // lx + ly
    return { x: (a + b) / 2, y: (b - a) / 2 };
  };

  // Rychlost na obrazovce → rychlost v logických souřadnicích.
  // Hráč se tak pohybuje po obrazovce stejně rychle všemi směry.
  const screenVectorToLogical = (vx, vy) => {
    const a = vx / KX;
    const b = vy / KY;
    return { x: (a + b) / 2, y: (b - a) / 2 };
  };

  // Čtyři rohy pole (sever-západ, sever-východ, jiho-východ, jiho-západ) na obrazovce.
  const tileDiamond = (tileX, tileY) => {
    const lx = tileX * TILE_SIZE;
    const ly = tileY * TILE_SIZE;
    return [
      toScreen(lx, ly),
      toScreen(lx + TILE_SIZE, ly),
      toScreen(lx + TILE_SIZE, ly + TILE_SIZE),
      toScreen(lx, ly + TILE_SIZE)
    ];
  };

  // Obdélník v polích (půdorys budovy) jako kosodélník na obrazovce.
  const rectDiamond = (tileX, tileY, widthTiles, heightTiles) => {
    const x0 = tileX * TILE_SIZE;
    const y0 = tileY * TILE_SIZE;
    const x1 = (tileX + widthTiles) * TILE_SIZE;
    const y1 = (tileY + heightTiles) * TILE_SIZE;
    return [toScreen(x0, y0), toScreen(x1, y0), toScreen(x1, y1), toScreen(x0, y1)];
  };

  return {
    width,
    height,
    toScreen,
    toLogical,
    screenVectorToLogical,
    tileDiamond,
    rectDiamond
  };
}
