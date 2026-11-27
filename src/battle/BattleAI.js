export function chooseAITarget(unit, units) {
  const opponents = units.filter(
    (other) =>
      other.hp > 0 &&
      other.side !== unit.side
  );

  if (opponents.length === 0) {
    return null;
  }

  return opponents.sort((a, b) => {
    const healthRatioA = a.hp / a.maxHp;
    const healthRatioB = b.hp / b.maxHp;

    if (healthRatioA !== healthRatioB) {
      return healthRatioA - healthRatioB;
    }

    const distanceA =
      Math.abs(unit.x - a.x) + Math.abs(unit.y - a.y);
    const distanceB =
      Math.abs(unit.x - b.x) + Math.abs(unit.y - b.y);

    return distanceA - distanceB;
  })[0];
}

// Pohyb k cíli podle skutečné cesty (ne vzdušnou čarou): když cestu blokuje jiné monstrum
// nebo překážka, jednotka ho obejde – i za cenu kroku, který ji vzdušnou čarou nepřiblíží.
// Cíl = libovolné volné pole vedle cíle (i šikmo – útok zblízka dosáhne i šikmo).
// Když je cíl úplně obklopený, jednotka se aspoň postaví co nejblíž (za spojence do fronty).
export function chooseAIMove(unit, target, units, grid) {
  if (!target) {
    return null;
  }

  const reachableCells = grid
    .getReachable(unit, units)
    .filter((cell) => cell.distance > 0);
  if (!reachableCells.length) return null;

  const living = units.filter((other) => other !== unit && other.hp > 0);
  const occupiedBy = (x, y, filter) => living.some((o) => o.x === x && o.y === y && filter(o));
  // passable(o) = jestli přes jednotku o lze projít (pro náhradní plán: přes spojence).
  const pathMap = (passable) => {
    const free = (x, y) => grid.isInside(x, y) && !grid.isBlocked(x, y) && !occupiedBy(x, y, (o) => !passable(o));
    const dist = new Map();
    const queue = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const x = target.x + dx;
        const y = target.y + dy;
        if ((dx || dy) && free(x, y)) { dist.set(grid.key(x, y), 0); queue.push({ x, y }); }
      }
    }
    for (let qi = 0; qi < queue.length; qi++) {
      const c = queue[qi];
      const d = dist.get(grid.key(c.x, c.y));
      for (const [nx, ny] of [[c.x + 1, c.y], [c.x - 1, c.y], [c.x, c.y + 1], [c.x, c.y - 1]]) {
        const k = grid.key(nx, ny);
        if (dist.has(k) || !free(nx, ny)) continue;
        dist.set(k, d + 1);
        queue.push({ x: nx, y: ny });
      }
    }
    return dist;
  };

  const best = (dist) => {
    const here = dist.get(grid.key(unit.x, unit.y)) ?? Infinity;
    let pick = null;
    let pickD = here;
    for (const cell of reachableCells) {
      const d = dist.get(grid.key(cell.x, cell.y));
      if (d === undefined) continue;
      if (d < pickD || (pick && d === pickD && cell.distance < pick.distance)) { pick = cell; pickD = d; }
    }
    return pick;
  };

  // 1) skutečná cesta kolem všech jednotek; 2) cesta „přes“ spojence – aspoň se přiblížit do fronty.
  const direct = best(pathMap(() => false));
  if (direct) return direct;
  const queued = best(pathMap((o) => o.side === unit.side));
  if (queued) return queued;

  // 3) poslední možnost: vzdušnou čarou blíž.
  const startingDistance = Math.abs(unit.x - target.x) + Math.abs(unit.y - target.y);
  return reachableCells
    .map((cell) => ({ cell, d: Math.abs(cell.x - target.x) + Math.abs(cell.y - target.y) }))
    .filter(({ d }) => d < startingDistance)
    .sort((a, b) => a.d - b.d || a.cell.distance - b.cell.distance)[0]?.cell ?? null;
}
