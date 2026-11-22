// Předměty podle dokumentu „Crafting a řemesla – návrh“ (sekce Itemy).
// icon = klíč obrázku z public/assets/items/icons (seznam v src/data/itemIcons.json,
// vzniká nástrojem tools/split-icons.ps1).
//
//   category  armor | materials | potions | accessories | keys | other (filtry v inventáři)
//   stack     kolik kusů se vejde do jednoho slotu
//   use       účinek při Použít (restoreMana, healMonster, food)
//   slot      slot výbavy pro Vybavit (weapon, shield, ring, amulet, helmet, armor, legs, boots)
//   effect    zamýšlený účinek výbavy (bonusy statistik zatím systém nepočítá)

export const ITEM_CATEGORIES = [
  { id: 'armor', label: 'Zbroj' },
  { id: 'materials', label: 'Materiály' },
  { id: 'potions', label: 'Potiony' },
  { id: 'accessories', label: 'Doplňky' },
  { id: 'keys', label: 'Klíče' },
  { id: 'other', label: 'Ostatní' }
];

const item = (id, name, category, icon, description, extra = {}) => ({
  id, name, category, icon, description, rarity: 'common', stack: 99, ...extra
});

// ----------------------------------------------------------- 1. spotřební
const CONSUMABLES = [
  item('minor_healing_tonic', 'Menší léčivý tonik', 'potions', 'icons01_001',
    'Obnoví malé množství HP (30) nejvíc zraněnému monstru v partě.', { use: { type: 'healMonster', amount: 30 } }),
  item('healing_tonic', 'Léčivý tonik', 'potions', 'icons01_002',
    'Obnoví větší množství HP (80) nejvíc zraněnému monstru v partě.', { use: { type: 'healMonster', amount: 80 }, rarity: 'uncommon' }),
  item('mana_potion', 'Tonik many', 'potions', 'icons01_003',
    'Obnoví část hrdinovy many (15).', { use: { type: 'restoreMana', amount: 15 } }),
  item('strong_mana_tonic', 'Silný tonik many', 'potions', 'icons01_004',
    'Obnoví větší množství many (40).', { use: { type: 'restoreMana', amount: 40 }, rarity: 'uncommon' }),
  item('antidote', 'Protijed', 'potions', 'icons01_005',
    'Odstraní otravu. Použije se v souboji (stavové efekty mimo souboj nepřetrvávají).'),
  item('travel_ration', 'Cestovní jídlo', 'potions', 'icons01_006',
    'Obnoví malé množství zdrojů: 5 many a 15 HP nejvíc zraněnému monstru.', { use: { type: 'food', mana: 5, heal: 15 } })
];

// ------------------------------------------------------ 2. Soul Crystaly
const CRYSTALS = [
  item('basic_crystal', 'Basic Soul Crystal', 'other', 'icons01_030',
    'Základní krystal pro ochočení divokých monster v souboji (akce Ochočení).'),
  item('greater_crystal', 'Greater Soul Crystal', 'other', 'icons01_008',
    'Silnější krystal s vyšší šancí na ochočení.', { rarity: 'uncommon' }),
  item('elemental_crystal', 'Elemental Soul Crystal', 'other', 'icons01_009',
    'Krystal se zvýšenou účinností při ochočení.', { rarity: 'rare' }),
  item('ancient_crystal', 'Ancient Soul Crystal', 'other', 'icons01_010',
    'Vzácný krystal s vyšším násobitelem šance.', { rarity: 'epic' }),
  item('dragon_crystal', 'Dragon Soul Crystal', 'other', 'icons01_012',
    'Nejsilnější krystal. Získání prastarých draků bude mít navíc příběhové podmínky.', { rarity: 'legendary' })
];

