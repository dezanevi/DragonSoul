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

## Verze 0.3 – rozpracováno

### Opraveno – řemeslné úkoly (navádění, obchod, odevzdání)
- Rybolov II – Úlovek dne: místo denní poptávky (často mořská ryba, v Greenvale nechytitelná) chyť a prodej
  Rybářovi Plotici.
- Úkoly s výrobou vedou krok po kroku: nejdřív chybějící suroviny (nasbírat / vytěžit / koupit / vyrobit),
  pak pracoviště. Sledovat i text úkolu se posouvají – např. Tonik many: modré byliny → čistá voda →
  Alchymistický stůl; Vlastní ingot: měď → uhlí → výheň v Kovárně. Platí pro Vaření II, Alchymii II a III,
  Kovářství II a III a Výrobu II a III; suroviny ke koupi jsou označené v obchodě.
- Prodej pro úkol: u postavy modrý „?“ u volby Obchod; ve výkupu modrý „?“ na filtru a u kategorie (např.
  Jídlo, Potiony), předmět k prodeji nahoře v rámečku s „!“ a „úkol 0/1“ (jako věci k nákupu). Platí i pro
  Rybářův obchod (Plotice).
- Nabídka postavy: nový úkol má žlutý „!“, splněný úkol k odevzdání žlutý „?“.
- Skalní stráň: monstra úrovně 1–3 (úkol Nový společník).

## Verze 0.2 – 2026-11-28

### Změněno – hlavní menu vpravo dole
- Tlačítka hlavního menu jsou zase v pravém dolním rohu (okraj 60 px vpravo i dole).
- Nové tlačítko Vypnout hru – zatím neaktivní (šedé).

### Grafika – srovnání karet (připomínky ke kartám)
- Jednotná hlavička všech karet: ikona + nadpis na stejném místě (Hrdina, Talenty, Parta, Inventář,
  Dovednosti, Bestiář, Mapa, Úkoly); Talenty a Parta už nemají nadpis namalovaný v obrázku jiným písmem.
- Hrdina: rámečky srovnané do mřížky (stejné okraje a mezery, horní řada na jedné výšce, pravý sloupec
  Zlato / Oblast / Magické kameny stejně široký jako Magické školy); Dovednosti už nezasahují do Vybavení.
- Parta: políčka monster i s rámečkem uvnitř panelu Aktivní parta, menší ikony bez přesahů (uši, rohy),
  texty v řádku se nepřekrývají; počet „Aktivní parta 4/4 · Úschovna“ na řádku nahoře (dřív ho zakrýval
  model monstra); panel Historie celý uvnitř detailu monstra.
- Inventář: všechna tlačítka filtrů kreslená stejně (rámeček, ikona, popisek stejným písmem uvnitř);
  šipky stránek bez tmavého čtverce; karta trochu menší, aby nadpis i panel Nástroje měly odstup od rámu.
- Dovednosti a Bestiář: seznam vlevo s odstupem od rámu karty.
- Bestiář: zvýraznění pod myší u „Výskyt“ zůstane na svém místě (dřív uskočilo do Schopností).
- Mapa: mapa pod hlavičkou (nadpis a ikona nezasahují do rámečku mapy).

### Grafika – texty a ikony uvnitř rámů karet
- Talenty: ikony talentů, hlaviček stromů a vrcholných talentů jsou uvnitř rámečků (dřív přes okraj);
  popis vrcholného talentu se vejde do rámečku (kratší úvod „Po 30 bodech:“, dlouhý text menším písmem);
  štítek „brzy“ je uvnitř políčka.
- Hrdina: ikony dovedností v panelu Dovednosti uvnitř rámečků tlačítek.
- Inventář: sloty v panelu Nástroje jsou menší, popisky už neleží přes slot pod sebou.
- Dovednosti, Bestiář, Úkoly a Mapa: nadpis s ikonou posunutý ze zlatého rohu rámu (Mapa má nově ikonu);
  texty a tlačítka vpravo nahoře (Objeveno, Co dál?, Jsi v oblasti…) mimo pravý roh; legenda Mapy mimo levý
  dolní roh; detail v Bestiáři má odstup od pravého rámu.
- Dovednosti: přehled profese s menšími mezerami – popis poslední specializace už nepřetéká přes spodní okraj.
- Party: historie monstra píše statistiku česky („do statistiky Síla“ místo „force“).

### Změněno – ekonomika: z koupených surovin se nevydělá
- Hodnota výrobku (`src/systems/ItemValueSystem.js`): suroviny koupitelné u obchodníků se počítají za nákupní
  cenu bez přirážky, vlastní suroviny (nasbírané, vytěžené, kořist, vlastní mezivýrobky) s přirážkou podle
  obtížnosti receptu – úroveň 1 → 1,1×, úroveň 100 → 1,9×. Výkup u obchodníků dál polovinou hodnoty.
- Vyráběné předměty, které obchodníci neprodávají, mají hodnotu podle receptu i tam, kde měly v datech pevnou
  cenu (často 2–3× nad cenou koupených surovin, např. Dřevěný talisman 26 → 8 zlata). Kovářské výrobky z vlastní
  rudy naopak zdražily (průměrně o čtvrtinu, u těžkých receptů víc), řemeslné zlevnily (průměrně o desetinu).
- Zboží z obchodu nemá vyšší hodnotu než jeho nákupní cena (Kůže 7 → 6).
- Vlastní obchod: zákazník koupitelnou část zboží nepřeplatí (tolerance ceny platí jen na vlastní práci
  a suroviny, koupená část se počítá i se slevou z Charismatu) a nad férovou cenou šance na prodej klesá tím
  prudčeji, čím víc je zboží „z obchodu“. Simulace na den: přeprodej koupené kůže ~2 zlata, Měděná dýka z
  vlastní rudy ~5 zlata, Pečená plotice z vlastní ryby ~70 zlata.

### Přidáno – úkoly Vlastní obchod a Účetní kniha (Demo 34 a 33)
- Vlastní obchod (Starosta Edric, po Za léčitelkou): získat Diplomacii 10 a koupit Zelený dům za 500 zlata.
  HUD ukazuje postup Diplomacie (7 / 10), pak zlata (… / 500). Splní se i domem koupeným dřív.
- Účetní kniha (Úřednice na radnici, po Vlastním obchodu): otevřít účetní knihu ve svém obchodě a prodat
  zákazníkům 5 kusů zboží. Odměna 20 zlata a 100 XP Diplomacie.
- Pořadí je obrácené oproti číslům v dokumentu – účetní kniha je až ve vlastním obchodě.

### Přidáno – řemeslné linie úkolů (Demo, úkoly 11–32)
- 17 nových úkolů: Rybolov I–III (Rybář), Těžba I–III a Kovářství II–III (Hornický mistr), Byliny II–III
  (Bylinkářka), Vaření I–II (Trhovkyně) a III (Výčepní), Alchymie II–III (Alchymista), Výroba I–III (Řemeslnice)
  a Do zbroje (Obchodník s látkami). Data jsou v `src/data/craftQuests.js`.
- Odemykání: část I všech řemesel (i dosavadní Byliny od řeky, Čistá voda, Kožený řemínek) až po úkolu Za
  léčitelkou, část II po části I téhož řemesla, část III po části II. Řemesla na sobě nezávisí. Do zbroje po
  Koženém řemínku a Výrobě I.
- Trh a výkup se učí v částech II (prodej Rybáři, Hornickému mistrovi, Bylinkářce, na tržišti).
- Nový typ cíle úkolu „goals“: počítadla událostí od přijetí úkolu (`src/systems/QuestCounters.js`) – úlovky,
  vytěžené suroviny, nasbírané byliny (statek zvlášť), vyrobené recepty, použité přípravky, prodané kusy (podle
  předmětu, obchodu, šperky, denní poptávka Rybáře), nasazená výbava a souboj vyhraný najedený. Víc cílů = postup
  „Část 1/2“ v HUD; nabídka úkolu je ukáže jako kroky.
- Sledovat vede i k rybářskému místu a nalezišti Těžby; pracoviště s výrobou pro úkol má modrý „?“ a recept značku.
- Výčepní nabízí úkol i v noci (vedle pokoje na noc), Řemeslnice má nabídku rozhovoru (úkoly).

### Změněno – úpravy zadání oproti dokumentu
- Těžba II: železná ruda místo cínu (cín je až od Těžby 8); Těžba III: Cínová žíla místo Opuštěného lomu
  (jeho žíly jsou od úrovně 18 a 92).
- Byliny III: 2× Vodní květ (Sběr bylin 8) místo pylu (ten je až z magických rostlin).
- Rybolov III: neobvyklá a lepší ryba (Lín, Pstruh) – vzácné ryby v Greenvale jsou od Rybolovu 18.
- Alchymie III: Odpuzovač zvěře – ochranné oleje proti živlům jsou od Alchymie 37.

### Grafika – nadpisy karet uvnitř rámu
- Karty Dovednosti, Bestiář a Úkoly (i Nástěnka úkolů): ikona a nadpis jsou posunuté dovnitř – už nesedí na zlatém
  rohu a horní hraně rámu. Nápověda vpravo nahoře na Nástěnce úkolů už nezasahuje do pravého rohu.

### Opraveno – karta Úkoly: hlášky v záhlaví
- Hláška po „Co dál?“ (i po Sledovat / Nesledovat a „V této oblasti teď žádný úkol není“) se už nekreslí dole
  přes dokončené úkoly – na 3 s nahradí nápovědu v záhlaví karty vedle tlačítka Co dál? (zlatě, dlouhá se zmenší).
  Co dělat je vidět v rozbaleném sledovaném úkolu.

### Přidáno – sledovaný úkol v HUD, cena v inventáři
- Ve světě je vpravo nahoře (pod lištou karet) panel **Sledovaný úkol**: název, co teď dělat a ukazatel postupu
  (např. „2 / 3“ kanců, kusy předmětu k odevzdání, krok vícekrokového úkolu; splněný úkol zeleně „Splněno – odevzdej“).
  Obnovuje se průběžně, klik otevře kartu Úkoly, pod otevřenou kartou a v interiéru se schová.
  Počet (kanci 2/3, druhy 3/5, XP mistrovství Vzduchu 12/40) ukazuje jen ukazatel – v textu kroku v panelu není
  (v kartě Úkoly zůstává).
- Náhled předmětu v inventáři ukazuje cenu: „Cena: N zlata / ks · výkup M zlata“ (výkup u obchodníka = polovina),
  u klíčů a předmětů bez ceny „Nedá se prodat“.

### Změněno – inventář: vybraný předmět
- Vybraný předmět (ten v náhledu vlevo dole) má v mřížce zlaté podkreslení pod ikonou, ne jen rámeček.
- Když přepneš filtr a vybraný předmět do nové kategorie nepatří, výběr se zruší a náhled ukáže „Vyber předmět“
  (dřív v něm zůstával skrytý předmět, např. Cestovní jídlo při filtru Potiony).

### Změněno – kategorie inventáře: Vybavení a Jídlo
- Kategorie Zbroj se jmenuje **Vybavení** a patří do ní i prsteny, amulety a druhá ruka (dřív Doplňky).
- Místo Doplňků je nová kategorie **Jídlo**: pokrmy, cestovní dávky, suroviny na vaření, maso, ryby a kuchyňské
  mezivýrobky (pokrmy už nejsou v Potionech, suroviny na vaření v Materiálech).
- Inventář: tlačítko Jídlo (ikona pokrmu) místo namalovaných Doplňků, popisek Vybavení; zvýraznění pod myší
  a při zapnutí funguje jako u ostatních. Filtr výkupu na tržišti používá stejné kategorie, Databáze
  u Surovin ukazuje i suroviny na vaření. Obchodní kategorie (poptávka ve vlastním obchodě) se nemění.
- Drobnost: hláška při nahrazení elixíru už neopakuje slovo („nahrazuje Elixír síly“).

### Přidáno – hvězdičky nových receptů i u profesí a podskupin
- Zlatá ★ u nově odemčených receptů je teď vidět i výš: v kartě Dovednosti u profese (vlevo), u tlačítka
  „Recepty ★“ a u podskupiny receptů (např. Tavení a díly); v oknech výroby u podskupiny a u Vše (před počtem).
- Jakmile hráč přejede myší přes poslední nový recept podskupiny, hvězdičky u podskupiny (a případně profese
  a Receptů) zhasnou.

