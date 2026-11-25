# AURION: LEGACY OF SOULS – historie verzí

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
- **Nové UI všech karet** z rozdělené sady `newui` (`src/ui/newUiKit.js`): při startu hry se z dílů
  přes 9-slice sestaví podklady karet Hrdina (muž i žena), Talenty (barevná i šedá verze), Party
  a Inventář – panely, štítky s nadpisy, popisky a ikony na stejných místech jako dřív, takže
  logika karet zůstala. Ze stejných dílů jsou stavy prvků: záložky s ikonami (modrá / světle
  modrá pod myší / zlatá aktivní), červené Zavřít, magické školy, dovednosti, sloty výbavy,
  políčka a kategorie inventáře, tlačítka a políčka karty Party, rámečky talentů.
  Rám karty, tlačítka a potvrzovací okna ostatních oken (mapa, výroba, obchody, rybolov, těžba,
  kořist) používají nové díly přes `nineImage` v `ui/fantasyCard.js`.
- Chybějící prvky ze starého UI vyříznuté do `public/assets/ui/legacy` (`tools/extract-legacy-ui.ps1`):
  portréty a postavy hrdiny / hrdinky, obrázek oblasti, postava inventáře, šipky stránek,
  30 ikon talentů; nabídka pravého tlačítka v inventáři zůstává ze starého UI.
- Staré nepoužívané UI (podklady karet, listy stavů, zdrojové obrázky) je ve složce
  `public/assets/ui/_stare`.
- Úvodní pozadí se načítá z nového `title-background.png` (dřív `.webp`, které už ve složce není).

- Nová sada UI z `public/assets/ui/newui` rozdělená na samostatné obrázky s průhledným pozadím
  (`public/assets/ui/newui/split/…`): tlačítka (modré, modré pod myší, zlaté, šedé, červené),
  rámečky ikon, rámečky karet (velká karta, panel, bublina nápovědy, slot) a 54 ikon karet.
  Nástroj `tools/split-newui.ps1` (bez `-Force` nepřepíše ručně upravené soubory), seznam dílů
  s rozměry a místem pro popis je v `src/data/newUi.json`. Ve hře se zatím nepoužívají.
  Bublina nápovědy (`card_tooltip.png`) má poloprůhledné tmavě modré pozadí a odlesky rámu
  přebarvené z bílé do zlata. Tlačítka, rámečky ikon a ikony jsou bez bílého lemu na hranách
  (`tools/defringe-newui.ps1`), hrad je vyříznutý kruhovou maskou. Návrh karty hrdiny z nové sady: artefakt „Nové UI karty hrdiny“.
- Kovářství podle schváleného návrhu „Kovářství – návrh systému“ (`src/data/smithing.js`,
  `src/systems/SmithingSystem.js`, okno Kovářství se stejným ovládáním jako Vaření a Alchymie):
  - 112 receptů v pěti kategoriích (zbraně 28, zbroje a štíty 28, nástroje 20, výztuhy 16,
    vzácné a elementálně kalené 20) a 19 mezivýrobků (tavení rud na ingoty, ocel, černá ocel,
    mithril, adamantit, orichalk, hvězdný kov, dračí železo; měděný drát, rybí šupinová destička,
    korálová výztuha, hlubinná šupinová vrstva). Dovednost Kovářství 1–100 na kartě hrdiny.
  - Výheň v kovárně Greenvale (dočasně umí všechny recepty, E vpravo vedle Hornického mistra).
    Kvůli testování jsou známé všechny recepty.
  - **Výbava hrdiny začala působit** jako velitelský bonus všem monstrům v partě: zbraň, štít,
    přilba, zbroj, holenice a boty dávají % k útoku, magickému útoku, obraně, magické odolnosti,
    rychlosti a max. HP, kalené kusy odolnost proti elementu nebo sílu elementálních útoků.
    Výbava + výztuha nejvýš +50 % na hodnotu; Řemeslník ×1,2. Souhrn ukáže tooltip slotu výbavy.
  - Výztuhy (brousek, nýty, šupinové záplaty, kalení, runy…) z inventáře na počet soubojů,
    aktivní je jedna (nahrazení se potvrzuje).
  - Krumpáče, těžební nástroje a kovové části rybářského náčiní jdou vykovat; nové Bylinkářský
    a Stříbrný bylinkářský srp (účinek doplní Sběr bylin).
- Rybolov: tři šupiny pro Kovářství – Odolná rybí šupina (řeky a jezera, Rybolov 10+),
  Mořská pancéřová šupina (moře, 30+) a Hlubinná magická šupina (hlubiny a magické vody, 50+).
- Okna Vaření, Alchymie a Kovářství listují dlouhé kategorie po 16 receptech (◀ ▶ nebo kolečko).
- Těžba podle schváleného návrhu „Těžba – návrh systému“ (`src/data/mining.js`,
  `src/systems/MiningSystem.js`, `src/scenes/MiningScene.js`, `src/scenes/MiningShopScene.js`):
  - Dovednost Těžba 1–100 v šesti třídách (Začátečník až Legendární horník), stejná křivka
    úrovní jako Rybolov. XP = (15 + 4 × úroveň naleziště) × vzácnost, první vytěžení ×2,
    naleziště 20+ / 40+ úrovní pod hráčem ×0,5 / ×0,2.
  - 40 surovin (rudy, drahokamy, elementální krystaly, krystalické minerály, pomocné materiály),
    39 běžných nalezišť a 4 speciální (Krystalová geoda, Runové ložisko, Žhavé rudné ložisko,
    Hvězdný meteorit jednou za 24 h). Měděná a Železná ruda, Astrální střep, Sůl,
    Křišťálový střep a Hvězdný prach zůstávají stejným předmětem s novým zdrojem.
  - Bez minihry: E u naleziště (hnědý kruh, speciální fialový) → okno naleziště se surovinami
    a šancemi → Těžit (ukazatel 3–8 s) → okno kořisti. Vytěžené naleziště zešedne a obnoví se
    za 5 min / 15 min / 45 min / 3 h podle vzácnosti (speciální 6–12 h), i mimo hru.
  - Výtěžnost 2–4 / 1–3 / 1–2 / 1 ks, vedlejší nález 12–20 %, šance na +1 kus z lepšího
    krumpáče, talentu a nástrojů; vzácné nálezy (Starodávná důlní mapa, Zapomenutá truhla
    horníka, Prastarý runový úlomek, Neopracovaný drahokam, Zlomek meteoritu, Důlní relikvie).
  - Šest krumpáčů a osm doplňkových nástrojů (kladivo, klín, kleště, majzlík, podpěra, vrták,
    astrální kladivo, ochranné kleště). Mapa odhalí Skrytou žílu na 30 min, otevře ji podpěra.
  - Hornický mistr v kovárně Greenvale: daruje Základní důlní krumpáč, prodává krumpáče I–III
    a Důlní podpěru (dokud je nevyrábí Kovářství), vykupuje suroviny z Těžby a od Těžby 25
    nastaví specializaci (Hlubinný horník, Hledač drahokamů, Průzkumník nalezišť; změna 250 zl).
  - Dočasně jsou všechna naleziště ve „zkušebním lomu“ na trávě jižně od kovárny Greenvale.
