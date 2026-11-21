import skillRows from '../data/skills.json';
import speciesSkillProfiles from '../data/monsterSkillProfiles.json';

const SKILLS_BY_ID = new Map(
  skillRows.map((skill) => [skill.id, skill])
);

export const MAX_ACTIVE_SKILLS = 6;
export const MAX_REGULAR_SKILLS = 5;

const STARTER_SKILLS_BY_ELEMENT = {
  flame: 'ember_breath',
  water: 'water_jet',
  stone: 'stone_fist',
  air: 'spark',
  verdant: 'vine_whip',
  shadow: 'quick_claw',
  astral: 'spark'
};

const LEVEL_SKILLS_BY_ELEMENT = {
  flame: {
    10: 'howl',
    20: 'cinder_maw',
    40: 'ember_claw',
    80: 'volcanic_breath'
  },
  water: {
    10: 'healing_pulse',
    20: 'undertow_fang',
    40: 'tentacle_crush',
    80: 'rime_lance'
  },
  stone: {
    10: 'stone_skin',
    20: 'faultbreaker',
    40: 'crushing_slam',
    80: 'horn_charge'
  },
  air: {
    10: 'howl',
    20: 'gale_pounce',
    40: 'wing_cleave',
    80: 'pounce'
  },
  verdant: {
    10: 'healing_pulse',
    20: 'briar_rend',
    40: 'spore_burst',
    80: 'web_snare'
  },
  shadow: {
    10: 'howl',
    20: 'gloomfang',
    40: 'spirit_drain',
    80: 'venom_spit'
  },
  astral: {
    10: 'healing_pulse',
    20: 'starwake_lance',
    40: 'crystal_shard',
    80: 'mystic_burst'
  }
};

const BOND_SKILLS_BY_ELEMENT = {
  flame: 'caldera_heart',
  water: 'abyssal_current',
  stone: 'mountain_verdict',
  air: 'tempest_crown',
  verdant: 'elderbloom_aegis',
  shadow: 'abyssal_eclipse',
  astral: 'celestial_convergence'
};

function normalizeElement(element) {
  return String(element ?? '').trim().toLowerCase();
}

function normalizeSpeciesId(speciesId) {
  return String(speciesId ?? '').trim().toLowerCase();
}

const SPECIES_ARCHETYPE_BY_ID = new Map();

for (const [archetype, speciesIds] of Object.entries(
  speciesSkillProfiles.speciesArchetypes ?? {}
)) {
  for (const speciesId of speciesIds) {
    SPECIES_ARCHETYPE_BY_ID.set(
      normalizeSpeciesId(speciesId),
      archetype
    );
  }
}

function getSpeciesProfile(speciesId) {
  const normalizedId = normalizeSpeciesId(speciesId);

  // Podporujeme profil přímo u kořene i nový zápis uvnitř "profiles".
  const individualProfile =
    speciesSkillProfiles.profiles?.[normalizedId] ??
    speciesSkillProfiles[normalizedId];

  if (individualProfile) {
    return individualProfile;
  }

  const archetype = SPECIES_ARCHETYPE_BY_ID.get(normalizedId);

  return archetype
    ? speciesSkillProfiles.archetypes?.[archetype] ?? null
    : null;
}


export function getSkill(skillId) {
  return SKILLS_BY_ID.get(skillId) ?? null;
}

export function getStarterSkillId(speciesId, elementFallback = null) {
  const speciesProfile = getSpeciesProfile(speciesId);

  if (
    speciesProfile?.starter &&
    SKILLS_BY_ID.has(speciesProfile.starter)
  ) {
    return speciesProfile.starter;
  }

  const element = elementFallback ?? speciesId;
  return STARTER_SKILLS_BY_ELEMENT[normalizeElement(element)] ?? 'tackle';
}

export function getSkillsLearnedAtLevel(
  speciesId,
  level,
  elementFallback = null
) {
  const speciesProfile = getSpeciesProfile(speciesId);
  const element = normalizeElement(elementFallback ?? speciesId);

  const profileSkillId =
    speciesProfile?.levels?.[String(level)];

  if (profileSkillId && SKILLS_BY_ID.has(profileSkillId)) {
    return [profileSkillId];
  }

  const fallbackSkillId = LEVEL_SKILLS_BY_ELEMENT[element]?.[level];

  return fallbackSkillId && SKILLS_BY_ID.has(fallbackSkillId)
    ? [fallbackSkillId]
    : [];
}

