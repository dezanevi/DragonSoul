# Dragon Souls – historie verzí

## Jak archivujeme

Verze se číslují 0, 0.1, 0.2, … (1.0 bude první vydání).

1. Před uložením verze sem nahoru dopiš novou sekci `## Verze N – datum`
   a popiš, co se od minulé verze změnilo (podle kategorií níže).
2. Spusť v PowerShellu ve složce hry:

   ```powershell
   powershell -ExecutionPolicy Bypass -File tools/archive-version.ps1 -Version N
   ```

3. Skript vytvoří ve složce `archiv/`:
   - `dragon-souls-vN.zip`: kompletní hra bez `node_modules`,
   - `vN-soubory.json`: otisky všech souborů pro porovnání s příští verzí,
   - `vN-zmeny.txt`: seznam souborů přidaných, změněných a smazaných od předchozí verze.

Obnovení verze: rozbal ZIP do nové složky a spusť `npm install` a `npm run dev`.

Kategorie změn: **Přidáno**, **Změněno**, **Opraveno**, **Odstraněno**, **Grafika**, **Známé problémy**.

---

## Verze 0.1 – rozpracováno

### Přidáno
- Start nové hry: první společník je Dire Wolf 5. úrovně s důvěrou (bond) 0 (dřív testovací
  vlk 100. úrovně). Po odchodu z interiéru, do kterého hra nastartovala (lovecká chata), stojí
  hráč ve světě na poli dveří dané budovy (`state.exitDoor`), ne na mostě.
- Mapa Greenvale: lovecká chata a dům u louky setkání si vyměnily místa (chata 35–39 × 57–61,
  dveře 40,59; dům 73–76 × 76–79, dveře 77,77). Louka setkání je hustší – 41 nových smrků,
  rozmístěných tak, aby mezi nimi šlo projít a cesty, parcely i jeskyně zůstaly volné.
- Načítací obrazovka (`public/loading-screen.webp`, vrstva v `index.html`): komiksový příběh
  se vynoří ze tmy, dole ukazatel načítání (průběh posílá BootScene), po načtení ho nahradí
  blikající „Klikni pro pokračování“. Zůstane nejméně 3 s (klik přeskočí) a pak se zatmí
  do hry. Adresa s `?loading` nechá obrazovku svítit, dokud se neklikne (pro prohlížení).
- Odchyt přejmenován na Ochočení (tlačítko v souboji, nápověda, hlášky, popis krystalu);
  při neúspěchu „Zvíře se nenechalo ochočit“. Systém zůstává stejný.
- Souboj s více divokými monstry (`BattleScene`): náhodné setkání má 1–5 monster
  (`ENCOUNTER_SIZE` podle oblasti, Greenvale zatím 1–3), každé na vlastním startovním poli,
  stejná jména se odliší písmenem (Goblin A, Goblin B). Jeskynní sliz má s sebou 2 gobliny
  5. úrovně. Odchyt cílí na konkrétní monstrum – po úspěchu ostatní bojují dál. Odměna roste
  s počtem monster (18 EXP + 10 za každé další, 8 zlatých za každé), bestiář zapíše každé
  poražené monstrum.
- Animace monster z obrázků (`src/battle/monsterAnimations.js`): Dire Wolf má v souboji
  i na kartě Party idle animaci ze 4 snímků (`assets/monsters/dire_wolf/animations/Idle.png`,
  3 snímky/s, bílé pozadí se odstraní, snímky zarovnané na společný ořez). Monstra hráče se
  hýbou synchronně (společné hodiny), monstra nepřítele
  jsou zrcadlově otočená doleva a liší se náhodným začátkem cyklu a rychlostí (0,8–1,1×).
  Druhy bez animace dál používají kreslený model.
- Karta Party u monster s animací: miniatura v aktivní partě = hlava z prvního snímku
  oříznutá do rámečku, portrét v detailu = celý první snímek bez pohybu, velký model
  na kruhu = animace idle.
