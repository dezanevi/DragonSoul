function getInitiativeScore(unit) {
  const speed = Number(unit.speed) || 0;
  const initiative = Number(unit.initiative) || 0;
  const modifier = Number(unit.initiativeModifier) || 0;

  return speed + initiative + modifier;
}

export function sortByInitiative(units) {
  return [...units]
    .filter((unit) => unit.hp > 0)
    .sort((a, b) => {
      const scoreDifference =
        getInitiativeScore(b) - getInitiativeScore(a);

      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      return String(a.id).localeCompare(String(b.id));
    });
}
