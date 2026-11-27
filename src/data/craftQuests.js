// Řemeslné linie Dema (záložka „Demo – úkoly“): každé řemeslo má 3 části I → II → III.
// Část I se odemkne po úkolu Za léčitelkou (všechna řemesla najednou), část II po části I
// téhož řemesla a část III po části II. Řemesla na sobě nezávisí.
// (Části I Bylin, Alchymie a Kovářství – Byliny od řeky, Čistá voda, Kožený řemínek – jsou
// v QuestSystem.js.)
//
// goals: cíle splněné podle počítadel událostí (systems/QuestCounters.js), počítá se od přijetí.
//   { key, need, text, target, craftItem } – craftItem = výrobek (označí pracoviště a recept).
// steps + deliver: stejné jako úvodní úkoly profesí (obstarat suroviny, vyrobit, odevzdat).

const GV = 'Greenvale';
const B = (id, label, interaction = false) => ({ type: 'building', id, label, ...(interaction ? { interaction: true } : {}) });
const FISHER = B('greenvale_fishing_hut', 'Rybářská chata');
const MINER = B('greenvale_smithy', 'Kovárna');
const HERBALIST = B('greenvale_home_1', 'Dům Bylinkářky');
const MARKET = B('greenvale_market', 'Tržiště – potraviny');
const TAVERN = B('greenvale_tavern', 'Hostinec');
const ALCHEMIST = B('greenvale_alchemist', 'Alchymistický obchod');
const WORKSHOP = B('greenvale_house_e1', 'Řemeslná dílna');
const WARES = B('greenvale_market_wares', 'Tržiště – zboží');
const DOCK = { type: 'fishingSpot', location: 'greenvale_dock', label: 'Molo na řece' };
const POND = { type: 'fishingSpot', location: 'greenvale_pond', label: 'Rybník u Rybářské chaty' };
const quarry = (deposit, label) => ({ type: 'miningSpot', deposit, label });
const herbSite = (site, label) => ({ type: 'herbSite', site, label });

const quest = (id, def) => ({ id, region: GV, ...def });
const flags = (key) => ({ accepted: `${key}Accepted`, objective: `${key}Ready`, completed: `${key}Done` });