### Přidáno – výroba: kde se výrobek používá
- Detail receptu v oknech výroby má sekci **Používá se v (N)**, když se výrobek používá v jiném receptu (všechny
  výrobní profese): ikona, profese a úroveň, název receptu a potřebné množství. Klik otevře výrobek v Databázi;
  co se nevejde, nabídne řádek „… a dalších N – všechny v Databázi“. Doba výroby a důvod, proč recept nejde vyrobit,
  jsou teď nad touto sekcí.

### Opraveno – ikony dárkových nástrojů
- Nástroje od NPC zdarma (Starý krumpáč, Starý srp, Starý prut, Starý háček) mají ikonu prvního vyrobitelného
  nástroje téhož druhu: Základní důlní krumpáč, Zahradnický srp a Rybářský hák (Kovářství); prut se nevyrábí,
  takže ikona Jednoduchého prutu. Dřív se ikona kopírovala dřív, než vyrobené nástroje dostaly vlastní ikony,
  a dárky zůstaly se starými zástupnými ikonami.

### Změněno – lom Greenvale
- Z jižního okraje lomu Greenvale zmizely stromy, které zasahovaly přes hranu jámy (pole 70–72, 97 a 71, 98 – teď skála útesu).
- Hvězdný meteorit (Těžba 85+) se přesunul z hlavního lomu do Opuštěného lomu na jihozápadě (pole 8, 119),
  k ostatním nalezištím nad úroveň dema (Ametystová dutina, Žíla dračího železa).

### Opraveno – zkratka „zl“ v textech
- Částky se všude píšou celým slovem („1 zlatý“, jinak „N zlata“) místo zkratky „zl“: potvrzení nákupu a platby,
  košík, hostinec (nabídka výčepní), koupě domu, vlastní obchod (stav, tržby, statistiky, prodeje) a karta Dovednosti.

### Přidáno – filtr výkupu na tržišti
- V obchodech na tržišti má sloupec Prodat tlačítko **Filtr: … ▾**: rozbalí kategorie (Vše, Zbroj, Materiály,
  Jídlo, Potiony, Doplňky, Ostatní) s počtem kusů na prodej; Jídlo = pokrmy, suroviny na vaření, maso, ryby
  a kuchyňské mezivýrobky (ty pak nejsou v Potionech ani Materiálech); prázdné kategorie nejdou zvolit. Seznam pak ukáže jen
  zvolenou kategorii (Esc nebo klik mimo nabídku ji zavře).
- Dlouhé názvy ve výkupu se už nezmenšují do nečitelna – zkrátí se „…“ (počet kusů zůstane), celý název je v náhledu.

### Přidáno – podpisové schopnosti monster z Greenvale
- 16 druhů z Greenvale má vlastní jedinečnou (podpisovou) schopnost, kterou se naučí na úrovni 5:
  Dire Wolf – Lovecký výpad (2 zásahy, krvácení), Wild Boar – Kančí nápor (omráčení), Goblin – Hrst písku
  (na dálku, paralýza), Forest Sprite – Mízový dotek (vysaje 60 %), Giant Spider – Jedovatá síť (otrava + okolí),
  Zephyr Hound – Vichřicový skok (2 zásahy na dálku), Galecrest Lynx – Hřebenový sek (+rychlost), Briarbound Wisp –
  Trnitá záře (okolí, krvácení), Hobgoblin – Nájezdnický úder (+útok), Cave Worm – Kousnutí z hlubin (vysaje 40 %),
  Cave Bear – Medvědí drtič (omráčení), Thornroot Stag – Trnová koruna (okolí, krvácení), Earth Elemental – Lavina
  kamení (okolí 60 %), Mossveil Lynx – Mechový závoj (+obrana), Air Elemental – Smršť (3 zásahy), Orc Warrior –
  Zuřivý sek (+útok).
- Nové mechaniky schopností v souboji: více zásahů, vysátí života, zásah nepřátel vedle cíle (nejvýš 2) a posílení
  útočníka po zásahu. Rychlý souboj a odhad počítají více zásahů a vysátí.
- Monstra, která už úroveň 5 mají (i Dire Wolf z nové hry), dostanou podpisovou schopnost na začátku souboje.
  Monstrum má teď až 7 schopností (6 běžných + Bond).
- Bestiář ukazuje podpisovou schopnost zlatě s ★ a štítkem „podpisová“; se 7 schopnostmi má seznam hustší řádky,
  aby se vešel do panelu.

### Přidáno – zlatá hvězdička u nově odemčených receptů
- Recepty, které zpřístupní nová úroveň výrobní dovednosti (Vaření, Alchymie, Kovářství, Řemeslnictví), mají
  v seznamu zlatou pulzující hvězdičku – v kartě Dovednosti → Recepty i v oknech výroby. Zmizí, jakmile hráč
  přejede myší přes řádek receptu (pamatuje se v uložené hře).

### Grafika – karta Dovednosti
- Tlačítko „Zpět (Enter)“ a nadpis vpravo nahoře jsou posunuté dovnitř okna – tlačítko už nepřekrývá zlatý roh rámu.

### Změněno – vyskakovací okno XP: nahoře, odemčené recepty
- Okno zisku XP vyjede shora a zastaví se nahoře uprostřed, hned pod lištou karet; texty (+XP, Nová úroveň,
  Odemkl jsi…) jsou pod dlaždicí. Po chvíli zajede zpět nahoru.
- Okno je menší (asi o třetinu, i s texty).
- Když nová úroveň výrobní dovednosti (Vaření, Alchymie, Kovářství, Řemeslnictví) zpřístupní recepty, nad oknem
  se ukáže „Odemkl jsi X předmětů“ (správný tvar: 1 předmět, 2–4 předměty, 5+ předmětů).

### Přidáno – vyskakovací okno zisku XP v dovednostech
- Při zisku XP v dovednosti (Sběr bylin, Alchymie, Těžba, Rybolov, Vaření, Kovářství, Řemeslnictví, Diplomacie)
  vyjede uprostřed dole dlaždice té dovednosti z karty Hrdiny s „+N XP“; ukazatel se plynule posune o získané XP.
  Při nové úrovni se naplní, zazáří, ukáže „Nová úroveň!“ a pokračuje od nuly. Více zisků čeká ve frontě
  (stejná dovednost se sečte), okno je vždy nad ostatními okny.
- Hromadná výroba (okna výroby): XP z celé várky se ukáže jednou, až po dokončení – i po přerušení (Esc)
  nebo zavření okna.

### Grafika – Dovednosti v kartě Hrdiny
- Dlaždice dovedností mají vyšší rámeček a ukazatel úrovně je o kousek menší – už nesedí na spodním okraji rámu.

### Přidáno – výroba: jen recepty se surovinami
- Okna výroby (Vaření, Alchymie, Kovářství, Řemeslnictví) mají vlevo dole přepínač **☐ Jen co vyrobím**:
  zapnutý ukáže jen recepty, které jde teď vyrobit aspoň 1× (suroviny, úroveň i pracoviště); počty u kategorií
  se přepočítají. Volba se pamatuje pro všechna okna výroby. Když nic nejde vyrobit, seznam to napíše.

### Přidáno – Štěstí a Charisma hrdiny
- **Charisma**: vlastní úroveň 1–15 s XP – roste se vším XP Diplomacie (rozhovory, obchod, úkoly), 15. úrovně
  dosáhneš přesně s Diplomacií 100. Zbytek do maxima 20 dorovnají předměty, jídlo a lektvary.
- **Štěstí**: jen z předmětů, jídla a lektvarů (bez úrovní), nejvýš 20.
- Účinky za bod – Štěstí: kritický zásah monster +1 % (základ 5 % pro všechny, poškození ×1,5, i v rychlém
  souboji a odhadu), kořist z monster +2,5 %, kus navíc při sběru bylin, těžbě a rybolovu +0,5 %,
  vzácné noční monstrum +0,5 %. Charisma: nákup u obchodníků −1 %, výkup +1 % (ceny v nabídkách i v košíku),
  vlastní obchod – zákazníci a šance na prodej +1,5 %, ochočení +0,5 %.
- Všechny amulety a prsteny mají Štěstí nebo Charisma podle obtížnosti (1 bod do úr. 19, +1 za 20 úrovní,
  nejvýš 5); nalezené a úkolové kusy mají obě. Navíc pár vzácných kusů: Srdce Greenvale, Amulet větrného drápu,
  Astrální fokus, Pegasí boty, Čelenka hvězdného mudrce, Plášť z dračí kůže, Stínová dýka, Sekera orčího válečníka.
- Opakující se jídla (20 receptů se stejným účinkem jako jiný recept) dávají místo toho Štěstí nebo Charisma na
  4–5 soubojů (Masový vývar zůstal – snídaně v hostinci). Lektvary: Elixír štěstěny (dřív Elixír divoké síly),
  Lektvar výmluvnosti (dřív Lektvar svítícího listu), Štěstí navíc v Lektvaru štěstí lovce a Elixíru velkého lovu.
- Karta Hrdiny: Štěstí a Charisma ukazují skutečnou hodnotu; hover říká maximum, úroveň a XP Charismatu,
  kde se statistika uplatní (s aktuálními čísly) a ze kterých předmětů / posílení pochází.
- Popisy výbavy, jídla a lektvarů ukazují Štěstí a Charisma jako body hrdiny („Hrdina: Štěstí +2“).

### Změněno – úkol Nový společník: Mágův krystal na Skalní stráni
- Nový předmět **Mágův krystal** (ikona jako Basic Soul Crystal): Mág ho dá 2× při přijetí úkolu Nový společník.
  Ochočuje jako Basic Soul Crystal, ale jen v souboji na **Skalní stráni** (jinde nejde použít).
- Když Mágovy krystaly dojdou (i vyplýtvané nepovedeným ochočením), v dalším souboji na Skalní stráni se doplní
  (2×, zpráva v záznamu souboje) – úkol nejde zablokovat. Po odevzdání úkolu si zbylé Mág vezme zpět.
- Úkol (text, rozhovor Mága, tečky na mapě) vede na Skalní stráň. V souboji po vyplýtvání posledního krystalu
  nebo bez použitelného krystalu hra poradí, kde se Mágův krystal doplní / že funguje jen na Skalní stráni.

### Grafika – horní lišta karet
- Z horní lišty zmizel podklad, který tlačítka karet spojoval – tlačítka stojí samostatně (svět, interiéry i karty).

### Grafika – schody do lomu
- Sjezdy do lomu mají kamenné schody (5 stupňů se světlým nášlapem a boční skalní líce) místo mezery
  ve skalní stěně. Každý sjezd má jedno schodiště rovně ve směru cesty.

### Opraveno – tržiště otevře obchod bez probliknutí
- Při dalším vstupu na tržiště se obchod otevře hned (ve stejném snímku jako interiér) a interiér se
  nevysouvá – dřív se nejdřív ukázal interiér a obchod naskočil až po animaci.

### Opraveno – nepřátelé obcházejí spojence
- V taktickém boji nepřátelské monstrum, kterému cestu blokuje jiné monstrum nebo překážka, už nestojí:
  hledá skutečnou cestu kolem (i přes krok, který ho vzdušnou čarou nepřiblíží) k volnému poli vedle cíle.
  Když je cíl úplně obklopený, zařadí se co nejblíž (do fronty za spojence).

### Přidáno – jídlo k odpočinku, potvrzení útraty
- Hostinec přes den nabízí dvě volby: **Odpočinek (5 zl)** a **Odpočinek s jídlem (10 zl)** –
  jídlo je stejný masový vývar jako snídaně k noclehu (regenerace po soubojích). Najetí myší ukáže popis volby.
- Nové potvrzovací okno před každou platbou zlatem: kolik zaplatíš a zlato před → po (Enter = zaplatit, Esc = zrušit).
  Platí pro nocleh a odpočinek, nákup v košíku všech obchodů (s prodejem ukáže i příjem), koupi domu,
  změnu specializace Těžby / Sběru bylin a úhradu dluhu vlastního obchodu. Prodej bez nákupu se nepotvrzuje.

### Přidáno – talenty Řemesla dokončeny, kategorie Řemeslník
- Napojené talenty (dřív „čeká na systém“): Bylinkářská ruka (+šance na bylinku navíc, max 25 %),
  Trpělivost rybáře, Úsporné zpracování (šance ušetřit suroviny při výrobě, max 10 %, vždy se spotřebuje aspoň 1 kus),
  Alchymická zručnost (silnější lektvary, max +10 %), Mistr kuchyně (jídlo trvá déle, max +25 %),
  Kovářský mistr / Zručný řemeslník (+bonusy kovové / nekovové výbavy), Vzácné směsi, Mistrovská výroba, Legendární řemeslník.
