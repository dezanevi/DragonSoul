// Alchymie podle schváleného dokumentu „Alchymie – návrh systému“: 12 mezivýrobků
// a 108 hlavních receptů v pěti kategoriích. Čísla jsou výchozí návrh.
//
// Recept: [id, název, kategorie, úroveň, pracoviště, kusů, ingredience, účinek, původ]
//   ingredience { itemId: počet } nebo { 'a|b': počet } = libovolná kombinace
//   pracoviště 1 stůl, 2 laboratoř, 3 elementální laboratoř, 4 mistrovská dílna
//   účinek (viz describeAlchemy):
//     heal / healAll / mana          okamžitě (mimo souboj i v souboji)
//     regenTurn / manaTurn + turns   v souboji za tah
//     cure: [stavy] | 'all'          v souboji odstraní stavy
//     immune: [stavy], resist: { element: % }, battles   ochrana na počet soubojů
//     buffs: { stat: % }, battles    elixír (vlastní slot)
//     throw: { damage, element, status, turns }   vrhací směs na nepřítele (souboj)
//     revive                         oživí omdlelé monstrum v souboji (50 % HP)
//     explore: { … }, minutes / battles   průzkumné bonusy
//     catalyst: 'využití'            surovina pro jiné profese
//     later: 'popis'                 účinek přibude se systémem (těžba, sběr, města)

const R = (id, name, category, level, station, qty, ingredients, effect, origin = 'base') =>
  ({ id, name, category, level, station, qty, ingredients, effect, origin, profession: 'alchemy' });

export const ALCHEMY_STATIONS = {
  1: { id: 'table', name: 'Alchymistický stůl' },
  2: { id: 'lab', name: 'Alchymistická laboratoř' },
  3: { id: 'elemental', name: 'Elementální laboratoř' },
  4: { id: 'master', name: 'Mistrovská alchymistická dílna' }
};

export const ALCHEMY_CATEGORIES = [
  { id: 'M', label: 'Mezivýrobky' },
  { id: 'A', label: 'Léčení a mana' },
  { id: 'B', label: 'Protijedy a ochrana' },
  { id: 'C', label: 'Bojové elixíry' },
  { id: 'D', label: 'Katalyzátory a směsi' },
  { id: 'E', label: 'Průzkum a užitek' }
];

export const ALCHEMY_ORIGINS = {
  base: 'Odemkne se úrovní Alchymie',
  game: 'Předmět, který už ve hře je',
  alchemist: 'Alchymista (návrh)',
  found: 'Nalezený recept (návrh)',
  quest: 'Úkol (návrh)'
};

// ------------------------------------------------------- mezivýrobky
export const ALCHEMY_INTERMEDIATES = [
  R('am_fish_oil', 'Rybí olej', 'M', 12, 1, 2, { 'fish_mackerel|fish_sardine|fish_eel|fish_catfish': 2 }, null),
  R('am_deep_oil', 'Hlubinný olej', 'M', 50, 2, 1, { 'fish_deep_eel|fish_swordfish|fish_tuna': 1 }, null),
  R('am_water_extract', 'Vodní extrakt', 'M', 6, 1, 2, { mat_vodni_kvet: 1, clean_water: 1 }, null),
  R('am_deep_extract', 'Hlubinný extrakt', 'M', 48, 2, 1, { fish_glowing_deep: 1, am_water_extract: 1 }, null),
  R('am_venom_concentrate', 'Jedový koncentrát', 'M', 18, 1, 2, { 'mat_jedovy_vacek|mat_vicehlava_jedova_zlaza|mat_bazilisci_zlaza|mat_vytrusny_vacek': 1, clean_water: 1 }, null),
  R('am_spirit_concentrate', 'Duchovní koncentrát', 'M', 45, 2, 1, { 'mat_ektoplazma|mat_duchovni_vlakno|mat_duchovni_esence|herb_pollen': 1, moon_flower: 1 }, null),
  R('am_astral_concentrate', 'Astrální koncentrát', 'M', 85, 4, 1, { 'mat_astralni_esence|mat_zariva_esence|crystal_astral': 1, astral_orchid: 1 }, null),
  R('am_moon_water', 'Měsíční vodní koncentrát', 'M', 60, 3, 1, { fish_moon: 1, am_water_extract: 1 }, null),
  R('am_elemental_water', 'Elementální vodní koncentrát', 'M', 55, 3, 1, { fish_elemental: 1, am_water_extract: 1 }, null),
  R('am_astral_fish', 'Astrální rybí extrakt', 'M', 90, 4, 2, { fish_astral: 1, astral_orchid: 1 }, null),
  R('am_glow_essence', 'Světélkující hlubinná esence', 'M', 58, 3, 1, { fish_glowing_deep: 1, mat_svitici_list: 1 }, null),
  R('am_coral_reagent', 'Korálová reagencie', 'M', 40, 2, 2, { hardened_coral: 1, cleansing_herbs: 1 }, null)
];