// ------------------------------------------------------ 3. vybavení
const GEAR = [
  item('hunting_fang', 'Lovecký tesák', 'armor', 'icons01_013', 'Zbraň. Přidá Fyzický útok.', { slot: 'weapon', stack: 1, effect: { physicalAttack: 2 } }),
  item('hunter_headband', 'Kožená čelenka lovce', 'armor', 'icons03_141', 'Hlava. Přidá Fyzický útok nebo Intelekt.', { slot: 'helmet', stack: 1, effect: { intellect: 1 } }),
  item('reinforced_vest', 'Zesílená lovecká vesta', 'armor', 'icons03_143', 'Tělo. Přidá Obranu.', { slot: 'armor', stack: 1, effect: { defense: 2 } }),
  item('mist_cloak', 'Plášť horské mlhy', 'armor', 'icons03_147', 'Plášť. Přidá Magickou odolnost. (Slot pláště zatím ve hře není.)', { stack: 1, effect: { magicResistance: 2 } }),
  item('courier_boots', 'Boty rychlého posla', 'armor', 'icons03_150', 'Boty. Zlepší rychlost pohybu po mapě.', { slot: 'boots', stack: 1, effect: { speed: 1 } }),
  item('caster_gloves', 'Rukavice přesného sesilatele', 'armor', 'icons03_148', 'Rukavice. Přidají Spell Power. (Slot rukavic zatím ve hře není.)', { stack: 1, effect: { spellPower: 1 } })
];

// ------------------------------------------------------ 4. doplňky
const ACCESSORIES = [
  item('focus_amulet', 'Amulet soustředění', 'accessories', 'icons01_019', 'Přidá Intelekt nebo Spell Power.', { slot: 'amulet', stack: 1, effect: { spellPower: 1 } }),
  item('pilgrim_amulet', 'Amulet poutníka', 'accessories', 'icons01_020', 'Zlepší pohyb po mapě.', { slot: 'amulet', stack: 1, effect: { speed: 1 } }),
  item('dragonstone_amulet', 'Amulet dračího kamene', 'accessories', 'icons01_021', 'Přidá Intelekt a Spell Power; propojí se s dračím systémem.', { slot: 'amulet', stack: 1, rarity: 'rare', effect: { intellect: 1, spellPower: 1 } }),
  item('clear_mind_ring', 'Prsten jasné mysli', 'accessories', 'icons01_022', 'Přidá Intelekt nebo maximální manu.', { slot: 'ring', stack: 1, effect: { maxMana: 5 } }),
  item('focus_ring', 'Prsten soustředění', 'accessories', 'icons01_023', 'Přidá Magický útok.', { slot: 'ring', stack: 1, effect: { magicAttack: 1 } }),
  item('willpower_ring', 'Prsten pevné vůle', 'accessories', 'icons01_026', 'Přidá Magickou odolnost.', { slot: 'ring', stack: 1, effect: { magicResistance: 1 } }),
  item('forest_luck_ring', 'Prsten lesního štěstí', 'accessories', 'icons01_024', 'Mírně zvýší Štěstí, s limitem.', { slot: 'ring', stack: 1, effect: { luck: 1 } }),
  item('negotiator_ring', 'Prsten vyjednavače', 'accessories', 'icons01_025', 'Zlepší obchodní ceny nebo Charisma.', { slot: 'ring', stack: 1, effect: { charisma: 1 } }),
  item('protective_ring', 'Ochranný prsten', 'accessories', 'icons03_153', 'Přidá Magickou odolnost.', { slot: 'ring', stack: 1, effect: { magicResistance: 1 } })
];

// ------------------------------------------------------ 5. klíčové předměty
const KEY_ITEMS = [
  item('hunting_permit', 'Lovecké povolení Greenvale', 'keys', 'icons01_027', 'Potvrzuje splnění lovecké zkoušky a povoluje odchod do Verdant Forest.', { stack: 1, rarity: 'rare' }),
  item('cave_gate_key', 'Starý klíč od jeskynní brány', 'keys', 'icons01_028', 'Otevře zamčenou část jeskyně nebo dungeonu.', { stack: 1 }),
  item('ruin_warden_key', 'Klíč strážce ruin', 'keys', 'icons01_029', 'Otevře konkrétní chrám nebo podzemní lokaci.', { stack: 1, rarity: 'rare' }),
  item('magic_stone', 'Magický kámen', 'keys', 'icons01_032', 'Příběhový předmět spojený s dračími silami.', { stack: 1, rarity: 'epic' }),
  item('dragon_seal', 'Dračí pečeť', 'keys', 'icons01_031', 'Otevře příběhovou bránu nebo přístup k dračímu místu.', { stack: 1, rarity: 'legendary' }),
  item('teleport_crystal', 'Krystal pro teleportaci', 'keys', 'icons01_039', 'Aktivuje či opravuje magický kámen pro budoucí rychlé cestování.', { rarity: 'rare' })
];