- Nová kategorie receptů **Řemeslník** v Kovářství, Řemeslnictví a Alchymii (i v kartě Dovednosti) – vidí ji jen hráč se specializací Řemeslník.
- 13 receptů ze vzácné kořisti Greenvale, odemykají se hodnostmi talentů (1./3./5.):
  - Kovářství: Gobliní lovecký nůž, Orčí kroužková košile, Štít orčího bojovníka, Meč z vlčích tesáků, Sekera orčího válečníka (epická).
  - Řemeslnictví: Vesta z divoké kůže, Amulet větrného drápu, Boty zephyrova běhu, Zbroj vůdce smečky,
    **Srdce Greenvale** (legendární amulet – po dokončení celého stromu Řemesla).
  - Alchymie: Slizový protijed, Elixír divokého kance, Lektvar větrného běžce.
- Talenty Kouzelníka (Kamenné stezky, Zlaté rozpouštění, Šetrnost cestovatele) zůstávají na později.

### Změněno – účinky v HUD
- Každá ikona účinku (jídlo, elixír, ochrana, lektvary, výztuha) má přes roh štítek trvání:
  „3b“ = 3 souboje, „3min“ = 3 minuty.
- Při najetí myší se nad panelem ukáže štítek s názvem, trváním a popisem účinku
  (jídlo podle receptu, ostatní podle popisu předmětu).

### Změněno – Databáze, inventář, odevzdání úkolu
- **Databáze:** u předmětu s víc než 5 místy získání je odkaz „… a dalších N míst – zobrazit
  všechna ▸“. Seznam se rozbalí přímo na místě – prvních 5 zůstane, kde bylo, zbytek se rozbalí
  dolů přes ostatní obsah (když se nevejde, druhým sloupcem). Recepty jdou rozkliknout; sbalí
  ho Skrýt ▴, klik mimo nebo Esc.
- **Inventář:** lišta se zlatem je kratší (jen na částku) a tlačítko Seřadit je hned za ní
  (dřív vpravo dole vedle Zavřít). Sekce Nástroje má stejný zlatý rámeček jako ostatní.
- **Odevzdání úkolu:** první věta poděkování už neproblikne – rozhovor posune jen klik, který
  v něm začal (dřív puštění myši po kliknutí na Odevzdat hned přeskočilo první větu).

### Změněno – obnova nalezišť a noční vzácná monstra
- **Obnova:** běžné a neobvyklé žíly i byliny (a záhony na statku) se obnoví za 12 minut,
  vzácné a lepší (i speciální naleziště a vzácné místo v lomu) za 48 minut. Dřív 5–15 minut,
  vzácné 45 minut až 24 hodin.
- Odpočty obnovy a texty postav jsou v herním čase (1 minuta hraní = 1 herní hodina):
  „obnova za 11 h 20 min“, běžné žíly a záhony „dvanáct hodin“, vzácné „dva dny“
  (`TimeSystem.formatGameDuration`).
- **Noc (23:00–05:00):** každé setkání na louce má 15% šanci, že jedno monstrum nahradí
  nejvzácnější druh oblasti (vzácný, jinak neobvyklý – Greenvale: Zephyr Hound, Verdant Forest:
  Pollen Oracle nebo Thornroot Stag) o úroveň výš než louka. V přehledu souboje má ★ a
  „vzácné v noci“. Ve dne se neobjeví.

### Změněno – obchod se sám otevře jen na tržišti
- Navštívený obchod se po vstupu otevře sám jen na tržišti (Tržiště – potraviny, Tržiště – zboží).
  U Bylinkářky, Rybáře a Hornického mistra se ukáže nabídka postavy (úkol, obchod, rozhovor).

### Opraveno – každá žíla v lomu odpočívá zvlášť
- Obnova vytěženého naleziště se počítá pro konkrétní žílu (oblast + pole), ne pro celý druh.
  Po vytěžení jedné měděné žíly jdou ostatní měděné žíly v lomu těžit dál.

### Změněno – odměny úkolů s jednotkou XP
- Odměny v rozhovorech a v kartě Úkoly uvádějí XP: „25 zlata a 200 XP Alchymie“ místo
  „zkušenosti v Alchymii (200)“; u hrdiny „30 XP hrdiny navíc“.

### Změněno – tutoriál souboje se přizpůsobí zkušenému hráči
- Když hráč udělá krok do 1,8 s od zvýraznění (nebo dřív, než se ukáže), tutoriál zrychlí:
  další zvýraznění bez pauzy (dřív 650 ms), rychlejší přechod (110 ms), slabší ztmavení
  a kratší texty Mága. Pomalejší hráč má dál plné vysvětlení. Bez tlačítka Přeskočit.
- Air Elemental v tutoriálu stojí ve stejné řadě jako vlk, takže vlk při útoku doběhne přímo
  před něj (dřív skončil šikmo a vypadalo to jako útok zdálky).
- Útok zblízka (všechny souboje): při přesunu a útoku má přednost pole přímo před cílem a výpad
  k cíli je delší (50 % vzdálenosti místo 35 %).

### Opraveno – plynulé přijímání a odevzdávání úkolů
- Mezi okny (nabídka postavy → rozhovor → nabídka úkolu → odevzdání) už nic neproblikne:
  nabídka s Odevzdat po přijetí splněného úkolu naváže hned (dřív se zpožděním 150 ms)
  a tlačítko Zavřít interiéru se vrací až 250 ms po zavření posledního okna, plynule.
- Air Elemental v tutoriálu souboje má úroveň 5 (dřív 1).

### Přidáno – modrý „?“ nad pracovištěm pro úkol
- Když má hráč pro probíhající úkol něco vyrobit (aktuální krok = výroba), ukáže se modrý „?“
  nad pracovištěm, kde to jde: alchymistický stůl, výheň a kovadlina, kuchyně a ohniště,
  koželužský a šperkařský stůl, Soul Crystal Workbench. Řemeslnictví podle přesného pracoviště
  receptu, ostatní profese aspoň stejně dobré pracoviště; každá výroba označí jen jedno pracoviště
  v místnosti.

### Změněno – košík uprostřed obchodu
- Ve všech obchodech (obchodníci na tržišti, Bylinkářka, Rybář, Hornický mistr) je košík
  prostřední tabulkou: Koupit | Košík | Prodat.

### Opraveno – název návnady v rybolovu
- Název zvolené návnady (např. „Kořeněná návnada (5 ks)“) se celý vejde mezi šipky: šipky jsou
  od sebe dál (300 px na název, delší název se zmenší) a mají čitelnou velikost 54 × 54.
  Účinek návnady je vpravo za šipkou.

### Změněno – připomínky z testování (tutoriál, souboj, úkoly)
- **Tutoriál souboje:** panel Mága už neproblikává prázdný (během pauzy je schovaný celý).
  První útok vlka dá Air Elementalovi vždy krvácení (KRV) a Mág vysvětlí, co dělá; krvácení
  elementála nezabije. Pořadí: zásah → kouzlo Vzduchu → ochočení.
- **Magie Vzduchu** je odemčená hned od začátku nové hry (dřív při přijetí úvodního úkolu).
- **Animace ochočení:** zlaté světlo a jiskry, monstrum se stáhne do krystalu, který zapulzuje;
  při neúspěchu se monstrum vytrhne a krystal se roztříští.
- Texty: tečky ve světě jsou **modré**, ne zlaté.
- Hlášky ve světě (nový úkol, splněný pasivní úkol…) jsou nad panelem party (HUD), ne přes něj.
- **Po přijetí úkolu** se interiér zavře a ve světě vyskočí hláška o novém úkolu. Výjimka: když
  je další krok v téže budově (např. výroba na alchymistickém stole – suroviny hráč už má),
  zůstane uvnitř, pracoviště ukáže modrý „?“ a hláška řekne, co dělat. Jinak vyjde ven a sledovaný
  úkol ho vede k dalšímu kroku (např. na tržiště). Když hráč už
  splňuje vše pro odevzdání, místo odchodu se hned ukáže nabídka postavy s Odevzdat úkol.
  Totéž po úvodním úkolu u Mága.
- **Zavřít** interiéru se během rozhovoru, nabídek a obchodu schová (neprosvítá pod panelem).
- Okna výroby (řemesla) se vždy otevřou na filtru **Vše**.
- **Volba souboje:** při najetí myší na Bojovat / Bez mřížky / Simulovat / Útěk se ukáže,
  co volba dá a co ne.
- **Rychlý souboj:** monstrum hráče na tahu má zlatý zářivý obrys; jméno, životy a stavy jsou
  vpravo od monster.
- **Zkušenosti monster:** omdlelé monstrum XP (ani tréninkový bod a důvěru) nedostane; křivka
  úrovní je jako u hrdiny (úroveň × 20, upravená růstem druhu).
- **Bestiář a úkoly** počítají každé zabité monstrum hned při omdlení (i když se souboj prohraje),
  ne vyhraná setkání.
- **Silnější nepřátelé:** fyzický útok divokých monster 80 % jejich Síly (dřív 40 %,
  `ENEMY_ATTACK_SHARE`). Rovnocenný souboj se vyhrává, silnější a početnější nepřátelé jsou nebezpeční.
- **Dárky od NPC** (starý prut, háček, krumpáč, srp) mají ikonu nejnižšího vyrobeného nástroje.
- **Navádění** jako v tutoriálu (ztmavení a světlé okno): po splnění Prvního lovu na Úkoly → Co dál?,
  po odemknutí talentů (4. úroveň) na Talenty.
- **Volba druhého živlu:** při najetí myší souhrn školy (kouzla, silná a slabá proti čemu).
- **Karta Úkoly:** hotové úkoly se nerozbalují a jsou mimo tabulku probíhajících, oddělené tlustou
  zlatou čarou (Dokončené úkoly); seznam se posouvá kolečkem myši, vpravo posuvník.

### Změněno – první dva úkoly se přijmou samy
- **Krotitelova zkouška** se přijme sama po rozhovoru s Mágem (bez okna Přijmout / Odmítnout),
  Soul Crystal hráč dostane hned. **Za léčitelkou** se zadává sám už dřív. Volba přijetí je
  až od třetího úkolu (Léčivé byliny pro Lioru).

### Přidáno – základní úkoly Dema (2, 5–9)
- **Zápisky krotitele** (pasivní, Mág): zadá se sám po Krotitelově zkoušce, splní a odmění se sám
  (10 zl), až hráč pozná 5 druhů monster – ve světě vyskočí hláška.
- **První lov** (Lovec u stolu v hostinci, po Za léčitelkou): poraz 3× Wild Boar, zlaté tečky vedou
  na nejbližší louku, kde divočáci žijí (cíl `meadow` umí `species`). 15 zl + 30 XP hrdiny.
- **Nový společník** (Mág, po Prvním lovu): ochoč další monstrum. 20 zl.
- **Výcvik** (Strážný na radnici, po Novém společníkovi): rozděl tréninkový bod v Party. 10 zl.
- **Píseň živlů** (Mág, po Prvním lovu): použij kouzlo hrdiny v souboji. 20 zl.
- **Druhá škola** (Mág, po Písni živlů): Vzduch na 2. úroveň mistrovství, pak si u Mága vybereš
  druhý živel (Oheň, Voda, Země, Světlo, Stín) – odemkne školu i první kouzla. 25 zl.
- Orčí hrozbu starosta nabídne až po základních úkolech 1–9 (bez pasivního).
- Úkoly mají obecné cíle podle stavu hry (`objectiveCheck` + výchozí hodnota při přijetí,
  `objectiveText` s postupem, např. „2/3“). Mág má nabídku se všemi svými úkoly, značka „!“ / „?“
  nad ním ukazuje kterýkoli z nich. Souboj počítá seslaná kouzla (`flags.spellsCast`).

### Změněno – úkoly v Demu: odměny a odemykání (záložka „Demo – úkoly“)
- **Odměny úkolů:** každý splněný úkol dá hrdinovi 15 XP (`QUEST_HERO_XP`) a dál 50 XP Diplomacie.
  `rewardXp` umí všechny profese (rybolov, těžba, byliny, vaření, alchymie, kovářství, výroba),
  `diplomacy` (navíc) a `hero` (navíc), i víc odměn najednou (pole).
- **Odemykání:** úkol s `requires` jde přijmout až po uvedených úkolech (řemeslné linie I → II → III,
  Orčí hrozba po Krotitelově zkoušce, Za léčitelkou a Léčivých bylinách). Dřívější podmínka
  „všechny ostatní úkoly oblasti“ je zrušená.
- **Talenty** se odemknou na 4. úrovni hrdiny. **Orčí hrozba** dá 30 zl, 30 XP hrdiny navíc a otevře
  cestu do Verdant Forest (les už není otevřený od začátku). Starší uložené hry s poraženým orkem
  si talenty i les nechají.
