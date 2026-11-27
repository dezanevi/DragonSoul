// Štěstí a Charisma hrdiny: ploché body (ne %), v popisech výbavy, jídla a lektvarů.
export const HERO_STAT_LABELS = { luck: 'Štěstí', charisma: 'Charisma' };

// „Štěstí +2“ / „Fyzický útok +3 %“.
export const statPart = (labels, stat, value) =>
  HERO_STAT_LABELS[stat] ? `${HERO_STAT_LABELS[stat]} +${value}` : `${labels[stat] ?? stat} +${value} %`;

// Bonusy výbavy bez Štěstí a Charismatu (ty patří hrdinovi, ne monstrům).
export const monsterBonus = (bonus = {}) => Object.fromEntries(Object.entries(bonus).filter(([k]) => !HERO_STAT_LABELS[k]));

// „ Hrdina: Štěstí +2, Charisma +1.“ (prázdné, když předmět nic takového nemá)
export function heroStatSuffix(bonus = {}) {
  const parts = Object.entries(bonus).filter(([k]) => HERO_STAT_LABELS[k]).map(([k, v]) => `${HERO_STAT_LABELS[k]} +${v}`);
  return parts.length ? ` Hrdina: ${parts.join(', ')}.` : '';
}