const elixir = (battles, buffs) => ({ buffs, battles });
const guard = (battles, extra) => ({ battles, ...extra });
const ALL_STATUSES = ['poison', 'sleep', 'paralysis', 'freeze', 'burn', 'curse', 'stun', 'bleed'];

// ------------------------------------------------------- 108 receptů
export const ALCHEMY_RECIPES = [
  // A Léčivé lektvary a regenerace (HP i mana)
  R('L001', 'Menší léčivý tonik', 'A', 1, 1, 2, { healing_herbs: 2, clean_water: 1 }, { heal: 30 }, 'game'),
  R('L002', 'Bylinný obklad', 'A', 4, 1, 2, { healing_herbs: 1, forest_sage: 1, clean_water: 1 }, { regenTurn: 8, turns: 3 }),
  R('L003', 'Lektvar první pomoci', 'A', 8, 1, 2, { healing_herbs: 2, am_water_extract: 1 }, { healAll: 15 }),
  R('L004', 'Šalvějový balzám', 'A', 12, 1, 2, { forest_sage: 1, mountain_root: 1, clean_water: 1 }, { heal: 30, cure: ['bleed'] }),
  R('L005', 'Léčivý tonik', 'A', 18, 1, 2, { healing_herbs: 3, am_water_extract: 1, clean_water: 1 }, { heal: 80 }, 'game'),
  R('L006', 'Regenerační lektvar', 'A', 22, 1, 2, { healing_herbs: 2, mat_vodni_kvet: 1, am_water_extract: 1 }, { regenTurn: 15, turns: 3 }),
  R('L007', 'Hromadný léčivý tonik', 'A', 27, 2, 2, { healing_herbs: 2, sun_thistle: 1, am_water_extract: 1 }, { healAll: 40 }),
  R('L008', 'Silný léčivý lektvar', 'A', 33, 2, 2, { healing_herbs: 3, mountain_root: 1, am_fish_oil: 1 }, { heal: 150 }),
  R('L009', 'Lektvar vodního květu', 'A', 38, 2, 2, { mat_vodni_kvet: 2, am_water_extract: 1, mat_vodni_esence: 1 }, { regenTurn: 25, turns: 4 }),
  R('L010', 'Lektvar slunečního bodláku', 'A', 45, 2, 2, { sun_thistle: 2, healing_herbs: 1, am_fish_oil: 1 }, { healAll: 75 }),
  R('L011', 'Hlubinný regenerační lektvar', 'A', 58, 2, 2, { am_deep_extract: 1, mat_vodni_kvet: 2, healing_herbs: 1 }, { regenTurn: 40, turns: 4 }, 'alchemist'),
  R('L012', 'Mistrovský léčivý elixír', 'A', 64, 2, 1, { healing_herbs: 2, am_deep_oil: 1, sun_thistle: 1 }, { heal: 240 }, 'alchemist'),
  R('L013', 'Velmistrovský léčivý lektvar', 'A', 78, 2, 1, { healing_herbs: 2, am_deep_oil: 1, mat_cista_esence: 1 }, { heal: 350 }, 'found'),
  R('L014', 'Lektvar znovuzrození', 'A', 95, 4, 1, { mat_fenixovo_pirko: 1, mat_znovuzrozeny_popel: 1, am_astral_concentrate: 1, sun_thistle: 1 }, { revive: 0.5 }, 'quest'),
  R('L015', 'Tonik many', 'A', 1, 1, 2, { blue_herbs: 2, clean_water: 1 }, { mana: 15 }, 'game'),
  R('L016', 'Lektvar soustředění', 'A', 10, 1, 2, { blue_herbs: 1, 'mat_vodni_kvet|moon_flower': 1, clean_water: 1 }, { manaTurn: 3, turns: 4 }),
  R('L017', 'Silný tonik many', 'A', 20, 1, 2, { blue_herbs: 3, am_water_extract: 1 }, { mana: 40 }, 'game'),
  R('L018', 'Lektvar svítícího listu', 'A', 26, 2, 2, { mat_svitici_list: 2, blue_herbs: 1, 'am_water_extract|herb_pollen': 1 }, { manaTurn: 6, turns: 4 }),
  R('L019', 'Měsíční lektvar many', 'A', 36, 2, 2, { moon_flower: 2, 'mat_mesicni_esence|herb_pollen': 1, am_water_extract: 1 }, { mana: 70 }),
  R('L020', 'Lektvar jasné mysli', 'A', 44, 2, 2, { moon_flower: 1, mat_svitici_list: 1, mat_snova_esence: 1 }, { manaTurn: 10, turns: 4, cure: ['sleep'] }, 'alchemist'),
  R('L021', 'Elementální lektvar many', 'A', 55, 3, 2, { am_elemental_water: 1, blue_herbs: 2, mat_vodni_esence: 1 }, { mana: 110 }),
  R('L022', 'Hlubinný lektvar many', 'A', 64, 3, 1, { am_deep_extract: 1, am_moon_water: 1, blue_herbs: 1 }, { manaTurn: 15, turns: 5 }, 'alchemist'),
  R('L023', 'Velmistrovský lektvar many', 'A', 76, 3, 1, { am_moon_water: 1, mat_zariva_esence: 1, moon_flower: 2 }, { mana: 160 }, 'found'),
  R('L024', 'Lektvar dvojí obnovy', 'A', 84, 4, 1, { am_deep_oil: 1, healing_herbs: 1, blue_herbs: 1, am_glow_essence: 1 }, { healAll: 180, mana: 100 }, 'found'),
  R('L025', 'Astrální lektvar many', 'A', 92, 4, 1, { am_astral_fish: 1, astral_orchid: 1, am_astral_concentrate: 1 }, { mana: 230, manaTurn: 28, turns: 3 }, 'quest'),

  // B Protijedy a ochranné přípravky
  R('L026', 'Protijed', 'B', 3, 1, 2, { cleansing_herbs: 2, clean_water: 1 }, { cure: ['poison'] }, 'game'),
  R('L027', 'Obvaz s hořkým kořenem', 'B', 6, 1, 2, { bitter_root: 1, cleansing_herbs: 1 }, { cure: ['bleed'] }),
  R('L028', 'Probouzecí sůl', 'B', 9, 1, 2, { storm_fern: 1, cleansing_herbs: 1 }, { cure: ['sleep', 'stun'] }),
  R('L029', 'Hřejivá mast', 'B', 14, 1, 2, { fire_sage: 1, clean_water: 1 }, { cure: ['freeze'] }),
  R('L030', 'Chladivá mast', 'B', 16, 1, 2, { ice_mint: 1, clean_water: 1 }, { cure: ['burn'] }),
  R('L031', 'Uvolňující tinktura', 'B', 19, 1, 2, { mountain_root: 1, cleansing_herbs: 1, mat_bleskova_zlaza: 1 }, { cure: ['paralysis'] }),
  R('L032', 'Silný protijed', 'B', 24, 1, 2, { am_venom_concentrate: 1, cleansing_herbs: 2, am_water_extract: 1 }, { cure: ['poison'], ...guard(2, { immune: ['poison'] }) }),
  R('L033', 'Očistný lektvar', 'B', 30, 2, 2, { cleansing_herbs: 2, am_water_extract: 1, mat_vodni_esence: 1 }, { cure: 'all' }, 'alchemist'),
  R('L034', 'Lektvar proti prokletí', 'B', 34, 2, 2, { 'bitter_root|shadow_lily': 1, cleansing_herbs: 1, mat_svetelna_esence: 1 }, { cure: ['curse'], ...guard(2, { immune: ['curse'] }) }),
  R('L035', 'Ochranný olej proti ohni', 'B', 37, 2, 2, { am_fish_oil: 1, ice_mint: 1, mat_krystal_namrazy: 1 }, guard(3, { resist: { fire: 15 } })),
  R('L036', 'Ochranný olej proti mrazu', 'B', 39, 2, 2, { am_fish_oil: 1, fire_sage: 1, mat_zhava_supina: 1 }, guard(3, { resist: { water: 15 } })),
  R('L037', 'Izolační mast', 'B', 42, 2, 2, { am_fish_oil: 1, mountain_root: 1, am_coral_reagent: 1 }, guard(3, { resist: { air: 15 } })),
  R('L038', 'Lektvar pevného těla', 'B', 47, 2, 2, { mat_bazilisci_zlaza: 1, cleansing_herbs: 1, am_water_extract: 1 }, guard(3, { immune: ['paralysis', 'stun'] }), 'alchemist'),
  R('L039', 'Hlubinná jedová ochrana', 'B', 53, 2, 2, { am_venom_concentrate: 1, am_deep_extract: 1, cleansing_herbs: 1 }, guard(4, { immune: ['poison', 'bleed'] })),
  R('L040', 'Stínový štít', 'B', 61, 3, 1, { mat_stinova_esence: 1, shadow_lily: 1, am_spirit_concentrate: 1 }, guard(3, { resist: { dark: 20 } })),
  R('L041', 'Elementální ochranný elixír', 'B', 72, 3, 1, { am_elemental_water: 1, al_fire_concentrate: 1, al_air_concentrate: 1 }, guard(4, { resist: { fire: 12, water: 12, earth: 12, air: 12, dark: 12, light: 12, verdant: 12 } }), 'found'),
  R('L042', 'Lektvar nezlomné mysli', 'B', 80, 4, 1, { mat_snova_esence: 1, moon_flower: 1, am_spirit_concentrate: 1 }, guard(4, { immune: ['sleep', 'stun', 'curse'] }), 'found'),
  R('L043', 'Panacea', 'B', 93, 4, 1, { mat_cista_esence: 1, am_astral_concentrate: 1, cleansing_herbs: 2, am_glow_essence: 1 }, { cure: 'all', ...guard(5, { immune: ALL_STATUSES }) }, 'quest'),

  // C Bojové a statistické elixíry
  R('L044', 'Elixír síly', 'C', 5, 1, 2, { mountain_root: 1, mat_kanci_kel: 1 }, elixir(2, { attack: 4 })),
  R('L045', 'Elixír odolnosti', 'C', 7, 1, 2, { mountain_root: 1, mat_jeskynni_chitin: 1 }, elixir(2, { defense: 4 })),
  R('L046', 'Elixír bystrosti', 'C', 11, 1, 2, { mat_svitici_list: 1, 'blue_herbs|herb_flower_essence': 1 }, elixir(2, { aether: 4 })),
  R('L047', 'Elixír hbitosti', 'C', 13, 1, 2, { storm_fern: 1, mat_oblackove_pirko: 1 }, elixir(2, { speed: 4 })),
  R('L048', 'Elixír vůle', 'C', 17, 1, 2, { 'blue_herbs|moon_flower': 1, cleansing_herbs: 1, mat_vilovy_prach: 1 }, elixir(2, { resolve: 6 })),
  R('L049', 'Elixír vitality', 'C', 21, 1, 2, { sun_thistle: 1, mountain_root: 1, am_fish_oil: 1 }, elixir(2, { maxHp: 6 })),
  R('L050', 'Elixír hloubky many', 'C', 25, 1, 2, { blue_herbs: 1, 'mat_vodni_kvet|moon_flower': 1, am_water_extract: 1 }, elixir(2, { maxMp: 6 })),
  R('L051', 'Elixír divoké síly', 'C', 28, 1, 2, { fire_sage: 1, mat_vlci_tesak: 1, am_fish_oil: 1 }, elixir(2, { attack: 6 })),
  R('L052', 'Ohnivý bojový elixír', 'C', 32, 2, 2, { mat_plamenna_esence: 1, fire_sage: 1, am_fish_oil: 1 }, elixir(3, { attack: 9 })),
  R('L053', 'Kamenný elixír', 'C', 35, 2, 2, { mat_kamenna_esence: 1, mountain_root: 1, am_fish_oil: 1 }, elixir(3, { defense: 9 })),
  R('L054', 'Arkánní elixír', 'C', 40, 2, 2, { mat_arkanni_prach: 1, mat_svitici_list: 1, am_water_extract: 1 }, elixir(3, { aether: 9 })),
  R('L055', 'Bouřkový elixír', 'C', 46, 2, 2, { mat_bourkova_esence: 1, storm_fern: 1, mat_bleskova_zlaza: 1 }, elixir(3, { speed: 9 })),
  R('L056', 'Elixír přílivové vůle', 'C', 52, 3, 1, { mat_vodni_esence: 1, moon_flower: 1, am_water_extract: 1 }, elixir(3, { resolve: 12 })),
  R('L057', 'Elixír obří vitality', 'C', 57, 2, 1, { mat_obri_kost: 1, sun_thistle: 1, am_deep_oil: 1 }, elixir(3, { maxHp: 12 })),
  R('L058', 'Elixír válečníka', 'C', 63, 2, 1, { mat_manticoruv_osten: 1, mat_plamenna_esence: 1, am_deep_oil: 1 }, elixir(3, { attack: 12, speed: 6 }), 'alchemist'),
  R('L059', 'Elixír mága', 'C', 69, 3, 1, { mat_zariva_esence: 1, am_elemental_water: 1, mat_svitici_list: 1 }, elixir(3, { aether: 12, maxMp: 6 }), 'alchemist'),
  R('L060', 'Elixír železné kůže', 'C', 74, 2, 1, { mat_tezke_kamenne_jadro: 1, mountain_root: 1, am_deep_oil: 1 }, elixir(4, { defense: 15, maxHp: 8 }), 'found'),
  R('L061', 'Elixír větrné bouře', 'C', 79, 3, 1, { mat_bourkova_esence: 1, mat_vzdusna_esence: 1, mat_hippogryfi_pirko: 1 }, elixir(4, { speed: 15 }), 'found'),
  R('L062', 'Dračí bojový elixír', 'C', 94, 4, 1, { mat_supina_ignarotha: 1, al_fire_concentrate: 1, am_deep_oil: 1, bitter_root: 1 }, elixir(5, { attack: 20, defense: 12 }), 'quest'),
  R('L063', 'Astrální elixír moci', 'C', 97, 4, 1, { mat_astralni_esence: 1, am_astral_concentrate: 1, am_astral_fish: 1 }, elixir(5, { aether: 20, maxMp: 12 }), 'quest'),

  // D Esenční katalyzátory a magické směsi
  R('L064', 'Bylinný katalyzátor', 'D', 6, 1, 2, { healing_herbs: 2, mat_svitici_list: 1 }, { catalyst: 'Řemeslnictví: amulety I–II' }),
  R('L065', 'Verdantský koncentrát', 'D', 16, 1, 2, { mat_verdantska_esence: 1, mat_suchadri_miza: 1 }, { catalyst: 'Přírodní magie (talismany, léčivé fokusy)' }),
  R('L066', 'Jedová směs', 'D', 20, 1, 2, { am_venom_concentrate: 1, am_fish_oil: 1 }, { throw: { damage: 0, element: 'verdant', status: 'poison', turns: 3 } }),
  R('L067', 'Plamenný koncentrát', 'D', 32, 3, 2, { 'mat_plamenna_esence|crystal_flame': 1, fire_sage: 1 }, { catalyst: 'Ohnivá magie (kalení, fokusy)' }),
  R('L068', 'Vodní koncentrát', 'D', 32, 3, 2, { 'mat_vodni_esence|crystal_water': 1, mat_vodni_kvet: 1 }, { catalyst: 'Vodní magie' }),
  R('L069', 'Kamenný koncentrát', 'D', 34, 3, 2, { 'mat_kamenna_esence|crystal_stone': 1, mountain_root: 1 }, { catalyst: 'Kamenná magie' }),
  R('L070', 'Vzdušný koncentrát', 'D', 34, 3, 2, { 'mat_vzdusna_esence|crystal_air': 1, storm_fern: 1 }, { catalyst: 'Vzdušná magie' }),
  R('L071', 'Impregnační směs', 'D', 36, 2, 3, { am_fish_oil: 1, wax: 1, cleansing_herbs: 1 }, { catalyst: 'Řemeslnictví: impregnace kůží a vláken' }),
  R('L072', 'Ohnivá směs', 'D', 38, 2, 2, { al_fire_concentrate: 1, am_fish_oil: 1, sulfur: 1 }, { throw: { damage: 60, element: 'fire', status: 'burn', turns: 2 } }),
  R('L073', 'Mrazivá směs', 'D', 40, 2, 2, { al_water_concentrate: 1, ice_mint: 1, mat_krystal_namrazy: 1 }, { throw: { damage: 50, element: 'water', status: 'freeze', turns: 1 } }),
  R('L074', 'Stínový koncentrát', 'D', 55, 3, 2, { 'mat_stinova_esence|crystal_shadow': 1, shadow_lily: 1 }, { catalyst: 'Stínová magie' }),
  R('L075', 'Světelný koncentrát', 'D', 42, 3, 2, { mat_svetelna_esence: 1, sun_thistle: 1 }, { catalyst: 'Světelná magie' }),
  R('L076', 'Uspávací prášek', 'D', 44, 2, 2, { mat_snovy_prach: 1, mat_vilovy_prach: 1, moon_flower: 1 }, { throw: { damage: 0, element: 'dark', status: 'sleep', turns: 2 } }, 'alchemist'),
  R('L077', 'Bouřkový koncentrát', 'D', 48, 3, 2, { mat_bourkova_esence: 1, mat_bleskova_zlaza: 1 }, { catalyst: 'Blesková magie' }),
  R('L078', 'Směs pro magické kalení – oheň', 'D', 50, 3, 1, { al_fire_concentrate: 1, am_fish_oil: 1, mat_zhava_supina: 1 }, { catalyst: 'Kovářství: ohnivé zbraně' }),
  R('L079', 'Směs pro magické kalení – led', 'D', 52, 3, 1, { al_water_concentrate: 1, mat_krystal_namrazy: 1, am_fish_oil: 1 }, { catalyst: 'Kovářství: ledové zbraně' }),
  R('L080', 'Směs pro magické kalení – blesk', 'D', 54, 3, 1, { al_storm_concentrate: 1, am_fish_oil: 1, mat_vybojova_zlaza: 1 }, { catalyst: 'Kovářství: bleskové zbraně' }),
  R('L081', 'Duchovní směs', 'D', 56, 3, 1, { am_spirit_concentrate: 1, mat_ektoplazma: 1, shadow_lily: 1 }, { catalyst: 'Duchovní fokusy a talismany' }),
  R('L082', 'Krystalická reagencie', 'D', 60, 3, 1, { mat_kristalove_jadro: 1, mat_krystalicky_strep_pavouka: 1, am_water_extract: 1 }, { catalyst: 'Krystalické doplňky' }),
  R('L083', 'Hvězdný katalyzátor', 'D', 66, 3, 1, { mat_zariva_esence: 1, mat_hvezdny_prach: 1, mat_svitici_list: 1 }, { catalyst: 'Magické fokusy IV–V' }, 'alchemist'),
  R('L084', 'Hlubinný katalyzátor', 'D', 70, 3, 1, { am_glow_essence: 1, mat_hlubinna_esence: 1, am_deep_oil: 1 }, { catalyst: 'Vodní talismany, hlubinné recepty' }, 'alchemist'),
  R('L085', 'Měsíční katalyzátor', 'D', 75, 3, 1, { am_moon_water: 1, mat_mesicni_esence: 1, moon_flower: 1 }, { catalyst: 'Duchovní a měsíční doplňky' }, 'found'),
  R('L086', 'Elementální katalyzátor', 'D', 82, 4, 1, { al_fire_concentrate: 1, al_water_concentrate: 1, al_stone_concentrate: 1, al_air_concentrate: 1 }, { catalyst: 'Elementální výbava V (Kovářství, Řemeslnictví)' }, 'found'),
  R('L087', 'Astrální katalyzátor', 'D', 90, 4, 1, { am_astral_concentrate: 1, mat_astralni_esence: 1, astral_orchid: 1 }, { catalyst: 'Legendární katalyzátor' }, 'quest'),
  R('L088', 'Fénixova esence', 'D', 98, 4, 1, { mat_fenixovo_pirko: 1, mat_znovuzrozeny_popel: 1, al_astral_catalyst: 1 }, { catalyst: 'Legendární katalyzátor (příběhové výrobky)' }, 'quest'),

  // E Průzkumné a užitkové přípravky
  R('L089', 'Odpuzovač zvěře', 'E', 2, 1, 2, { bitter_root: 1, cleansing_herbs: 1 }, { explore: { encounters: -0.5 }, minutes: 5 }),
  R('L090', 'Lákadlo monster', 'E', 8, 1, 2, { mat_vytrusny_vacek: 1, forest_sage: 1 }, { explore: { encounters: 0.5 }, minutes: 5 }),
  R('L091', 'Svítící olej', 'E', 10, 1, 2, { wax: 1, mat_svitici_list: 1 }, { later: 'V jeskyních větší dohled (15 min) – až budou jeskyně k průzkumu.' }),
  R('L092', 'Lektvar rychlé chůze', 'E', 15, 1, 2, { storm_fern: 1, wayfarer_thyme: 1, clean_water: 1 }, { explore: { move: 10 }, minutes: 10 }),
  R('L093', 'Návnadový olej', 'E', 18, 1, 3, { am_fish_oil: 1, mat_vodni_kvet: 1 }, { explore: { fishWait: 0.85 }, minutes: 10 }),
  R('L094', 'Sběračský extrakt', 'E', 22, 1, 2, { forest_sage: 1, mat_vilovy_prach: 1 }, { explore: { herbExtra: 0.2 }, minutes: 15 }),
  R('L095', 'Horníkův lektvar', 'E', 24, 1, 2, { mountain_root: 1, mat_kamenny_strep: 1, clean_water: 1 }, { explore: { mineTime: 0.85 }, minutes: 15 }),
  R('L096', 'Lektvar hledače pokladů', 'E', 33, 2, 2, { mat_zlaty_prach: 1, mat_svitici_list: 1, am_water_extract: 1 }, { explore: { drop: 0.1 }, battles: 10 }),
  R('L097', 'Lektvar štěstí lovce', 'E', 35, 2, 2, { mat_vilovy_prach: 1, sun_thistle: 1, am_fish_oil: 1 }, { explore: { tame: 0.05 }, battles: 3 }, 'alchemist'),
  R('L098', 'Proutkařův olej', 'E', 41, 2, 2, { al_stone_concentrate: 1, am_fish_oil: 1 }, { explore: { dowsing: 1 }, minutes: 10 }),
  R('L099', 'Lektvar hlubinného dechu', 'E', 49, 2, 2, { am_deep_extract: 1, mat_vodni_kvet: 1 }, { explore: { fishDeep: 1.25 }, minutes: 15 }),
  R('L100', 'Lektvar neviditelnosti', 'E', 54, 3, 1, { al_shadow_concentrate: 1, mat_nocni_esence: 1, shadow_lily: 1 }, { explore: { encounters: -1 }, minutes: 5 }),
  R('L101', 'Lektvar zkušeností', 'E', 59, 2, 1, { moon_flower: 1, mat_arkanni_prach: 1, am_water_extract: 1 }, { explore: { monsterXp: 0.15 }, battles: 5 }),
  R('L102', 'Lektvar pouta', 'E', 62, 2, 1, { mat_cista_esence: 1, sun_thistle: 1, healing_herbs: 1 }, { explore: { bond: 2 }, battles: 5 }, 'alchemist'),
  R('L103', 'Teleportační prach', 'E', 67, 3, 1, { mat_arkanni_prach: 1, al_air_concentrate: 1, mat_hvezdny_prach: 1 }, { later: 'Návrat do posledního navštíveného města – až budou města v regionech.' }),
  R('L104', 'Lektvar mistra řemesla', 'E', 73, 4, 1, { al_crystal_reagent: 1, mat_zlaty_prach: 1, mat_svitici_list: 1 }, { explore: { craftXp: 0.2 }, minutes: 15 }, 'found'),
  R('L105', 'Lektvar cestovatelovy ochrany', 'E', 77, 2, 1, { am_deep_oil: 1, mountain_root: 1, mat_kurova_supina: 1 }, { explore: { escape: 1 }, minutes: 5 }, 'found'),
  R('L106', 'Lektvar hlubinného zraku', 'E', 85, 3, 1, { am_glow_essence: 1, al_deep_catalyst: 1, mat_svitici_list: 1 }, { explore: { fishRare: 1.5 }, minutes: 15 }, 'found'),
  R('L107', 'Lektvar astrální cesty', 'E', 91, 4, 1, { am_astral_concentrate: 1, mat_vzdusna_esence: 1, astral_orchid: 1 }, { explore: { move: 25, encounters: -1 }, minutes: 15 }, 'quest'),
  R('L108', 'Elixír velkého lovu', 'E', 96, 4, 1, { al_astral_catalyst: 1, mat_zlaty_prach: 1, mat_mesicni_esence: 1 }, { explore: { drop: 0.25, tame: 0.1 }, battles: 10 }, 'quest')
];