- Odměny hotových úkolů podle seznamu: Léčivé byliny 100 XP bylin, Byliny od řeky 200,
  Čistá voda 200 XP alchymie, Kožený řemínek 200 XP kovářství. Liora při odevzdání bylin
  řekne o odpočinku a přenocování v hostinci.
- **Zelený dům** stojí 500 zl (dřív symbolicky 1 zl). Dočasný Strážný na radnici už nedává
  XP Diplomacie, jen promluví.

### Přidáno – nabídka rozhovoru u postav
- Postava s více možnostmi ukáže volbu ve spodním panelu rozhovoru (jméno postavy a tlačítka
  po třech v řadě, výška 62, písmo 22, klávesy 1–9, Esc = odejít): Bylinkářka, Rybář, Hornický mistr (obchod + rozhovor, u Bylinkářky i úkol),
  Liora (úkol, vyléčit partu, úschovna monster), Starosta (úkol, dům na prodej, rozhovor),
  Trhovkyně a Obchodník s látkami (obchod + rozhovor), Alchymista a Učednice (úkol + rozhovor).
- Úkol je v nabídce první (Nový úkol / Úkol / Odevzdat úkol), nový a splněný má zlaté písmo.
- Bez nabídky zůstává první návštěva s dárkem (srp, prut, krumpáč), úkol Za léčitelkou
  (splní se rozhovorem) a postavy s jedinou možností.

### Změněno – balance poškození monster
- **Rozdíl úrovní:** každá úroveň útočníka nad cílem +6 % poškození technik monster, pod cílem
  −6 %, nejvýš ±50 % (`DamageCalculator.levelDamageMultiplier`). Platí v ručním souboji
  i v simulaci, kouzla hrdiny a házené přípravky beze změny.
- Přesila silnějších nepřátel bez přípravy prohrává (2× úr. 5 proti 4× úr. 10: rychlý souboj 0 %),
  s jídlem, výbavou a taktikou je vyhratelná (odhad ručního boje bez taktiky: +20 % statů ≈ 22 %,
  +35 % ≈ 70 %). Slabší nepřátelé naopak padají rychleji.

### Přidáno – den a noc
- **Herní čas** (`systems/TimeSystem.js`, uložený v `state.time` = den + minuta): 1 minuta hraní
  = 1 herní hodina. Den 05:00–23:00 (18 min), noc 23:00–05:00 (6 min). Čas běží ve světě
  a v interiérech, ne pod kartami, v pauze, obchodech a soubojích. Nová hra začíná v 05:00 (úsvit),
  staré uložené hry také.
- **Tma:** od 21:00 se stmívá, ve 23:00 je noc, od 04:00 se rozednívá, v 05:00 je šero a v 07:00
  plný den. Hrdina nosí stále lucernu: pole do vzdálenosti 8 polí jsou světlá (poslední 2 pole
  plynule slábnou), vše se kreslí hranatě po celých polích. Za hranou tma plynule houstne až do
  úplné tmy na okraji obrazovky (podle přiblížení). HUD a výzvy zůstávají světlé.
- **Hodiny:** v horním řádku tabulky HUD vpravo („Den 1 · 05:00 · Úsvit“), v interiéru vpravo dole.
- **Hostinec:** výčepní podle denní doby nabízí přenocování (20:00–05:00, 10 zl, spí se do
  úsvitu, se snídaní) nebo odpočinek přes den (5 zl, +2 hodiny, bez snídaně). Obojí vyléčí
  partu a obnoví manu. Výčepní čas nezmiňuje.

### Změněno – hlavní obrazovka
- Tlačítka hlavního menu jsou z herního UI (modrá tlačítka jako v pauze a na kartách, 68 px,
  písmo 26) s ikonou vlevo, bez panelu pod nimi. Nedostupné volby jsou šedé.
- Sloupec tlačítek je vystředěný pod drahokamem v logu (x 1021), mezery 10 px, spodní tlačítko končí u paty vodopádu (y 840).
- Odstraněny cvičné souboje: prototyp Soul Clash (`SoulClashScene.js`) je smazaný celý.
- Enter = Pokračovat (je-li rozehraná hra), jinak Nová hra. Hlášky jsou na panelu nové sady.

### Změněno – lokace v HUD (vratka)
- Název lokace už není samostatný štítek nad panelem: průhledná tabulka panelu party se
  o řádek zvětšila nahoru a lokace je v jejím horním řádku (jedna společná tabulka).

### Opraveno – hláška „Co dál?“
- Delší hláška na kartách (např. po „Co dál?“) roste nahoru a nevyleze pod kartu.
  Karta Úkoly se po „Co dál?“ zavře až po 2,4 s, aby šla hláška přečíst.

### Přidáno – hlášení chyb (bug report)
- **Pauza → Nahlásit chybu:** okno s polem pro popis (Odeslat Ctrl+Enter, Esc zpět). K popisu
  se samo přidá oblast, interiér, pole, úroveň, sledovaný úkol, velikost okna a prohlížeč.
- Hlášení se vždy uloží v prohlížeči (`aurion-bug-reports`); tlačítko **Stáhnout reporty**
  je stáhne jako soubor .md. Při vývoji (`npm run dev`) se navíc zapíše do složky
  `bug-reports/` (soubor .json + souhrn `REPORTY.md`) přes plugin ve `vite.config.js`.
  Na GitHub Pages žádný server není – hlášení zůstane jen v prohlížeči hráče.
- Složka `bug-reports/` je v `.gitignore`. Hlášení se přenáší do dokumentu „Dragon Souls –
  Bug reporty“ (`systems/BugReportSystem.js`).

### Změněno – sledování úkolu vede po cestách
- Zlaté tečky sledovaného úkolu vedou po cestách, dokud to jde, i když to není nejkratší
  trasa: pole mimo cestu stojí 12× víc než cesta (dřív 3×), z cesty sejdou až na posledním
  úseku k cíli. Z náměstí k jeskyni 63 z 67 polí po cestě, do lomu 50 z 53, do Opuštěného
  lomu 100 ze 105 (`TRAIL_OFFROAD_COST` ve `WorldScene.js`).

### Změněno – geny monster podle povahy druhu
- Geny (0–15, hráči se dál nezobrazují) se u nově získaných monster losují podle archetypu
  druhu: obránce (golemové, strážci, želvy, medvěd, Earth Elemental…) vyšší zbroj, vitalita
  a síla, nižší rychlost; šelma (vlk, rys, liška, kanec…) vyšší rychlost a síla, nižší zbroj;
  létavec, kouzelník, hromotluk, drak, had / vodní tvor a hmyz mají vlastní rozložení, ostatní
  podle živlu. Každý jedinec má dál náhodný rozptyl ±5 (originalita). Průměr na 300 losech:
  Earth Elemental zbroj 10,8 / síla 11,1 / rychlost 4,1; Dire Wolf rychlost 11 / síla 11 /
  zbroj 3,7 (`MonsterSystem.rollGenes`, `geneArchetype`). Už chycená monstra se nemění.

### Přidáno – karta Party: bonusy statistik zeleně
- U statistik monstra je jako v kartě hrdiny zeleně „+N“: o kolik je statistika v souboji
  vyšší díky velitelskému bonusu (statistiky hrdiny / 5 + talenty), důvěře (Bond), talentu
  Vůdce smečky, jídlu, elixíru a výbavě / výztuze hrdiny. Tooltip řádku vypíše hodnotu
  v souboji a odkud bonus je. Výpočet je stejný jako v souboji (`systems/MonsterStatBonus.js`).

### Změněno – simulace podle pravidel rychlého souboje
- Simulace souboje (Simulovat) i šance na výhru v okně před bojem se počítají podle pravidel
  rychlého souboje bez mřížky: všichni na dosah, útok na dálku bez postihu a nepřátelé míří
  přednostně na monstra s útoky na dálku (mezi nimi na nejzraněnější), jinak na monstrum
  s nejnižším podílem HP (`BattleSimulationSystem.pickTarget`). Bez přehrávání průběhu.

### Opraveno a změněno – Orčí válečník: jeskyně u Jižních plání, bez povolení
- **Jeskyně orčího válečníka chyběla** (vchod se ztratil při předělání oblasti v editoru,
  úkol Orčí hrozba nešel splnit). Nový vchod je v útesu na okraji Jižních plání (7/57)
  s mýtinou před ním; nastavuje se při načtení mapy (`caveEntrance`), takže ho další úprava
  oblasti v editoru nesmaže. Oblast „Jeskyně orčího válečníka“ v HUD, tečky úkolu vedou k ní.
- **Lovecké povolení je zrušené:** úkol Orčí hrozba dává jen talentové stromy, Verdant Forest
  je otevřený od začátku. Texty úkolu a starosty upravené.

### Změněno – tutoriál souboje, modifikátor nástrojů
- **Tutoriál (Krotitelova zkouška):** po každém kroku krátká pauza (0,65 s), pak se zatmavení,
  zlatý rámeček i text Mága objeví naráz s plynulým nástupem (dřív se text měnil hned
  a zatmavení zvlášť).
- **Modifikátor vyrobených nástrojů podle stupně:** krumpáče +1 až +6, srpy +1 až +5, pruty
  +1 až +3, háčky / naviják / bodec +1 až +4; staré nástroje od NPC +0. Každý bod: šance na
  kus navíc +2 % (Těžba, Sběr bylin), doba těžby / sběru −3 %, u Rybolovu čekání −3 % (prut
  i háček se sčítají). Modifikátor je v popisu předmětu a zeleně „+N“ u slotu Nástroje.

### Změněno – oblast Greenvale: cesty, rozcestníky, názvy oblastí, Opuštěný lom
- **Opuštěný lom** (malý štěrkový lom na jihozápadě): Ametystová dutina (úr. 18, vyřazená
  z hlavního lomu) jako skála se 4 žilami a jediné vzácné naleziště **Žíla dračího železa**
  (úr. 92, fialový kruh, jen jedno pole). Hlavní lom má dál všechny žíly úr. 1–10.
- **Kultivované cesty:** stromy těsně u cesty a hned před ní (koruna by cestu zakryla) zmizí
  a mezi cestou a loukou je vždy pruh trávy. Děje se při načtení mapy (`cultivatePaths`
  v `data/maps/index.js`), takže to přežije i nové vygenerování oblasti z editoru.
- **Rozcestníky:** rozcestí mimo náměstí se najdou samy; stojí u nich ukazatel a když k němu
  hrdina dojde (do 3 polí), ukáže se nad ním, kam která cesta vede (šipka + první
  pojmenovaná oblast na větvi). V Greenvale jich je 5.
- **Názvy oblastí a poloha v HUD:** ve štítku nad středem spodního panelu party (dřív vlevo
  nahoře pod FPS) je „Greenvale – název“ (Opuštěný lom,
  Lom Greenvale, Statek, Jeskyně, Rybářské molo, Náměstí, louky setkání, Vesnice Greenvale);
  mimo pojmenované oblasti jen „Greenvale“ (`map.areas`, `areaAt`).

### Přidáno – sloty Nástroje a základní nástroje od NPC
- **Karta Inventář má vpravo sekci Nástroje** s vlastními sloty mimo mřížku inventáře:
  Krumpáč, Srp, Prut, Háček / naviják, 7 pomocných nástrojů Těžby (kladivo na rudu, klín,
  kleště na krystaly, majzlík, vrták, kladivo na astrální kámen, ochranné kleště) a 2 řemeslné
  (Koželužské nože, Šperkařská lupa). Karta je posunutá doleva, aby byla i se sekcí vystředěná.
- Nástroj ve slotu platí stejně jako dřív (profese ho najdou). Do prázdného slotu se při
  otevření inventáře přesune nejlepší nástroj daného druhu, nový nástroj jde do prázdného
  slotu sám. Klik na slot = výběr jiného nástroje z inventáře nebo „Sundat“; dvojklik na
  nástroj v inventáři ho dá do slotu (výměna). Najetí myší ukáže popis vlevo dole.
- **Základní nástroje od NPC:** Hornický mistr dává Starý krumpáč, Bylinkářka Starý srp,
  Rybář Starý prut a Starý háček. Jsou běžné, bez bonusů (stupeň I) a obchodník je vykoupí
  za 1 zlatý. Krumpáče, srpy a pruty z obchodů a Kovářství zůstávají beze změny.