- Karta Party: všechna 4 políčka party se kreslí z monsterselect.png přes namalovaný podklad
  (dřív byla vidět namalovaná políčka, takže s jedním monstrem se stav neměnil): výchozí
  (tmavé), hover (modrá záře), vybrané (modré) až po kliknutí na monstrum – při otevření karty
  je první monstrum vybrané jen pro detail, políčko zůstává tmavé; hover vybrané políčko
  neztmaví. Prázdné místo a omdlelé monstrum = Neaktivní (šedé).
- Inventář (`src/systems/InventorySystem.js`, předměty v `src/data/items.js`): sloty
  `state.inventory.slots` (40 = 8 × 5), hromádky do 99 kusů. Starší uložené hry s počtem
  krystalů se převedou; souboj (Odchyt) a karta hrdiny čtou krystaly z inventáře.
- Lektvar many (ikona `icons01_004`): obnoví 15 many (ne nad maximum, při plné maně se
  nespotřebuje). Hráč dostane 50 kusů – nová hra v počátečním inventáři, starší uložené hry
  jednou při načtení (příznak `starterManaPotions`).
- Karta Inventář (`src/scenes/InventoryScene.js`, klávesa I ve světě i v interiéru, záložka
  Inventář na liště): podklad inventory.png, hover stavy z hoover-icon.png (tmavá = výchozí,
  modrá = pod myší) pro políčka, výbavu, filtry kategorií a šipky stránek. Levé tlačítko =
  detail předmětu vlevo dole, pravé = nabídka z right-click obrázků (Použít, Vybavit,
  Přesunout, Rozdělit, Zahodit; nedostupné akce ztlumené). Rozdělení s výběrem počtu,
  zahození s potvrzením, filtr kategorií, zlato.
- Ikony předmětů rozdělené na jednotlivé obrázky: `public/assets/items/icons/iconsNN_XXX.png`
  (999 ikon ze 6 listů, seznam `src/data/itemIcons.json`, nástroj `tools/split-icons.ps1`).
- Nové obrázky budov Greenvale (PNG s bílým pozadím, odstraní se při načtení): radnice,
  hostinec, rybářská chata, lovecká chata a domy A–C. `src/entities/buildingSprites.js`
  ukazuje na nové soubory místo smazaných `.webp`. Kovárna zatím zůstává na původním
  `smithy.webp`.
- Tržiště nahradily dva stánky u náměstí (východní strana, mezi náměstím a rybářskou chatou):
  „Tržiště – potraviny“ (`stallfood.png`, pole 66–69 × 58–60) a „Tržiště – zboží“
  (`stallmats.png`, pole 72–75 × 58–60, nový interiér `greenvale_market_wares`). Stará
  parcela tržiště na severovýchodě je zpět tráva, před stánky vede cesta a byly odstraněny
  stromy a keře, které by stály ve stáncích nebo před nimi.
- Karta hrdiny: ženská postava má vlastní podklad `hero_card_female.png`. Magické školy
  (`magic_school.png`) a dovednosti (`skillsset1.png`, `skillset2.png`) jsou interaktivní
  tlačítka z obrázků stavů (`src/ui/heroCard/heroButtonSprites.js`, bílé pozadí se odstraní
  při startu): první = výchozí, modrá = pod myší, zlatá = zakliknutá (vybraná), šedá = zamčená
  (zamčené školy magie; dovednost s `professions[id].locked`). Klik na školu ukáže úroveň
  a zkušenosti, ukazatel zkušeností a „Úr.“ jsou v proužku obrázku.
- Karta Party z grafiky `assets/ui/partyscene` (rozložení a výřezy v `src/ui/partyCardLayout.js`):
  podklad partyscene.png, políčka monster v partě z monsterselect.png (výchozí / hover / vybrané,
  omdlelé monstrum šedě), úschovna po dvou sloupcích s výřezy položek a šipkami, schopnosti,
  tlačítka +, Do úschovny a Propustit z partyscene-buttons.png ve stavech výchozí / hover /
  vybrané. Šedá jen u tlačítek +, když nejsou Training Points k přidělení (a u nedostupného
  přesunu mimo Lioru). Najetí na řádek statistiky ukáže geny a trénink.