// Recepty, jejichž výrobek slouží jako surovina jiných receptů, mají předmět pod
// stálým id (al_…). Ostatní výrobky mají id „alch_Lxxx“; tři toniky a protijed
// zůstávají pod původním id.
const PRODUCT_IDS = {
  L001: 'minor_healing_tonic', L005: 'healing_tonic', L015: 'mana_potion', L017: 'strong_mana_tonic', L026: 'antidote',
  L067: 'al_fire_concentrate', L068: 'al_water_concentrate', L069: 'al_stone_concentrate', L070: 'al_air_concentrate',
  L074: 'al_shadow_concentrate', L077: 'al_storm_concentrate', L082: 'al_crystal_reagent', L084: 'al_deep_catalyst',
  L087: 'al_astral_catalyst'
};
export const alchemyOutputId = (recipe) =>
  recipe.category === 'M' ? recipe.id : PRODUCT_IDS[recipe.id] ?? `alch_${recipe.id}`;

export const ALL_ALCHEMY = [...ALCHEMY_INTERMEDIATES, ...ALCHEMY_RECIPES];
export const ALCHEMY_BY_ID = Object.fromEntries(ALL_ALCHEMY.map((r) => [r.id, r]));
export const ALCHEMY_BY_OUTPUT = Object.fromEntries(ALL_ALCHEMY.map((r) => [alchemyOutputId(r), r]));
export const GAME_ITEM_RECIPES = ['L001', 'L005', 'L015', 'L017', 'L026'];