// ------------------------------------------------------ 6. suroviny
const RAW = [
  ['healing_herbs', 'Léčivé byliny', 'icons01_033', 'Sběr bylin, obchody. Léčivé toniky a vaření.'],
  ['cleansing_herbs', 'Čistící byliny', 'icons01_034', 'Sběr v lesích a vlhkých oblastech. Protijed a alchymie.'],
  ['blue_herbs', 'Modré byliny', 'icons01_035', 'Vodní či stinné oblasti. Lektvary many.'],
  ['forest_mushrooms', 'Lesní houby', 'icons01_036', 'Lesy a jeskyně. Vaření a alchymie.'],
  ['iron_ore', 'Železná ruda', 'icons01_037', 'Těžba v dolech. Kovářství a kovové vybavení.'],
  ['copper_ore', 'Měděná ruda', 'icons01_038', 'Těžba v nalezištích. Prsteny, úchyty a nástroje.'],
  ['astral_shard', 'Astrální střep', 'icons05_162', 'Vzácné oblasti a poklady. Magické doplňky a předměty.'],
  ['wood', 'Dřevo', 'icons01_040', 'Sběr na určených místech. Nástroje a nekovové výrobky.'],
  ['leather', 'Kůže', 'icons01_041', 'Lov, obchod, úkoly. Vesty, boty a další výbava.'],
  ['fiber', 'Vlákno', 'icons01_042', 'Rostliny, obchod. Oblečení a řemeslné výrobky.'],
  ['fish', 'Ryby', 'icons01_043', 'Rybolov. Vaření, úkoly a případně obchod.'],
  ['clean_water', 'Čistá voda', 'icons01_044', 'Prameny, studny, obchod. Alchymie a vaření.'],
  ['leather_strap', 'Kožený řemínek', 'icons01_045', 'Řemeslnictví, obchod. Zbraně a kovové vybavení.'],
  ['iron_clasp', 'Železný uzávěr', 'icons01_046', 'Kovářství. Zesílená výstroj a vybavení.'],
  ['wax', 'Vosk', 'icons01_047', 'Sběr nebo obchod. Voděodolné vybavení a řemesla.']
].map(([id, name, icon, description]) => item(id, name, 'materials', icon, description));