- Karta Talenty z grafiky `assets/ui/Talenttree` (kopie s ASCII názvy v `assets/ui/talents`,
  rozložení v `src/ui/talentCardLayout.js`): barevný obrázek karty jako podklad, zamčené
  a neaktivní talenty, nedokončené závěrečné talenty a zamčené stromy jsou výřezy ze šedé
  verze. Modrý rámeček = talent pod myší, zlatý = talent s přidělenými body (a hlavička
  hlavní specializace). Přidělené hodnosti se vybarví na namalovaných kosočtverečcích;
  volné body vedle „Volné body:“, body stromu a stav v hlavičce sloupce, tlačítko Zvolit,
  „brzy“ u talentů čekajících na systém. Zavřít a horní lišta používají obrázky stavů přes
  namalované prvky.
- NPC Liora a starosta Edric (`src/entities/npcSprites.js`): vlastní pixelové postavy ve
  velikosti hrdiny se jménem nad hlavou. Liora v hostinci léčí partu i úschovnu a umožní
  přesun monster; starosta na radnici (dříve „Rychtář Edric“) ukazuje „!“ (nový úkol)
  a „?“ (splněno, vrať se). Výzva „E: mluvit / prohlédnout / odejít“ nad hrdinou.
- Interiéry (`src/scenes/InteriorScene.js`) překreslené pro 1920 × 1080 (dřív 640 × 360):
  stěna s trámy, podlaha z prken, nábytek s kolizí, velké okno rozhovoru.
- Úkol Jeskynní sliz (`src/systems/QuestSystem.js`): zadá ho starosta, u vchodu do jeskyně
  ve světě (E) začne souboj s bossem Jeskynní sliz (nový druh `cave_slime`, Earth). Po návratu
  ke starostovi se odemknou talentové stromy (volba specializace) a cesta do Verdant Forest.
  Stav úkolu vychází z dosavadních příznaků lovecké zkoušky, starší uložené hry pokračují.
- Záložka Úkoly na kartě hrdiny ukazuje přijaté úkoly; nástěnka na radnici zná stav úkolu.
- Horní lišta karet i na kartách Talenty a Party (`src/ui/cardTabBar.js`): stejné obrázky
  stavů a stejné místo jako na kartě hrdiny – klid, zlatá pod myší, modrá aktivní karta.
  Klik přepne kartu (Hrdina / Talenty / Party); záložky bez vlastní karty (Inventář, Řemesla,
  Bestiář, Mapa, Úkoly) otevřou kartu hrdiny rovnou na dané záložce. Obsah obou karet je
  posunutý pod lištu, hlášky jsou vlevo dole.
- Karta Party (`src/scenes/PartyScene.js`, klávesa P ve světě i v interiéru, záložka Party
  na kartě hrdiny) ve stylu karty hrdiny pro 1920 × 1080: aktivní parta (4 místa s modelem,
  HP, Bondem a bojovou připraveností), úschovna se šipkami, detail monstra (druh, element,
  úroveň, statistiky s geny a tréninkem, Training Points po jednom, schopnosti s použitím,
  historie), propuštění s potvrzovacím oknem (poslední monstrum party nejde propustit
  ani uložit). Přesun mezi partou a úschovnou jen u Liory v hostinci; jinde se úschovna
  jen prohlíží. Společné prvky karet v `src/ui/fantasyCard.js`.