export const STATUS_LABELS_CZ = {
  poison: 'otrava', sleep: 'spánek', paralysis: 'paralýza', freeze: 'zmrazení',
  burn: 'spálení', curse: 'prokletí', stun: 'omráčení', bleed: 'krvácení'
};
export const ELEMENT_LABELS_CZ = {
  fire: 'oheň', water: 'voda a led', earth: 'země', air: 'vzduch a blesk', dark: 'temná magie', light: 'světlo', verdant: 'příroda'
};
const STAT_LABELS = {
  attack: 'Fyzický útok', aether: 'Magický útok', defense: 'Obrana', resolve: 'Magická odolnost',
  speed: 'Rychlost', maxHp: 'Max. HP', maxMp: 'Max. mana'
};

// Kde jde předmět použít: 'any' (mimo souboj i v něm), 'battle', 'world', 'none'.
export function alchemyUseContext(effect) {
  if (!effect || effect.catalyst) return 'none';
  if (effect.later) return 'none';
  if (effect.throw || effect.revive || effect.regenTurn || effect.manaTurn || effect.cure) return 'battle';
  if (effect.explore) return 'world';
  return 'any';
}

const souboje = (n) => `${n} ${n === 1 ? 'souboj' : n < 5 ? 'souboje' : 'soubojů'}`;
const tahy = (n) => `${n} ${n === 1 ? 'tah' : n < 5 ? 'tahy' : 'tahů'}`;