- Mapa světa: Průzkumník nalezišť vidí místo dopadu Hvězdného meteoritu.
- Alchymie podle schváleného návrhu „Alchymie – návrh systému“ (`src/data/alchemy.js`,
  `src/systems/AlchemySystem.js`, okno Alchymie se stejným ovládáním jako Vaření):
  - 108 receptů v pěti kategoriích (léčení a mana 25, protijedy a ochrana 18, bojové elixíry 20,
    katalyzátory a směsi 25, průzkum 20) a 12 mezivýrobků (rybí a hlubinný olej, vodní a hlubinné
    extrakty, jedový, duchovní, astrální a měsíční koncentrát…). Toniky a protijed zůstaly.
  - Alchymistický stůl u Liory v hostinci (dočasně umí všechny recepty). Dovednost Alchymie
    1–100 na kartě hrdiny. Kvůli testování jsou známé všechny recepty.
  - Souboj: nová akce **Předmět** (klávesa X) – léčivé lektvary a mana, regenerace za tah,
    protijedy, oživení, elixíry, ochrany a vrhací směsi (jed, oheň, mráz, uspání). Zabere tah.
  - Elixíry (jeden najednou) a ochrany (imunity, odolnost proti elementům) platí počet soubojů;
    bonus jídla a elixíru na stejnou statistiku je nejvýš +25 %.
  - Průzkumné přípravky: odpuzovač / lákadlo / neviditelnost (náhodná setkání), rychlost pohybu,
    rybolov (čekání, hlubinné a vzácné úlovky), drop, ochočení, zkušenosti monster, důvěra,
    jistý útěk, zkušenosti výrobních profesí. Svítící olej, sběračský extrakt, horníkův lektvar,
    proutkařův olej a teleportační prach jdou vyrobit, účinek přibude s jejich systémy.
- **Testovací hra** (tlačítko na obrazovce tvorby postavy): hrdina na úrovni 100 s plnými
  talentovými body, všechny školy magie na úrovni 4 a všechna kouzla, všechny profese na 100,
  suroviny a mezivýrobky na každý recept Vaření, Alchymie a Kovářství (po 99 ks), všechny pruty,
  kovové části, krumpáče a nástroje, návnady, 100 000 zlata a Dire Wolf na úrovni 100
  s 510 tréninkovými body. Inventář má tolik stránek, kolik je potřeba.
- Načtení hry dovolí nejvýš 510 volných tréninkových bodů monstra (dřív 100); počet stránek
  inventáře se řídí počtem slotů.
- **Nové ikony předmětů** ze čtyř listů v `assets/items` (271 ikon, `icons07`–`icons10`):
  alchymistické mezivýrobky a esence, 36 materiálů z dropů, 25 ryb, lastury, perly, korály,
  návnady, pruty a kovové části, všech 53 předmětů Těžby a 76 kusů kované výbavy (stupeň podle
  úrovně výroby, elementální kusy v barvě prvku). Lín a Korálovka sdílí ikonu podobné ryby.
  Nástroje `tools/split-icons-blobs.ps1` (velké ikony bez mřížky) a `tools/split-icons-grid.ps1`
  (list s mřížkou, i otvory v prstenech a řetízcích).
- **Simulace souboje**: na začátku každého boje panel s nepřáteli, porovnáním sil (průměrné
  poškození za kolo, HP, zbroj a vůle) a šancí na výhru. Volby Bojovat (Enter), Simulovat (S)
  a Útěk (F). Simulace počítá techniky monster, přesnost, elementy, odolnosti, talenty, výbavu,
  jídlo a elixíry, ne Arionova kouzla; hráčova monstra mají nevýhodu 20 %. Šance = 400 náhodných
  průběhů, výsledek rozhodne další průběh. Výhra dá polovinu EXP a kořisti, monstra přijdou
  o HP a použití technik podle průběhu; prohra = běžná porážka. Útěk před bojem má stejnou
  šanci jako v boji; při neúspěchu boj nezačne, ale monstra v partě ztratí polovinu HP.
  Systém: `src/systems/BattleSimulationSystem.js`.
- **Vesnice Greenvale podle referenčního obrázku** (první návrh, skript
  `tools/greenvale-village.mjs`, náhled `tools/greenvale-village-preview.bmp`): kompaktní
  vesnice kolem dlážděného náměstí s kašnou, cesty ve vesnici dlážděné stejně jako náměstí.
  Radnice s nástěnkou na severu, za ní dům a hvězdárna v lese, tržiště a stánky kolem
  náměstí, kovárna, sklad, hostinec a alchymista na východě, domy, kostel a lovecká chata
  na západě. Budovy mají mezi parcelami víc místa. Řeka od vodopádu pod skalami obtéká
  vesnici jihem, u ní rybářská chata s molem a rybářskými místy, kamenný most na cestě
  k jižní bráně. Za mostem statek: dům, větrný mlýn, studna, stáj a tři ohrazená pole
  (pruhy obdělané půdy – později bylinky), polní cesty. Kolem les. Zkušební lom je za
  mostem na jihozápadě.
  Louka setkání, jeskyně a jih s bránou se nezměnily. Uložená pozice se kvůli nové mapě
  jednou vrátí na start (WORLD_LAYOUT_VERSION 8).
- Vesnice – rozmístění z editoru terénu: posuny budov (a měřítko radnice 0,44, nástěnky 0,52,
  kostela 1,12) jsou přepočítané na pole mapy (`tools/greenvale-editor-export.json`). Terén
  se budovám přizpůsobí – pod budovou na útesu nebo u moře vznikne pevnina s novým útesem,
  parcely vyčistí louku i stromy; cesty, dlažba, ploty a les se přegenerují k novému
  rozložení. Vrátka pole u řeky jsou na jižní straně.
- **Sběr bylin** podle schváleného dokumentu „Sběr bylin – návrh systému“ (`src/data/herbalism.js`,
  `src/systems/HerbalismSystem.js`): 16 rostlin v 6 vzácnostech, úroveň 1–100 v šesti třídách,
  XP podle vzácnosti a úrovně rostliny (brzda proti farmení, herbář = bonus za první sběr).
  Bez minihry: E u zeleného kruhu → okno naleziště (rostlina, výtěžnost, vedlejší rostlina,
  vzácné nálezy, srp) → Sbírat (1,5–5 s) → okno kořisti. 19 nalezišť, 3 záhony statku
  (obnova 10 min, poloviční XP, osetí Vzácnými semeny) a 4 speciální naleziště (hustý porost,
  skryté lesní – odhalí Botanický zápis, magická zahrada, prastaré s Astrální orchidejí).
  Dočasně jsou všechna v Greenvale: louka, břeh řeky, vodopád, les, záhony statku a bylinková
  zahrada vedle zkušebního lomu. Srpy z Kovářství: Zahradnický (3), Mistrný (26), Sběrač bylin
  s mosaznou čepelí (50), Mithrilový (68), Hvězdný (88). Šest vzácných nálezů s využitím
  v Alchymii, Vaření a Kovářství. Bylinkářka (dům s bylinkovou zahrádkou): startovní srp
  a byliny, omezená denní zásoba běžných bylin, výkup za polovinu ceny (hledaná bylina ×2)
  a tři specializace od úrovně 25. Karta hrdiny: třída, herbář, specializace.