// ------------------------------------------- 7. dropy monster (materiály)
// Po boji hrdina nezíská peníze, ale materiály poražených monster. † = legendární.
export const MONSTER_DROPS = {
  fire: {
    'Ashen Kestrel': ['Žhavé pírko', 'Popelavý letkový hrot'],
    'Balor': ['Démonická kůže', 'Pekelný žárový kámen'],
    'Cerberus': ['Pekelný tesák', 'Trojitá psí kůže'],
    'Chimera': ['Chimérický roh', 'Směsná šupina'],
    'Cinderback Salamander': ['Žhavá šupina', 'Salamandří žárová žláza'],
    'Demon Warrior': ['Démonická kůže', 'Pekelné železo'],
    'Emberhorn Ram': ['Žhavý roh', 'Beraní kůže'],
    'Fire Elemental': ['Ohnivá esence', 'Uhlík živého plamene'],
    'Hellhound': ['Pekelná kůže', 'Žárový tesák'],
    'Ignaroth': ['Šupina Ignarotha', 'Prvotní dračí plamen'],
    'Orc Warrior': ['Orčí železný úlomek', 'Bojovníkův kožený řemen'],
    'Phoenix': ['Fénixovo pírko', 'Znovuzrozený popel'],
    'Pit Fiend': ['Pekelné železo', 'Jádro propasti'],
    'Sootveil Moth': ['Popelavé křídlo', 'Sazový prášek'],
    'Wyvern': ['Wyverní šupina', 'Jedovatý osten']
  },
  water: {
    'Brineglass Jelly': ['Solný gel', 'Průsvitná medúzová blána'],
    'Coral Guardian': ['Živý korál', 'Přílivové jádro'],
    'Drowned Bellkeeper': ['Zatopený bronz', 'Hlubinná esence'],
    'Frostmourn': ['Šupina Frostmournu', 'Srdce věčného ledu'],
    'Hydra': ['Hydří šupina', 'Vícehlavá jedová žláza'],
    'Ice Golem': ['Ledové jádro', 'Krystal námrazy'],
    'Kraken': ['Přísavka krakena', 'Hlubinné chapadlové vlákno'],
    'Leviathan Spawn': ['Šupina Leviathana', 'Propastná perla'],
    'Merfolk Warrior': ['Mořská šupina', 'Korálová zbraňová ozdoba'],
    'Pearlback Tortoise': ['Perleťový úlomek krunýře', 'Přílivový kámen'],
    'Sea Serpent': ['Mořská šupina', 'Hadí tesák'],
    'Siltjaw Eel': ['Bahenní úhoří kůže', 'Výbojová žláza'],
    'Siren': ['Sirénin hlasový krystal', 'Mořská perla'],
    'Water Elemental': ['Vodní jádro', 'Přílivová esence'],
    'Water Nymph': ['Vodní květ', 'Nymfina čistá esence']
  },
  earth: {
    'Behemoth': ['Obří kost', 'Těžké kamenné jádro'],
    'Cave Bear': ['Medvědí kůže', 'Jeskynní dráp'],
    'Cave Worm': ['Jeskynní chitin', 'Podzemní sliz'],
    'Cyclops': ['Kyklopí oko', 'Obrská kost'],
    'Earth Elemental': ['Zemní jádro', 'Živý kamenný střep'],
    'Forest Troll': ['Trollí kůže', 'Lesní kost'],
    'Gargoyle': ['Chrličový kámen', 'Stínový prach'],
    'Goblin': ['Gobliní zub', 'Zcizená kovová součástka'],
    'Hobgoblin': ['Orčí kovový žeton', 'Gobliní železný úlomek'],
    'Iron Guardian': ['Strážcovo železo', 'Runa ze starého jádra'],
    'Minotaur': ['Minotauří roh', 'Drsná obrská kůže'],
    'Mountain Troll': ['Horská trollí kůže', 'Žulová kost'],
    'Ogre': ['Ogrská kůže', 'Těžká kost'],
    'Rock Elemental': ['Skalní jádro', 'Kamenný střep'],
    'Stone Golem': ['Kamenné jádro', 'Rytý runový kámen'],
    'Troll': ['Trollí kůže', 'Trollí kost'],
    'Wild Boar': ['Kančí kel', 'Divoká kůže'],
    // Jeskynní sliz (boss úkolu) – v dokumentu chybí, materiály podle jeskynních monster.
    'Jeskynní sliz': ['Podzemní sliz', 'Kamenné jádro']
  },
  air: {
    'Air Elemental': ['Vzdušná esence', 'Větrný krystal'],
    'Cloudmantle Owl': ['Obláčkové pírko', 'Soví sklovité oko'],
    'Djinn': ['Bouřková esence', 'Větrný krystal'],
    'Galecrest Lynx': ['Větrná kožešina', 'Rysí dráp'],
    'Griffin': ['Gryfoní pírko', 'Dravčí spár'],
    'Harpy': ['Harpyjní pírko', 'Hlasový krystal'],
    'Hippogriff': ['Hippogryfí pírko', 'Tvrdé kopyto'],
    'Roc': ['Rocaří pero', 'Obří dráp'],
    'Skyribbon Serpent': ['Nebeská šupina', 'Vzdušné hedvábí'],
    'Stormneedle Manta': ['Bouřková ploutev', 'Bouřková esence'],
    'Thunderkite': ['Bouřkové pírko', 'Blesková žláza'],
    'Whistlewing Bat': ['Zvuková blána', 'Kožnaté křídlo'],
    'Windscar Stalker': ['Větrná kožešina', 'Dráp větrného lovce'],
    'Zephyr Hound': ['Zephyrová kožešina', 'Větrný dráp']
  },
  verdant: {
    'Barkplate Pangolin': ['Kůrová šupina', 'Živé dřevo'],
    'Basilisk': ['Baziliščí šupina', 'Kamenící žláza'],
    'Briarbound Wisp': ['Trnité vlákno', 'Lesní duchovní esence'],
    'Cockatrice': ['Hřebenaté pírko', 'Kamenící žláza'],
    'Dire Wolf': ['Direwolfí kožešina', 'Vlčí tesák'],
    'Dryad': ['Suchadří míza', 'Živé dřevo'],
    'Forest Sprite': ['Vílový prach', 'Svítící list'],
    'Giant Spider': ['Pavoučí hedvábí', 'Jedový váček'],
    'Manticore': ['Manticorův osten', 'Jedový váček'],
    'Mossveil Lynx': ['Mechem pokrytá kožešina', 'Lesní dráp'],
    'Pollen Oracle': ['Věštecký pyl', 'Prastaré semeno'],
    'Sporeback Toad': ['Výtrusný váček', 'Ropuchová kůže'],
    'Thornroot Stag': ['Trnitý paroh', 'Kořenové vlákno'],
    'Treant': ['Staré živé dřevo', 'Prastará míza']
  },
  dark: {
    'Death Knight': ['Prokletý úlomek zbroje', 'Hřbitovní železo'],
    'Ghost': ['Ektoplazma', 'Duchovní vlákno'],
    'Gloamweaver': ['Šerohedvábí', 'Stínová esence'],
    'Hollow Lantern': ['Strašidelné sklo', 'Duchovní plamen'],
    'Imp': ['Démonická blána', 'Impí křídlo'],
    'Incubus': ['Snová esence', 'Stínové hedvábí'],
    'Lich': ['Lichova kost', 'Prach z úvazku duše'],
    'Nightglass Stalker': ['Noční skleněný střep', 'Kůže lovce noci'],
    'Nythrakar': ['Šupina Nythrakara', 'Srdce Abyssu'],
    'Orc Shaman': ['Šamanský totem', 'Temná duchovní esence'],
    'Skeleton': ['Hřbitovní kost', 'Staré hřbitovní železo'],
    'Succubus': ['Snová esence', 'Démonická blána'],
    'Vampire': ['Zapečetěná krev', 'Noční esence'],
    'Wraith': ['Ektoplazma', 'Přízračné vlákno'],
    'Zombie': ['Hřbitovní kost', 'Rozkladný sliz']
  },
  light: {
    'Arcane Wisp': ['Arkánní prach', 'Zářivá esence'],
    'Aurelion': ['Šupina Aureliona', 'Srdce hvězdného světla'],
    'Comet-Tail Fox': ['Kometoocasá kožešina', 'Hvězdný prach'],
    'Crystal Golem': ['Křišťálový střep', 'Krystalické jádro'],
    'Crystal Spider': ['Křišťálové hedvábí', 'Broušený krystal'],
    'Dawncoil Serpent': ['Šupina úsvitu', 'Jitřní esence'],
    'Moon Stag': ['Měsíční paroh', 'Měsíční esence'],
    'Pegasus': ['Nebeské pírko', 'Pegasí žíně'],
    'Prism Herald': ['Hranolový střep', 'Světelná esence'],
    'Sphinx': ['Sluneční prach', 'Rytý úlomek hádanky'],
    'Star Seraph': ['Hvězdné pírko', 'Astrální esence'],
    'Starwake Moth': ['Hvězdný prach', 'Svítící křídlo'],
    'Sunshard Beetle': ['Sluneční krunýř', 'Zlatý prach'],
    'Unicorn': ['Jednorožčí roh', 'Čistá esence']
  }
};
const LEGENDARY = new Set(['Ignaroth', 'Frostmourn', 'Nythrakar', 'Aurelion']);

