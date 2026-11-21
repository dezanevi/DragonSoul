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

export function chooseAIMove(unit, target, units, grid) {
  if (!target) {
    return null;
  }

  const startingDistance =
    Math.abs(unit.x - target.x) + Math.abs(unit.y - target.y);

  const reachableCells = grid
    .getReachable(unit, units)
    .filter((cell) => cell.distance > 0);

  reachableCells.sort((a, b) => {
    const distanceA =
      Math.abs(a.x - target.x) + Math.abs(a.y - target.y);
    const distanceB =
      Math.abs(b.x - target.x) + Math.abs(b.y - target.y);

    if (distanceA !== distanceB) {
      return distanceA - distanceB;
    }

    return a.distance - b.distance;
  });

  return reachableCells.find((cell) => {
    const distance =
      Math.abs(cell.x - target.x) + Math.abs(cell.y - target.y);

    return distance < startingDistance;
  }) ?? null;
}