export function describeAlchemy(e) {
  if (!e) return 'Mezivýrobek pro další recepty.';
  if (e.catalyst) return `Katalyzátor – ${e.catalyst}.`;
  if (e.later) return `${e.later}`;
  const parts = [];
  if (e.heal) parts.push(`${e.heal} HP vybranému monstru`);
  if (e.healAll) parts.push(`${e.healAll} HP všem monstrům`);
  if (e.mana) parts.push(`+${e.mana} many`);
  if (e.regenTurn) parts.push(`regenerace ${e.regenTurn} HP za tah (${tahy(e.turns)})`);
  if (e.manaTurn) parts.push(`mana +${e.manaTurn} za tah (${tahy(e.turns)})`);
  if (e.revive) parts.push(`oživí omdlelé monstrum s ${Math.round(e.revive * 100)} % HP`);
  if (e.cure) parts.push(e.cure === 'all' ? 'odstraní všechny negativní stavy' : `odstraní ${e.cure.map((s) => STATUS_LABELS_CZ[s]).join(' a ')}`);
  if (e.immune) parts.push(`imunita: ${e.immune.length >= 8 ? 'všechny stavy' : e.immune.map((s) => STATUS_LABELS_CZ[s]).join(', ')} (${souboje(e.battles)})`);
  if (e.resist) {
    const list = Object.entries(e.resist);
    parts.push(list.length >= 7 ? `odolnost proti všem elementům ${list[0][1]} % (${souboje(e.battles)})`
      : `odolnost ${list.map(([el, v]) => `${ELEMENT_LABELS_CZ[el]} ${v} %`).join(', ')} (${souboje(e.battles)})`);
  }
  if (e.buffs) parts.push(`${Object.entries(e.buffs).map(([s, v]) => `${STAT_LABELS[s]} +${v} %`).join(', ')} (${souboje(e.battles)})`);
  if (e.throw) {
    const t = e.throw;
    parts.push(`vrhací: ${t.damage ? `${t.damage} poškození, ` : ''}${STATUS_LABELS_CZ[t.status]} na ${tahy(t.turns)}`);
  }
  if (e.explore) {
    const x = e.explore;
    const ex = [];
    if (x.encounters === -1) ex.push('žádná náhodná setkání');
    else if (x.encounters) ex.push(`náhodná setkání ${x.encounters > 0 ? '+' : ''}${Math.round(x.encounters * 100)} %`);
    if (x.move) ex.push(`rychlost pohybu +${x.move} %`);
    if (x.fishWait) ex.push(`rybolov: čekání −${Math.round((1 - x.fishWait) * 100)} %`);
    if (x.fishDeep) ex.push(`rybolov: hlubinné úlovky ×${x.fishDeep}`);
    if (x.fishRare) ex.push(`rybolov: vzácné a vyšší ×${x.fishRare}`);
    if (x.drop) ex.push(`drop z monster +${Math.round(x.drop * 100)} %`);
    if (x.tame) ex.push(`ochočení +${Math.round(x.tame * 100)} %`);
    if (x.monsterXp) ex.push(`zkušenosti monster +${Math.round(x.monsterXp * 100)} %`);
    if (x.bond) ex.push(`důvěra za vítězství ×${x.bond}`);
    if (x.escape) ex.push('útěk ze souboje vždy uspěje');
    if (x.mineTime) ex.push(`těžba o ${Math.round((1 - x.mineTime) * 100)} % rychlejší`);
    if (x.herbExtra) ex.push(`Sběr bylin: ${Math.round(x.herbExtra * 100)} % šance na +1 kus`);
    if (x.dowsing) ex.push('ukazuje připravená naleziště a Skrytou žílu v regionu');
    if (x.craftXp) ex.push(`zkušenosti výrobních profesí +${Math.round(x.craftXp * 100)} %`);
    parts.push(`${ex.join(', ')} (${e.minutes ? `${e.minutes} min` : souboje(e.battles)})`);
  }
  const text = parts.join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1) + '.';
}

export const alchemyXp = (recipe) => Math.round(8 + 1.5 * recipe.level);