// Ikony materiálů: list icons05 je seřazený po elementech (2 řádky po 16 ikonách,
// verdant/dark/light po jednom). Každá ikona má druh, materiál dostane volnou ikonu
// svého elementu podle druhu odvozeného z názvu (pírko, kůže, tesák, šupina, esence…).
const ICON_KINDS = {
  fire: ['feather', 'feather', 'scale', 'spike', 'organ', 'hide', 'stone', 'horn', 'crystal', 'orb', 'flame', 'fang', 'hide', 'stone', 'stone', 'orb',
    'claw', 'horn', 'stone', 'metal', 'crystal', 'orb', 'powder', 'stone', 'feather', 'feather', 'powder', 'feather', 'powder', 'stone', 'wing', 'wing'],
  water: ['essence', 'slime', 'membrane', 'membrane', 'coral', 'coral', 'shell', 'pearl', 'pearl', 'crystal', 'orb', 'ice', 'crystal', 'ice', 'ice', 'organ',
    'scale', 'crystal', 'fiber', 'fin', 'tentacle', 'tentacle', 'stone', 'fin', 'plant', 'fin', 'scale', 'scale', 'fang', 'hide', 'essence', 'essence'],
  earth: ['stone', 'stone', 'crystal', 'crystal', 'stone', 'stone', 'stone', 'stone', 'bone', 'bone', 'rune', 'rune', 'stone', 'stone', 'stone', 'stone',
    'hide', 'hide', 'claw', 'fang', 'horn', 'stone', 'metal', 'metal', 'stone', 'orb', 'stone', 'rune', 'crystal', 'stone', 'bone', 'stone'],
  air: ['essence', 'feather', 'feather', 'organ', 'essence', 'orb', 'crystal', 'essence', 'hide', 'claw', 'wing', 'feather', 'feather', 'claw', 'claw', 'scale',
    'feather', 'essence', 'essence', 'wing', 'wing', 'wing', 'hide', 'hide', 'claw', 'feather', 'hide', 'hide', 'plant', 'plant', 'plant', 'wood'],
  verdant: ['plant', 'plant', 'powder', 'seed', 'fiber', 'wood', 'sap', 'wood', 'slime', 'plant', 'plant', 'organ', 'organ', 'organ', 'fiber', 'fiber'],
  dark: ['flame', 'essence', 'flame', 'bone', 'bone', 'bone', 'stone', 'metal', 'crystal', 'crystal', 'feather', 'wing', 'organ', 'blood', 'orb', 'crystal'],
  light: ['orb', 'crystal', 'powder', 'essence', 'feather', 'hide', 'crystal', 'crystal', 'crystal', 'essence', 'horn', 'plant', 'plant', 'shell', 'seed', 'orb']
};
// Začátek řady elementu v icons05 (číslo ikony).
const ICON_START = { fire: 1, water: 33, earth: 65, air: 97, verdant: 129, dark: 145, light: 161 };
// Verdant má navíc mech a kůru z konce vzdušných řad.
const EXTRA_POOL = { verdant: [[123, 'plant'], [124, 'plant'], [125, 'plant'], [126, 'plant'], [127, 'plant'], [128, 'wood']] };