### Výkon – bloky stromů uvnitř lesa
- Stromy uvnitř lesa (všech 8 sousedních polí neprůchozích – hrdina k nim nedojde) se
  nekreslí jednotlivě: stromy ve stejném pruhu 4 hloubkových řad a krátkém úseku (~8 polí)
  se spečou do jednoho obrázku. V Greenvale je to 1 902 stromů ve 179 blocích; okrajové
  stromy (1 070) zůstávají samostatné, takže hrdina za ně zajde správně.
- Bloky vznikají až u kamery (viditelné hned, v rezervě nejvýš 3 za snímek) a daleko mimo
  záběr se uvolní – v paměti grafické karty bývá ~20–40 MB.
- Měření v nejhustším lese: 1 096 stromových obrázků na obrazovce → 148 stromů + 38 bloků,
  čas snímku 2,38 → 2,12 ms (stejně jako bez stromů); chůze lesem průměr 2,27 ms, 99 % snímků
  pod 3,7 ms. Vypnutí: `FOREST_BLOCKS = false` ve `WorldScene.js`. Stromy v blocích nejdou
  posouvat editorem terénu (Alt+F8).

### Změněno – ikony monster jen s hlavou
- Ikony monster ukazují jen hlavu (dřív celé tělo): seznam a náhled výskytu v Bestiáři,
  seznam i portrét v kartě Party a dolní panel party. Hlava se vyřízne z prvního snímku
  automaticky (nejvyšší výběžek obrysu na přední straně těla); u 36 druhů, kde by výřez
  trefil křídlo, hřbet, ocas nebo krystaly, je poloha hlavy zadaná ručně (`HEAD_HINTS`
  v `battle/monsterAnimations.js`). Velké obrázky (pódium Bestiáře, model v Party, souboj,
  přehled po boji) zůstávají celé.

### Změněno – Bestiář: Výskyt místo Pozorováno
- V Záznamu druhu je místo „Pozorováno“ políčko **Výskyt** s počtem luk, kde se druh objevuje
  (louky setkání ve všech regionech). Klik otevře **náhled mapy** regionu (stejná mapa jako
  v kartě Mapa): louky jsou zlatě orámované s názvem a na každé pomalu bliká obrázek monstra.
  Pod mapou seznam luk s úrovněmi monster (vzácná louka označená). Druh bez určené louky ukáže
  mapu své oblasti s poznámkou. Zavře Esc, tlačítko nebo klik mimo okno.

### Změněno – lom: skály se 4 nalezišti
- **Lom obsahuje každou žílu úrovně 1–10 jednou** (dřív jen 3 druhy a Ametystová dutina úr. 18
  navíc). 9 skupin: skála obarvená do odstínu suroviny a kolem ní 4 naleziště stejného druhu
  (sever, jih, západ, východ) – celkem 36 nalezišť. Nejnižší úrovně u sjezdu na východě:
  Měděná žíla (1), Uhelná sloj (1), Žulový lom (1), Křemenná žíla (3), Solná skála (4),
  Železná žíla (5), Pyritová žíla (6), Cínová žíla (8), Krystalová puklina (10).
  Skála blokuje své pole. Zápis `oreGroup('Nxx', x, y)` v `greenvale.js`; generátor oblasti
  (`tools/greenvale-region.mjs`) lom už nepřepisuje. Nová dekorace `oreRock` v mapě, odstíny `depositTint` v `data/mining.js`.

### Změněno – jeden velký statek místo Bylinkové louky
- **Bylinková louka je zrušená** (ohrada západně od statku zmizela, zůstává tráva).
- **Statek je jedna velká ohrada** kolem Statku, větrného mlýna, stáje, studny a polí
  (x 73–91, y 75–83): vstup od mostu na západě, brána na jih. Staré malé ohrady statku jsou pryč.
- Všech 13 nalezišť z louky je uvnitř statku: záhony Z01–Z03 u mlýna, divoké byliny L01–L09
  a Hustý bylinný porost SH1 na polích u stáje. Všechna jsou dostupná (ověřeno). Naleziště
  L01–L09 se jmenují „Statek – …“ místo „Bylinková louka – …“.

### Změněno – úkoly: Co dál?, Liora místo Písně větrů
- **Co dál?** – šedé tlačítko v rámečku vpravo nahoře v kartě Úkoly. Najde nejbližší úkol
  v oblasti (probíhající → jeho cíl, nepřijatý nebo splněný → zadavatel; vzdálenost od hrdiny
  stejně jako tečky ve světě), začne ho sledovat a kartu zavře, aby byly vidět zlaté tečky.
- **Úkol Píseň větrů je zrušený** (Mág → Bard → Mág). Magii Vzduchu dál odemyká úvodní úkol;
  Mág a Bard mají jen rozhovor.
- **Za léčitelkou** (nový): po dokončení Krotitelovy zkoušky se zadá sám – zajít za Liorou do
  Domu léčitelky (modrý „?“). Splní se rozhovorem s Liorou, která monstra vyléčí. Starší
  uložené hry ho dostanou při dalším rozhovoru s Mágem.
- **Léčivé byliny pro Lioru** (nový): Liora pak nabídne úkol (okno Přijmout / Odmítnout) –
  obstarat 3× Léčivé byliny u Bylinkářky (koupit nebo nasbírat) a přinést jí je.
  Odměna 15 zlata a zkušenosti ve Sběru bylin. Byliny jsou v obchodě Bylinkářky označené.

### Změněno – nabídka úkolu s Přijmout / Odmítnout
- Po rozhovoru se zadavatelem se úkol už nepřijme sám: otevře se okno **„Nový úkol: …“**
  s tabulkou Zadavatel, Náplň (stručně, např. „Nasbírej čisticí byliny u řeky…“), Kroky
  a Odměna a tlačítky **Přijmout (Enter)** / **Odmítnout (Esc)**. Odmítnutý úkol jde přijmout
  později – zadavatel má dál „!“. Platí pro všechny úkoly (Mág – Krotitelova zkouška a Píseň
  větrů, Alchymista, Učednice, Bylinkářka, Starosta). Soul Crystal od Mága až po přijetí,
  u Bylinkářky se po rozhodnutí otevře obchod (`InteriorScene.showQuestOffer`, `brief` v QUESTS).

### Změněno – obchodování: souhrn, rychlý vstup, náhled předmětu
- **Souhrn po obchodu:** po „Potvrdit obchod“ se uprostřed ukáže okno „Obchod uzavřen“
  (jako hláška u dokončeného úkolu) – zeleně koupené, červeně prodané předměty, zlato
  před → po a XP Diplomacie. Hráč ho musí odkliknout („Rozumím“, Enter, mezerník, Esc);
  obchod zůstává otevřený (`showTradeSummary`).
- **Navštívený obchod se otevře hned:** když hráč obchod v interiéru už jednou otevřel,
  příště se po vstupu otevře rovnou bez rozhovoru (tržiště, Bylinkářka, Rybář, Hornický
  mistr). Neplatí, když u postavy čeká úkol („!“ / „?“) – pak nejdřív rozhovor
  (`InteriorScene.autoOpenShop`, `flags.visitedShops`).
- **Náhled předmětu v obchodech:** najetí myší na ikonu nebo název (nákup i výkup) ukáže
  okénko s názvem, bonusy a popisem; klik otevře Databázi v kartě Dovednosti nad obchodem.
  Obchod se jen pozastaví – po zavření Databáze pokračuje i s košíkem (`shopItemHover`).

### Změněno – oblékání v Inventáři, Kniha kouzel pod portrétem
- **Inventář:** pravý klik na slot výbavy otevře stejné okno jako v kartě Hrdina – předměty
  pro tento slot (klik = obléct), u obsazeného slotu „Sundat“, bez předmětů „Nemáš žádné
  vybavení.“ Esc nebo klik mimo okno ho zavře. Společný kód `ui/heroCard/equipPicker.js`.
- **Karta Hrdina:** tlačítko „Kniha kouzel (K)“ je pod portrétem hrdiny (dřív vpravo od
  Zavřít). Klik na školu magie i klávesa K knihu otevírají dál.

### Opraveno a doplněno – vratky
- **Po první porážce se každý další boj vyhodnotil jako prohra** (hrdina se probouzel
  u léčitelky i po výhře). Příznak porážky se teď na začátku každého souboje vynuluje.
- **Ukazatel FPS** v levém horním rohu hry (zelená ≥ 50, žlutá ≥ 30, jinak červená).
- **Jména:** ikonka přejmenování ✎ (Party, vlastní obchod) je bez zlatého rámu – jen znak,
  pod myší zezlátne.
- **Diplomacie – DOČASNĚ:** Strážný na radnici dá při rozhovoru XP do Diplomacie až na úroveň 10
  (koupě domu). Před nahráním na GitHub rozhodnout, jestli zůstane (`grantGuardTrainingXp`).
- **Bestiář:** ve Schopnostech je fialově Bond schopnost druhu, v pravém sloupci pod kořistí
  vysvětlení důvěry (0–100, +2 za vítězství, Bond schopnost na 100, bonusy útok / obrana / rychlost).
- Obchodník s látkami už v pozdravu nezmiňuje řemínky.

### Změněno – karta Dovednosti a výroba v budově
- **Karta Řemesla se jmenuje Dovednosti** (záložka v horní liště i nadpis karty). Talentový
  strom „Řemesla“ se nemění.
- **V budově jde vyrobit vše** z dané profese, co umí kterékoli pracoviště v ní, ať hráč klikne
  na kterýkoli objekt. V Řemeslné dílně jdou u Koželužského stolu i u Šicího stroje vyrobit
  i šperkařské recepty (a naopak). Okno má pak v nadpisu název budovy („Řemeslnictví – Řemeslná
  dílna“). Soul Crystaly zůstávají u Soul Crystal Workbench v Hvězdárně (jiná budova).
  (`InteriorScene.openCooking` posílá `stations`, `CookingScene.stationFor`.)

### Změněno – souboj bez mřížky: klik na monstrum
- Bez mřížky se cíl vybírá kliknutím přímo na postavu monstra (jako postavy v interiérech),
  ne na políčko pod ní. Pod kurzorem se monstrum zvýrazní bílým prstencem, kurzor se změní
  na ruku a ukáže se tooltip; klik do prázdné trávy nic nedělá. Při překryvu vyhrává monstrum
  vpředu (`BattleScene.unitAtPointer`). Souboj na mřížce beze změny.

### Přidáno – Prodat X
- Ve výkupu všech obchodů (obchodníci na tržišti, Bylinkářka, Rybář, Hornický mistr) je mezi
  „Prodat 1“ a „Prodat vše“ tlačítko **Prodat X**. Otevře okno s volbou množství: číslo se píše
  na klávesnici, šipky ↑ ↓ mění o 1, tlačítka −10 / −1 / +1 / +10 / Max; pod číslem je, kolik
  hráč dostane (u Rybáře včetně denní poptávky). Enter vloží zvolené kusy do košíku, Esc zruší
  (`askQuantity` v `ui/nameInput.js`, `sellButtons` v `ui/shopCart.js`).

### Změněno – úkoly v obchodech a oknech výroby
- **Stav po koupi:** předmět pro úkol zůstává v obchodě označený i po koupi, dokud úkol běží.
  Štítek ukazuje skutečný stav po potvrzení obchodu (např. 1/1, 3/1), splněný zeleně s ✓.
- **Kožený řemínek už nejde koupit** u Obchodníka s látkami – vyrábí se z kůže (úkol Kožený řemínek).
- **Recepty pro úkoly:** v oknech výroby (Vaření, Alchymie, Kovářství, Řemeslnictví) je recept,
  jehož výrobek chce probíhající úkol, nahoře, ve zlatém rámečku se štítkem stavu.
- **Víc úkolů najednou:** když běží víc úkolů, štítek ukazuje název úkolu v jeho barvě (zlatá,
  modrá, růžová, zelená). Předmět pro dva úkoly (např. Čistá voda pro Čistou vodu i Byliny od
  řeky) má dva štítky; zásoba se dělí v pořadí úkolů (`questMarkList`, `questMarkObjects`).

### Změněno – Taverna: levnější nocleh se snídaní
- **Pokoj na noc u Výčepní stojí 10 zlata** (dřív 15). Kromě vyléčení party a obnovení many
  dostane hráč ke snídani účinek **Masového vývaru se zeleninou**: po každém z příštích
  4 soubojů +10 HP monstrům v partě. Nahradí případný jiný aktivní pokrm a je vidět v HUD
  u Účinků (`InteriorScene.rentRoom`, `ROOM_MEAL`).
- Snídaně je zmíněná v dialogu: v popisku Výčepní („pokoj na noc se snídaní (10 zl)“),
  v odpovědi po zaplacení, při nedostatku zlata a v radě Lovce u stolu.