- Liora léčí i monstra v úschovně.
- Talentové stromy Souboj, Řemesla a Kouzelník (`src/data/talents.js`, pravidla v
  `src/systems/TalentSystem.js`): 5 hodností po 1 bodu, stupně po 0/5/10/15/20 bodech,
  nejvýš 30 bodů do stromu, závěrečný talent automaticky po 30 bodech, ostatní stromy
  zamčené do dokončení hlavního. Specializaci jde zvolit po lovecké zkoušce
  (`greenvaleHunterPermitGranted`); jediný aktivní pasivní bonus je bonus hlavní cesty.
  Řemeslník dostane při volbě základní recepty (`state.knownRecipes`).
- Účinky v boji: velitelské bonusy z rozkazů a Dračí taktiky, % poškození a odolnosti
  (formace, Zocelená družina, pasivní bonusy Souboje a Kouzelníka), Lovec příležitostí,
  Vůdce smečky (Tempo), Nezlomné velení (snížení šance na stavový efekt). Kouzla:
  Spell Power z talentů, sleva na manu (min. 1 MP), bonus zkušeností škol, Elementární
  soustředění (zvolená škola), Dračí arkanista. Rozšířená mana zvýší maximum i aktuální manu.
  Talenty Řemesel a Kouzelník IV jdou koupit, ale účinek začne až se systémy řemesel,
  magických kamenů a rozkladu předmětů (karta je označuje „čeká na systém“).
- Karta Talenty (`src/scenes/TalentScene.js`, klávesa T, záložka Talenty na kartě hrdiny):
  tři stromy, volné a utracené body, volba specializace s potvrzením, nákup hodností
  kliknutím, tooltip s důvodem, proč talent nejde koupit, výběr školy pro Elementární soustředění.
- Karty C (hrdina) a T (talenty) jdou otevřít i v interiéru; interiér se mezitím pozastaví.
- Rychlost, Štěstí a Charisma hrdiny (`src/systems/HeroStatsSystem.js`): nový hrdina má 1,
  starší uložené hry se doplní. Rychlost zrychluje chůzi po mapě (+2 % za bod nad 1,
  nejvýš +50 %) a přičítá se k ní pasivní bonus monster v aktivní partě
  (`HERO_SPEED_BONUS_BY_SPECIES` / `monster.heroSpeedBonus`, zatím prázdné).
  Pro Štěstí a Charisma jsou připravené výpočty (vzácná setkání, sleva), použijí je
  budoucí systémy. Karta hrdiny ukazuje skutečné hodnoty místo „—“.
- Postupné odemykání škol magie (`MagicMasterySystem.js`: `unlockMagicSchool`,
  `isMagicSchoolUnlocked`, událost `magic-school-unlocked`). Nový hrdina má jen Air;
  zamčená škola nezískává zkušenosti, její kouzla nejsou v boji a na kartě je ztmavená
  s nápisem Zamčeno. Starší uložené hry: odemčené jsou školy s úrovní nad 0.
- Hratelná verze online přes GitHub Pages: `.github/workflows/deploy.yml` po každém nahrání
  do větve `main` hru sestaví a zveřejní. Hra má relativní cesty (`base: './'` ve Vite,
  obrázky jako `assets/...`), takže běží i z podadresáře `/dragon-souls/`.
- Vytvoření postavy po kliknutí na „Nová hra“ (`src/scenes/CharacterCreateScene.js`,
  grafika z `Dragon_Souls_Character_Select_Assets` v `public/assets/ui/character-select/`):
  jméno (psaní z klávesnice včetně diakritiky, nejvýše 20 znaků, bez jména nejde pokračovat),
  volba muž / žena (kliknutím nebo šipkami; neaktivní avatar je šedý), tlačítko Potvrdit
  se stavem pod myší, Esc / „Zpět do menu“. Podkladem je tabulka
  `public/assets/ui/character-select/name-panel.png` (rám s drakem a polem pro jméno).
  Obrázky se při načtení čistě ořežou: zůstane jen hlavní tvar a jeho záře, zbytky
  sousedních obrázků ze spritesheetu zmizí. Pohlaví se ukládá do `state.gender`.