const KIND_WORDS = [
  ['feather', ['pirko', 'pero']], ['membrane', ['medusova blana']], ['wing', ['kridlo', 'blana']],
  ['hide', ['kuze', 'kozesin', 'zine']], ['fang', ['tesak', 'zub', 'kel']], ['claw', ['drap', 'spar']],
  ['horn', ['roh', 'paroh', 'kopyto']], ['scale', ['supin']], ['shell', ['krunyr', 'chitin']],
  ['essence', ['esence', 'ektoplazm']], ['orb', ['jadro']], ['organ', ['srdce', 'zlaz', 'vacek', 'oko', 'prisavk']],
  ['bone', ['kost']], ['powder', ['prach', 'popel', 'pyl', 'prasek']], ['crystal', ['krystal', 'stres', 'sklo', 'sklen', 'perla', 'perlet']],
  ['rune', ['runa', 'runov', 'hadank']], ['stone', ['kamen', 'kamenn']], ['metal', ['zelez', 'bronz', 'kov', 'soucast', 'zeton', 'zbroj', 'ozdoba']],
  ['slime', ['sliz', 'gel']], ['fiber', ['hedvab', 'vlakn', 'remen']], ['wood', ['drevo', 'kur', 'totem']], ['sap', ['miza']],
  ['seed', ['semen']], ['plant', ['list', 'kvet', 'koral']], ['flame', ['plamen', 'uhlik']], ['spike', ['osten', 'hrot']],
  ['blood', ['krev']], ['fin', ['ploutev']], ['tentacle', ['chapadl']], ['ice', ['led', 'namraz']]
];
const KIND_FALLBACK = {
  membrane: ['wing', 'slime'], shell: ['scale'], organ: ['orb'], spike: ['fang', 'claw'], blood: ['organ'], sap: ['essence', 'slime'],
  slime: ['essence'], fiber: ['plant'], seed: ['plant'], metal: ['stone'], rune: ['stone'], fin: ['wing', 'scale'], tentacle: ['hide'],
  ice: ['crystal'], coral: ['plant'], flame: ['orb', 'essence'], wood: ['plant'], powder: ['crystal'], pearl: ['crystal'], essence: ['orb'],
  orb: ['essence', 'crystal'], horn: ['fang', 'bone'], bone: ['fang'], plant: ['seed'], hide: ['fiber'], wing: ['feather'], scale: ['shell']
};