export const CRAFT_QUESTS = {
  // ------------------------------------------------------------------ Rybolov (Rybář)
  greenvale_fish_dock: quest('greenvale_fish_dock', {
    title: 'Rybolov I – Na molu',
    brief: 'Chyť 3 ryby na molu nebo u rybníka a vrať se za Rybářem.',
    giver: 'Rybář',
    description: 'Rybář ti ukáže, že ryby berou jen trpělivým. Rybářská místa mají modrý kruh u vody – stoupni si k nim a stiskni E.',
    returnTo: 'Vrať se za Rybářem do Rybářské chaty.',
    reward: '10 zlata a 200 XP Rybolovu.',
    requires: ['greenvale_visit_healer'],
    rewardGold: 10,
    rewardXp: { prof: 'fishing', amount: 200 },
    goals: [{ key: 'fish', need: 3, text: 'Chyť 3 ryby (Molo na řece nebo rybník u chaty, modrý kruh, E)', target: DOCK }],
    giverTarget: FISHER,
    flags: flags('fishDock'),
    dialog: {
      offer: ['Prut máš, návnadu taky. Tak ukaž, co umíš: na molu na řece chyť tři ryby a přines mi ukázat úlovek.'],
      active: ['Molo je kousek odsud, u řeky. Modrý kruh, nahodit a čekat.'],
      ready: ['Tři ryby! Ruka ti nezakolísala. Tady máš něco na návnady.'],
      done: ['Ryby se ti zatím daří. Podívej se do obchodu, co dnes hledám.']
    }
  }),
  greenvale_fish_demand: quest('greenvale_fish_demand', {
    title: 'Rybolov II – Úlovek dne',
    brief: 'Prodej Rybářovi rybu, kterou dnes poptává (za 150 % ceny).',
    giver: 'Rybář',
    description: 'Rybář každý den hledá jeden druh ryby a platí za něj víc. Který to je, uvidíš v jeho obchodě (Dnešní poptávka).',
    returnTo: 'Vrať se za Rybářem do Rybářské chaty.',
    reward: '15 zlata, 300 XP Rybolovu a 30 XP Diplomacie.',
    requires: ['greenvale_fish_dock'],
    rewardGold: 15,
    rewardXp: [{ prof: 'fishing', amount: 300 }, { prof: 'diplomacy', amount: 30 }],
    goals: [{ key: 'sell:fishDemand', need: 1, text: 'Chyť rybu z dnešní poptávky a prodej ji Rybářovi (obchod v Rybářské chatě)', target: { ...FISHER, interaction: true } }],
    giverTarget: FISHER,
    flags: flags('fishDemand'),
    dialog: {
      offer: ['Každý den chci jeden druh ryby – a za ten platím půldruhé ceny. Podívej se v obchodě, co dnes hledám, chyť ji a prodej mi ji.'],
      active: ['Dnešní poptávku najdeš v mém obchodě nahoře. Chyť tu rybu a prodej mi ji.'],
      ready: ['Přesně tuhle jsem chtěl. Vidíš, s poptávkou se vyplatí počítat.'],
      done: ['Zítra budu chtít zase jinou rybu. Stav se.']
    }
  }),
  greenvale_fish_rare: quest('greenvale_fish_rare', {
    title: 'Rybolov III – Vzácná ryba',
    brief: 'Chyť neobvyklou nebo vzácnější rybu (např. Lín v rybníku, Pstruh na řece).',
    giver: 'Rybář',
    description: 'Běžné ryby už umíš. Rybář chce vidět neobvyklý úlovek: Lína z rybníka (Rybolov 5) nebo Pstruha z řeky (Rybolov 8). Lepší návnada a háček pomůžou.',
    returnTo: 'Vrať se za Rybářem do Rybářské chaty.',
    reward: '35 zlata a 400 XP Rybolovu.',
    requires: ['greenvale_fish_demand'],
    rewardGold: 35,
    rewardXp: { prof: 'fishing', amount: 400 },
    goals: [{ key: 'fish:better', need: 1, text: 'Chyť neobvyklou nebo vzácnější rybu (Lín v rybníku od Rybolovu 5, Pstruh na řece od 8)', target: POND }],
    giverTarget: FISHER,
    flags: flags('fishRare'),
    dialog: {
      offer: ['Plotice chytí každý. Přines mi zprávu o něčem vzácnějším – třeba Lína z rybníka u chaty nebo Pstruha z řeky.'],
      active: ['Lín bere v rybníku, pstruh na řece. Trpělivost a dobrá návnada.'],
      ready: ['To je kus! Z tebe bude opravdový rybář. Tady máš odměnu.'],
      done: ['Ve Verdant Forest jsou řeky plné štik a úhořů. Až tam budeš, vezmi prut.']
    }
  }),

  // ------------------------------------------------------------------ Těžba (Hornický mistr)
  greenvale_mine_stone: quest('greenvale_mine_stone', {
    title: 'Těžba I – Kámen do kovárny',
    brief: 'Vytěž v lomu 5× Měděnou rudu a vrať se za Hornickým mistrem.',
    giver: 'Hornický mistr',
    description: 'Hornický mistr potřebuje měď do kovárny. Lom je za mostem na jihozápadě; naleziště mají hnědý kruh s krumpáčem.',
    returnTo: 'Vrať se za Hornickým mistrem do Kovárny.',
    reward: '10 zlata a 200 XP Těžby.',
    requires: ['greenvale_visit_healer'],
    rewardGold: 10,
    rewardXp: { prof: 'mining', amount: 200 },
    goals: [{ key: 'mine:copper_ore', need: 5, text: 'Vytěž 5× Měděnou rudu (lom, Měděná žíla, E)', target: quarry('N01', 'Lom – Měděná žíla') }],
    giverTarget: MINER,
    flags: flags('mineStone'),
    dialog: {
      offer: ['Kovárna žere měď jako hladový vlk. Vezmi krumpáč, v lomu vytěž pět kusů měděné rudy a pak se mi ukaž.'],
      active: ['Měděná žíla je v lomu hned u sjezdu. Hnědý kruh, E.'],
      ready: ['Pěkná ruda. Ruce ti slouží. Tady máš za práci.'],
      done: ['Rudu ti vykoupím, nebo si z ní u výhně roztav ingoty.']
    }
  }),
  greenvale_mine_iron: quest('greenvale_mine_iron', {
    title: 'Těžba II – Železo pro kovárnu',
    brief: 'Vytěž 3× Železnou rudu (Těžba 5) a prodej Hornickému mistrovi 3 suroviny z Těžby.',
    giver: 'Hornický mistr',
    description: 'Mistr chce železo a ukáže ti, že suroviny navíc se dají prodat. Železná žíla v lomu vyžaduje Těžbu 5.',
    returnTo: 'Vrať se za Hornickým mistrem do Kovárny.',
    reward: '15 zlata, 300 XP Těžby a 30 XP Diplomacie.',
    requires: ['greenvale_mine_stone'],
    rewardGold: 15,
    rewardXp: [{ prof: 'mining', amount: 300 }, { prof: 'diplomacy', amount: 30 }],
    goals: [
      { key: 'mine:iron_ore', need: 3, text: 'Vytěž 3× Železnou rudu (lom, Železná žíla, Těžba 5)', target: quarry('N02', 'Lom – Železná žíla') },
      { key: 'sell:MiningShop', need: 3, text: 'Prodej Hornickému mistrovi 3 suroviny z Těžby (obchod v Kovárně)', target: { ...MINER, interaction: true } }
    ],
    giverTarget: MINER,
    flags: flags('mineIron'),
    dialog: {
      offer: ['Měď máme, teď železo. Až budeš mít Těžbu na pětce, vytěž v lomu tři kusy železné rudy. A co ti přebude, to ti vykoupím – prodej mi aspoň tři kusy.'],
      active: ['Železná žíla je v lomu vedle měděné. Přebytky mi prodej v obchodě.'],
      ready: ['Dobré železo a férový obchod. Tak se to dělá.'],
      done: ['Cín najdeš v lomu taky – ale chce to zkušenější ruku.']
    }
  }),
  greenvale_mine_tin: quest('greenvale_mine_tin', {
    title: 'Těžba III – Cínová žíla',
    brief: 'Vytěž 2× Cínovou rudu na Cínové žíle v lomu (Těžba 8).',
    giver: 'Hornický mistr',
    description: 'Z mědi a cínu vzniká bronz. Cínová žíla je nejvzácnější naleziště lomu Greenvale a vyžaduje Těžbu 8.',
    returnTo: 'Vrať se za Hornickým mistrem do Kovárny.',
    reward: '35 zlata a 400 XP Těžby.',
    requires: ['greenvale_mine_iron'],
    rewardGold: 35,
    rewardXp: { prof: 'mining', amount: 400 },
    goals: [{ key: 'mine:tin_ore', need: 2, text: 'Vytěž 2× Cínovou rudu (lom, Cínová žíla, Těžba 8)', target: quarry('N03', 'Lom – Cínová žíla') }],
    giverTarget: MINER,
    flags: flags('mineTin'),
    dialog: {
      offer: ['Bronz je lepší než měď – ale potřebuješ cín. Cínová žíla je na kraji lomu a chce Těžbu na osmičce. Přines mi zprávu, až vytěžíš dva kusy.'],
      active: ['Cínová žíla je na západním kraji lomu. Těžba osm, jinak se do ní nezakousneš.'],
      ready: ['Cín! Teď už si můžeš u výhně slít i bronz. Výborně.'],
      done: ['V Opuštěném lomu na jihozápadě jsou vzácné žíly – ale ty jsou zatím nad tvé síly.']
    }
  }),

  // ------------------------------------------------------------------ Sběr bylin (Bylinkářka)
  greenvale_herb_farm: quest('greenvale_herb_farm', {
    title: 'Byliny II – Statkové záhony',
    brief: 'Nasbírej 5 bylin na statku (záhony a ohrada za mostem) a 3 byliny prodej Bylinkářce.',
    giver: 'Bylinkářka',
    description: 'Na statku za mostem rostou záhony bylin, které se rychle obnovují. Co nasbíráš navíc, vykoupí Bylinkářka.',
    returnTo: 'Vrať se za Bylinkářkou (Dům Bylinkářky).',
    reward: '15 zlata, 300 XP Sběru bylin a 30 XP Diplomacie.',
    requires: ['greenvale_river_herbs'],
    rewardGold: 15,
    rewardXp: [{ prof: 'herbalism', amount: 300 }, { prof: 'diplomacy', amount: 30 }],
    goals: [
      { key: 'herb:farm', need: 5, text: 'Nasbírej 5 bylin na statku (záhony u mlýna a ohrada za mostem)', target: herbSite('Z01', 'Záhony statku') },
      { key: 'sell:HerbalistShop', need: 3, text: 'Prodej Bylinkářce 3 byliny (obchod v Domě Bylinkářky)', target: { ...HERBALIST, interaction: true } }
    ],
    giverTarget: HERBALIST,
    flags: flags('herbFarm'),
    dialog: {
      offer: ['Záhony na statku za mostem obnovuju každou chvíli. Nasbírej tam pět bylin – a co nepotřebuješ, prodej mi. Aspoň tři kusy.'],
      active: ['Statek je za mostem, záhony u mlýna. A přebytky mi prodej v obchodě.'],
      ready: ['Krásné, čerstvé byliny. Se mnou se vyplatí obchodovat, uvidíš.'],
      done: ['Na tůňkách u řeky rostou i vzácnější květy. Až budeš umět víc, zajdi tam.']
    }
  }),
  greenvale_herb_rare: quest('greenvale_herb_rare', {
    title: 'Byliny III – Vzácný květ',
    brief: 'Nasbírej 2× Vodní květ (Sběr bylin 8) na Tůňkách u řeky a přines ho Bylinkářce.',
    giver: 'Bylinkářka',
    description: 'Vodní květ je neobvyklá rostlina z tůněk u řeky. Alchymisté z něj dělají vodní extrakt.',
    returnTo: 'Přines 2× Vodní květ Bylinkářce (Dům Bylinkářky).',
    reward: '35 zlata a 300 XP Sběru bylin.',
    requires: ['greenvale_herb_farm'],
    rewardGold: 35,
    rewardXp: { prof: 'herbalism', amount: 300 },
    steps: [
      { kind: 'gather', item: 'mat_vodni_kvet', qty: 2, text: 'Nasbírej 2× Vodní květ na Tůňkách u řeky (Sběr bylin 8, zelený kruh, E).',
        target: herbSite('H07', 'Tůňky u řeky') }
    ],
    deliver: { id: 'mat_vodni_kvet', qty: 2 },
    giverTarget: HERBALIST,
    flags: flags('herbRare'),
    dialog: {
      offer: ['Na tůňkách u řeky kvete vodní květ – bílomodrý, na hladině. Natrhej mi dva, až budeš mít Sběr bylin na osmičce.'],
      active: ['Tůňky u řeky, severně od náměstí. Vodní květ chce zkušenou ruku – Sběr bylin osm.'],
      ready: ['Vodní květy! Ty se mi do sbírky hodí. Děkuju.'],
      done: ['V lesích za Greenvale rostou ještě vzácnější rostliny. Ale to už je jiný příběh.']
    }
  }),

  // ------------------------------------------------------------------ Vaření (Trhovkyně, Výčepní)
  greenvale_cook_market: quest('greenvale_cook_market', {
    title: 'Vaření I – Na trhu',
    brief: 'Kup u Trhovkyně mouku, sůl a zeleninu, uvař 3× Cestovní jídlo a přines je Trhovkyni.',
    giver: 'Trhovkyně',
    description: 'Trhovkyně chystá snídaně pro hosty hostince a potřebuje pomoc. Suroviny prodává sama, uvařit je můžeš v Hostinské kuchyni nebo na sporáku.',
    returnTo: 'Odevzdej 3× Cestovní jídlo Trhovkyni (Tržiště – potraviny).',
    reward: '10 zlata a 200 XP Vaření.',
    requires: ['greenvale_visit_healer'],
    rewardGold: 10,
    rewardXp: { prof: 'cooking', amount: 200 },
    steps: [
      { kind: 'buy', item: 'flour', qty: 3, text: 'Kup 3× Mouku u Trhovkyně (Tržiště – potraviny).', target: { ...MARKET, interaction: true } },
      { kind: 'buy', item: 'salt', qty: 3, text: 'Kup 3× Sůl u Trhovkyně (Tržiště – potraviny).', target: { ...MARKET, interaction: true } },
      { kind: 'buy', item: 'vegetables', qty: 3, text: 'Kup 3× Zeleninu u Trhovkyně (Tržiště – potraviny).', target: { ...MARKET, interaction: true } },
      { kind: 'craft', text: 'Uvař 3× Cestovní jídlo v Hostinské kuchyni (Hostinec).', target: B('greenvale_tavern', 'Hostinská kuchyně') }
    ],
    deliver: { id: 'travel_ration', qty: 3 },
    giverTarget: MARKET,
    flags: flags('cookMarket'),
    dialog: {
      offer: ['Hosté v hostinci chtějí ráno snídani s sebou na cestu. Kup u mě mouku, sůl a zeleninu, v hostinské kuchyni z nich uvař tři cestovní jídla a přines mi je.'],
      active: ['Mouka, sůl a zelenina ode mě, uvařit v hostinské kuchyni. Tři cestovní jídla.'],
      ready: ['Voní to báječně! Hosté budou spokojení. Tady máš za pomoc.'],
      done: ['Čerstvé suroviny mám každý den. A z vlastní ryby uvaříš ještě lepší jídlo.']
    }
  }),
  greenvale_cook_fish: quest('greenvale_cook_fish', {
    title: 'Vaření II – Ryba na talíř',
    brief: 'Chyť plotici, uvař z ní Pečenou plotici a jednu prodej na tržišti.',
    giver: 'Trhovkyně',
    description: 'Z vlastních surovin se vaří nejlevněji. Pečená plotice je plotice a léčivé byliny – a hotové jídlo se dá prodat.',
    returnTo: 'Vrať se za Trhovkyní (Tržiště – potraviny).',
    reward: '15 zlata, 300 XP Vaření a 30 XP Diplomacie.',
    requires: ['greenvale_cook_market'],
    rewardGold: 15,
    rewardXp: [{ prof: 'cooking', amount: 300 }, { prof: 'diplomacy', amount: 30 }],
    goals: [
      { key: 'craft:cooking:V013', need: 1, text: 'Chyť Plotici (molo nebo rybník) a uvař Pečenou plotici (Plotice + Léčivé byliny, kuchyně)', target: POND, craftItem: 'meal_V013' },
      { key: 'sold:meal_V013', need: 1, text: 'Prodej 1× Pečenou plotici Trhovkyni (Tržiště – potraviny)', target: { ...MARKET, interaction: true } }
    ],
    giverTarget: MARKET,
    flags: flags('cookFish'),
    dialog: {
      offer: ['Kupovat se dá všechno, ale vlastní ryba je nejlevnější. Chyť plotici, upeč ji s léčivými bylinkami a jednu mi prodej – uvidíš, že se to vyplatí.'],
      active: ['Plotice z mola nebo rybníka, k tomu léčivé byliny. Upeč ji a prodej mi ji.'],
      ready: ['Křupavá a voňavá! Takovou ráda prodám dál.'],
      done: ['Dobré jídlo před bojem udělá divy. Zeptej se výčepní v hostinci.']
    }
  }),
  greenvale_cook_battle: quest('greenvale_cook_battle', {
    title: 'Vaření III – Před bitvou',
    brief: 'Sněz pokrm s účinkem (najedený) a vyhraj s ním souboj. Vrať se za Výčepní.',
    giver: 'Výčepní',
    description: 'Pokrm s trvajícím účinkem (regenerace, bonus k útoku…) platí několik soubojů. Sníš ho v inventáři (Použít).',
    returnTo: 'Vrať se za Výčepní do hostince.',
    reward: '35 zlata a 400 XP Vaření.',
    requires: ['greenvale_cook_fish'],
    rewardGold: 35,
    rewardXp: { prof: 'cooking', amount: 400 },
    goals: [{ key: 'win:fed', need: 1, text: 'Sněz pokrm s účinkem (inventář, Použít) a vyhraj souboj, dokud účinek trvá', target: { type: 'meadow', label: 'Louka' } }],
    giverTarget: TAVERN,
    flags: flags('cookBattle'),
    dialog: {
      offer: ['Hladový krotitel je poloviční krotitel. Sněz něco pořádného – vývar, pečeni, cokoliv s účinkem – a pak vyhraj souboj. Uvidíš ten rozdíl.'],
      active: ['Najez se (inventář, Použít) a vyhraj souboj, dokud jídlo účinkuje.'],
      ready: ['Vidíš? Plné břicho, silná ruka. Tady máš za odvahu.'],
      done: ['Kuchyni máš kdykoli k dispozici. A pokoj taky.']
    }
  }),

  // ------------------------------------------------------------------ Alchymie (Alchymista)
  greenvale_alch_mana: quest('greenvale_alch_mana', {
    title: 'Alchymie II – Tonik many',
    brief: 'Nasbírej modré byliny, uvař z nich Tonik many a jeden prodej na tržišti.',
    giver: 'Alchymista',
    description: 'Tonik many vrátí hrdinovi manu na kouzla. Modré byliny rostou ve stínu u vodopádu a v zahrádkách, čistou vodu prodává Trhovkyně.',
    returnTo: 'Vrať se za Alchymistou do Alchymistického obchodu.',
    reward: '15 zlata, 300 XP Alchymie a 30 XP Diplomacie.',
    requires: ['greenvale_clean_water'],
    rewardGold: 15,
    rewardXp: [{ prof: 'alchemy', amount: 300 }, { prof: 'diplomacy', amount: 30 }],
    goals: [
      { key: 'craft:alchemy:L015', need: 1, text: 'Nasbírej 2× Modré byliny (Stín u vodopádu) a uvař Tonik many (+ Čistá voda, Alchymistický stůl)', target: herbSite('H03', 'Stín u vodopádu'), craftItem: 'mana_potion' },
      { key: 'sold:mana_potion', need: 1, text: 'Prodej 1× Tonik many na tržišti (Trhovkyně nebo Obchodník s látkami)', target: { ...MARKET, interaction: true } }
    ],
    giverTarget: ALCHEMIST,
    flags: flags('alchMana'),
    dialog: {
      offer: ['Kouzla stojí manu a mana se dá vrátit. Nasbírej modré byliny ve stínu u vodopádu, uvař z nich tonik many a jeden prodej na tržišti – ať víš, co má lektvar za cenu.'],
      active: ['Modré byliny, čistá voda, můj stůl. A jeden tonik prodej na tržišti.'],
      ready: ['Vlastní byliny, vlastní lektvar, vlastní zisk. Tak se z učedníka stává alchymista.'],
      done: ['Ochranné přípravky jsou těžší. Ale jeden ti ukážu.']
    }
  }),
  greenvale_alch_repel: quest('greenvale_alch_repel', {
    title: 'Alchymie III – Odpuzovač zvěře',
    brief: 'Uvař Odpuzovač zvěře (Hořký kořen + Čisticí byliny) a použij ho.',
    giver: 'Alchymista',
    description: 'Odpuzovač zvěře na 5 minut sníží počet setkání s divokými monstry – hodí se, když spěcháš. Použiješ ho v inventáři.',
    returnTo: 'Vrať se za Alchymistou do Alchymistického obchodu.',
    reward: '35 zlata a 400 XP Alchymie.',
    requires: ['greenvale_alch_mana'],
    rewardGold: 35,
    rewardXp: { prof: 'alchemy', amount: 400 },
    goals: [
      { key: 'craft:alchemy:L089', need: 1, text: 'Nasbírej Hořký kořen (Les) a Čisticí byliny a uvař Odpuzovač zvěře (Alchymie 2)', target: herbSite('H04', 'Les'), craftItem: 'alch_L089' },
      { key: 'use:alchemy:L089', need: 1, text: 'Použij Odpuzovač zvěře (inventář, Použít)', target: null }
    ],
    giverTarget: ALCHEMIST,
    flags: flags('alchRepel'),
    dialog: {
      offer: ['Ne každý souboj stojí za to. Hořký kořen z lesa a čisticí byliny dají odpuzovač zvěře – monstra se ti budou chvíli vyhýbat. Uvař ho a vyzkoušej.'],
      active: ['Hořký kořen roste v lese, čisticí byliny u řeky. Uvař odpuzovač a použij ho v inventáři.'],
      ready: ['Cítíš, jak se ti zvěř vyhýbá? Dobrá práce.'],
      done: ['Ochranné oleje proti živlům tě naučím, až budeš mnohem zkušenější.']
    }
  }),

  // ------------------------------------------------------------------ Kovářství (Hornický mistr)
  greenvale_smith_ingot: quest('greenvale_smith_ingot', {
    title: 'Kovářství II – Vlastní ingot',
    brief: 'Roztav vlastní měděnou rudu na Měděný ingot a jeden ingot prodej na tržišti.',
    giver: 'Hornický mistr',
    description: 'Měděný ingot je 2× Měděná ruda a 1× Uhlí (obojí z lomu) – roztavíš ho u výhně v Kovárně.',
    returnTo: 'Vrať se za Hornickým mistrem do Kovárny.',
    reward: '15 zlata, 300 XP Kovářství a 30 XP Diplomacie.',
    requires: ['greenvale_leather_strap'],
    rewardGold: 15,
    rewardXp: [{ prof: 'smithing', amount: 300 }, { prof: 'diplomacy', amount: 30 }],
    goals: [
      { key: 'craft:smithing:sm_copper_ingot', need: 1, text: 'Vytěž 2× Měděnou rudu a 1× Uhlí a roztav Měděný ingot u výhně (Kovárna)', target: quarry('N01', 'Lom – Měděná žíla'), craftItem: 'sm_copper_ingot' },
      { key: 'sold:sm_copper_ingot', need: 1, text: 'Prodej 1× Měděný ingot na tržišti (Obchodník s látkami nebo Trhovkyně)', target: { ...WARES, interaction: true } }
    ],
    giverTarget: MINER,
    flags: flags('smithIngot'),
    dialog: {
      offer: ['Ruda je jen kámen, dokud ji neroztavíš. Vytěž měď a uhlí, u výhně z nich slij ingot a jeden prodej na tržišti – ať víš, co tvá práce stojí.'],
      active: ['Dvě měděné rudy a uhlí, výheň je tady. Ingot pak prodej na tržišti.'],
      ready: ['Čistý ingot. Teď už z tebe není jen horník, ale i kovář.'],
      done: ['Z ingotů ukuješ zbraně a zbroje. Zkus to.']
    }
  }),
  greenvale_smith_weapon: quest('greenvale_smith_weapon', {
    title: 'Kovářství III – Zbraň pro krotitele',
    brief: 'Vykovej Měděnou dýku (2× Měděný ingot + Kožený řemínek) u výhně.',
    giver: 'Hornický mistr',
    description: 'Měděná dýka je první zbraň, kterou si krotitel ukuje sám. Nasadit ji můžeš v inventáři – přidá hrdinovi sílu.',
    returnTo: 'Vrať se za Hornickým mistrem do Kovárny.',
    reward: '35 zlata a 400 XP Kovářství.',
    requires: ['greenvale_smith_ingot'],
    rewardGold: 35,
    rewardXp: { prof: 'smithing', amount: 400 },
    goals: [{ key: 'craft:smithing:A01', need: 1, text: 'Vykovej Měděnou dýku u výhně (2× Měděný ingot + Kožený řemínek)', target: MINER, craftItem: 'smith_A01' }],
    giverTarget: MINER,
    flags: flags('smithWeapon'),
    dialog: {
      offer: ['Krotitel bez zbraně je jako horník bez krumpáče. Slij dva měděné ingoty, přidej kožený řemínek a ukovej si dýku.'],
      active: ['Dva měděné ingoty a řemínek. Výheň je tvoje.'],
      ready: ['Dobře vyvážená čepel. Nos ji s hrdostí.'],
      done: ['Bronz a železo jsou tvrdší než měď. Až budeš zkušenější, ukuješ lepší zbraně.']
    }
  }),

  // ------------------------------------------------------------------ Řemeslnictví (Řemeslnice)
  greenvale_craft_hide: quest('greenvale_craft_hide', {
    title: 'Výroba I – Kůže na zakázku',
    brief: 'Získej kůže z monster (kořist) a zpracuj 2× na Kůži na Koželužském stole.',
    giver: 'Řemeslnice',
    description: 'Monstra jako Wild Boar nebo Dire Wolf občas zanechají kůži. Na Koželužském stole v Řemeslné dílně z ní uděláš kůži pro řemeslníky.',
    returnTo: 'Vrať se za Řemeslnicí do Řemeslné dílny.',
    reward: '10 zlata a 200 XP Řemeslnictví.',
    requires: ['greenvale_visit_healer'],
    rewardGold: 10,
    rewardXp: { prof: 'crafting', amount: 200 },
    goals: [{ key: 'craft:crafting:cr_hide_to_leather', need: 2, text: 'Získej v soubojích kůže z monster a zpracuj 2× na Kůži (Koželužský stůl, Řemeslná dílna)', target: { type: 'meadow', species: 'wild_boar', label: 'Louka s divočáky' }, craftItem: 'leather' }],
    giverTarget: WORKSHOP,
    flags: flags('craftHide'),
    dialog: {
      offer: ['Kůže z trhu je drahá. Lovec si ji obstará sám: monstra po souboji občas nechají kožešinu. Přines si dvě a na koželužském stole je zpracuj.'],
      active: ['Kožešiny padají z divočáků i vlků. Zpracuješ je na koželužském stole tady v dílně.'],
      ready: ['Pěkně vydělané kůže. Ruce na to máš.'],
      done: ['Na šperkařském stole se dají dělat prsteny a amulety. Zkus to.']
    }
  }),
  greenvale_craft_jewel: quest('greenvale_craft_jewel', {
    title: 'Výroba II – První šperk',
    brief: 'Vyrob prsten nebo amulet na Šperkařském stole a jeden šperk prodej na tržišti.',
    giver: 'Řemeslnice',
    description: 'Nejjednodušší je Měděný prsten (Měděný drát + Křemen). Šperky dávají hrdinovi štěstí a charisma – a dobře se prodávají.',
    returnTo: 'Vrať se za Řemeslnicí do Řemeslné dílny.',
    reward: '15 zlata, 300 XP Řemeslnictví a 30 XP Diplomacie.',
    requires: ['greenvale_craft_hide'],
    rewardGold: 15,
    rewardXp: [{ prof: 'crafting', amount: 300 }, { prof: 'diplomacy', amount: 30 }],
    goals: [
      { key: 'craft:crafting:jewel', need: 1, text: 'Vyrob prsten nebo amulet na Šperkařském stole (např. Měděný prsten: Měděný drát + Křemen)', target: WORKSHOP, craftItem: 'cr_b01' },
      { key: 'sell:jewel', need: 1, text: 'Prodej 1 prsten nebo amulet na tržišti (Obchodník s látkami)', target: { ...WARES, interaction: true } }
    ],
    giverTarget: WORKSHOP,
    flags: flags('craftJewel'),
    dialog: {
      offer: ['Kůže umíš, teď něco jemnějšího. Na šperkařském stole vyrob prsten nebo amulet – měděný prsten je nejsnazší. A jeden prodej na tržišti.'],
      active: ['Měděný drát ti ukuje kovář nebo si ho slij sám, křemen je v lomu. Šperk pak prodej na tržišti.'],
      ready: ['Krásná práce. A vidíš, že se šperky dají dobře prodat.'],
      done: ['Mág v Hvězdárně má pracovní stůl na Soul Crystaly. Řekni mu, že tě posílám.']
    }
  }),
  greenvale_craft_crystal: quest('greenvale_craft_crystal', {
    title: 'Výroba III – Krystal duše',
    brief: 'Vyrob Basic Soul Crystal na Soul Crystal Workbench v Hvězdárně.',
    giver: 'Řemeslnice',
    description: 'Soul Crystal je Křišťálový střep (lom, Krystalová puklina, nebo kořist) a Vlákno (Obchodník s látkami). Vyrábí se u Mága v Hvězdárně.',
    returnTo: 'Vrať se za Řemeslnicí do Řemeslné dílny.',
    reward: '35 zlata a 400 XP Řemeslnictví.',
    requires: ['greenvale_craft_jewel'],
    rewardGold: 35,
    rewardXp: { prof: 'crafting', amount: 400 },
    goals: [{ key: 'craft:crafting:E01', need: 1, text: 'Vyrob Basic Soul Crystal (Křišťálový střep + Vlákno) na Soul Crystal Workbench v Hvězdárně', target: B('greenvale_observatory', 'Hvězdárna'), craftItem: 'basic_crystal' }],
    giverTarget: WORKSHOP,
    flags: flags('craftCrystal'),
    dialog: {
      offer: ['Krotitel, který si umí vyrobit vlastní Soul Crystal, nikdy nezůstane bez společníka. Křišťálový střep a vlákno – a Mágův pracovní stůl v Hvězdárně.'],
      active: ['Křišťálový střep, vlákno od Obchodníka s látkami, stůl u Mága v Hvězdárně.'],
      ready: ['Vlastní krystal duše! Teď jsi opravdový řemeslník.'],
      done: ['Kůže, šperky, krystaly – dílna je ti kdykoli k dispozici.']
    }
  }),

  // ------------------------------------------------------------------ Do zbroje (Obchodník s látkami)
  greenvale_gear: quest('greenvale_gear', {
    title: 'Do zbroje',
    brief: 'Kup nebo vyrob kus výbavy a nasaď ho (inventář, Vybavit).',
    giver: 'Obchodník s látkami',
    description: 'Výbava (zbraň, zbroj, prsten, amulet) přidá hrdinovi statistiky. Vyrobíš ji v kovárně a dílně, nasadíš v inventáři nebo na kartě Hrdina.',
    returnTo: 'Vrať se za Obchodníkem s látkami (Tržiště – zboží).',
    reward: '15 zlata.',
    requires: ['greenvale_leather_strap', 'greenvale_craft_hide'],
    rewardGold: 15,
    goals: [{ key: 'equip', need: 1, text: 'Nasaď kus výbavy (inventář, Vybavit) – kup ho, nebo vyrob v kovárně či dílně', target: null }],
    giverTarget: WARES,
    flags: flags('gear'),
    dialog: {
      offer: ['Na cestu za vesnici potřebuješ víc než dobrou vůli. Kup nebo si vyrob kus výbavy a nasaď ho – ukaž mi, jak ti sedí.'],
      active: ['Výbavu nasadíš v inventáři (Vybavit) nebo na kartě Hrdina.'],
      ready: ['Sluší ti to! Teď vypadáš jako opravdový krotitel.'],
      done: ['Látky, vlákno, kůže a vosk – všechno pro řemeslníky.']
    }
  }),

  // ------------------------------------------------------------------ obchod (Starosta, Úřednice)
  // 34 – koupit Zelený dům (500 zlata, Diplomacie 10). Splní se i domem koupeným dřív.
  greenvale_own_shop: quest('greenvale_own_shop', {
    title: 'Vlastní obchod',
    brief: 'Získej Diplomacii 10, našetři 500 zlata a kup od starosty Zelený dům.',
    giver: 'Starosta Edric',
    description: 'Zelený dům u náměstí je na prodej – mohl by v něm být tvůj obchod. Starosta ho prodá jen zkušenému obchodníkovi (Diplomacie 10). Diplomacii zvedneš obchodem, úkoly a rozhovory.',
    objective: 'Kup Zelený dům.',
    objectiveText: (state) => {
      const level = Number(state?.professions?.diplomacy?.level) || 1;
      return level < 10
        ? `Získej Diplomacii 10 (obchod, úkoly, rozhovory): úroveň ${level}/10.`
        : `Kup Zelený dům od starosty Edrica za 500 zlata (máš ${Math.floor(Number(state?.gold) || 0)}).`;
    },
    returnTo: 'Vrať se za starostou Edricem na radnici.',
    reward: 'Vlastní obchod – Zelený dům.',
    requires: ['greenvale_visit_healer'],
    objectiveCheck: (state) => Boolean(state?.business?.properties?.greenvale_house_w1),
    progress: (state) => {
      const level = Number(state?.professions?.diplomacy?.level) || 1;
      return level < 10 ? { have: level, need: 10, label: 'Diplomacie' } : { have: Math.min(500, Number(state?.gold) || 0), need: 500, unit: 'zlata' };
    },
    giverTarget: B('greenvale_town_hall', 'Radnice'),
    objectiveTarget: B('greenvale_town_hall', 'Radnice', true),
    flags: flags('ownShop'),
    dialog: {
      offer: ['Zelený dům u náměstí stojí prázdný. Mohl by v něm být pěkný obchod – tvůj obchod.', 'Prodám ho za pět set zlatých, ale jen zkušenému obchodníkovi. Vrať se, až budeš mít Diplomacii deset a peníze.'],
      active: ['Diplomacie deset a pět set zlatých – pak je Zelený dům tvůj.'],
      ready: ['Tak co, jak se ti v Zeleném domě líbí? Úřednice ti vysvětlí, jak vést účetní knihu.'],
      done: ['Greenvale potřebuje obchodníky. Ať se ti daří.']
    }
  }),
  // 33 – Úřednice: účetní kniha ve vlastním obchodě a prvních 5 prodaných kusů.
  greenvale_ledger: quest('greenvale_ledger', {
    title: 'Účetní kniha',
    brief: 'Ve svém obchodě otevři účetní knihu a prodej zákazníkům 5 kusů zboží.',
    giver: 'Úřednice',
    description: 'Obchod je víc než pult. Dej zboží do skladu, nastav ceny a sleduj v účetní knize, co se prodává. Zákazníci chodí, jen když je obchod otevřený a hraješ.',
    returnTo: 'Vrať se za Úřednicí na radnici.',
    reward: '20 zlata a 100 XP Diplomacie.',
    requires: ['greenvale_own_shop'],
    rewardGold: 20,
    rewardXp: { prof: 'diplomacy', amount: 100 },
    goals: [
      { key: 'ledger:open', need: 1, text: 'Otevři účetní knihu ve svém obchodě (Zelený dům, Účetní kniha)', target: B('greenvale_house_w1', 'Zelený dům', true) },
      { key: 'shopSale', need: 5, text: 'Prodej zákazníkům ve svém obchodě 5 kusů zboží (sklad → prodejní pult, otevřený obchod)', target: B('greenvale_house_w1', 'Zelený dům', true) }
    ],
    giverTarget: B('greenvale_town_hall', 'Radnice'),
    flags: flags('ledger'),
    dialog: {
      offer: ['Tak ty jsi ten nový obchodník ze Zeleného domu! Než začneš, podívej se do účetní knihy – tam uvidíš, co se prodává a za kolik.', 'A pak prodej prvních pět kusů. Uvidíme, jestli ti to jde.'],
      active: ['Účetní kniha leží na pultu v Zeleném domě. Zboží dej do skladu, vyber ho na prodejní pult a otevři obchod.'],
      ready: ['Pět prodaných kusů a čistá kniha. Z tebe bude obchodník.'],
      done: ['Vyhlášky visí na nástěnce vlevo. Kdyby něco, jsem tady.']
    }
  })
};