- Alchymie a Vaření podle kapitoly 14 návrhu: Měsíční květ má v nízkých receptech náhradu
  (Vodní květ, kde už recept Modré byliny má; jinde Modré byliny), Lektvar proti prokletí bere
  Hořký kořen místo Stínové lilie (Čistící byliny už v receptu jsou), Stínový koncentrát je na
  úrovni 55. Pylové zrno, Vonná esence a Lesní pryskyřice jsou náhradou v receptech. Sběračský
  extrakt teď opravdu účinkuje (Sběr bylin 20 % na +1 kus, 15 min).
- **Řemeslnictví** podle dokumentu „Řemeslnictví – návrh systému“ (`src/data/crafting.js`,
  `src/systems/CraftingSystem.js`, okno `CraftingScene`): 108 receptů (A Šperky 22, B Brašny 22,
  C Fokusy a talismany 20, D Kožená výbava 19, E Soul Crystaly 5, F Ostatní 20) a 10 mezivýrobků
  (broušené drahokamy, vyčiněná kůže, pevná šňůra, jádro fokusu). Tři pracoviště: Koželužský
  stůl a Šperkařský stůl v nové Řemeslné dílně (dům u radnice) a Soul Crystal Workbench
  v Hvězdárně; recept jde vyrobit jen na svém pracovišti. Výbava dává velitelské bonusy partu
  stejně jako Kovářství (Řemeslník ×1,2), plášť se nosí ve slotu zbroje a rukavice/fokusy
  v druhé ruce. Brašny přidávají strany inventáře, cestovní předměty dávají dočasné účinky,
  výcvikové závaží +3 body, zrcadlo duše obnoví techniky. Nástroje: koželužské nože (+1 kůže),
  šperkařská lupa (25 % na +1 drahokam). Dračí recepty (Dragon Soul Crystal, plášť z dračí kůže)
  vyžadují příběhovou Dračí pečeť. Karta hrdiny ukazuje třídu a počet vyrobených receptů.
- Ochočení v souboji použije nejlepší Soul Crystal v inventáři (Ancient → Elemental → Greater →
  Basic); prastaré draky ochočí jen Dragon Soul Crystal. Tlačítko ukazuje počet všech krystalů.
- **Karta Řemesla** (`src/scenes/ProfessionsScene.js`): záložka Řemesla v horní liště, klik
  na dovednost v kartě hrdiny ji otevře na dané profesi. Vlevo 8 profesí s úrovní a Databáze.
  Přehled: úroveň, XP, třída, souhrn (recepty / lokality / herbář), kde se profese dělá,
  volba specializace Těžby a Sběru bylin, Řemeslník, aktivní účinky. Recepty: kategorie,
  filtry Vše / Lze vyrobit / Chybí suroviny / Zamčené, detail se surovinami (jen prohlížení,
  vyrábí se u stolu). Naleziště: lokality Rybolovu, Těžby a Sběru bylin s obsahem a šancemi,
  nenalezené druhy jsou „???“. Diplomacie zatím jen „připravuje se“.
- Úvodní úkoly profesí (se sledováním, značkami a odměnou zlato + zkušenosti v profesi):
  **Čistá voda** (Alchymista – 3× Čistá voda od Trhovkyně), **Kožený řemínek** (Učednice
  v kovárně – 1× řemínek od Obchodníka s látkami nebo z Řemeslnictví), **Byliny od řeky**
  (Bylinkářka – 3× Čisticí byliny z naleziště Břeh řeky). Úkol je splněný, jakmile máš
  suroviny v inventáři; zůstanou ti.
- Kruhy u vchodů jsou výraznější (záře, silný obrys, výplň, mírné pulzování) a kreslí se přes
  budovu za nimi, ale pod hrdinou – dřív je u radnice a Hvězdárny zakrýval obrázek budovy.
- Rybářská chata je o pole výš (i s dvorkem, ploty a keři), cesta vede až k jejím dveřím;
  vstup do radnice leží na dlažbě napojené na cesty. Všechny vchody jsou na cestní síti.
- Trvalé žluté kruhy před vstupy do budov s interiérem; modrý kruh tam, kde má hráč dokončit
  krok úkolu (rozhovor u cíle, návrat k zadavateli).
- Vstup do radnice je přímo před nakreslenými dveřmi (pole 60, 44); hrdina u dveří se kreslí
  před budovou.
- Nová hra začíná s prázdným inventářem (dřív 50 lektvarů many a 5 Soul Crystalů).
- Vrácené úkoly (25. 11.):
  - Talenty: Elementární soustředění se po volbě školy jmenuje podle ní (např. Ohnivé
    soustředění) na kartě i v tooltipu.
  - Karta hrdiny: tooltipy statistik ukazují „Teď“ a „Po +1 bodu“, strop (Rychlost +50 %,
    Štěstí 15 %, Charisma 25 %) a u velitelských statistik hodnotu, při které přijde další +1.
  - Úkoly: tečky sledovaného úkolu po souboji už nemizí. Zlaté „!“ / „?“ nad budovou zadavatele
    ve světě i nad postavou v interiéru (Starosta, Mág), modré „?“ tam, kde je úkolem rozhovor
    (hostinec / Bard).
  - Kolize: pole za budovami, kde by hrdinu zakryl obrázek budovy, jsou neprůchozí (podle
    průhlednosti obrázku); cesty zůstávají průchozí a budova, za kterou hrdina na cestě zajde,
    zprůsvitní. Útes uprostřed cesty před Hvězdárnou je dlažba, cesta k Rybářské chatě vede
    až ke dveřím.
  - Souboj: fyzické schopnosti mají vždy dosah 1 pole; na celou mřížku (do 5 polí plně, dál
    −70 %) jdou jen magické.
- **Souboj – zjednodušení:** schopnosti monstra už nejsou na spodní liště (zůstaly Kouzla,
  Předmět, Ochočení, Čekat, Útěk). Klik na nepřítele otevře nabídku schopností (v dosahu /
  přesun + útok / −70 % z dálky / mimo dosah) a pod ní užší fialový panel **Kouzlit**, který
  otevře **knihu kouzel**: vlevo školy magie, vpravo útočná kouzla školy – stejná kniha je
  i na tlačítku Kouzla. Kouzla hrdiny mají neomezený dosah a žádný postih.
- Pohyb + útok v jednom tahu: když je nepřítel v dosahu pohybu, monstrum k němu samo dojde
  a hned zaútočí.
- Schopnosti na dálku (dosah > 1) a magické jdou použít na cíl kdekoli na bojišti: do 5 polí
  plné poškození, dál −70 % (tooltip schopnosti na to upozorní, bez potvrzování). Platí i pro
  nepřátele.
- Nepřátelská monstra jsou agresivní: jdou k cíli a útočí, s dosahem netaktizují. Na louce
  Greenvale lze nově potkat Air Elementala (Jiskra – magický útok na dálku).