### Opraveno – úkol Byliny od řeky
- **Naleziště H02 Břeh řeky je zpět za kostelem** (49, 72, `data/maps/greenvale.js`). Při
  náhodném rozmístění divokých bylin se přesunulo jinam a úkol Bylinkářky „Byliny od řeky“
  (nasbírat Čisticí byliny na Břehu řeky) nešel splnit. Generátor oblasti
  (`tools/greenvale-region.mjs`) teď naleziště z úkolů (`QUEST_HERB_SITES`) nepřesouvá, ostatní
  divoké byliny zůstávají náhodně. Jiné úkoly na přesunutá naleziště neodkazují.

### Výkon – svět Greenvale
Změřeno v Greenvale u náměstí: čas snímku 3,28 → 2,42 ms (−26 %), vykreslení 2,78 → 2,09 ms.
- **Grafika mimo záběr se nekreslí** (`WorldScene.cullRect / cullPoint`, v `cullGround`):
  - značky nalezišť (byliny, těžba, rybaření), vstupní kruhy budov a značky NPC;
  - ploché dlaždice (most, molo, vodopád) a stěny lomu.

  Phaser grafiku neořezává a každý snímek ji přepočítává i daleko mimo obrazovku. Kreslicích
  příkazů grafik za snímek je teď 4 402 místo 29 188 (−85 %).
- **Méně bodů na elipsu** (`ELLIPSE_POINTS = 20` místo 32) u značek a kruhů. Vzhled je stejný.
- **Ladicí mřížka (G) se postaví až při prvním zapnutí.** Dřív vznikala při každém startu světa:
  576 skrytých textů a grafika se 475 tisíci příkazy. Ve světě jsou teď 4 texty místo 580
  a textur je o 576 méně (paměť a rychlejší start světa).

### Přidáno – Kniha kouzel
- **Kniha kouzel v kartě hrdiny** (`scenes/SpellbookScene.js`, přepsaná stará anglická scéna).
  Otevírá ji tlačítko „Kniha kouzel (K)“ vpravo od Zavřít nebo klávesa K. Klik na školu magie
  otevře knihu rovnou na stránce té školy (dřív se ukázal jen malý seznam).
  - **Vlevo** je šest škol s úrovní a počtem kouzel; zamčené školy jsou označené. Šipky
    nahoru / dolů přepínají školu.
  - **Vpravo** jsou kouzla školy seřazená jako v souboji: útočná podle úrovně školy, potom
    podpůrná, s nápovědou, jak se v souboji sesílají.
  - U každého kouzla je cena many (s talenty), síla včetně skutečného poškození hrdiny
    („teď ~N“), cíle (1 / 2 / 3 / plocha 3×3 / všichni / celá parta), živelný efekt se šancí,
    popis a stav („umíš“, „od úrovně N“, „zamčená škola“).
  - Esc nebo K zavře knihu a karta hrdiny pokračuje.

### Změněno – kouzla hrdiny
Přepracovaná kouzla (`data/spells.json`, `BattleScene.castSelectedSpell / spellTargets /
castSupportSpell`): každá škola má svou roli, je 39 kouzel (11 nových). Stávající kouzla si
nechala id, takže uložené hry fungují dál a nová kouzla se do knihy doplní podle úrovně školy.
- **Oheň – silné útoky:**
  - Ohnivá jiskra se šancí na spálení;
  - Plamenná stěna na 2 cíle;
  - nová **Ohnivá koule s plochou 3 × 3 pole**: zasáhne cíl a všechny nepřátele kolem něj, bez
    mřížky cíl a jeho sousedy v řadě (`spell.area`);
  - Meteorický úder je nejsilnější zásah jednoho cíle;
  - Pekelný žár zasáhne všechny nepřátele.
- **Voda – léčení:**
  - Léčivý pramen (12 HP);
  - nové **Osvěžující déšť** (celá parta), **Pramen života** (28 HP a odstranění negativních
    efektů) a **Příliv obnovy** (celá parta 20 HP a odstranění efektů);
  - útočná kouzla mají šanci zmrazit, Mrazivá vlna zasáhne 2 cíle.
- **Země – obrana vlastních monster:**
  - Kamenná kůže;
  - nové **Kamenná hradba** (+3 Zbroj celé partě), **Žulový štít** (+7 Zbroj na 3 tahy) a
    **Pevnost hor** (+6 Zbroj celé partě na 3 tahy);
  - Kamenný výbuch zasáhne 2 cíle, Zlom země všechny nepřátele se šancí na omráčení.
- **Vzduch – rychlost:**
  - Zadní vítr;
  - nové **Vichřice v zádech** (+3 Tempo celé partě) a **Bouřný spěch** (+7 Tempo);
  - nová **Bouře** zasáhne všechny nepřátele se šancí na paralýzu, Hromový zásah také paralyzuje.
- **Světlo:**
  - nové **Světlo naděje** (+3 Síla celé partě);
  - Pád hvězdy zasáhne 3 cíle.
- **Temnota – prokletí:**
  - Stínový šíp a Trhlina duše mají šanci prokletí;
  - Paprsek propasti zasáhne všechny nepřátele.
- **Živelné bonusy:** účinnost podle živlu cíle už ve hře byla a platí pro každý zasažený cíl.
  Nově přibyly živelné stavové efekty: oheň = spálení, voda = zmrazení, země = omráčení,
  vzduch = paralýza, temnota = prokletí.
- Kniha kouzel v souboji ukazuje počet cílů nebo plochu a šanci na efekt. Karta Hrdina a Kniha
  kouzel ukazují „celé party / 3 cíle / plocha 3×3 / všichni nepřátelé“.
- Hláška o zkušenostech školy je česky („Magie Oheň +5 EXP“) a na nejvyšší úrovni už nepíše „+0 EXP“.

### Opraveno – čitelnost písma v nižších rozlišeních
Příčina: hra kreslí obraz 1920 × 1080 a prohlížeč ho zmenšoval na velikost okna „nejbližším
pixelem“ (`image-rendering: pixelated`, `pixelArt: true`). Z tenkých tahů písmen tak vypadávaly
celé řádky pixelů. Při 1280 × 720 se třeba „máš 99“ četlo jako „máš 93“.
- **Vyhlazené zmenšení obrazu** (`index.html`, `main.js`): plátno se zmenšuje s vyhlazením. Při
  1920 × 1080 se nic nemění.
- **Vyhlazené textury písma** (`main.js`, `smoothTextTextures`): texty se do obrazu zmenšují
  s vyhlazeným filtrem. Sprity, mapa a ikony zůstávají ostré (pixel art).
- **Světlejší šedá** (`main.js`, `READABLE_GREYS`): 15 málo kontrastních šedých a šedomodrých
  odstínů textů je zhruba o čtvrtinu světlejších a zachovávají si odstín. Platí pro všechny texty
  (při vytvoření i `setColor`), včetně nápisů zakázaných tlačítek. Nejvíc je to vidět v Řemeslech
  (popisy receptů, „máš N“, původ receptu).

### Přidáno – souboj bez mřížky
- **Nová volba před bojem „Bez mřížky (R)“** vedle Bojovat (na mřížce), Simulovat a Útěk
  (`BattleScene.enterSimpleMode`). Tahový souboj zůstává se stejným pořadím tahů, ale:
  - nikdo nechodí a všechny vzdálenosti se počítají jako „vedle sebe“ (`BattleScene.dist`),
    takže každá schopnost i podpora dosáhne na každý cíl;
  - útok na dálku nemá postih −70 %;
  - jednotky stojí ve dvou řadách proti sobě, bez políček, desky a překážek. Zvýraznění je jen záře
    pod jednotkami.
  - Nepřátelé přednostně útočí na monstra s útoky na dálku (kouzla), mezi nimi na nejzraněnější
    (`chooseSimpleTarget`). Když žádné takové není, rozhodují jako dřív.

  Souboj na mřížce zůstává beze změny.

### Opraveno – jméno hrdiny
- **V souboji už se neobjevuje „Arion“** místo jména hráče (`BattleScene.heroName / heroVerb`).
  Opravené texty:
  - tlačítko „Kouzlit (jméno)“ a nápověda ke kouzlům;
  - hlášky o seslání kouzla, o kouzlu už použitém v tomto kole, o útěku, o porážce a o novém postupu
    na úroveň;
  - souhrn simulace („bez tvých kouzel“).

  Sloveso se řídí pohlavím postavy (seslal / seslala, upadl / upadla, „Přinesou ho / ji“).
  „Arion“ zůstává jen jako výchozí jméno, když hráč žádné nezadá.

### Přidáno – Jména
- **Společné okno pro zadání jména** (`ui/nameInput.js`): píše se na klávesnici, Enter potvrdí,
  Esc zruší. Tlačítko vpravo vrátí výchozí jméno. Klávesnice karty je během psaní vypnutá, takže
  písmena nespouštějí zkratky. Používá ho pojmenování monstra po chycení v souboji (stejné
  chování jako dřív) i obě nová přejmenování.
- **Přejmenování monstra kdykoli po chycení:** v kartě Party je tlačítko ✎ hned za jménem
  monstra. Prázdné jméno nebo „Jméno druhu“ vrátí jméno druhu. Dlouhé jméno se zúží, aby
  nepřekrylo živel.
- **Přejmenování vlastního obchodu:** v kartě obchodu je tlačítko ✎ za názvem, nejvíc 28 znaků,
  „Původní název“ vrátí Zelený dům u náměstí. Nový název se ukazuje v kartě, v nadpisu interiéru,
  ve výzvě u dveří („E: vstoupit – …“) a v přehledu Diplomacie.

### Přidáno – Diplomacie (1. etapa: vlastní obchod)
Podle dokumentu „Diplomacie“ (`data/diplomacy.js`, `systems/DiplomacySystem.js`, `scenes/OwnShopScene.js`).
- **Dovednost Diplomacie** (úroveň 1–100, třídy I–VI, křivka XP jako u ostatních profesí). Na kartě
  Profese má přehled: úroveň, XP, zdroje XP, odemykání funkcí a vlastní provozovny.
- **XP Diplomacie** jde ze tří zdrojů:
  - **obchody:** každý předmět má vlastní XP hodnotu podle ceny a vzácnosti. Platí to pro prodej
    NPC, nákup u NPC (polovina) a prodej ve vlastním obchodě. Počítá se položka, ne kus.
    Opakovaný obchod stejného předmětu během herního dne slábne (×0,8, nejméně 10 %).
    Bezcenné předměty XP nedávají;
  - **úkoly:** 50 XP, jednorázově za každý splněný úkol;
  - **nové rozhovory s NPC:** 10 XP. Stejný rozhovor znovu nedá nic.
- **Zelený dům u náměstí** (`greenvale_house_w1`) má dveře na JZ (68, 64):
  - pod Diplomacií 10 má šedý zamčený vstupní kruh, od úrovně 10 fialový;
  - koupě je u starosty Edrica: po rozhovoru nabídne dům v okně s volbou;
  - cena je zatím 1 zlatý (ekonomika se doladí později), typ Malý obchod (16 slotů, ~30 zákazníků
    za herní den, provoz 2 zl / den).
- **Vlastní obchod:** interiér s prodejním pultem, skladem a účetní knihou, které otevírají kartu
  obchodu se třemi záložkami:
  - **Prodej:** 16 slotů, cena (−10 / −1 / +1 / +10, tržní cena), hodnocení ceny, popularita,
    regionální poptávka, nasycení trhu, odhad prodeje za den a XP za prodej;
  - **Sklad:** přesun z inventáře a zpět, nabídnutí do slotu;
  - **Statistiky:** tržby, náklady, čistý provozní příjem, zákazníci, obchody, reputace, poslední
    dny, nejprodávanější a neprodávané zboží, historie obchodů.

  Objednávky a Zaměstnanci jsou zamčené pro další etapu. Obchod jde zavřít a otevřít.
- **Simulace prodeje:**
  - herní den trvá 24 minut hraní, prodej běží jen při zapnuté hře (žádný offline příjem);
  - každých 10 s přicházejí zákazníci 7 typů podle profilu Greenvale (rozpočet, preference
    kategorií, tolerance ceny), každý s 1–2 potřebami. Nakupuje podle vzorce z dokumentu:
    popularita × preference × region × (hodnota/cena)² × nasycení;
  - nasycení trhu sdílejí všechny obchody v oblasti a obnovuje se podle rychlosti spotřeby;
  - reputace 0–100 mění návštěvnost (férové ceny, rozmanitost a obchody ji zvedají, předražení ji
    snižuje) a nový stupeň reputace dá jednorázově XP;
  - provoz se platí na konci dne. Bez peněz se obchod zavře se zachovaným zbožím a otevře se po
    úhradě dluhu.

  Popularita a ekonomická kategorie se počítají pro všech 850 předmětů. Klíče a příběhové
  předměty prodat nejde.