export function getBondSkillId(speciesId, elementFallback = null) {
  const speciesProfile = getSpeciesProfile(speciesId);

  if (
    speciesProfile?.bondSkill &&
    SKILLS_BY_ID.has(speciesProfile.bondSkill)
  ) {
    return speciesProfile.bondSkill;
  }

  const element = elementFallback ?? speciesId;
  const skillId = BOND_SKILLS_BY_ELEMENT[normalizeElement(element)];

  return skillId && SKILLS_BY_ID.has(skillId) ? skillId : null;
}

export function learnBondSkill(monster) {
  if (!monster || (Number(monster.bond) || 0) < 100) {
    return {
      success: false,
      reason: 'Bond schopnost vyžaduje Bond 100.'
    };
  }

  const skillId = getBondSkillId(monster.speciesId, monster.element);

  if (!skillId) {
    return {
      success: false,
      reason: 'Pro tento element není Bond schopnost nastavena.'
    };
  }

  return learnSkill(monster, skillId);
}

export function getMonsterSkills(monster) {
  if (!monster || !Array.isArray(monster.skills)) {
    return [];
  }

  return monster.skills
    .map((skillId) => {
      const skill = getSkill(skillId);
      if (!skill) return null;

      const remainingUses =
        monster.skillUses?.[skillId] ?? skill.maxUses;

      return {
        ...skill,
        remainingUses
      };
    })
    .filter(Boolean);
}

export function learnSkill(monster, skillId) {
  const skill = getSkill(skillId);

  if (!monster || !skill) {
    return { success: false, reason: 'Schopnost nebyla nalezena.' };
  }

  monster.skills ??= [];
  monster.skillUses ??= {};

  if (monster.skills.includes(skillId)) {
    return { success: false, reason: 'Monstrum tuto schopnost už zná.' };
  }

  const bondSkillCount = monster.skills.filter(
    (knownSkillId) => getSkill(knownSkillId)?.bondOnly
  ).length;

  const regularSkillCount = monster.skills.length - bondSkillCount;

  if (skill.bondOnly) {
    if ((Number(monster.bond) || 0) < 100) {
      return {
        success: false,
        reason: 'Tato schopnost vyžaduje Bond 100.'
      };
    }

    if (bondSkillCount >= 1) {
      return {
        success: false,
        reason: 'Monstrum už má svou Bond schopnost.'
      };
    }
  } else if (regularSkillCount >= MAX_REGULAR_SKILLS) {
    return {
      success: false,
      reason: 'Monstrum už má pět běžných schopností.'
    };
  }

  if (monster.skills.length >= MAX_ACTIVE_SKILLS) {
    return {
      success: false,
      reason: 'Monstrum už má všech šest míst pro schopnosti obsazených.'
    };
  }

  monster.skills.push(skillId);
  monster.skillUses[skillId] = skill.maxUses;

  monster.history ??= [];
  monster.history.push(`Naučilo se schopnost ${skill.name}.`);

  return { success: true, skill };
}

export function forgetSkill(monster, skillId) {
  if (!monster || !Array.isArray(monster.skills)) {
    return false;
  }

  const index = monster.skills.indexOf(skillId);
  if (index === -1) return false;

  monster.skills.splice(index, 1);

  if (monster.skillUses) {
    delete monster.skillUses[skillId];
  }

  const skill = getSkill(skillId);

  monster.history ??= [];
  monster.history.push(
    `Zapomnělo na schopnost ${skill?.name ?? skillId}.`
  );

  return true;
}

export function canUseSkill(monster, skillId) {
  if (!monster?.skills?.includes(skillId)) return false;

  const skill = getSkill(skillId);
  if (!skill) return false;

  if (skill.bondOnly && (Number(monster.bond) || 0) < 100) {
    return false;
  }

  const remainingUses =
    monster.skillUses?.[skillId] ?? skill.maxUses;

  return remainingUses > 0;
}

export function consumeSkillUse(monster, skillId) {
  if (!canUseSkill(monster, skillId)) return false;

  monster.skillUses ??= {};
  monster.skillUses[skillId] -= 1;

  return true;
}
