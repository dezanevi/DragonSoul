// Idle animace monster z listů v public/assets/monsters. Každý list má 2 řady × 4 monstra,
// každé monstrum 4 snímky vedle sebe (bílé pozadí). Klíč = id druhu (data/monsters.json),
// hodnota = [list, buňka 0–7] (0–3 horní řada zleva, 4–7 dolní řada).
// Druhy bez animace (seznam MISSING) dál používají kreslený model.

export const MONSTER_SHEET_FILES = [
  'Fantastický atlas bytostí ve spritových animacích.png', // 0
  'Fantasy herní bestiální sprite sheet.png', // 1
  'Fantasy Monstrá_ Lesní a Vodní Bytosti.png', // 2
  'List příšer ve fantasy sprite stylu.png', // 3
  'Obrázek ChatGPT 23. 11. 2026 22_17_24.png', // 4
  'Obrázek ChatGPT 23. 11. 2026 22_17_30.png', // 5
  'Obrázek ChatGPT 23. 11. 2026 22_17_33.png', // 6
  'Obrázek ChatGPT 23. 11. 2026 22_17_45.png', // 7
  'Obrázek ChatGPT 23. 11. 2026 22_17_48.png', // 8
  'Obrázek ChatGPT 23. 11. 2026 22_17_52.png', // 9
  'Obrázek ChatGPT 23. 11. 2026 22_17_59.png', // 10
  'Obrázek ChatGPT 23. 11. 2026 22_18_03.png', // 11
  'Obrázek ChatGPT 23. 11. 2026 22_18_07.png', // 12
  'Obrázek ChatGPT 23. 11. 2026 22_18_11.png', // 13
  'Obrázek ChatGPT 24. 11. 2026 20_51_30.png', // 14
  'Obrázek ChatGPT 24. 11. 2026 20_51_33.png', // 15
  'Obrázek ChatGPT 24. 11. 2026 20_51_36.png', // 16
  'Obrázek ChatGPT 24. 11. 2026 20_51_39.png', // 17
  'Obrázek ChatGPT 24. 11. 2026 20_51_41.png', // 18
  'Obrázek ChatGPT 24. 11. 2026 20_51_43.png', // 19
  'Obrázek ChatGPT 24. 11. 2026 20_51_46.png', // 20
  'Obrázek ChatGPT 24. 11. 2026 20_51_49.png', // 21
  'Sada fantasy příšer ve spritech.png', // 22
  'Spriteový list fantasy monsterů v pohybu.png', // 23
  'Řada fantasy herních monster spriteů.png', // 24
  'Řada fantasy monsterových spriteů.png' // 25
];

export const MONSTER_SHEET_CELLS = {
  air_elemental: [4, 0], arcane_wisp: [4, 1], ashen_kestrel: [4, 2], aurelion: [4, 3],
  cyclops: [4, 4], barkplate_pangolin: [4, 5], basilisk: [4, 6], behemoth: [4, 7],
  briarbound_wisp: [5, 0], brineglass_jelly: [5, 1], cave_bear: [5, 2], cave_worm: [5, 3],
  cerberus: [5, 4], chimera: [5, 5], cinderback_salamander: [5, 6], cloudmantle_owl: [5, 7],
  crystal_golem: [6, 0], moon_stag: [6, 1], wraith: [6, 2], dryad: [6, 4],
  earth_elemental: [6, 5], phoenix: [6, 6], frostmourn: [6, 7],
  cockatrice: [7, 0], death_knight: [7, 7],
  demon_warrior: [8, 0], djinn: [8, 1], drowned_bellkeeper: [8, 2], emberhorn_ram: [8, 5],
  fire_elemental: [8, 6], forest_sprite: [8, 7],
  gloamweaver: [9, 1], troll: [9, 4], rock_elemental: [9, 5],
  zephyr_hound: [11, 1], galecrest_lynx: [11, 2], gargoyle: [11, 3], ghost: [11, 4],
  giant_spider: [11, 5], starwake_moth: [11, 6], goblin: [11, 7],
  griffin: [12, 0], harpy: [12, 1], hellhound: [12, 2], hippogriff: [12, 3],
  hobgoblin: [12, 4], hollow_lantern: [12, 5], hydra: [12, 6], ice_golem: [12, 7],
  imp: [13, 1], incubus: [13, 2], iron_guardian: [13, 3], kraken: [13, 4],
  leviathan_spawn: [13, 5], lich: [13, 6], manticore: [13, 7],
  merfolk_warrior: [0, 0], minotaur: [0, 1], mossveil_lynx: [0, 3], forest_troll: [0, 4],
  nightglass_stalker: [0, 5], nythrakar: [0, 6], ogre: [0, 7],
  windscar_stalker: [1, 1], wyvern: [1, 2],
  thornroot_stag: [2, 0], treant: [2, 2], mountain_troll: [2, 3], unicorn: [2, 4],
  vampire: [2, 5], water_elemental: [2, 6], water_nymph: [2, 7],
  zombie: [3, 7],
  orc_shaman: [22, 0], orc_warrior: [22, 1], pearlback_tortoise: [22, 2], pegasus: [22, 3],
  balor: [22, 5], pollen_oracle: [22, 6], coral_guardian: [22, 7],
  thunderkite: [23, 1],
  stone_golem: [24, 1],
  roc: [25, 0], sea_serpent: [25, 2], siltjaw_eel: [25, 3], siren: [25, 4],
  skeleton: [25, 5], skyribbon_serpent: [25, 6], sootveil_moth: [25, 7]
};

// Statické listy (bez animace): řady monster vedle sebe, každé monstrum jeden obrázek.
// Monstra se najdou podle mezer mezi nimi (mřížka v listu není pravidelná).
// rows = druhy zleva doprava v každé řadě; null = monstrum v listu se nepoužije.
export const MONSTER_STILL_SHEETS = [
  {
    file: 'Fantasy RPG Bestiář_ 16 Příšer.png',
    rows: [
      ['wild_boar', 'dire_wolf', 'cave_slime', 'sporeback_toad', 'crystal_spider', 'sunshard_beetle', 'sphinx', 'prism_herald'],
      ['comet_tail_fox', 'dawncoil_serpent', 'star_seraph', 'stormneedle_manta', 'whistlewing_bat', 'succubus', 'pit_fiend', null]
    ]
  }
];

// Druhy bez obrázku v listech (dál kreslený model).
export const MISSING_MONSTER_ANIMATIONS = ['ignaroth'];