### Změněno – mapa Greenvale
- **Nové rozložení oblasti Greenvale z editoru** (`tools/greenvale-region.mjs`, úpravy
  v `tools/greenvale-region-edits.json`). Louky a cesty jsou podle editoru, oblast se rozrostla
  na západ, na jih a na jihovýchod. Detaily doladil skript:
  - osamocená pole (missclick) jsou podle sousedů;
  - nová pobřeží a okraj mapy lemují útesy, kromě jezírka u x 36, y 111;
  - nově nakreslená tráva mimo cesty, louky, budovy a naleziště je zalesněná;
  - kde by les uzavřel louku nebo naleziště, vede k nim travnatá stezka (vše je dosažitelné ze spawnu).

  Rybaření u jezírka (36, 109) je nové místo Lesní řeka (úr. 10). V lomu je 12 nalezišť
  úr. 8–18: Krystalová puklina ×6, Cínová žíla ×3, Ametystová dutina ×3. Divoké byliny H01–H07
  jsou rozmístěné náhodně po oblasti. Dvě vzácné mýtiny (H12), které skončily ve vodě
  a v útesu, jsou přesunuté hluboko do lesa. Zóny setkání pokrývají všechny louky:
  - původní zóny jdou za svými loukami;
  - 7 nových luk má úroveň podle vzdálenosti od vesnice (8–16), např. Větrná pláň,
    Louka u jezírka nebo Odlehlá východní pláň.

  18 dekorací na vodě či ve stromech je pryč.
- **Brána do Verdant Forest** je přesunutá na konec dlážděné cesty na jihovýchodním okraji
  (98, 121, `HAND_MAP_EXITS` v `data/maps/index.js`). Původní místo (93, 97) je po novém rozložení v lese.
- **Odkaz na editor oblasti** je v dokumentu Zadání práce (sekce Nástroje), aby šla mapa upravovat kdykoli.
- **Výkon: stromy mimo obrazovku se nekreslí** (`WorldScene.cullGround`). Les má ~3 000 objektů
  a v záběru jich bývá jen 50–300.
- **Editor oblasti Greenvale** (`map-editor.html`, při běhu hry na `/map-editor.html`): 2D pohled
  shora na celou oblast načtený přímo z `data/maps/greenvale.js`. Terén se kreslí štětcem
  (velikost 1–3), výplní nebo se nabírá kapátkem. Pravé tlačítko vrací pole do stavu ve hře
  a funguje Zpět / Znovu. Zobrazit jde budovy s dveřmi, zóny setkání, zvýraznění změn
  a mřížku. Úpravy se ukládají v prohlížeči (`greenvale-map-editor`) a do hry se zapracují
  na požádání.
- **Průchozí cesta za radnicí** (`collisionAspect` u budovy v `data/maps/greenvale.js`,
  `WorldScene.fitBuildingCollision`). Obrázek radnice je mnohem větší než její půdorys v mapě
  a jeho okraj vlevo dole (stín) táhl kolizi o víc než pole na západ, přes dlážděnou cestu
  mezi radnicí a modrým domem. Radnice teď má vlastní poměr stran kolize (2 : 3): cesta na
  západě i dokola za budovou je průchozí, zdi blokují a dveře zůstávají volné.
- **Lom Greenvale** (`tools/greenvale-quarry.mjs`, `WorldScene.groundLift / isQuarry /
  drawQuarryWalls`, štěrk v `world/terrainTiles.js`): jižně pod Bylinkovou loukou zahloubený
  lom – dno leží o 40 px níž, po zadních okrajích vrstvené skalní stěny, sjezdy po cestě
  z jižní cesty a od statku (cesta mírně klesá), hrdina plynule sestupuje. Zem je nová
  vygenerovaná dlaždice štěrku (kamínky, stíny, vrstvené boky), u stěn ve stínu; balvany
  po okrajích. 12 nalezišť do úr. 10: Měděná žíla ×2, Uhelná sloj ×2, Žulový lom ×2,
  Železná žíla ×2, Křemenná žíla, Solná skála, Pyritová žíla, Krystalová puklina; uprostřed
  mýtina se střídavou vzácnou Cínovou žílou, Skrytá žíla a meteorit zůstávají.
- **Louky setkání s vlastními monstry a úrovněmi** (`encounterZones` v `data/maps/greenvale.js`,
  `encounterZoneAt` v `data/maps/index.js`, `BattleScene.createWildMonsters`): úroveň monster
  už neurčuje úroveň hrdiny, ale louka. Všechny louky jsou otevřené; při vstupu se ukáže
  název a úrovně, v okně setkání „Setkání – název louky“.
  - Louka za Loveckou chatou úr. 1–3 (Dire Wolf, Wild Boar)
  - Severní pastvina úr. 3–5 (Wild Boar, Goblin, Forest Sprite)
  - Jižní pláně úr. 5–7 (Goblin, Giant Spider, Zephyr Hound)
  - Lesní paseka (nová, jih) úr. 7–9 (Giant Spider, Galecrest Lynx, Briarbound Wisp)
  - Skalní stráň (nová, severovýchod) úr. 8–10 (Hobgoblin, Cave Worm, Cave Bear, Zephyr Hound)
  - Útes ztracených (nová, jihovýchodní poloostrov) úr. 14–16, vzácná (Thornroot Stag,
    Earth Elemental, Mossveil Lynx)
- **Cesty a hustý les** (`tools/greenvale-wilds.mjs`): odbočky cest ke všem loukám, lesní pásy
  mezi loukami s průchodem; mimo cesty, louky, budovy a naleziště je hustý les (~460 stromů),
  takže se chodí po cestách. Dveře, naleziště a louky ověřené jako dostupné.
- **Skryté mýtiny se vzácnými nalezišti** (`rareSpots`, `activeRareSpots`): 5 mýtin v lese
  s neoznačenou stezkou; vždy 2 mají vzácné naleziště (Bouřková kapradina úr. 16, Ametystová
  dutina úr. 18, Cínová žíla, Lesní řeka), výběr se mění každé 3 hodiny.
- Zkušební mřížka všech nalezišť Těžby na jihu je pryč (lom přijde s kartou Těžba).
- Zkušební rybářská místa ostatních oblastí (úr. 20–90) u Rybářské chaty jsou pryč; zůstal
  rybník, molo a Lesní řeka (do úr. 10).

### Grafika
- **Obrázky monster z listu „Fantasy RPG Bestiář: 16 Příšer“** (`MONSTER_STILL_SHEETS`
  v `data/monsterSheets.js`, `prepareStillSheets` v `battle/monsterAnimations.js`): statický
  list 2 × 8 monster, která se najdou podle mezer mezi nimi. Když se dotýkají, rozdělí se
  v nejužším místě. Vlastní obrázek dostalo 14 druhů, které dosud měly kreslený model:
  Wild Boar, Cave Slime, Sporeback Toad, Crystal Spider, Sunshard Beetle, Sphinx, Prism Herald,
  Comet-tail Fox, Dawncoil Serpent, Star Seraph, Stormneedle Manta, Whistlewing Bat, Succubus
  a Pit Fiend. **Dire Wolf** má nový obrázek ve stylu ostatních monster místo vlastní animace.
  Bez obrázku zůstává jen Ignaroth: lávový golem v listu se k ohnivému drakovi nehodí.
- **Nové ikony předmětů (icons11)**: list „Fantasy RPG ikony surovin a výbavy“ rozřezaný po
  řádcích (`tools/split-icons-grid.ps1`) na 87 ikon v `public/assets/items/icons`, záznam
  v `data/itemIcons.json`. Vlastní ikonu místo společné zástupné dostalo 84 předmětů
  (mapa `ICONS11` v `data/items.js`): 12 bylin, 17 kovů a kovářských surovin, 20 zbraní,
  8 výztuh, 2 srpy, sůl, mouka, zelenina, 13 druhů masa a 9 kuchyňských meziproduktů.
  Zbývajících 336 výrobků bez vlastní ikony je v dokumentu „Chybějící ikony“.
- **Ikony výrobků (icons12–15)**: listy „Atlas fantasy alchymistických ikon“ (106), „Atlas
  fantasy ikon předmětů RPG“ (74), „Fantazijní mřížka jídelních ikon“ (102) a „Ikonová sada
  fantasy vybavení a surovin“ (51) rozřezané a přiřazené (`RECIPE_ICONS` v `data/items.js`):
  vlastní ikonu má 333 výrobků Vaření, Alchymie, Kovářství a Řemeslnictví. Bez ikony zbývá
  Korálovka na vodním květu, Makrela na ledové mátě a Elixír větrné bouře.

### Změněno
- **Reset po porážce, léčitelka a pokoj v hostinci** (`InteriorScene.js`, `BattleScene.js`):
  - Liora se přestěhovala z hostince do Domu léčitelky (dřívější dům se zrzavou sousedkou
    u náměstí, na mapě „Dům léčitelky“). Léčí zdarma; přesouvání monster mezi partou
    a úschovnou je teď u ní.
  - V hostinci je místo ní Výčepní: pokoj na noc za 15 zlata – stejné vyléčení (mana,
    monstra v partě i v úschovně).
  - Hostinec a Dům léčitelky jsou místa odpočinku: hra si pamatuje poslední navštívené.
    Po porážce v souboji se hrdina probudí tam, všichni vyléčení, a výčepní / Liora ho
    přivítá. Bez navštíveného místa je výchozí hostinec.
- **Karta hrdiny** (`HeroScene.js`, `ui/heroCard/heroPicker.js`):
  - Pravý klik na slot výbavy otevře okno s předměty pro tento slot z inventáře (ikona,
    název, bonus); klik = obléct (dosavadní kus jde do inventáře). Obsazený slot má navíc
    „Sundat“. Bez vhodných předmětů: „Nemáš žádné vybavení.“
  - Klik na školu kouzel ukáže kouzla školy: mana, poškození / léčení, potřebná úroveň školy
    a stav (umíš / od úrovně N / nenaučeno / škola zamčená).
  - Ukazatel úrovně v tlačítkách dovedností je větší (úroveň a procenta, na úr. 100 „max.“).
  - Okno zavře klik mimo něj nebo Esc. Názvy škol ve stavovém řádku jsou česky.
- **Testovací hra**: Bestiář je kompletně odemčený (všech 105 druhů pozorovaných).
- **Výroba – množství**: vlastní množství jde zvolit jen do počtu, který jde ze surovin vyrobit
  (+, šipka nahoru i Max se zastaví); výběr jiného receptu začíná znovu od 1.
- **Souboj – kouzla monster a vzhled** (`BattleScene.js`, `battle/battleUi.js`):
  - Magický útok (kouzlo monstra) se sesílá z místa – monstrum se nehne (hráč i nepřátelé).
    Plné poškození do 5 polí, dál −70 %.
  - Přesnost u kouzel nezvyšuje šanci na zásah, ale plný dosah: +1 pole za každých 8 bodů
    nad 80. U fyzických útoků zůstává +0,5 % k zásahu za bod (i v simulaci a v kartě Party).
  - Tooltip schopnosti je menší a ukazuje se vedle nabídky útoku (nepřekrývá Kouzlit).
  - Kouzlit (Arion) je poslední řádek tabulky útoků místo odsazeného panelu.
  - Vzhled ve stylu zbytku hry: tmavé panely se zlatavým okrajem, tlačítka jako dlaždice
    karet (zlatý výběr, zlatavý okraj pod myší), písmo karet. Všechny prvky zůstaly.
- **Bestiář – schopnosti**: detail objeveného druhu má sloupec Schopnosti – startovní
  schopnost a schopnosti na úrovních 10, 20, 40 a 80 (štítek „start“ / „úr. N“, druh, síla,
  dosah nebo „na sebe“). Kořist je vedle ve druhém sloupci, pódium a Záznam jsou nižší.
- **Sběr bylin v Greenvale** (`data/herbalism.js`, `data/maps/greenvale.js`): jen bylinky do úrovně 10.
  - Zahrádky domů: 12 nových nalezišť G01–G12 (Léčivé a Čistící byliny, Modré byliny, Hořký
    kořen, Lesní šalvěj, Poutnický tymián) u 8 domů včetně Řemeslné dílny, Lovecké a Rybářské chaty.
  - Statek: tři rozházené záhony nahradila jedna velká ohrazená Bylinková louka (x 57–68,
    y 82–86, brány na východ a na jih) – nahoře řada záhonů Z01–Z03, pod ní 9 divokých nalezišť
    L01–L09 (do úr. 8) a Hustý bylinný porost (úr. 10). Strom uprostřed louky zmizel.
  - Zkušební naleziště jiných oblastí a vyšších úrovní (H08–H19, Skryté lesní naleziště,
    Magická zahrada, Prastaré naleziště) z Greenvale zmizela; H03 a H05 se posunula, aby je
    nezakrývaly domy.