- Ženská postava: `public/assets/hero/hero-female-walk.png` (přebaleno z
  `hero-female-walk-source.png` nástrojem `tools/repack-sprite.ps1`, okraj pod nohama 6 px).
  Podle `state.gender` se použije ve světě, v interiérech a v souboji (Arion i portrét
  v panelu velitele). Portrét na kartě hrdiny je zatím namalovaný mužský.
  Na obrazovce tvorby postavy nejsou popisky Muž/Žena – volí se tlačítky se symboly.
- Při vývoji (`npm run dev`) je hra v konzoli prohlížeče dostupná jako `window.game`
  (pro ladění; v sestavené verzi není).

### Opraveno (karty)
- Karty otevřené z interiéru byly schované pod interiérem (pořadí scén) – karta se teď
  vždy přesune navrch.
- ESC, které zavřelo kartu v interiéru, hned poslalo hru i do menu – interiér teď chvíli
  po návratu z karty klávesy ignoruje.

### Opraveno (tvorba postavy)
- V interiérech byla postava vždy mužská – interiér nepředával postavě zvolené pohlaví.
- Nový vzhled a ovládání souboje (`src/scenes/Battlescene.js`, `src/battle/`):
  - Perspektivní pohled na mřížku 10 × 8 (`BoardProjection.js`), kulisa louky u jeskyně
    Greenvale malovaná kódem (`backdrops.js`, další lokace se přidají do `BACKDROPS`),
    poletující pyl, kameny a tůňka jako překážky.
  - Provizorní vektorové modely monster podle druhu a elementu (`monsterModels.js`),
    Arion stojí vlevo u bojiště, aura ukazuje připravené kouzlo.
  - Lišta akcí dole: schopnosti monstra (klávesy 1–6) + Kouzla (Q), Odchyt (C), Čekat
    (mezera), Útěk (F, 70 %). Obrana se nezobrazuje, kód zůstal.
  - Na začátku tahu je vidět dosah pohybu (tyrkysová pole). Pohyb i útok ukončí tah,
    Čekat tah přeskočí. Nepřítel v dosahu všech útočných schopností svítí červeně,
    jen některých oranžově.
  - Kliknutí na nepřítele otevře nabídku útoků (schopnosti monstra a Arionova kouzla,
    mimo dosah zašedlé); nic se nepoužije automaticky. Tlačítko schopnosti na liště
    jen ukáže její dosah.
  - Kliknutí na vlastní monstrum otevře podpůrná kouzla (a léčivé/posilující schopnosti).
  - Pořadí tahů, panel velitele s manou, záznam boje, tooltipy, plovoucí čísla, výsledek boje.
- Podpůrná kouzla: Zadní vítr (vzduch), Léčivý pramen (voda), Kamenná kůže (země),
  Požehnání (světlo) – mistrovství 1. Kouzla, na která má hrdina mistrovství, se při načtení
  hry doplní do Spellbooku.
- Vstup do boje: náhodné setkání na tmavé louce (po 8–18 polích), klávesa B spustí testovací souboj.
- Vesnice ožila doplňky z `public/assets/objects/greenvale-objects.webp`:
  ploty kolem obytných parcel (domy, kovárna, lovecká chata, rybářská chata; mají kolizi,
  u cest zůstávají průchody), keře a kytky na zahrádkách a kolem náměstí, rákos u pobřeží,
  kapradí, jetel, pařezy a kmeny v lesích, rozcestník u náměstí. Doplňky jsou v mapě
  v seznamu `decor` (generátor, oddíl 8).
- Jeskyně má obrázek vchodu (na poli `C`, ústím ke kameře).
- Smrky (`S`, „Smrk“): lemují tmavou louku (zóna setkání) a občas rostou v lesích.
- Pobřeží ostrova podle referenční mapy: `tools/greenvale-coast-128.txt` je pobřeží změřené
  z `greenvale-map.png` v dvojnásobném rozlišení (`map-from-reference.ps1 -Tiles 128 -WorldWidth 7680`).
  Kde obrázek končí, je okraj zvlněný šumem. Malé ostrůvky z reference zůstaly.