- Kolize budov podle obrázků: kolizní obdélník se při startu spočítá z obrysu spodní části
  obrázku budovy (stěny), ne z půdorysu v mapě – hrdina už neprochází zdmi (radnice měla kolizi
  jen 3×2 pole, obrázek je 2,5× širší). Pole dveří zůstává vždy volné. Stejné kolize používají
  tečky sledovaného úkolu.
- Cesty ke dveřím: dlažba u kovárny je napojená na hlavní cestní síť (byla odříznutá);
  Rybářská chata má dveře na jihozápadní straně, jak jsou nakreslené (dřív pole na východě).
- **Karta Úkoly** (`src/scenes/QuestsScene.js`, záložka Úkoly): rozklikávací seznam úkolů (popis,
  co dělat, zadavatel, odměna) a tlačítko Sledovat / Nesledovat. Sledovaný úkol vede hrdinu
  tyrkysovými tečkami ve světě (A* po mapě, cesty a dlažba mají přednost): k zadavateli, po
  přijetí k cíli a po splnění zpět k zadavateli; kroužek označí cíl. Tečky drží pole – při chůzi
  po trase se prošlá pole odmazávají, celá cesta se přepočítá jen při změně cíle nebo když hrdina
  z trasy sejde. Dokončený úkol se přestane sledovat.
- Nástěnka úkolů (radnice i nástěnka na náměstí – E) ukazuje nedokončené úkoly oblasti včetně
  nepřijatých se stejným Sledovat.
- Nový úkol **Píseň větrů**: Mág v Hvězdárně ho zadá, Bard v hostinci zazpívá Píseň větrů, Mág pak
  odemkne školu magie Vzduch a její první kouzla. Nová hra proto začíná bez odemčené magie
  (uložené hry, které vzduch už mají, ho nepřijdou).
- Karta hrdiny: bez dráčka za jménem; řádky Jméno – Mana posunuté výš, takže ukazatel many má
  odstup od spodního okraje rámečku. Najetí na statistiky ukáže tooltip jako na kartě Party:
  Spell Power (+½ k poškození kouzel), Rychlost (rychlost chůze v %), Štěstí a Charisma
  (připravené účinky, zatím se nepoužívají), Intelekt (zatím bez vlastního účinku) a velitelské
  statistiky (hodnota ÷ 5 + talenty = bonus ke statistice každého monstra v boji).
- Inventář: ikony předmětů v políčkách i ve slotech výbavy mají za sebou záři v barvě vzácnosti
  (neobvyklé zelená, vzácné modrá, epické fialová, běžné jen slabě šedá). Legendární mají
  výraznou sytě zlatou záři se zářícím zlatým prstencem.
- Karta Party: po otevření je monstrum rovnou označené (zlaté políčko) – poprvé první v aktivní
  partě, příště naposledy vybrané (pamatuje se podle monstra i po přesunech). Tooltip statistik
  už neukazuje geny ani radu k bodům, ale co statistika dělá v boji s čísly: Vitalita = HP,
  Síla / Magická síla +½ k poškození, Zbroj / Magická obrana −½ ze zásahu, Rychlost 12+ = pohyb
  3 pole, Přesnost ±0,5 % zásahu za bod proti 80.
- Talenty: strom už není omezený na 30 bodů – 30 bodů ho dokončí (závěrečný talent, otevřou se
  ostatní stromy) a další body jdou přidávat dál. Hlavička každého stromu má pod myší modrý
  rámeček a tooltip s bonusy stromu (pasivní bonus, talenty s body a hodností, závěrečný talent).
- Pohyb pod kartami: otevřená karta (Hrdina, Talenty, Party, Inventář, Řemesla, Mapa) už svět
  nepozastaví, hrdina jde ovládat šipkami / WASD i pod kartou. Ostatní akce světa (dveře, E,
  setkání, klávesové zkratky karet, kolečko) s otevřenou kartou čekají; v Databázi se WASD
  píše do hledání a hrdina stojí.
- **Písmo Lora** (Google Fonts, licence OFL) místo Georgie a Verdany v celé hře – číslice
  jsou stejně vysoké jako velká písmena, a proto lépe čitelné. Soubory jsou ve
  `public/assets/fonts` (@font-face v index.html), hra se spustí až po načtení písma.
- Šipky stránek (inventář, karta Řemesla) mají průhledné pozadí místo tmavého obdélníku.
- Karta Řemesla: tlačítko Zpět (i klávesa Enter) vrací o krok zpět v historii karty až do
  stavu při otevření (profese, záložky, recepty, předměty v Databázi). Stránkování má zlaté
  šipky jako inventář.
- Nabídka pravého tlačítka v inventáři má šestý řádek „Kde se používá“ ve stejném stylu jako
  Použít … Zahodit (dokreslený do obrázku nabídky); dřívější samostatné tlačítko je pryč.
- **Databáze předmětů** (`src/systems/ProfessionDatabase.js`): hledání psaním na klávesnici
  (bez ohledu na diakritiku), filtry Suroviny / Výrobky / Výbava / Ostatní; u předmětu odkud
  se získá (recept, rybolov, naleziště, drop z monstra, obchod) a ve kterých receptech se
  používá. Klik na recept nebo surovinu skočí dál. V inventáři je pod nabídkou pravého
  tlačítka nové tlačítko „Kde se používá“.
- Kožený řemínek jde vyrobit v Řemeslnictví 1 na Koželužském stole (1× Kůže → 2 řemínky).
- Kůže (surovina pro výrobu) jde vyrobit v Řemeslnictví 1 na Koželužském stole z kterékoli
  kůže nebo kožešiny z monster (18 druhů, běžné se spotřebují dřív).
- Obchody: Trhovkyně (Tržiště – potraviny) prodává sůl, mouku, zeleninu, čistou vodu, lesní
  houby, ryby a dřevo; Obchodník s látkami (Tržiště – zboží) vlákno, kožený řemínek, vosk
  a Lovecký tesák (`src/data/merchants.js`, okno `MerchantShopScene`, otevře se po rozhovoru).
  Rybář navíc prodává 8 návnad z Řemeslnictví, Pružný a Mistrovský prut; jeho nabídka se
  listuje po 8 řádcích. Bez zdroje zůstávají jen klíče a příběhové předměty.
- Opraveno: obrázek pozadí titulní obrazovky se načítá z `public/assets/title-background.png`.
- Odstraněno: referenční obrázek mapy Greenvale (`reference-greenvale`, smazaný soubor
  `greenvale-map.png`) – hra se ho už nepokouší načíst.
- Řemeslnictví F01–F05 vyrábí původní předměty z dokumentu Itemy (Kožená čelenka lovce,
  Zesílená lovecká vesta, Plášť horské mlhy, Boty rychlého posla, Rukavice přesného
  sesilatele) místo duplikátů se stejným názvem.
- Rybolov – záběr: po čekání se splávek potopí (ZÁBĚR!) a hráč má 1,2 s (úr. 1) až 1,8 s
  (úr. 100) na zaseknutí mezerníkem / E / tlačítkem. Zaseknutí moc brzy nebo pozdě = nic se
  nechytí a návnada je pryč.