- **Chůze za budovami**: pole za budovou (sever / západ) se už neblokují – hrdina za budovu
  dojde a ta zprůsvitní. Kolize budovy sahá dozadu až po půdorys z mapy (dřív jen podle
  spodní třetiny obrázku, takže hrdina „za budovou“ stál uprostřed domu); přední strana se
  dveřmi zůstává podle obrázku. Dveře i cesty zůstaly průchozí (`WorldScene.js`).
- **Hlavní menu**: volby Nová hra, Pokračovat, Nahrát hru a Uložit hru jsou uprostřed obrazovky
  pod logem (dřív vpravo); výška beze změny (`MenuScene.js`).

### Přidáno
- **Obchody s košíkem** (společný `ui/shopCart.js`; obchodník na tržišti, Bylinkářka, Rybář
  a Hornický mistr – okna rozšířená na 1860 px): třetí sloupec Košík. U Rybáře košík počítá
  denní poptávku jen do limitu, u Bylinkářky nejde vložit víc, než je denní zásoba.
  Specializace (Bylinkářka, Hornický mistr) se volí hned, mimo košík. Tlačítka „Do košíku“,
  „Prodat 1“ a „Prodat vše“ jen vkládají; v košíku je zeleně „+“ co hráč dostane a červeně „−“
  co prodává, u každého řádku částka a tlačítko „−“. Dole „Celkem“: +N (zeleně), když prodej
  převýší nákup, jinak −N (červeně). Obchod se provede až „Potvrdit obchod“ (nejdřív prodej,
  pak nákup), „Vyprázdnit“ košík zahodí. Nákup nad rámec zlata po obchodu nejde vložit.
- **Měna – ikona mince místo „zl“** (`coinAmount` v `ui/fantasyCard.js`): ceny a zlato v obchodech
  mají za číslem zlatou minci; ve větách (zprávy, odměny úkolů, Databáze) je „zlata“.
- **Tutoriálový souboj – světelný bod**: obrazovka je zatmavená a zlatý pulzující rámeček
  ukazuje, kam kliknout: Air Elemental → útok v nabídce → Kouzla → kouzlo Vzduchu → Air
  Elemental → Ochočení → Air Elemental. Panel Mága zůstává světlý (`BattleScene.update`).
- **Kovářství – vysouvací panel sad**: „Zbroje a štíty ›“ nechá kategorie vlevo a vedle vysune
  úzký panel (Všechny, 11 kovů, Vzácné a kalené). Po výběru se zavře, zvolená sada je v názvu
  kategorie („Zbroje a štíty: Železo“). Klik mimo panel nebo Esc ho zavře.
- **HUD – hrdina, mana, XP a účinky** (`src/ui/partyHud.js`): spodní panel je jedna průhledná
  tabulka – vlevo portrét hrdiny se jménem, úrovní, ukazatelem many a XP, hned vedle „Účinky“
  s ikonami aktivního jídla, elixíru, ochrany, průzkumných lektvarů a výztuhy (až 8 ikon, při
  najetí myší název a zbývající souboje / minuty; bez aktivního účinku se rámeček skryje), pak
  monstra party s HP a XP. Klik na hrdinu otevře kartu Hrdina, klik na monstrum kartu Party
  s tímto monstrem (rámeček pod myší zezlátne). Volné body talentů hrdiny („★ Volné body
  talentů: N“, pod myší podtržené s popisem „Otevřít Talenty“) otevřou Talenty; monstrum
  s volnými tréninkovými body má místo stavu „★ Volné body: N“.
- **Karta hrdiny – bonusy z výbavy**: u Fyzického a Magického útoku, Obrany, Magické odolnosti
  a Rychlosti je zeleně „+N“ (hodnota × % z výbavy). Tooltip vypíše, z kterých předmětů a výztuhy
  bonus je (`gearBreakdown` v `SmithingSystem.js`).
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
- Úkoly: značky „!“ a „?“ zmizí hned po přijetí úkolu, splnění cíle (např. Bard) i odevzdání
  (v interiéru okamžitě, nad budovami ve světě hned po odchodu).
  - Mág ukáže „!“ Písně větrů až po dokončení úvodního úkolu.
  - První úkol má bod na louce za Loveckou chatou (32, 56): tečky vedou tam a tam se spustí
    souboj s Air Elementalem. Jinde na louce do té doby setkání nejsou.
- **Výroba trvá** ve všech oknech výroby (Vaření, Alchymie, Kovářství, Řemeslnictví):
  - Kusy se vyrábějí jeden po druhém s ukazatelem průběhu a odpočtem.
  - Jeden kus trvá 1,2 s + 0,04 s za úroveň receptu (úr. 1 ≈ 1,2 s, úr. 50 ≈ 3,2 s,
    úr. 100 ≈ 5,2 s), mezivýrobky 60 % této doby.
  - Esc výrobu přeruší, už vyrobené kusy zůstávají. Doba je vidět v detailu receptu.
- Kovářství: „Zbroje a štíty ›“ se rozklikne na podfiltry podle kovu (11 sad) a „Vzácné
  a kalené“. Kategorie Vzácné a kalené zmizela: elementální zbraně jsou ve Zbraních, ostatní
  vzácné kusy v novém podfiltru.
- **Kovářství – sady zbrojí podle kovu**:
  - Jednotlivé zbroje B01–B28 nahradilo 11 kompletních sad: měď, bronz, železo, ocel, horská
    ocel, černá ocel, mithril, adamantit, orichalk, hvězdný kov a dračí železo.
  - Každá sada má přilbu, boty, holenice, štít a zbroj, s úrovní od kovu L do L+4
    (holenice tedy až do Kovářství 95).
  - Síla roste se stupněm kovu. Kovy mají vlastní zaměření: horská ocel a adamantit Max. HP,
    černá ocel obranu, mithril rychlost, orichalk magický útok, hvězdný kov magickou odolnost
    a odolnost světlu, dračí železo Max. HP a odolnost ohni.
  - Kusy jedné sady mají stejný stupeň ikony.
  - Elementální vzácné zbroje (kategorie E) zůstávají. Staré kusy B01–B28 se z uložených her
    odeberou z inventáře i z výbavy.
- **Esc ve světě otevře Pauzu** místo hlavního menu:
  - Nabídka: Vrátit se do hry, Uložit hru, Načíst hru (5 slotů s náhledem), Hlavní menu;
    Nastavení a Vypnout hru jsou zatím šedé (`scenes/PauseScene.js`).
  - Volba rozlišení a celé obrazovky byla zrušena (nekonzistentní) – platí původní pravidla:
    hra vyplní okno, nejvýš 1920 px na šířku, 16 : 9.
- **Ořez monster**: statický obrázek monstra se ze společného listu vyřízne podle skutečného
  obrysu (hranice snímku v nejužším místě, souvislá plocha monstra) – už není uříznutá hlava,
  ocas ani křídlo a nepřilepí se kousek sousedního snímku. Chybějících 15 druhů je
  v dokumentu „Chybějící monstra“.
- Animace monster jsou globálně vypnuté: všude (souboj, Soul Clash, Party, Bestiář, panel
  party) je jen první snímek idle. Animace chůze hrdiny zůstává.
- **Soul Clash – prototyp zjednodušeného souboje** (hlavní menu → Cvičné souboje):
  - Formace 2 × 3 bez mřížky, jeden rozkaz na monstrum (schopnost, Chránit, Obrana,
    Prohodit). Bez rozkazu monstrum udělá instinktivní útok za 50 %.
  - Nepřátelé ukazují záměry (cíl a poškození). Nabíjené útoky (⚡) jde zásahy zlomit, zlomený
    nepřítel nejedná a dostává +50 %.
  - Elementální reakce: Bouře (voda → vzduch), Požár (oheň → příroda), Pára (oheň + voda).
  - Hrdina velí za Soul energii (Jehla větru, Bariéra, Duší úder).
  - Pořadí akcí je vidět, náhled poškození je přesný a animace mají rychlost 1×, 2× nebo 4×.
  - Tři cvičné souboje: Tři goblini, Smíšená tlupa, Boss Minotaurus se dvěma fázemi.
  - Parta je pevná (Dire Wolf, Fire Elemental, Water Nymph, Air Elemental).
  - Původní souboj se nemění (`scenes/SoulClashScene.js`).
- **Zrušeno pravidlo o počtu útoků**:
  - Schopnosti monster nemají omezený počet použití a v souboji ani v simulaci se neodečítají.
  - Monstrum už neomdlí kvůli vyčerpaným útočným technikám.
  - Počty použití zmizely ze souboje (nabídka útoku, lišta, tooltipy), z karty Party (místo
    nich síla útoku) i z panelu party. Staré záznamy v uložených hrách se ignorují.
  - Recept a předmět Zrcadlo duše (Řemeslnictví F18, obnovoval použití technik) jsou
    odstraněné. Řemeslnictví má teď 107 receptů, staré kusy v uložených hrách se odeberou.
- Herní obrazovka má dole **panel party**:
  - Každé monstrum má rámeček s miniaturou, jménem a úrovní, HP barem (aktuální / max,
    zelená → žlutá → červená) a počtem zbývajících útoků (součet použití útočných schopností).
  - Vyčerpané monstrum je šedé s nápisem „Vyčerpáno“.
  - Panel se překreslí sám při změně údajů a pod otevřenou kartou nebo interiérem se schová
    (`ui/partyHud.js`).
- Inventář má tlačítko **Seřadit** (vpravo vedle Zavřít):
  - Řadí v pořadí filtrů (Zbroj, Materiály, Potiony, Doplňky, Klíče, Ostatní), v kategorii
    od nejvzácnějšího a pak podle názvu.
  - Neúplné hromádky stejného předmětu se slijí a prázdná políčka jsou na konci.
- **Bestiář** je nová karta ve stylu Řemesel (záložka Bestiář):
  - Vlevo jsou filtry Všechna, Objevená, Ochočená a 7 elementů (objeveno / celkem).
  - Uprostřed je seznam druhů s obrázkem, neobjevené jsou „???“ s černou siluetou.
  - Vpravo je detail s animací na pódiu, elementem, vzácností, oblastí a popisem. Pod ním je
    záznam (pozorováno, ochočeno, poraženo, v partě) a kořist s proklikem do Databáze.
- Idle animace monster z listů v `public/assets/monsters`: přiřazeno 90 ze 105 druhů
  (`src/data/monsterSheets.js`). Zobrazují se v souboji, v kartě Party i v Bestiáři. Bílé
  pozadí uzavřené mezi nohama se odstraní. Chybějících 15 druhů je v dokumentu Chybějící ikony.
- Nová hra začíná v Hvězdárně úvodním úkolem **Krotitelova zkouška**:
  - Hrdina je lovec, Dire Wolf je jeho lovecký pes.
  - Mág sám promluví, probudí mu magii Vzduchu (hned odemčená), dá 1 Soul Crystal a pošle ho
    na louku. Úkol se rovnou sleduje.
  - Na prvním poli louky je vždy Air Elemental. Je to jeho jediný výskyt, v běžných setkáních
    už není.
  - Souboj je tutoriál s průvodcem Mágem: bez panelu před bojem, bez simulace, útěku a čekání.
    Kroky: zásah Dire Wolfem → kouzlo Vzduchu → ochočení. Ochočení se odemkne až po zásahu
    vlkem a je jisté (100 %). Air Elemental neútočí a neklesne pod 1 HP.
  - Po ochočení Mág přenese hrdinu zpět do Hvězdárny. Odměna: 5× Basic Soul Crystal, 20 zl
    a Air Elemental v partě.
- Úkol Jeskynní sliz se jmenuje **Orčí hrozba**:
  - Boss je Orčí válečník (Orc Warrior) se dvěma gobliny. Nejde simulovat ani ochočit.
  - Starosta úkol nabídne až po dokončení všech ostatních úkolů v Greenvale. Do té doby řekne,
    které chybí, a nemá „!“.
  - Na nástěnce se úkol ukáže až ve chvíli, kdy jde přijmout.
- Píseň větrů: magie Vzduchu je odemčená už z úvodního úkolu, odměnou jsou zkušenosti magie
  Vzduchu (starší hry ji odemknou jako dřív).
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