const plain = (text) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const slug = (text) => plain(text).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const kindOf = (name) => KIND_WORDS.find(([, words]) => words.some((w) => plain(name).includes(w)))?.[0] ?? 'stone';
const iconKey = (n) => `icons05_${String(n).padStart(3, '0')}`;

function buildMaterials() {
  const pools = {};
  for (const [element, kinds] of Object.entries(ICON_KINDS)) {
    pools[element] = kinds.map((kind, i) => [ICON_START[element] + i, kind]).concat(EXTRA_POOL[element] ?? []);
  }

  // 1) Seznam materiálů (jedinečné názvy) a dropy podle druhu monstra.
  const materials = {};
  const drops = {};
  const entries = [];
  for (const [element, monsters] of Object.entries(MONSTER_DROPS)) {
    for (const [monster, names] of Object.entries(monsters)) {
      drops[slug(monster)] = names.map((name, index) => {
        const id = `mat_${slug(name)}`;
        if (!materials[id]) {
          materials[id] = item(id, name, 'materials', null, `Materiál z monster (${monster}). Použije se při výrobě.`, {
            rarity: LEGENDARY.has(monster) ? 'legendary' : index === 0 ? 'common' : 'uncommon',
            element
          });
          entries.push({ id, element, kind: kindOf(name) });
        }
        return id;
      });
    }
  }

  // 2) Ikony ve více kolech: přesný druh ve vlastním elementu → přesný druh jinde →
  //    náhradní druh u sebe → jinde → cokoli volného u sebe → sdílená ikona.
  const used = new Set();
  const others = (element) => Object.keys(pools).filter((e) => e !== element);
  const free = (els, kinds) => {
    for (const k of kinds) {
      for (const e of els) {
        const hit = pools[e].find(([n, pk]) => pk === k && !used.has(n));
        if (hit) return hit[0];
      }
    }
    return null;
  };
  const passes = [
    (m) => free([m.element], [m.kind]),
    (m) => free(others(m.element), [m.kind]),
    (m) => free([m.element], KIND_FALLBACK[m.kind] ?? []),
    (m) => free(others(m.element), KIND_FALLBACK[m.kind] ?? []),
    (m) => pools[m.element].find(([n]) => !used.has(n))?.[0] ?? null,
    (m) => (pools[m.element].find(([, pk]) => pk === m.kind) ?? pools[m.element][0])[0]
  ];
  for (const pass of passes) {
    for (const m of entries) {
      if (materials[m.id].icon) continue;
      const n = pass(m);
      if (n == null) continue;
      used.add(n);
      materials[m.id].icon = iconKey(n);
    }
  }
  return { materials, drops };
}

const { materials: MATERIALS, drops: DROPS_BY_SPECIES } = buildMaterials();

// Dropy podle druhu monstra (klíč = id druhu, např. dire_wolf; boss Jeskynní sliz = jeskynni_sliz).
export const SPECIES_DROPS = { ...DROPS_BY_SPECIES, cave_slime: DROPS_BY_SPECIES.jeskynni_sliz };

export const ITEMS = Object.fromEntries(
  [...CONSUMABLES, ...CRYSTALS, ...GEAR, ...ACCESSORIES, ...KEY_ITEMS, ...RAW, ...Object.values(MATERIALS)].map((it) => [it.id, it])
);

export const getItem = (id) => ITEMS[id] ?? null;