- **Interiér hostince** z nového obrázku „Pohádková krčma u plápolajícího krbu“: Liora
  u výčepu (léčení), krb = hostinská kuchyně, sud = sklep s úschovnou monster, bard
  a lovec u stolu (rozhovory). Dřívější obrázek hostince (zrzavá hostitelka) má teď třetí dům.
- Vesnice – úpravy grafiky: z červeného domu (mezi kostelem a radnicí, i jeho zrcadlová
  varianta) zmizel zlatý křížek pod budovou (původní obrázek v `_stare/house-red-s-krizem.png`).
  Stánky mají průhlednou mezeru mezi zbožím a stříškou (velké uzavřené bílé plochy se
  při načtení smažou, bílé pruhy markýzy zůstanou) – ve vesnici i v editoru.
- Optimalizace regionu Greenvale: asi o třetinu méně stromů, smrků a skal (493 → 318)
  a o 60 % méně keřů, rostlin a pařezů (215 → 103); zbylé jsou větší (stromy × 1,3,
  doplňky × 1,5). Ploty a rozcestníky zůstaly.
- **Vesnice – finální rozložení a uliční síť** (`tools/greenvale-editor-export-2.json`):
  tržiště jsou stánky z editoru (dveře na jihozápad), rybářská chata na východním pobřeží
  s molem do moře a rybářskými místy (staré molo u ústí řeky zrušeno), alchymista u řeky,
  nový zelený dům u tržiště a kostel jihozápadně od náměstí (původní kostel na kraji louky
  smazán, louka je zase celá); menší stánky, studna
  a kašna. Rovné dlážděné ulice: hlavní třída od radnice přes náměstí k mostu, okruh kolem
  hostince a tržiště, ulice na východ k rybářské chatě, na západ k louce, na severozápad
  k domům a kostelu, na sever ke hvězdárně a na jih k alchymistovi; od dveří dlážděné
  uličky. Uvnitř města zahrady s keři a jednotlivé stromy, les až kolem města. Úpravy
  z editoru jsou zapsané v mapě, v prohlížeči se smazaly (jinak by se uplatnily dvakrát).
- **Editor terénu – budovy** (Alt+F8, nabídka „Budovy“): všech 22 budov sady v2, každá ve dvou
  variantách – dveře na jihovýchod a dveře na jihozápad (zrcadlově). Vkládají se ve stejném
  měřítku jako ve vesnici; u vložené budovy tlačítko „Dveře na JV / JZ“ přepne variantu.
  Export obsahuje u budov soubor obrázku a stranu dveří (`b`, `door`).
- **Nové interiéry** (`public/assets/interiors`): interiér je karta stejné velikosti jako
  ostatní karty s obrázkem místnosti (načte se až při prvním vstupu). Postavy a předměty jsou
  klikací místa – pod myší se zvýrazní zlatým rámečkem se štítkem „Jméno – akce“, klik otevře
  menu: Radnice (starosta + „!“/„?“ u úkolu, nástěnka, mapa světa, úřednice, strážný),
  Hostinec (Liora léčí, krb = hostinská kuchyně, truhla = úschovna monster), Kovárna (hornický
  mistr, výheň a kovadlina = Kovářství, učednice), Rybářská chata (rybář, náčiní = obchod),
  tržiště (potraviny, zboží – zatím jen rozhovor), Lovecká chata a domy (obyvatel, krb = sporák).
  Nově se dá vejít do Alchymistického obchodu (alchymistický stůl se přesunul sem z hostince)
  a do Hvězdárny (mág – magické školy se připravují). Odchod: Zavřít, Esc nebo E; dialog
  pokračuje klikem, E nebo mezerníkem. Hrdina se v interiéru už nepohybuje.
- **Nová hra začíná před radnicí** (ne v lovecké chatě).
- **Přehled po souboji** (výhra, prohra, simulace i nepovedený útěk): karty monster party
  s náhledem jako v kartě Party, jménem, úrovní a HP barem. Ubrané HP se zbarví červeně
  a postupně odteče, pod barem je „−X HP“ a nové HP. Po výhře tabulka: Získané EXP, Úroveň
  (při postupu zeleně „5 → 6“), EXP do další úrovně, Trénink a Důvěra pro hrdinu i každé
  monstrum. Pod ní kořist, nové schopnosti a poznámka o simulaci. Okno se už nezavírá samo,
  jen tlačítkem Pokračovat nebo Enterem (platí pro všechny výsledky boje).
  Panel před bojem má větší písmo (20–28) a větší tlačítka; dvouřádkové popisky tlačítek
  jsou všude zarovnané na střed.
- **Vesnice Greenvale z nové sady budov** (`assets/greenvale`, rozřezáno do
  `assets/buildings/greenvale/v2`): všechny budovy ve stejném stylu a v pevném měřítku 2×.
  Původní budovy (radnice, hostinec, kovárna, lovecká a rybářská chata, 3 domy, 2 stánky)
  zůstaly na místě se svými dveřmi a interiéry. Přibyly budovy a doplňky bez interiéru:
  kostel a alchymistický obchod u radnice, kašna, nástěnka a stánky s rybami a květinami na
  náměstí, studna, hvězdárna a domy na severovýchodě, větrný mlýn a stáj u kovárny, sklad
  u přístavu a dva domy na východě. Budovy bez dveří se nedají projít ani do nich vstoupit.
  Lovecká chata má půdorys 4 × 4, dům 3 stojí na parcele místo na útesu. Staré obrázky budov
  jsou v `assets/buildings/greenvale/_stare`.
- **Jednotné UI i mimo karty**: okna Rybolovu, Těžby, Vaření, Alchymie a Kovářství, obchody
  Rybáře a Hornického mistra, okno kořisti, panel před bojem a výsledek souboje, dialogy
  v interiérech, výzvy „E: …“ a hlášky ve světě jsou z nové sady UI (panel, sekce, nadpis
  s ikonou, tlačítka). Vybraná kategorie je zlaté „aktivní“ tlačítko, vybraný řádek ztmaveně
  zlatý, ukazatel čekání má zlatou drážku. Společné prvky: `uiWindow`, `uiTitle`, `uiSection`,
  `uiSelectedRow`, `uiProgressBar`, `uiPrompt`, `uiToast` v `src/ui/fantasyCard.js`.
- Dialog v interiéru se kreslí nad hrdinou (dřív ho hrdina u spodního okraje překrýval).
- **Animace vysunutí karty**: karta otevřená ze světa nebo z interiéru (klávesa nebo záložka
  lišty) sjede shora zpod horní lišty (0,38 s). Přepínání mezi kartami se neanimuje.
  Horní lišta má všude stejný podklad (panel nové sady) – ve světě, v interiéru i na kartách
  Hrdina, Talenty, Party, Inventář a Mapa –, takže během animace zůstává na místě.
  `slideCardIn` a `TAB_STRIP` v `src/ui/cardTabBar.js`.
- **Karty podle vzoru karty Mapa**: Hrdina, Talenty, Party a Inventář mají stejnou velikost
  a rám jako Mapa (panel 1760 × 926 pod horní lištou); obsah karty se do něj zmenší
  (`CARD_FIT` v `src/ui/fantasyCard.js`), podklady karet už nemají vlastní rám. Okolí karet
  (i Mapy) se neztmavuje. Karta Hrdina má stejnou horní lištu jako ostatní karty.
  Kliknutí na aktivní záložku lišty kartu zavře.
