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
- Hratelná verze online přes GitHub Pages: `.github/workflows/deploy.yml` po každém nahrání
  do větve `main` hru sestaví a zveřejní. Hra má relativní cesty (`base: './'` ve Vite,
  obrázky jako `assets/...`), takže běží i z podadresáře `/dragon-souls/`.
- Vytvoření postavy po kliknutí na „Nová hra“ (`src/scenes/CharacterCreateScene.js`,
  grafika z `Dragon_Souls_Character_Select_Assets` v `public/assets/ui/character-select/`):
  jméno (psaní z klávesnice včetně diakritiky, nejvýše 20 znaků, bez jména nejde pokračovat),
  volba muž / žena (kliknutím nebo šipkami; neaktivní avatar je šedý), tlačítko Potvrdit
  se stavem pod myší, Esc / „Zpět do menu“. Zbytky sousedních obrázků z původního
  spritesheetu se při načtení ořežou. Pohlaví se ukládá do `state.gender`;
  postava ve světě a portrét na kartě jsou zatím jen mužské.
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
  - Aktivní záložka je podbarvená modře obrázkem ze 3. řádku listu
    `Herní navigační lišty v různých stavech.png` (kopie `public/assets/ui/hero/tab-states.png`,
    výřez a odstranění bílého pozadí při načtení v `src/ui/heroCard/tabSprites.js`).
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