- Interaktivní karta hrdiny (klávesa C ve světě; zavírá C, ESC nebo tlačítko Zavřít).
  Podkladem je schválená grafika `public/assets/ui/hero/hero_card.png` (z prototypu
  `Dragon_Souls_Hero_Test`), interaktivní prvky jsou samostatné vrstvy nad ní ve
  stejných souřadnicích 1536 × 1024, karta se škáluje s rozlišením. Svět je při otevřené
  kartě pozastavený.
  - 8 záložek (Hrdina, Talenty, Party, Inventář, Řemesla, Bestiář, Mapa, Úkoly), vždy jedna
    aktivní, přepínání i klávesami 1–8. Ostatní záložky zatím ukazují „připravuje se“
    ve stejně velkém rámu.
  - Stavy tlačítek: klid, pod myší zlatá záře, aktivní jasně modrá, nedostupné šedé,
    fokus bílý obrys (Tab / Shift+Tab, Enter).
  - Horní lišta z listu `Herní navigační lišty v různých stavech.png`
    (kopie `public/assets/ui/hero/tab-states.png`): 1. řádek = záložka v klidu,
    2. řádek = pod myší (zlatá), 3. řádek = aktivní karta (modrá). Tlačítko Zavřít
    ze souboru `Čtyři stavy fantasy tlačítka Zavřít.png` (kopie `close-states.png`):
    klid / pod myší / stisk / nedostupné. Výřez a odstranění bílého pozadí při načtení
    v `src/ui/heroCard/tabSprites.js`.
  - Záložka Hrdina: jméno, úroveň, ukazatele zkušeností a many, Intelekt, Spell Power,
    Rychlost, Štěstí, Charisma (poslední tři „—“, dokud je hra nemá), velitelské
    statistiky, 6 magických škol (úroveň a postup), zlato, oblast, magické kameny.
  - 8 slotů vybavení s výběrem, tooltipem a rámečkem podle vzácnosti; čtou společný
    stav `state.equipment` (`src/systems/EquipmentSystem.js`, událost `equipment-changed`).
  - 8 tlačítek dovedností – vysílají událost `hero-skill-selected` (řemesla zatím nejsou).
  - Kód: `src/scenes/HeroScene.js` (karta), `src/ui/heroCard/` (rozvržení, FantasyButton,
    záložky, panely, vybavení, dovednosti, tooltip).
- Ostrov Greenvale zvětšený na dvojnásobek (mapa 115 × 120 polí) generátorem
  `tools/greenvale-generate.mjs` (zdroj `tools/greenvale-base.js`, náhled `tools/greenvale-preview.png`):
  přirozeně zvlněné pobřeží s útesy proměnlivé tloušťky, budovy rozestoupené na původních
  místech, parcely kolem budov, cesty ode dveří, rovný most na jih, skalní masiv u jeskyně.
- Zóna setkání: tmavá louka u jeskyně (znak `,`, „Louka (setkání)“), rozšířená, jediná souvislá.
- Stromy (`T`) a skály (`R`) rozmístěné náhodně ve shlucích, vykreslené jako objekty
  z `public/assets/objects/greenvale-objects.webp` (8 stromů, 9 skal; `src/entities/objectSprites.js`).
- Molo (`D`) od rybářské chaty do vody.
- Terén z izometrických dlaždic v `public/assets/objects/` (`src/world/terrainTiles.js`):
  tráva (10 variant, převážně čisté), tmavá zóna setkání (7 variant), parcely, hliněné cesty,
  dlažba, voda a útesy nad vodou. Vykreslení ve dvou vrstvách (voda, pak souš odzadu dopředu),
  bloky 16 × 16 polí se kreslí jen v záběru kamery. Most, molo, jeskyně a vodopád zatím ploše.