- Karta Hrdina (muž i žena): u Vybavení celá postava (`inventory_figure`) místo výřezu useknutého
  u kolen.
- Inventář: náhled a popis předmětu se ukáže už při najetí myší, po odjetí zase vybraný předmět.
- Ohniště: Dřevo se spotřebuje až s prvním uvařeným receptem (dřív hned při rozdělání ohně,
  i když se nic neuvařilo).
- Okna výroby: recepty jako vyšší tlačítka (60 px, písmo 21, dlouhé názvy se zmenší), větší
  kategorie; výchozí písmo tlačítek nové sady 21 (čitelnost).
- Setkání v Greenvale: 1 / 2 / 3 monstra se šancí 60 : 25 : 10 (přepočteno na 100 %, tj. asi
  63 / 26 / 11 %). EXP za vítězství 18 × počet monster, za každé další monstrum +30 %
  (1 = 18, 2 = 47, 3 = 86, 4 = 137 EXP).
- Ochočení: po úspěchu okno pro pojmenování zvířete (psaní na klávesnici, Enter potvrdí,
  prázdné jméno = jméno druhu). Ochočené monstrum přijde do party s HP, které mělo v okamžiku
  ochočení (dřív přišlo s 0 HP). Stejná monstra v boji už nemají písmena (Goblin A, B).
- Rybolov: doba čekání náhodně v rozmezí podle úrovně – úroveň 1: 3–10 s, úroveň 100: 1–3 s
  (plynule mezi nimi), prut, návnada a olej ji dál zkracují.
- Karta Party: volné tréninkové body výrazně v rámečku statistik (až 510), bez barevných
  kruhů u monster a schopností; schopnost ukazuje jen název a použití, pod myší tooltip
  s informacemi o útoku (druh, element, síla, přesnost, dosah, efekt, popis).
- Karta Party, druhé kolo: „Volné body k rozdělení“ mají vlastní řádek pod čarou dole
  v tabulce statistik (dřív zasahovaly do tlačítek +), řádky statistik jsou o kousek výš.
  Šedý text pod tabulkou zmizel; geny, trénink a pravidlo „5 bodů = +1“ ukáže tooltip pod
  myší na řádku nebo na +. Schopnosti jsou jen v rámečku, bez políčka pro ikonu.
- Animace zavření karty: karta zajede nahoru pod horní lištu (0,3 s), pak se vrátí svět
  (`slideCardOut` v `src/ui/cardTabBar.js`).
- Testovací hra se spouští jménem **admin91** na obrazovce tvorby postavy (tlačítko zmizelo).
- **5 slotů pro uložení a nahrání**: Uložit hru / Nahrát hru v menu otevře okno s pěti sloty
  (jméno, úroveň, oblast, zlato, čas uložení a náhled). Náhled je poslední snímek hry při
  odchodu do menu (Esc ve světě nebo v interiéru). Obsazený slot se před přepsáním potvrzuje,
  nahraná hra se stane rozehranou (Pokračovat). Z menu zmizel spodní text o poslední hře.
- Opraveno: po animaci zavření karta na jeden snímek problikla celá (kamera se vracela dřív,
  než se scéna zastavila).

### Změněno
- Úvodní úkoly profesí končí výrobou předmětu, který hráč odevzdá (z inventáře se vezme):
  - Čistá voda: kup 3× Čistou vodu (Trhovkyně) a 2× Léčivé byliny (Bylinkářka), na
    Alchymistickém stole vyrob Menší léčivý tonik.
  - Kožený řemínek: kup Kůži (nově u Obchodníka s látkami, 6 zl) a na Koželužském stole
    vyrob Kožený řemínek.
  - Byliny od řeky: nasbírej 2× Čisticí byliny, kup Čistou vodu a vyrob Protijed
    (recept je nově na Alchymii 1).

  Krok, jehož předmět hráč už má, se přeskočí (s hotovým výrobkem rovnou „vrať se“).
  Sledování, modrý kruh a modrý „?“ vedou vždy k aktuálnímu kroku. V obchodě je předmět
  pro úkol nahoře, se zlatým rámečkem, „!“ a štítkem „Úkol: máš/potřeba“.
- Obchodníci na tržišti (Trhovkyně, Obchodník s látkami) vykupují suroviny a výrobky
  z inventáře: okno obchodu má vlevo Koupit a vpravo Prodat (Prodat 1 / Prodat vše,
  stránkování). Výkup je za polovinu hodnoty předmětu: vlastní cena, jinak nejnižší cena
  u obchodníků, u výrobků hodnota surovin receptu × 1,3, jinak podle vzácnosti
  (`systems/ItemValueSystem.js`). Klíčové předměty se nevykupují, u předmětu pro úkol je
  upozornění.
- Přijatý úkol se rovnou sleduje (tečky ve světě vedou k jeho cíli). V kartě Úkoly jsou
  dokončené úkoly až dole a šedě (šedý řádek a název).
- Malá tlačítka (do výšky 70 px) mají užší zlaté rámování.
- Karta Řemesla má nový vzhled. Profese vlevo jsou tmavé dlaždice s ikonou, úrovní a tenkým
  pruhem XP. Seznamy (recepty s ikonou výrobku, naleziště, kategorie, Databáze) mají lehké
  tmavé řádky se zlatavým okrajem pod myší a zlatým vybraným řádkem. Detaily jsou na tmavých
  panelech s nadpisy sekcí a zlatou linkou, ikony v rámečku barvy vzácnosti. Přehled má
  hlavičku s velkou ikonou a štítky se souhrnem.
- Okna výroby (Vaření, Alchymie, Kovářství, Řemeslnictví) mají vzhled karty Řemesla: vlevo
  filtry Vše a kategorie s počtem receptů, uprostřed recepty s ikonou výrobku, vpravo tmavý panel
  s ikonou v rámečku vzácnosti a surovinami s ikonami. Ukazují se jen naučené recepty a nejvýš
  o 5 úrovní nad úrovní profese. Nové vlastní množství: − / + (i šipky nahoru a dolů), Max
  a tlačítko „Vyrobit ×N“.
- Vstupy do budov leží mimo obrázky budov, na poli přímo pod nakreslenými dveřmi, a vede k nim
  dlažba. Kruh je menší a kreslí se pod budovou, nikdy přes její texturu. Hostinec, dům 1 a dům 3
  mají obrázek posunutý (`offsetX` v `buildingSprites.js`), aby dveře seděly nad polem vstupu.
  Dům 2 je i s plotem a parcelou o pole na západ, protože mu před dveřmi stál dům 3. Před
  budovami zmizely stromy, keře a rostliny, které zakrývaly vstupy.
- Rybářská chata: vstup a kruh jsou přímo před nakreslenými dveřmi, před nimi vedou 2 pole
  kamenné cesty.
- Hra se jmenuje **AURION: LEGACY OF SOULS** (titulek stránky, CHANGELOG; logo je v obrázku
  úvodního pozadí). Klíče uložených her v prohlížeči (`dragon-souls-…`) zůstaly, aby se
  rozehrané hry neztratily.
