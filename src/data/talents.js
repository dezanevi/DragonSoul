// Talentové stromy hrdiny (dokument Talent tree – návrh).
//
// Každý talent má 5 hodností po 1 bodu. Stupně I–V se odemykají po investování
// 0 / 5 / 10 / 15 / 20 bodů do daného stromu, do stromu jde nejvýš 30 bodů a po 30
// bodech se automaticky získá závěrečný talent.
//
// `effect` popisuje, co jedna hodnost dělá (počítá TalentSystem.getTalentBonuses).
// `needsSystem` = účinek čeká na systém, který ve hře ještě není (talent jde koupit,
// ale zatím nic nedělá – karta to ukazuje).

export const TALENT_MAX_RANK = 5;
export const TREE_POINT_LIMIT = 30;
export const TIER_REQUIREMENTS = [0, 5, 10, 15, 20];
export const TIER_NAMES = ['I', 'II', 'III', 'IV', 'V'];

export const TALENT_TREES = [
  {
    id: 'combat',
    name: 'Souboj',
    title: 'Velitel monster',
    passive: 'Aktivní monstra způsobují o 5 % více fyzického poškození a utrpí o 5 % méně fyzického poškození.',
    tiers: [
      {
        name: 'Základy velení',
        talents: [
          { id: 'physical_command', name: 'Fyzický rozkaz', text: '+1 k velitelskému bonusu Fyzického útoku pro aktivní monstra za hodnost.', effect: { commanderAttack: 1 } },
          { id: 'magical_command', name: 'Magický rozkaz', text: '+1 k velitelskému bonusu Magického útoku pro aktivní monstra za hodnost.', effect: { commanderMagicAttack: 1 } }
        ]
      },
      {
        name: 'Ochrana party',
        talents: [
          { id: 'fortified_defense', name: 'Zpevněná obrana', text: '+1 k velitelskému bonusu Obrany (Zbroj aktivních monster) za hodnost.', effect: { commanderDefense: 1 } },
          { id: 'protective_will', name: 'Ochranná vůle', text: '+1 k velitelskému bonusu Magické odolnosti aktivních monster za hodnost.', effect: { commanderMagicResistance: 1 } }
        ]
      },
      {
        name: 'Taktická podpora',
        talents: [
          { id: 'striking_formation', name: 'Úderná formace', text: '+1 % k fyzickému poškození aktivních monster za hodnost.', effect: { monsterPhysicalDamage: 0.01 } },
          { id: 'magical_formation', name: 'Magická formace', text: '+1 % k magickému poškození aktivních monster za hodnost.', effect: { monsterMagicalDamage: 0.01 } }
        ]
      },
      {
        name: 'Zkušený velitel',
        talents: [
          { id: 'hardened_party', name: 'Zocelená družina', text: 'Aktivní monstra utrpí o 1 % méně fyzického poškození za hodnost.', effect: { monsterPhysicalTaken: 0.01 } },
          { id: 'unbreakable_command', name: 'Nezlomné velení', text: 'O 2 procentní body nižší šance, že nepřítel aplikuje na aktivní monstrum stavový efekt.', effect: { statusChanceReduction: 0.02 } }
        ]
      },
      {
        name: 'Mistrovství velení',
        talents: [
          { id: 'opportunist', name: 'Lovec příležitostí', text: 'Útok s elementovou výhodou způsobí o 1 % poškození navíc za hodnost.', effect: { elementalAdvantageBonus: 0.01 } },
          { id: 'pack_leader', name: 'Vůdce smečky', text: '+1 k Tempu aktivních monster za hodnost (pořadí iniciativy).', effect: { monsterTempo: 1 } }
        ]
      }
    ],
    final: {
      id: 'dragon_tactics',
      name: 'Dračí taktika',
      text: '+1 ke všem čtyřem velitelským bonusům (Fyzický útok, Magický útok, Obrana, Magická odolnost).',
      effect: { commanderAttack: 1, commanderMagicAttack: 1, commanderDefense: 1, commanderMagicResistance: 1 }
    }
  },
  {
    id: 'crafting',
    name: 'Řemesla',
    title: 'Sběrač a výrobce',
    passive: 'Předměty vyrobené hrdinou mají o 20 % vyšší číselné účinky (ne dobu trvání ani cenu).',
    tiers: [
      {
        name: 'Základy sběru',
        talents: [
          { id: 'herbalist_hand', name: 'Bylinkářská ruka', text: '+5 % šance na dodatečnou surovinu při sběru bylin za hodnost (nejvýš +25 %).', effect: { herbBonusChance: 0.05 }, needsSystem: 'sběr bylin' },
          { id: 'prospector', name: 'Zkušený prospektor', text: '+5 % šance na dodatečnou surovinu při těžbě za hodnost (nejvýš +25 %).', effect: { miningBonusChance: 0.05 }, needsSystem: 'těžba' }
        ]
      },
      {
        name: 'Cestovní řemesla',
        talents: [
          { id: 'angler_patience', name: 'Rybářská trpělivost', text: '+4 % šance na kvalitnější nebo bonusový úlovek za hodnost (nejvýš +20 %).', effect: { fishingBonusChance: 0.04 }, needsSystem: 'rybolov' },
          { id: 'thrifty_processing', name: 'Úsporné zpracování', text: '−2 % materiálové ceny výroby za hodnost (nejvýš −10 %, vždy aspoň 1 kus suroviny).', effect: { materialCostReduction: 0.02 }, needsSystem: 'výroba' }
        ]
      },
      {
        name: 'Výroba',
        talents: [
          { id: 'alchemy_skill', name: 'Alchymická zručnost', text: '+2 % k účinku lektvarů vyrobených hrdinou za hodnost (nejvýš +10 %).', effect: { potionPotency: 0.02 }, needsSystem: 'alchymie' },
          { id: 'master_chef', name: 'Mistr kuchyně', text: '+5 % k délce trvání účinků jídel za hodnost (nejvýš +25 %).', effect: { foodDuration: 0.05 }, needsSystem: 'vaření' }
        ]
      },
      {
        name: 'Odborná výroba',
        talents: [
          { id: 'master_smith', name: 'Kovářský mistr', text: 'Odemyká kovové recepty na 1., 3. a 5. hodnosti; +2 % ke statistikám vyrobeného kovového vybavení za hodnost.', effect: { metalGearBonus: 0.02 }, needsSystem: 'kovářství' },
          { id: 'skilled_crafter', name: 'Zručný řemeslník', text: 'Odemyká nekovové recepty na 1., 3. a 5. hodnosti; +2 % ke statistikám vyrobeného nekovového vybavení za hodnost.', effect: { nonMetalGearBonus: 0.02 }, needsSystem: 'řemeslnictví' }
        ]
      },
      {
        name: 'Mistrovské recepty',
        talents: [
          { id: 'rare_mixtures', name: 'Vzácné směsi', text: 'Otevírá výjimečné alchymistické recepty na 1., 3. a 5. hodnosti.', effect: {}, needsSystem: 'recepty' },
          { id: 'masterwork', name: 'Mistrovská výroba', text: 'Otevírá vyšší řady kovářských a řemeslnických receptů na 1., 3. a 5. hodnosti.', effect: {}, needsSystem: 'recepty' }
        ]
      }
    ],
    final: {
      id: 'legendary_crafter',
      name: 'Legendární řemeslník',
      text: 'Odemyká unikátní legendární recepty, které nejsou dostupné běžným postupem.',
      effect: {},
      needsSystem: 'recepty'
    }
  },
  {
    id: 'wizard',
    name: 'Kouzelník',
    title: 'Osobní magie hrdiny',
    passive: 'Hrdinova kouzla a magické schopnosti aktivních monster způsobují o 5 % více magického poškození; aktivní monstra utrpí o 5 % méně magického poškození.',
    tiers: [
      {
        name: 'Základy magie',
        talents: [
          { id: 'expanded_mana', name: 'Rozšířená mana', text: '+2 k maximální maně za hodnost (navýší i aktuální manu).', effect: { maxMana: 2 } },
          { id: 'focused_casting', name: 'Soustředěné seslání', text: '+1 Spell Power za hodnost.', effect: { spellPower: 1 } }
        ]
      },
      {
        name: 'Úsporné sesílání',
        talents: [
          { id: 'mana_thrift', name: 'Šetření manou', text: 'Cena kouzel −2 % za hodnost (nejvýš −10 %, nikdy pod 1 MP).', effect: { manaCostReduction: 0.02 } },
          { id: 'steady_focus', name: 'Pevná koncentrace', text: '+5 % zkušeností pro školy magie za hodnost (nejvýš +25 %).', effect: { masteryExpBonus: 0.05 } }
        ]
      },
      {
        name: 'Magické školy',
        talents: [
          { id: 'elemental_focus', name: 'Elementární soustředění', text: 'Kouzla vybrané školy způsobí o 2 % více poškození za hodnost (nejvýš +10 %). Škola se vybírá při první hodnosti.', effect: { focusSchoolDamage: 0.02 }, choosesSchool: true },
          { id: 'broad_knowledge', name: 'Široké znalosti', text: '+3 % zkušeností Magic Mastery u ostatních škol než vybrané za hodnost (nejvýš +15 %).', effect: { otherSchoolsExpBonus: 0.03 } }
        ]
      },
      {
        name: 'Užitková magie',
        talents: [
          { id: 'stone_paths', name: 'Mistr kamenných cest', text: '1. hodnost: teleport k nejbližšímu aktivovanému magickému kameni; další hodnosti −5 % ceny teleportu (nejvýš −20 %).', effect: { teleportCostReduction: 0.05 }, needsSystem: 'magické kameny a teleport' },
          { id: 'golden_dissolution', name: 'Zlatý rozklad', text: '1. hodnost: rozklad bezpečně vybraných předmětů na zlato; další hodnosti +5 % zlata (nejvýš +20 %).', effect: { dissolveGoldBonus: 0.05 }, needsSystem: 'rozklad předmětů' }
        ]
      },
      {
        name: 'Mistrovské sesílání',
        talents: [
          { id: 'mighty_casting', name: 'Mocné seslání', text: '+1 Spell Power za hodnost.', effect: { spellPower: 1 } },
          { id: 'traveler_thrift', name: 'Úspora pro cestovatele', text: 'Cena užitkových kouzel (např. teleportu) −2 % za hodnost (nejvýš −10 %, nikdy pod 1 MP).', effect: { utilityCostReduction: 0.02 }, needsSystem: 'užitková kouzla' }
        ]
      }
    ],
    final: {
      id: 'dragon_arcanist',
      name: 'Dračí arkanista',
      text: '+2 Spell Power a +5 % poškození hrdinových kouzel (ne schopností monster).',
      effect: { spellPower: 2, spellDamage: 0.05 }
    }
  }
];

export const TALENT_TREE_BY_ID = Object.fromEntries(TALENT_TREES.map((tree) => [tree.id, tree]));

// Talent podle id → { tree, tierIndex, talent }.
export const TALENT_INDEX = new Map(
  TALENT_TREES.flatMap((tree) =>
    tree.tiers.flatMap((tier, tierIndex) =>
      tier.talents.map((talent) => [talent.id, { tree, tierIndex, talent }])
    )
  )
);