- V zóně setkání jen pár stromů a kamenů (6 stromů, 1 kámen uvnitř).
- Vesnice Greenvale rozložená podle referenčního obrázku: mapa 64 × 64 polí s ostrovem,
  útesy, loukou u jeskyně, náměstím, 7 parcelami s budovami, cestami a mostem na jih.
  Vygenerováno nástroji `tools/map-from-reference.ps1` (pobřeží a terén podle barev)
  a `tools/greenvale-layout.mjs` (ručně zadané náměstí, parcely, cesty, most, budovy).
  Referenční obrázek (R) sedí přesně pod mapou.
- Rozhraní (popisky ovládání, ladicí údaje) má vlastní kameru, při zoomu se nehýbe.
- Hlavní menu: nový úvodní obrázek (`public/title-background.webp`) a grafická tlačítka
  z `public/assets/ui/menu-buttons.webp` (Nová hra, Pokračovat, Nahrát hru, Uložit hru).
  V klidu modrá, pod myší zlatá, nedostupná ztlumená. Obrázek tlačítek se při načtení
  rozřeže automaticky (`src/ui/menuButtons.js`), stačí ho vyměnit za nový se stejným rozvržením.
- Izometrický svět (kamera z jihovýchodu, pole 128 × 64 px): `src/world/iso.js`
  promítá logickou mřížku do izometrie. Mapa v textu, kolize, vchody a uložené
  pozice zůstaly na logické mřížce 64 jednotek na pole.
- `src/entities/WorldHero.js`: hrdina ve světě = neviditelné fyzikální tělo na logické
  mřížce + viditelný sprite promítnutý do izometrie. Pohyb WASD odpovídá směrům
  na obrazovce (W = severozápad), řazení do hloubky podle polohy nohou.
- Budovy se kotví na přední (jihovýchodní) roh půdorysu, šířka podle izometrického půdorysu.
- Ladicí režim (G) a referenční mapa (R) v izometrii.
- Laboratoř terénů: přepínač pohledu (izometrický / čtvercový) a typ obrázku
  (opakovatelná textura shora, která se promítne do izometrie, nebo hotová
  izometrická dlaždice 2 : 1).
- Laboratoř terénů (`lab.html`, `src/lab/lab.js`): samostatné okno mimo hru.
  Zobrazuje jen hrdinu na gridu 64 px. Do okna jde přetáhnout textury terénu,
  nastavit, kolik polí jedna kopie pokryje, malovat je do polí, měnit výšku hrdiny,
  zoom, mřížku a vyhlazování. Tlačítkem jde zkopírovat nastavení.
- Budovy ve světě používají skutečnou grafiku. Bílé pozadí se odstraní automaticky
  při načtení (`src/entities/buildingSprites.js`).
- `vite.config.js`: sestavení obou stránek a vyřazení složek `archiv` a `tools` z hlídání.

### Opraveno
- Názvy souborů sedí s importy i na Linuxu (GitHub): `BattleScene.js`, `SaveSystem.js`,
  `HeroProgressionSystem.js` (dřív `Battlescene.js`, `Savesystem.js`, `HeroProgressionSystem.js.js`).
  Kontrola: `node tools/check-import-case.mjs`.
- Po druhém a dalším souboji se boj nedal ukončit: Phaser používá stejnou instanci scény
  a příznak odchodu z minulého boje zůstal nastavený. Scéna souboje teď na začátku
  každého boje vynuluje všechny příznaky.

### Změněno
- Názvy elementů jsou sjednocené se školami magie: Air, Water, Fire, Earth, Light, Dark
  (dřív Flame, Stone, Shadow, Astral) + Verdant jako element monster bez školy. Upravená
  data monster a schopností, kruh výhod i tabulky schopností; staré názvy fungují jako aliasy.