- Lovecký tesák, Kožená čelenka lovce, Zesílená lovecká vesta a Boty rychlého posla mají účinek
  ve formátu velitelského bonusu (útok +2 %, magický útok +1 %, obrana +2 %, rychlost +1 %).
- V souboji se kladný bonus statistiky zaokrouhluje nahoru, aby u malých hodnot nezmizel.
- Adamantitový a Dračí krumpáč se kovají na Kovářství 72 a 92 (dřív plánováno 70 a 90),
  protože jejich ingoty jdou tavit až od těchto úrovní.
- Oprava okna Alchymie: kategorie s 25 recepty přetékala přes okraj okna (teď stránky).
- Krystalické jádro (drop Crystal Golem) je teď **Křišťálové jádro** – stejný předmět jako
  z Těžby; staré kusy v inventáři se při načtení převedou.
- Alchymie: Plamenný, Vodní, Kamenný, Vzdušný, Stínový a Astrální koncentrát jdou vyrobit
  i z elementálního krystalu místo esence; Ohnivá směs potřebuje navíc Síru. Horníkův lektvar
  (těžba o 15 % rychlejší) a Proutkařův olej (zvýrazní připravená naleziště) už účinkují.
- Talent Zkušený prospektor už účinkuje (+5 % na +1 kus při těžbě za hodnost).
- Názvy esencí a materiálů sjednocené se schváleným systémem esencí: Plamenná esence (dřív
  Ohnivá), Vodní esence (Přílivová a Nymfina čistá), Kamenná esence (Živý kamenný střep),
  Verdantská esence (Lesní duchovní), Duchovní esence (Temná duchovní), Baziliščí žláza
  (Basilisk), Krystalický střep pavouka (Broušený krystal), Snový prach (Incubus). Staré kusy
  v inventáři se při načtení hry převedou.
- Editor terénu ve světě (Alt+F8, záměrně není v nápovědě; `src/world/TerrainEditor.js`):
  - Všech 9 grafických listů z `public/assets/objects` (travnaté, pobřežní a ostrovní dlaždice,
    tři sady mostů, objekty Greenvale) se automaticky rozřeže na jednotlivé prvky (161 prvků).
  - Panel vlevo: výběr listu, náhledy prvků, ovládání vybraného prvku (velikost, hloubka
    před / za, duplikovat, smazat), Export rozmístění do schránky (JSON), vymazání regionu.
  - Klik do mapy vloží vybraný prvek, klik na prvek ho vybere, tažení posouvá, [ ] mění
    velikost, Delete maže. Hráč stojí, kamera se po regionu posouvá WASD / šipkami, kolečko zoom.
  - Rozmístění se ukládá v prohlížeči zvlášť pro každý region a zobrazuje se i při hraní.
    Zápis do map hry doplníme, až bude editor hotový.
  - Úpravy objektů, které už v mapě jsou (stromy, smrky, kameny, keře, ploty, rozcestník,
    jeskyně, budovy – ne dlaždice): výběr klikem, posun, velikost, hloubka, smazání. Ukládají se
    jako rozdíl oproti mapě a platí i při hraní; kolize a dveře zatím zůstávají podle mapy.
  - Zpět (tlačítko nebo Ctrl+Z) vrací poslední úpravy (až 100 kroků) – vložení, posun,
    velikost, hloubku, smazání i vymazání vložených prvků.
- Vaření podle schváleného návrhu „Vaření – návrh systému“ (`src/data/cooking.js`,
  `src/systems/CookingSystem.js`, okno `CookingScene`):
  - 104 receptů v 10 kategoriích a 9 mezivýrobků (vývarové základy, koření, konzervovaná ryba,
    ohnivý extrakt, korálová sůl, aromatický prášek, démonické a hvězdné koření).
  - Pracoviště: ohniště kdekoli ve světě mimo města (klávesa V, stojí 1× Dřevo), kuchyňský
    sporák v Lovecké chatě a domech Greenvale, hostinská kuchyně v hostinci (umí všechny recepty).
  - Dovednost Vaření 1–100 se zkušenostmi (první uvaření receptu ×2) na kartě hrdiny.
    Kvůli testování jsou známé všechny recepty (`ALL_RECIPES_KNOWN_FOR_TESTING`).
  - Jídlo se jí z inventáře mimo souboj: obnova HP monstrům a many hrdinovi, stav „Najedený“
    (jen jeden pokrm, nový nahradí starý po potvrzení) – regenerace a mana po každém souboji,
    bonusy statistik v souboji, cestovní bonusy (rychlost pohybu, +HP každých 50 kroků).
  - Nové suroviny: 11 bylin (zbytek ze 16 schválených; Vodní květ a Svítící list jsou stejné
    předměty jako drop z Water Nymph a Forest Sprite – opravena dřívější zdvojená verze), Sůl,
    Mouka, Zelenina, 13 druhů masa.
  - Maso padá z vhodných monster (50 %), Dřevo z Treanta, Dryády a Barkplate Pangolina (60 %).
    Dřevo a kuchyňské suroviny zatím prodává Rybář (obchodník s potravinami přijde na tržiště).
- Inventář – ovládání myší:
  - Tažení předmětu na jiné políčko ho přesune (prohodí / sloučí). Tažení se Shiftem
    otevře okno Rozdělit s volbou počtu kusů (−10 / −1 / +1 / +10), které se dají do cílového
    políčka (prázdného nebo se stejným předmětem – nejvýš kolik se do hromádky vejde).
  - Tažení na slot výbavy předmět vybaví (do špatného slotu ho nepustí), tažení ze slotu
    výbavy do inventáře ho sundá.
  - Dvojklik levým tlačítkem: výbavu vybaví, spotřební předmět použije, na slotu výbavy sundá.
  - Sloty výbavy na kartě Inventář ukazují ikonu vybaveného předmětu (překryje namalovanou
    ikonu) a hover se tomu přizpůsobí: u vybaveného slotu modré prázdné políčko s ikonou
    předmětu, u prázdného slotu modrá verze namalované ikony.
- Rybolov podle schváleného návrhu „Rybolov – návrh systému“ (bez minihry):
  - U rybářského místa (modrý kruh u vody) se klávesou E otevře panel rybolovu: prut, kovová
    část, výběr návnady (← →), možné úlovky s procenty (nechycené jako ???) a Nahodit (mezerník).
  - Po nahození se do 1–10 s objeví úlovek: 10 s na minimu lokality, −0,25 s za každou úroveň
    navíc, nejméně 1 s; zkracuje prut a návnada. Každé nahození končí úlovkem.
  - 27 ryb, 11 vodních surovin (lastury, perly, korály; naplavené dřevo = Dřevo), 13 lokalit
    s tabulkami pravděpodobností, 10 návnad, 3 pruty a 4 kovové části (`src/data/fishing.js`).
    Legendární úlovek nejvýš 1 % a po chycení se na 30 minut vyřadí.
  - Dovednost Rybolov má úroveň 1–100 a zkušenosti (první úlovek druhu ×2, snadné úlovky méně).
    Úroveň a deník ukazuje karta hrdiny. Talent Rybářská trpělivost dává šanci na bonusový kus.
  - Kvůli testování je všech 13 lokalit dočasně v Greenvale na molu a podél břehu.
  - Rybář v Rybářské chatě: poprvé daruje Jednoduchý prut, Rybářský hák a 5 chlebových návnad;
    obchod prodává prut, hák a základní návnady a vykupuje ryby a vodní suroviny, denní poptávka
    na jeden druh za 150 % (nejvýš 10 ks).
- Okno kořisti: všechny získané předměty musí hráč potvrdit – Vzít vybrané (odškrtávání),
  Vzít vše, Nevzít nic. Co se do plného inventáře nevejde, je označené. Platí pro rybolov
  i pro drop z boje (dřív šel rovnou do inventáře); připravené i pro těžbu.
- Svět Aurie (`src/data/maps/auria.js`): všech 9 regionů kromě Greenvale jako samostatné mapy
  (načítají se po jednom) ze základních dlaždic. Každý region má vlastní recept terénu podle
  popisu oblastí (les s řekou, hory s jeskyní, mrazivé pláně, citadela s hradbami, temná říše,
  sopečné hnízdo s lávou, poušť, pobřeží s pláží, ostrovy). Generování je deterministické,
  velikosti regionů se ladí v `REGION_RECIPES`.
- Nové dlaždice: písek, sníh, štěrk, popel, láva (neprůchozí), temná zem, krystal, brána.
- Brány mezi regiony na okraji map ve směru souseda, s cestou ze středu (přes vodu a lávu most).
  Klávesou E se cestuje a hráč se objeví u protější brány. Greenvale má bránu do Verdant Forest.
  Zatím jsou kvůli testování průchozí všechny regiony (`ALL_REGIONS_OPEN_FOR_TESTING`
  v `RegionSystem.js`).
- Připravená města: uprostřed každého regionu je náměstí, čtyři stavební parcely a čtyři místa
  pro NPC (obchodník, léčitel, představený, trenér). Ve hře jsou označená zlatou značkou.
- Karta Mapa (klávesa M, záložka Mapa v liště karet): všechny regiony vykreslené ze skutečného
  terénu, rozmístěné podle polohy na mapě světa, se spojnicemi bran, městy, místy NPC a
  pulzující polohou hráče.

### Změněno
- Ve světě a v interiérech je místo řádku s nápovědou horní lišta karet (Hrdina, Talenty,
  Party, Inventář, Řemesla, Bestiář, Mapa, Úkoly) se stejnými stavy jako na kartách: klid,
  zlatá pod myší, modrá u zobrazené karty. Kliknutí kartu otevře (Řemesla, Bestiář a Úkoly
  na kartě hrdiny). Klávesové zkratky platí dál.
- Souboj: pohled zůstává z boku, kamera je ale výš – deska sahá skoro přes celou výšku
  obrazovky, vzdálené řady se téměř nezkracují a postavy jsou o něco menší. Mřížka se
  nekreslí (jen jemná šachovnice polí). Nastavení je naladěné společně a zapsané v `BATTLE_VIEW`
  (`BattleScene.js`). Ladicí panel s posuvníky (`src/battle/BattleViewTuner.js`) se v souboji
  otevírá klávesami Alt+F9 (záměrně není v nápovědě).
- Náhodná setkání zatím jen v Greenvale (v nových regionech vypnutá).
- Polohy regionů na mapě světa (`mapX`/`mapY`) přerovnané, aby se regiony nepřekrývaly.
- Nové podklady karet (hrdina muž/žena, talenty, party, inventář) bez namalované lišty,
  tlačítka Zavřít, škol magie, dovedností a ikon výbavy: lišta, Zavřít, školy a dovednosti
  kreslí hra z obrázků stavů; sloty výbavy na kartě hrdiny dostaly obrázky z hoover-icon.png
  (tmavý / modrý pod myší) a ikonu vybaveného předmětu. Karta talentů přeměřená (řádky
  talentů, závěrečné talenty, panely, hlavička), kosočtverečky hodností kreslí hra celé
  (podklad je nemá). Šedá verze talentů se teď načítá z `talent-card-grey.png`.
- Předměty podle dokumentu „Crafting a řemesla – návrh“ (`src/data/items.js`, 240 předmětů):
  léčivé toniky, toniky many (dosavadní lektvar many = „Tonik many“), protijed, cestovní jídlo,
  Soul Crystaly (Basic … Dragon), vybavení (zbraň, čelenka, vesta, plášť, boty, rukavice),
  amulety a prsteny, klíčové předměty (Lovecké povolení Greenvale dostane hráč po úkolu
  Jeskynní sliz), suroviny a 193 materiálů z dropů monster podle elementů. Ikony z listů
  icons01–06: základní předměty ručně, materiály automaticky podle elementu a druhu z názvu
  (pírko, kůže, tesák, šupina, esence…). Materiály bez přesné ikony vypisuje dokument
  „Dragon Souls – Chybějící ikony předmětů“.
- Po vítězství hrdina nezíská peníze, ale materiály poražených monster (1. materiál 70 %,
  2. materiál 35 %); plný inventář hlásí, že část zůstala na bojišti. Vlčí drop „Lovecký tesák“
  je kvůli shodě se zbraní pojmenovaný „Vlčí tesák“, Jeskynní sliz dává Podzemní sliz a Kamenné jádro.
- Použití v inventáři: léčivé toniky léčí nejvíc zraněné monstrum v partě, cestovní jídlo
  přidá manu a HP; vybavení se vybaví do odpovídajícího slotu (plášť a rukavice zatím slot nemají).
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
- Odevzdání úkolu s odměnou ve zkušenostech profese (např. Kožený řemínek → Kovářství)
  spadlo, když hráč tu profesi ještě nikdy nepoužil. Profese se teď nejdřív založí.
- Pohyb hrdiny po diagonále (W+A, W+D, S+A, S+D a šipky) drží směr mřížky: jde přesně podél
  řady / sloupce polí (na obrazovce v poměru 2 : 1, dřív pod 45°), stejnou rychlostí.
- „Kde se používá“ z inventáře otevřelo prázdnou kartu Řemesla (Databáze se nevykreslila).
  V oknech výroby (Vaření, Alchymie, Kovářství, Řemeslnictví) jde kliknout na surovinu:
  otevře se Databáze (odkud ji získat, kde se používá) a po zavření karty se hra vrátí do okna výroby.
- Karty otevřené z interiéru byly schované pod interiérem (pořadí scén) – karta se teď
  vždy přesune navrch.
- ESC, které zavřelo kartu v interiéru, hned poslalo hru i do menu – interiér teď chvíli
  po návratu z karty klávesy ignoruje.
- Karta Talenty: tenčí písmo – názvy talentů netučně se slabým obrysem, menší texty karty
  (stav stromu, Utraceno…, popisy) s obrysem 2 px místo 3 px, nadpisy stupňů se slabším obrysem.
  Kosočtverečky hodností jsou menší, vycentrované pod názvem talentu a celé uvnitř políčka
  (dřív zasahovaly do spodního okraje).

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