- HP hrdiny je skryté v celé hře (léčitelka už nemluví o zdraví hrdiny); v uložené hře zůstává.
- Stromy rostou v hustých lesících, mimo ně jen jednotlivě; stromy mají různé velikosti
  (0,7× až 1,35×) a zrcadlí se. Mapa 114 × 122 polí, `WORLD_LAYOUT_VERSION` 7
  (uložená pozice se přesune na start).
- Nová hra má v uložení prázdné sloty vybavení (`equipment`), starší uložení se doplní.
- Tlačítka dovedností 2.–4. sloupce jsou na kartě o ~10 px vpravo oproti zadání
  (X 291 / 484 / 675), aby seděla na namalovaná tlačítka.
- Výška hrdiny je jedno nastavení `HERO_DISPLAY_HEIGHT` v `heroSprite.js`.
- Pole mapy jsou jen logika (kolize) a plochá barva.

### Odstraněno
- Všechny textury terénů (`public/assets/terrain/`) a jejich načítání v BootScene.
- Rozpracované prolínání terénů (`src/world/TerrainRenderer.js`).
- Nepoužívaný `src/data/greenvaleLayout.js`.

---

## Verze 0 – 2026-11-21

Výchozí archivovaný stav hry.

### Stav hry
- Phaser 3 + Vite, rozlišení 1920 × 1080.
- Hotové herní systémy: tahový boj na mřížce s iniciativou, výpočet poškození,
  AI nepřátel, příšery a jejich schopnosti, poutání příšer, živly, stavové efekty,
  kouzla a mistrovství magie, talenty, trénink, postup hrdiny, oblasti a cestování,
  ukládání hry.
- Scény: úvodní menu, svět, boj, družina, bestiář, kniha kouzel, hrdina, interiéry.

### Přidáno
- Grid světa: čtvercová pole 64 × 64 px. Mapa je zapsaná jako text
  (`src/data/maps/greenvale.js`), typy polí jsou v `src/data/tiles.js`.
- Vesnice Greenvale na mřížce 60 × 34: ostrov s útesy, náměstí, cesty, 9 parcel s budovami,
  most přes řeku, jeskyně, vodopád.
- Kolize podle typu pole (voda, útesy, stromy, vodopád) a podle půdorysu budov.
- Vstup do budov klávesou E u dveří (napojeno na existující interiéry).
- Ladicí režim (G): mřížka, souřadnice pole pod myší, kolize, dveře a zajímavá místa.
- Průhledný referenční obrázek původní mapy (R).
- Nástroj `tools/repack-sprite.ps1` pro přebalení spritesheetů do pravidelné mřížky.

### Změněno
- Svět místo jednoho velkého obrázku vykresluje Phaser tilemapa.
- Načítání a animace hrdiny se přesunuly do BootScene (sdílí je svět i interiéry).
- Hrdina se ve světě vykresluje ve výšce 112 px a jeho pozice odpovídá bodu u nohou.

### Opraveno
- Spritesheet hrdiny byl rozřezaný špatně (snímky se posouvaly). Je přebalený
  na pravidelnou mřížku 192 × 256 px, originál zůstal v `hero-walk-source.png`.
- Při chůzi na západ se hrdina díval na východ. Západní směry teď vznikají zrcadlením.
- Kolizní obdélník hrdiny je u nohou a odpovídá jeho velikosti.

### Grafika
- Dlaždice světa i budovy jsou zatím provizorní (barevné bloky).
- Původní obrázky budov mají bílé pozadí a zatím se nepoužívají.

### Známé problémy
- Chůze, kolize a ladicí režim ve světě nebyly po přestavbě úplně proklikané.
- Importy `BattleScene.js` a `SaveSystem.js` nesedí velikostí písmen s názvy souborů
  (`Battlescene.js`, `Savesystem.js`). Na Windows to funguje, na webovém serveru to spadne.
- Soubor `HeroProgressionSystem.js.js` má zdvojenou příponu.
- `src/data/greenvaleLayout.js` už se nepoužívá (nahradila ho nová mapa).
