// Mapa vesnice Greenvale: 114 × 122 polí na logické mřížce.
// Ve hře se vykresluje izometricky (kamera z jihovýchodu, pole 128 × 64 px).
//
// Vygenerováno skriptem tools/greenvale-generate.mjs (seed 7) ze zvětšeného
// rozložení podle referenčního obrázku. Dál se může upravovat ručně.
//
// Každý znak v `ground` je jedno pole. Význam znaků najdeš v src/data/tiles.js:
//   .  tráva        ,  louka – zóna setkání        :  cesta        #  dlažba
//   _  parcela      =  most        D  molo        ~  voda         ^  útes
//   T  strom        S  smrk        R  skála       C  jeskyně     F  vodopád
//
// Souřadnice polí: x = sloupec (0 vlevo), y = řádek (0 nahoře) v logické mřížce.
// Na obrazovce je pole 0,0 nahoře, osa x vede doprava dolů a osa y doleva dolů.
// Ve hře zapni klávesou G mřížku – ukazuje souřadnice pole pod myší.

// Skupina v lomu: skála na poli (x, y) a kolem ní 4 naleziště téhož druhu (S, J, Z, V).
const oreGroup = (deposit, x, y) => [[0, -1], [0, 1], [-1, 0], [1, 0]].map(([dx, dy]) => ({ deposit, x: x + dx, y: y + dy }));

export const GREENVALE_MAP = {
  id: 'Greenvale',
  name: 'Greenvale',
  // Kultivace cest při načtení (data/maps/index.js): stromy u cesty pryč, mezi cestou a loukou tráva.
  cultivatePaths: true,
  // Jeskyně orčího válečníka (úkol Orčí hrozba) v útesu na okraji Jižních plání.
  caveEntrance: { x: 7, y: 57 },

  // Pojmenované oblasti (HUD „Greenvale – název“, rozcestníky). Louky setkání mají názvy
  // v encounterZones; fallback = záložní oblast, když pole nepatří nikam konkrétně.
  areas: [
    { name: 'Opuštěný lom', x0: 0, y0: 114, x1: 9, y1: 121 },
    { name: 'Lom Greenvale', x0: 56, y0: 87, x1: 81, y1: 97 },
    { name: 'Statek', x0: 72, y0: 74, x1: 92, y1: 84 },
    { name: 'Jeskyně orčího válečníka', x0: 5, y0: 55, x1: 9, y1: 59 },
    { name: 'Rybářské molo', x0: 82, y0: 50, x1: 96, y1: 60 },
    { name: 'Náměstí', x0: 55, y0: 50, x1: 67, y1: 61 },
    { name: 'Vesnice Greenvale', x0: 38, y0: 26, x1: 92, y1: 76, fallback: true }
  ],

  ground: [
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~^^^^~^^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^..^^^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~^^TT^^^^^^^^~~~~^^^^^^^^^^^^^~~~~~~~~~~~~~~~~^^T^R..^^^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~^^TSSTTSTSTS^^^^^^ST.::.STSTT^^^~~~~~~~~~~~~~~^T.T..T.^^^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~^^,,,,,,,,STSSSTTTSTT..:.TSTTSTS^^~~~~~~~~~~~~^^ST.S...^^^^^^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~^^,,,,,,,,,,SSSTTTRSSST.:,,,,,TTTT^^~~~~~~~~~~~^^^^T.S...^^^S^^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~^S,,,,,,,,,,,TSTSTTSTST.:,,,,,,STSS^~~~~~~~~~~~~^^^......T....^^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~^^T,,,,,,,,,,,SSTSSSTTST.:,,,,,,STST^~~~~~~~~~~~~~^^.S.TT....T.T^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~^^RS,,,,,,,,,,,STSTSTTSS..:,,,,,,STSS^~~~~~~~~~~~~~^^T.T.TT..T...^^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~^TSS,,,,,,,,,,,TSSSTTSS..::,,,,,,SSSS^~~~~~~~~~~~~~~^.....TT..TT.T^^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~^SSS,,,,,,,,,,TTSTTTSS..:,,,,,,,,TTST^~~~~~~~^^^~~~~^.....TTTT..TT.^^^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~^^SS,,,,,,,,,STTTSS....:,,,,,,,,,TST^^~~~~~~^^^^^^^^^.......T......RT^^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~^TTT,,,,,STTSTTTS..:::.,,,,,,,,,TTR^~~~~~~^^.^^^^^^^^....TTT...T..R..^^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~^^TST,,,,.TSTSST..::...,,,,,,,,SST^^~~~~^^^....^^^~~^^.....T.....S..^^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~^TSTT.::.TSSSTT.::..TTSTT,,,RST^^^~~~~^^....T.^^~~~~^^...T.T.T..T.^^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~^TSTT.::..STSSS.::.RTSTTTRSSTTS^~~~~~^^^..S...^^~~~~~^^..T^.^^^^..^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~^^STT..::.SSTTT..:.TSSTSSTSTTS^^~~~~^^..TT...R^^^~~~~~^^^^^^^^^^^^^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~^SRST..:..STTSS.:.SSTTSTTTRST^~~~~^^^........^^^^~~~~~~~~~~~~~~^^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~^TSRTT..:..TTTS.:.....TTTSTT^^~~~^^^^T.S......^^^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~^TTSSTT..:...TS.:::::..RSSTT^~~~~^^^^^^.R.....^^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~^STSSTRS..::.T..:...::.STTT^^~~~^^^~~~^^^^^^^^^~~~~~~~~~^^^^^^^^^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~^SSTTTTTS..:.S.::.T.:..STST^~~~~~~~~~~~~~~~~~~~~~~~~~~~~^______.^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~^TTRSSSSSS.:.T.:..S.:.SSTS^^~~~~~~~~~~~~~~~~~~~~~~~~~~~~^______.^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~^STSSSTTST.:...:.SS.:.TTTS^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^______.^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~^^TTTSTTT..:..::.TT.:.S,,,^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^_____:.^~~~~~^^^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~^TTTSTST.::..:..TT.:..,,,^~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^_____##^^^^^^^^^^^^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~^STSSS...:::::.TSS.::.,,,^~~~~~~~~~~~~~~~~~^^^^^^^......____##.^..^^^^^^^^^^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~^TSRTT.:::::...TR,,,:.,,,^~~~~~~~~~~~~~~~~^^^^^^..______....##^^....TTTTS^^^^^~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~^TTST..::::..STTS,,,,:,,,^~~~~~~~~~~~~~~~~^^^.....______....##......STT,,,^^^^^~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~^SST..:::...TTSRS,,,,:,,,^~~~~~~^^^^^^~~~^^^SS....______....##......TST,,,,,^^^~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~^TTS.::::.TTTTSTT,,,,,,,,^~~^~~~^^^^.^^~^^^^..T...______....##......TTS,,,,,S^^~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~^TS..:::..RTTSTTSS,,,,,,,^~^^~~~^^TS..^^^^........______....##.........,,,S,,^^~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~^T..:::..SSTSSSTTT,,,,,,^^^~~~~^^TTS..............___#__....##..______.,,,S,S,^^~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~^T.::::.SSTSTSTTTSTTT^^^^~~~~~~^STST.................##.....##..______.,,,,,S,,^~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~^S.:::..RSSTTTSTS^^^^^~~~~~~~~^^TTSS...______........#......##..______.,,,,,,,S^~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~^^S.::..SSSSTR^^^^^~~~~~~~~~^^^^TTTTS...______........#......##.._____#.,,,,,,,,^~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~^TT.::.STSSTT^^~~~~~~~~~~^^^^STSS.......______........#......##.._____#.,,,,S,,,^^~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~^ST.::.TSTT^^^~~~~~~~^^^^^ST.TTT._______.____#........#......##..__####.,,,,,,,,T^~~~~~~~~~~^^~~~~~~~~~~~~~',
    '~~~~~~^^TS.::.TT^^^~~~~~^^^^^TSTSTSTTSS._______.____#........##############....,,,,,,,,R^^~~~~~~~~^^^^~~~~~~~~~~~~',
    '~~~~~^^STS.::.S^^~~~~~~^^STTTTRTSSSSSTS._____.##########.___###############:::::,,,S,,..^^~~~~~~~~^..^^~~~~~~~~~~~',
    '~~~~~^STSS.::.S^~~~~~^^^STSSTSTSTSSSTTS._____.##########.____##.._______.##....,,,,,,,,^^~~~~~~~~~^...^~~~~~~~~~~~',
    '~~~~~^TTTS.::.T^~~~^^^SSSTSSSRTTTSTSSSS._____##.______##.____##..______:###.SST,,,,S,S,^~~~~~~~~~^^..T^^~~~~~~~~~~',
    '~~~~^^SSTT.::.T^~~~^SSSSSSSSSTSSTTTTTTT.______..______##.____##..______####.STS,S,,,,,,^~~~~~~~~~^^....^^~~~~~~~~~',
    '~~~~^RTSTS.::.^^~~~^TTTTTTRTTTSTSTTTSSS........._____###...__##.._______###.TST,,,,,,SS^~~~~~~~~~~^^..R.^~~~~~~~~~',
    '~~~^^STRST.:::^^^^^^SSRTTSSS,,,,SSSSSRSSSS......______##.....##.._______.##.TTSTTSSSSTT^~~~~~~~~~~~^....^^~~~~~~~~',
    '~~^^RTTSST.::::^.SSRSSSTT,,,,,,,STTSSSSTSTSTT...______##.____##############.TTTTSTTTSTS^^~~~~~~~~~~^^..T^^^~~~~~~~',
    '~~^SSSTTTT..::::TTSTTSTTT,,,,,,,TTSTSSTSSTTS..........##.____##__##########.TTTSTT......^~~~~~~~~~~~^^^.^^^^~~~~~~',
    '~^^STSSTTST^^:::::..STSSS,,,,,,,,STSTSSSTTSS....______##.___###___..........SSTTT.______^^^^~~~~~~~~^^^^^^^^~~~~~~',
    '~^STTSSTTS^^^^:::::....TT,,,,,,,,,TSTSSSSSST....______##._#######_................_______..^~~~~~~~~~^^^^^^~~~~~~~',
    '~^SSTSSSST^ST.::::::::.ST,,,,,,,,,TSTRRTSTSS...._____###.#########.................______..^~~~~~~~~~~^^^^~~~~~~~~',
    '^^SSTTTST^^ST.::::::::....,,,,,,,,TSTTSTTSST....______##_##########################_____...^~~~~~~~~~~~~~~~~~~~~~~',
    '^TT,,,,T^^TTT..::...::::::,,,,,,,,.......STT..T._____###_##########################_____.#DDDDDD~~~~~~~~~~~~~~~~~~',
    '^T,,,,,^^TSTT..:..S.:::::::,,,,,,,______........______#############..._____#......###.#..#DDDDDD~~~~~~~~~~~~~~~~~~',
    '^T,,,,,,TSSS..:..TS...::::::,,,,,,______::########################...._____#.......#######..^~~~~~~~~~~~~~~~~~~~~~',
    '^S,,,,,,TTT..::.SSSTS.::::::,,,,,._____:::^^^###########_#########._________..........#.....^^~~~~~~~~~~~~~~~~~~~~',
    '^,,,,,,,TS..::..SSSSS.....::,,,,..______::^FF..........__########.._________...............~~~~~~~~~~~~~~~~~~~~~~~',
    '^,,,,,,,..:::..TSSTTTTSTS.::::::.._____#::R~~.._______.___######..._____.......T........~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '^,,,:::::::...TSSSTSSTSTT.:::.:::::_____::~~~.._______.....###.....____:...............~~~~~~^^~~~~~~~~~~~~~~~~~~~',
    '^,,,:,,,,...SSSSTSSSTSTSS.:::.::::::::::::~~~.._______....##.......____:.......TS.T..~~~~~~..^~~~~~~~~~~~~~~~~~~~~',
    '^T,,:,,,,,,,,TTSTTTSTSTTT.:::.....::::::::.~~..______###################...........T~~~~~_____^~~~~~~~~~~~~~~~~~~~',
    '^^,,,,,,,,,,,TSSTSTTTTTSTS:::.STT.::::::::.~~~._______....##############.....T...S~~~~~_______^~~~~~~~~~~~~~~~~~~~',
    '~^^^,,,,,,,,,^TSSTSTSSTSSS:::TSTSS.........~~~._______.T..##._______..##.....R..~~~~~.._______^~~~~~~~~~~~~~~~~~~~',
    '~~~^^,,,,,,,,^^STTTSSTTTT.:::.TTSRTSSSSST.T~~~._______....##._______..##.....T.~~~~~...______:^~~~~~~~~~~~~~~~~~~~',
    '~~~~^^,,,,,,,^^STSSTSTSSS.::..TSTSSTTSTSS...~~~...........##._______..##...T.~~~~~.....______:^~~~~~~~~~~~~~~~~~~~',
    '~~~~~^^TSSTTT^SSSSSTTSSSS.::.SSRSSSTTTSTT..R~~~...........##.______#####....~~~~~:::::::::###:^^~~~~~~~~~~~~~~~~~~',
    '~~~~~~^^STSST^TTSTTSSTSS..::.TTTSTSSTTTST.TS.~~~..........##._______#.##...~~~~:::...........T.^~~~~~~~~~~~~~~~~~~',
    '~~~~~~~^^^SSS^^TSSSSTSST.:::.SSTSTTSTTT...STT~~~....______##._______..##..~~~~::...............^~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~^^^^^^TT^TTTTSS.:::.STTTTTTTTS...TTT.~~~...______##._______..##.~~~~::.......T........^~~~~~~~~~~~~~~^^^^',
    '~~~~~~~~~~~~~^^T^^^TSTT.:::..TTTTRTTSTT...ST.T~~~~..______#...........##~~~~::.................^~~~~~~~~~~~~~~^ST^',
    '~~~~~~~~~~~~^^SS^^^^TTT.:::.TST.TTTSSTSTTSTT.T.~~~~.______##..........==~~~::..................^~~~~~~~~~~~~~^^TT^',
    '~~~~~~~~~~^^^TTST^^^^^^S::S.SST.TTSSSSTTSSST..T.~~~~_______..........~==~~::.....__________....^~~~~~~~~~~~~~^TTT^',
    '~~~~~~~~~^^RTTSSTS^^^^^T::STSTT.TTTTSTSTTTSTTTSTS~~~~______.........~~==~::......__________...^^^~~~~~~~~~~~~^SST^',
    '~~~~~~~^^^SSSSTTSTSTTS^^:..TRST.TTTTTTTTSTTSSTTSST~~~~...........T~~~~=#::.......__________...^^^^^^~~~~~~~~^^SST^',
    '~~~~~~^^~^SSTTS...TTSS..::.SST...TSTSTTSTSTSTSSTTS~~~~~~S......~~~~~~~##.::::::..__________....^^..^^~~~~~~~^TSSS^',
    '~~~~~^^^^^TTSTS........:::.......STSTTSTSTTTTSSTS^^~~~~~~~~..~~~~~~~..##._____:..__________........^^~~~~~~~^TTSR^',
    '~~~~~^TTRTTSTTS...TTT..:::.TST...STSSSTSSSTRSTTTTT^T~~~~~~~~~~~~~~~...##._____:____._______......^^^~~~~~~~~^STST^',
    '~~~~^^STSTSTTSTSSSTTT.:::..STTTSTTTSSSTTSSSSSTSSSSTTTTTT.~~~~~~~......##._____:____............^^^^^~~~~~~~^^TTSS^',
    '~~~^^STTSTSTTSTTSTSST.:::.TSTSSSTTTTSTSSTTTTSSTRTSTSTTTT....._______..##.__________._____..^^^^^^^^~~~~~~~~^SSTST^',
    '~~^^SRSTSSSSTTTTSTTS..::..SSSSTTTSTTTSTSSSSTTSSTSTSTTSST..............##._________.......^^^~~~~~~~~~~~~~~~^TTTTR^',
    '~^^STTTTSTSTSTSSSTT..:::.TSTTSSSTTSSTTTTSTTRTSTTSST...................##................^^~~~~~~~~~~~~~~~~^^TTTTT^',
    '~^^TSTTTSTTTTSTTSST.::::.STTTSST^STSSTTSSTSTSTTSTS..::::..............###:::::....::::..^~~~~~~~~~~~~~~~~^^STTTST^',
    '^^^STTTTTTTTSRSTTS..:::,.TTTTSSTTSSSTSRTTSTSSTTTTT.:::::......T.......##############:::.^^^^~~~~~~~~~~~~^^TTTTTTT^',
    '^^^TTS,,,,TTSTSSS..:::,,,,TSTSTSSSTTSSTSTSSSTSRTTT..::::...............#############::::.TS^~~~~~~~~~~~^^TSSTTTST^',
    '^^TTT,,,,,,,TTST..::::,,,,STRTTSTSTSSSSSSTSTSSSTSRS.::::::...............:.......S#####:...^^^^~~~~~~^^^TTSTTSTTS^',
    '^^TS,,,,,,,,TTR..::::,,,,,,,TTSSTSSSTTSTSSSTTSSSTTT.::::.gggggggggggggggg:gggggRgS########..TS^^^^^^^^TTTSRSSSTTS^',
    '^^ST,,,,,,,,ST..::::,,,,,,,,SSTTSRTRTTRTT^^TST.SSTS...::.ggggggggggggggggggggggRgTS..######...STSSTTSSSSRTTTTSTTT^',
    '^^TT,,,,,,,,S..::::,,,,,,,,,SSTSSTSSSSTTTT^^T...TTTSS.::.gggggggggggggggggggggg^^^^^^..:#####..SSSSRSTSSSSSTSSSTR^',
    '^^S,,,,,,,,,..::::,,,,,,,,,,TTTTTSSSTSTSTST^^............gggggggggggggggggggggg^^^~~^R.::#####..TSRTSTSSTTTTSTTTT^',
    '^^^,,,,,,,,,:::::::::,,,,,,,SRTSRTTSTSRRTTT^^^^.TSSST^^^^^ggggggggRgggggggggggg^^~~~^S.....####...TTTSRSTSSTSSTTT^',
    '^^^,,,,,,,,,::::::::::,,,,,STSTTTSSTTSSTTSS^~~^^STTT^^^^^^^gggRgggggggggggggggR^~~~~^TSSTT..#####..TTSTSRSTSTTTSS^',
    '^^S,,,,,,,,:::.....::::,,,,STRSSSSSSTTTTTST^~~~^^^^^^~~~^^^^RR^^^gggggggggggggR^~~~~^STSTTS..#####...TSTTTTTTTSTR^',
    '^^TT,,,,,,::...SSS..::::,,.SSSSSSSTTSTTSSTS^^~~~^^~~~~~~~^^^^^^^^^ggRRggRggggR^^~~~~^SSTTTSS...#####..STSSTSSTTST^',
    '^^SS,,,,,::..TTRRST..:::::...RSSSTSSTTTTSTS^~~~~~~~~~~~~~~^^^^^^~^^^^^^^^^^^^^^~~~~~^STTSTTTTS..#####..STSSTSSSSS^',
    '^^TTSTRT.:...STTTRSS..::::::..SRSRRTTTSSTTS^^~~~~~~~~~~~~~~^^^~~~~^^^^^^^^~~^^~~~~~~^TSSTSSTTTT..#####..STSSTTSST^',
    '^STSTTRS.:::.TTTSSSTS...:::::..STTSSTTSTSTST^~~~~~~~~~~~~~~~~~~~~~~~^^^^^~~~~~~~~~~~^^^SSSTSRTST...####.TTSSSRSST^',
    '^SSSSTST...:..TTTSTTTTS...::::...TTTRSTSTSST^^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^TSSTSTTSSST..###.STTSTSTSS^',
    '^SSTSSSSSS..:..TSSSTTTTST..:::::.STSTSSTTSSTT^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^TTTSRRTSTSTT..##..SSTTTSST^',
    '^STTTSSRTST.::.TTTTTSSSSSS..::::..SSSSTTSTTTT^^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^SSSTSTTSTSTTT.###.TSRSTTSS^',
    '^^TSTRTSSTS..:..SSSSTRSTTTT...:::.STTTTTSSSTTS^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^TSSTTTSTSSTSS.###.SSSTTSTS^',
    '^^STTTSSSTTS..:..TTSSTTTSSTTS.:::....SSTTSTTTT^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^TTTSSSTTT,,,,,,.##.,,,,,,,T^',
    '^SSSSSTSTSSSS.::.STSSSTTSTTTS..:::::...TTRTRTS^^~~~~~^^^^^^^~~~~~~~~~~~~~~~~~~~~~~~~^^TSSSSTTT,,,,,,,,##.,,,,,,,,^',
    '^TSTSTSRSRTTS..:.TTSSSSTTTTRSS....::::.STSTSTTT^~~~~^^.....^^~~~~~~~~~~~~~~~~~~~~~~~^SSSRSTTTS,,,,,,,,##.,,,,,,,,^',
    '^SRSTTTSTTTST..:.TTSTSTSSTTSRTTT....::.,,,,,,SS^~~~~^^...T.^^^~~~~~~~~~~~~~~~~~~~~~^^TTTTTTTT,,,,,,,,,##.,,,,,,,,^',
    '^STTSSSSTSS...::.TT^^^^^^^TSTTST.....::,,,,,,,S^^~~~~^^....^^^~~~~~~~~~~~~~~~~~~~~^^TTTTSSSTT,,,,,,,,,##.,,,,,,,,^',
    '^^TSTTSTT...:::..T^^~~~~~^SSTTST......:,,,,,,,,,^~~~~^......^^~~~~~~~~~~~~~~~~~~~^^SSSTTTSTTS,,,,,,,,,##.,,,,,,,,^',
    '~^^TTSSS..::^^..R^^~~~~~~^^SSTTS...~~~:,,,,,,,,,^~~~~^^...T.^^~~~~~~~~~~~~~~~~~^^^RSTTSSSSTST,,,,,,,,,##.,,,,,,,,^',
    '~~^SSST..::,,^^S^^~~~~~~~~^^TSST...~~~~:,,,,,,,,^~~~~~^^.^..^^~~~~~~~~~~~~~~~~~^STTSTSSSSTSRST,,,,,,,,##.,,,,,,,,^',
    '~~^^TS^^::,,,,^^^~~~~~~~~~~^^TTS...~~~~.:,,,,,,,^~~~~~~^^.^^^^~~~~~~~~~~~~~~~~^^TTTSSSSSTSSTTS,,,,,,,##.,,,,,,,,,^',
    '~~~^^^^~:,,,,,,^^~~~~~~~~~~~^^ST...~~~~.::,,,,,,^~~~~~~~^^^^^^^~~~~~~~~~~~~~~^^TSTSRTSTTTSSSST,,,,,,,##,,,,,,,,,,^',
    '~~^^~~~~:,,,,,,,^~~~~~~~~~~~~^^^...~~~~..::,,,T^^~~~~~~~~~^^^^~~~~~~~~~~~~~~^^SSSSTTSTTTTTTRTT,,,,,,##.,,,,,,,,,,^',
    '^^^^^~~::,,,,,,,^^~~~~~~~~~~~~~^^.,,,,,,,.:,,^^^~~~~~~~~~~~^^~~~~~~~~~~~~~~^^STTTTTTSSTSTSTSSSSST.###..,,,,,,,,TS^',
    '^ggg^^^:,,,,,,,,,^^~~~~~~~~~~~~~^.,,,,,,,,^^^^~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^SSSSTTSSTTTRSSTTSTTSS.##..ST,,,,,,STS^',
    '^gggggggg,,,,,,,,,^^~~~~~~~~~~~~^^,,,,,,,,^~~~~~~~~~~~~~~~~~~~~~~~~^^^^SSTTTSTTTSSSSSTTTTSSSTTSTT.##.TTTT,,,,TTTS^',
    '^^ggggggg,,,,,,,,,,^^~~~~~~~~~~~~^,,,,,,,^^~~~~~~~~~~~~~~~~~~~~~~^^^TTTSSSSTSTSSSSSTTSSSSTTTSTSTT.##.STTTTTTSTTST^',
    '~^ggggggg^,,,,,,,,,^^~~~~~~~~~~~~^^,,,,^^^~~~~~~~~~~~~~~~~~~~~~~^^TSSTSTSRSTTSSRSTRTSTTSSSRSRTTST.##.STSTSTSTRSST^',
    '^^gggggg^^^^,,,,,,^^~~~~~~~~~~~~~~^^,,^^~~~~~~~~~~~~~~~~~~~~~~^^^SSTTTSTSSTSTSTTSTTRSTSTSSRRSSST..##.STSTTTTTRTST^',
    '^^^^^^^^^~~^^^^^^^^~~~~~~~~~~~~~~~~^^^^~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^###^^^^^^^^^^^^^^'
  ],

  // Hráč začíná na mostě, pokud nemá platnou uloženou pozici.
  spawn: { x: 62, y: 61 },

  // Budovy stojí na parcelách (_). x, y = severozápadní roh půdorysu v polích,
  // width × height = půdorys, přes který se nedá projít.
  // door = pole, na kterém hráč stojí, když vchází dovnitř (klávesa E).
  buildings: [
    {id: 'greenvale_town_hall', name: 'Radnice', x: 58, y: 45, width: 3, height: 2, collisionAspect: [2, 3], door: {x: 61, y: 45}},
    {id: 'greenvale_notice_board', name: 'Nástěnka', x: 60, y: 47, width: 1, height: 1},
    {id: 'greenvale_observatory', name: 'Hvězdárna', x: 65, y: 27, width: 4, height: 4, door: {x: 70, y: 30}},
    {id: 'greenvale_house_n2', name: 'Dům', x: 73, y: 38, width: 4, height: 4},
    {id: 'greenvale_house_n3', name: 'Dům', x: 48, y: 40, width: 4, height: 4},
    {id: 'greenvale_fountain', name: 'Kašna', x: 59, y: 56, width: 3, height: 3},
    {id: 'greenvale_stall_flowers', name: 'Stánek s květinami', x: 56, y: 56, width: 2, height: 2},
    {id: 'greenvale_market', name: 'Tržiště – potraviny', x: 63, y: 51, width: 2, height: 3, door: {x: 65, y: 55}},
    {id: 'greenvale_market_wares', name: 'Tržiště – zboží', x: 58, y: 51, width: 2, height: 3, door: {x: 60, y: 54}},
    {id: 'greenvale_stall_fish', name: 'Stánek s rybami', x: 56, y: 59, width: 2, height: 2},
    {id: 'greenvale_smithy', name: 'Kovárna', x: 62, y: 67, width: 5, height: 5, door: {x: 68, y: 70}},
    {id: 'greenvale_warehouse', name: 'Sklad', x: 88, y: 65, width: 5, height: 4},
    {id: 'greenvale_house_e1', name: 'Řemeslná dílna', x: 59, y: 33, width: 4, height: 4, door: {x: 62, y: 38}},
    {id: 'greenvale_tavern', name: 'Hostinec', x: 66, y: 45, width: 5, height: 4, door: {x: 72, y: 48}},
    {id: 'greenvale_alchemist', name: 'Alchymistický obchod', x: 53, y: 72, width: 5, height: 4, door: {x: 59, y: 74}},
    {id: 'greenvale_house_green', name: 'Dům', x: 71, y: 57, width: 4, height: 3},
    {id: 'greenvale_home_3', name: 'Dům léčitelky', x: 49, y: 47, width: 4, height: 3, door: {x: 54, y: 49}},
    {id: 'greenvale_home_1', name: 'Dům', x: 49, y: 53, width: 4, height: 4, door: {x: 53, y: 56}},
    {id: 'greenvale_hunter_lodge', name: 'Lovecká chata', x: 35, y: 58, width: 4, height: 4, door: {x: 39, y: 61}},
    {id: 'greenvale_home_2', name: 'Dům', x: 41, y: 43, width: 4, height: 4, door: {x: 45, y: 46}},
    {id: 'greenvale_fishing_hut', name: 'Rybářská chata', x: 83, y: 53, width: 5, height: 4, door: {x: 87, y: 58}},
    {id: 'greenvale_house_w1', name: 'Zelený dům', x: 68, y: 60, width: 3, height: 4, door: {x: 68, y: 64}},
    {id: 'greenvale_church', name: 'Kostel', x: 48, y: 62, width: 5, height: 5},
    {id: 'greenvale_house_e2', name: 'Statek', x: 74, y: 79, width: 4, height: 4},
    {id: 'greenvale_windmill', name: 'Větrný mlýn', x: 82, y: 76, width: 3, height: 3},
    {id: 'greenvale_well', name: 'Studna', x: 80, y: 81, width: 2, height: 1},
    {id: 'greenvale_stable', name: 'Stáj', x: 86, y: 76, width: 4, height: 4}
  ],

  // Doplňky bez kolize (kromě plotů): [druh, x, y, varianta / osa plotu].
  // x, y v polích, desetinná místa = poloha uvnitř pole. Viz generátor, oddíl 8.
  decor: [
    ['plant',60.27,7.64,1], ['stump',57.47,9.33,1], ['plant',58.61,10.27,1], ['plant',61.56,16.65,1], ['plant',67.53,16.48,1],
    ['stump',69.58,17.44,1], ['stump',65.49,18.44,0], ['plant',71.6,20.66,0], ['plant',46.52,22.37,2], ['plant',52.34,23.64,0],
    
    ['plant',29.46,49.32,3], ['plant',100.57,49.43,0],
    ['plant',27.45,55.6,1], ['plant',41.52,70.66,1], 
    
    ['plant',61.6,86.66,2], 
    ['plant',56.6,106.46,0], ['plant',55.55,107.4,3], ['fence',72,37.5,'y'], ['fence',72.5,37,'x'], ['fence',73.5,37,'x'],
    ['fence',74.5,37,'x'], ['fence',75.5,37,'x'], ['fence',76.5,37,'x'], ['fence',78,37.5,'y'], ['fence',77.5,37,'x'], ['fence',72,38.5,'y'],
    ['fence',78,38.5,'y'], ['fence',72,39.5,'y'], ['fence',78,39.5,'y'], ['fence',72,40.5,'y'], ['fence',72,41.5,'y'], ['fence',72,42.5,'y'],
    ['fence',47,39.5,'y'], ['fence',47.5,39,'x'], ['fence',48.5,39,'x'], ['fence',49.5,39,'x'], ['fence',50.5,39,'x'], ['fence',51.5,39,'x'],
    ['fence',53,39.5,'y'], ['fence',52.5,39,'x'], ['fence',47,40.5,'y'], ['fence',53,40.5,'y'], ['fence',46,41.5,'y'], ['fence',53,41.5,'y'],
    ['fence',61,66.5,'y'], ['fence',61.5,66,'x'], ['fence',68,66.5,'y'], ['fence',61,67.5,'y'], ['fence',68,67.5,'y'], ['fence',61,68.5,'y'],
    ['fence',68,68.5,'y'], ['fence',61,69.5,'y'], ['fence',61,70.5,'y'], ['fence',68,71.5,'y'], ['fence',61,72.5,'y'], ['fence',61.5,73,'x'],
    ['fence',62.5,73,'x'], ['fence',63.5,73,'x'], ['fence',64.5,73,'x'], ['fence',65.5,73,'x'], ['fence',66.5,73,'x'], ['fence',68,72.5,'y'],
    ['fence',67.5,73,'x'], ['fence',58,32.5,'y'], ['fence',58.5,32,'x'], ['fence',59.5,32,'x'], ['fence',60.5,32,'x'], ['fence',61.5,32,'x'],
    ['fence',62.5,32,'x'], ['fence',64,32.5,'y'], ['fence',63.5,32,'x'], ['fence',58,33.5,'y'], ['fence',64,33.5,'y'], ['fence',58,34.5,'y'],
    ['fence',58,35.5,'y'], ['fence',64,35.5,'y'], ['fence',58,36.5,'y'], ['fence',64,36.5,'y'], ['fence',58,37.5,'y'], ['fence',58.5,38,'x'],
    ['fence',62.5,38,'x'], ['fence',64,37.5,'y'], ['fence',63.5,38,'x'], ['fence',70,57.5,'y'], ['fence',70,58.5,'y'], ['fence',76,59.5,'y'],
    ['fence',72.5,61,'x'], ['fence',73.5,61,'x'], ['fence',74.5,61,'x'], ['fence',76,60.5,'y'], ['fence',75.5,61,'x'], ['fence',48,46.5,'y'],
    ['fence',48,47.5,'y'], ['fence',48,48.5,'y'], ['fence',48,49.5,'y'], ['fence',48,50.5,'y'], ['fence',48.5,51,'x'], ['fence',49.5,51,'x'],
    ['fence',50.5,51,'x'], ['fence',51.5,51,'x'], ['fence',52.5,51,'x'], ['fence',53.5,51,'x'], ['fence',48,52.5,'y'], ['fence',48.5,52,'x'],
    ['fence',49.5,52,'x'], ['fence',50.5,52,'x'], ['fence',51.5,52,'x'], ['fence',52.5,52,'x'], ['fence',53.5,52,'x'], ['fence',48,53.5,'y'],
    ['fence',48,54.5,'y'], ['fence',48,55.5,'y'], ['fence',48,56.5,'y'], ['fence',48,57.5,'y'], ['fence',34,57.5,'y'], ['fence',34.5,57,'x'],
    ['fence',35.5,57,'x'], ['fence',36.5,57,'x'], ['fence',37.5,57,'x'], ['fence',38.5,57,'x'], ['fence',40,57.5,'y'], ['fence',39.5,57,'x'],
    ['fence',34,58.5,'y'], ['fence',34,59.5,'y'], ['fence',34,60.5,'y'], ['fence',34,61.5,'y'], ['fence',40,42.5,'y'], ['fence',40.5,42,'x'],
    ['fence',41.5,42,'x'], ['fence',42.5,42,'x'], ['fence',43.5,42,'x'], ['fence',44.5,42,'x'], ['fence',45.5,42,'x'], ['fence',40,43.5,'y'],
    ['fence',40,44.5,'y'], ['fence',40,45.5,'y'], ['fence',40,46.5,'y'], ['fence',40,47.5,'y'], ['fence',40.5,48,'x'],
    ['fence',41.5,48,'x'], ['fence',42.5,48,'x'], ['fence',44.5,48,'x'], ['fence',45.5,48,'x'], ['fence',82,52.5,'y'],
    ['fence',82.5,52,'x'], ['fence',83.5,52,'x'], ['fence',84.5,52,'x'], ['fence',85.5,52,'x'], ['fence',86.5,52,'x'], ['fence',89,52.5,'y'],
    ['fence',82,53.5,'y'], ['fence',89,53.5,'y'], ['fence',89,54.5,'y'], ['fence',67,59.5,'y'], ['fence',67.5,59,'x'], ['fence',68.5,59,'x'],
    ['fence',69.5,59,'x'], ['fence',67,60.5,'y'], ['fence',67,61.5,'y'], ['fence',72,61.5,'y'], ['fence',67,62.5,'y'], ['fence',67,63.5,'y'],
    ['bush',59.46,31.6,1], ['bush',67.65,36.7,4], 
    ['bush',57.46,38.61,1], ['bush',70.52,38.37,5], ['bush',47.51,39.35,4], ['bush',54.49,40.34,4], ['bush',60.47,41.61,1],
    ['bush',78.34,41.47,0], ['bush',41.59,42.45,4], ['bush',53.55,43.69,2], ['bush',58.5,44.64,2], ['plant',81.7,44.63,1], ['bush',52.29,46.65,4],
    ['plant',82.49,47.63,2], 
    ['stump',85.36,51.72,1], ['bush',69.61,54.47,1], ['bush',88.41,54.27,4], ['bush',90.52,55.67,2], 
    ['bush',44.56,57.61,0], ['bush',77.61,57.47,5], ['bush',51.53,60.48,0], ['bush',65.33,60.66,2],
    ['bush',55.56,62.62,0], ['bush',53.27,63.63,4], ['bush',56.37,63.42,4], ['bush',57.56,63.7,2], ['bush',60.31,63.61,0], ['bush',72.53,64.67,2],
    ['bush',91.57,64.62,3], ['bush',61.53,65.68,2], ['bush',62.6,66.74,2], ['plant',47.66,69.3,0], ['bush',60.64,69.69,3], ['bush',91.73,70.66,1],
    ['bush',52.41,71.4,5], ['plant',85.64,71.29,1],
    ['plant',87.48,72.63,2], ['stump',45.56,75.7,0], ['plant',66.29,76.65,0],
    ['bush',81.56,77.41,4], ['bush',69.28,80.62,1],
    // Statek Greenvale: jedna velká ohrada kolem Statku, mlýna, stáje, studny, polí a záhonů
    // bylin (vstup od mostu na západě, brána na jih). Dřívější Bylinková louka je zrušená.
    ['fence',76.5,75,'x'], ['fence',77.5,75,'x'], ['fence',78.5,75,'x'], ['fence',79.5,75,'x'], ['fence',80.5,75,'x'], ['fence',81.5,75,'x'],
    ['fence',82.5,75,'x'], ['fence',83.5,75,'x'], ['fence',84.5,75,'x'], ['fence',85.5,75,'x'], ['fence',86.5,75,'x'], ['fence',87.5,75,'x'],
    ['fence',88.5,75,'x'], ['fence',89.5,75,'x'], ['fence',90.5,75,'x'], ['fence',91,75.5,'y'], ['fence',91,76.5,'y'], ['fence',91,77.5,'y'],
    ['fence',91,78.5,'y'], ['fence',91,79.5,'y'], ['fence',91,80.5,'y'], ['fence',91,81.5,'y'], ['fence',91,82.5,'y'], ['fence',73.5,83,'x'],
    ['fence',74.5,83,'x'], ['fence',75.5,83,'x'], ['fence',76.5,83,'x'], ['fence',77.5,83,'x'], ['fence',78.5,83,'x'], ['fence',81.5,83,'x'],
    ['fence',82.5,83,'x'], ['fence',83.5,83,'x'], ['fence',84.5,83,'x'], ['fence',85.5,83,'x'], ['fence',86.5,83,'x'], ['fence',87.5,83,'x'],
    ['fence',88.5,83,'x'], ['fence',89.5,83,'x'], ['fence',90.5,83,'x'], ['fence',73,79.5,'y'], ['fence',73,80.5,'y'], ['fence',73,81.5,'y'],
    ['fence',73,82.5,'y'],
    // Skály nalezišť v lomu (pole x, y; obarvené podle suroviny) – kolem každé 4 naleziště.
    ['oreRock',71,91,'N01'], ['oreRock',76,90,'N33'], ['oreRock',67,91,'N37'], ['oreRock',71,94,'N34'], ['oreRock',75,94,'N36'],
    ['oreRock',67,94,'N02'], ['oreRock',63,91,'N39'], ['oreRock',59,91,'N03'], ['oreRock',60,93,'N27'],
    ['oreRock',5,118,'N16'], // Opuštěný lom
    ['plant',86.8,55.6,2], ['signpost',64.5,63.5,0],
    ['signpost',54.5,59.5,0], ['signpost',67.5,54.5,0]
  ],

  // Rybářská místa (src/data/fishing.js) – v Greenvale jen lokality do úrovně 10 (rybník, molo,
  // Lesní řeka). Vyšší lokality přijdou s dalšími oblastmi.
  fishingSpots: [
    {location: 'greenvale_pond', x: 93, y: 56},
    {location: 'greenvale_dock', x: 92, y: 56},
    {location: 'verdant_river', x: 94, y: 56},
    {location: 'verdant_river', x: 36, y: 109}
  ],

  // Naleziště Těžby: lom Greenvale jižně pod statkem (tools/greenvale-quarry.mjs),
  // jen naleziště do úrovně 10. Vzácná Cínová žíla se střídá v mýtině uprostřed lomu (rareSpots).
  // Čtyři skupiny: uprostřed skála obarvená do odstínu suroviny (decor 'oreRock'), kolem ní
  // 4 naleziště stejného druhu (sever, jih, západ, východ).
  // Lom obsahuje každou žílu úrovně 1–10 jednou (9 skupin); nejnižší úrovně u sjezdu na východě.
  miningSpots: [
    ...oreGroup('N01', 71, 91), // Měděná žíla, úr. 1
    ...oreGroup('N33', 76, 90), // Uhelná sloj, úr. 1
    ...oreGroup('N37', 67, 91), // Žulový lom, úr. 1
    ...oreGroup('N34', 71, 94), // Křemenná žíla, úr. 3
    ...oreGroup('N36', 75, 94), // Solná skála, úr. 4
    ...oreGroup('N02', 67, 94), // Železná žíla, úr. 5
    ...oreGroup('N39', 63, 91), // Pyritová žíla, úr. 6
    ...oreGroup('N03', 59, 91), // Cínová žíla, úr. 8
    ...oreGroup('N27', 60, 93), // Krystalová puklina, úr. 10
    // Opuštěný lom na jihozápadě: žíla vyřazená z hlavního lomu (nad úr. 10) a jediné
    // vzácné naleziště od úrovně 90 (jen jedno pole, bez skály).
    ...oreGroup('N16', 5, 118), // Ametystová dutina, úr. 18
    {deposit: 'N11', x: 2, y: 116, rare: true} // Žíla dračího železa, úr. 92 – vzácné, jedno naleziště
  ],

  // Louky setkání: každá má svá monstra a rozsah úrovní (BattleScene). Pole louky (znak ,)
  // patří do první zóny, jejíž obdélník ho obsahuje. Všechny louky jsou otevřené.
  encounterZones: [
    { id: 'meadow_windy_plain', name: 'Větrná pláň', x0: 8, y0: 9, x1: 18, y1: 18, level: [11, 13], species: ['thornroot_stag', 'earth_elemental', 'mossveil_lynx'] },
    { id: 'meadow_north_shore', name: 'Louka u severního pobřeží', x0: 28, y0: 10, x1: 36, y1: 19, level: [8, 10], species: ['hobgoblin', 'cave_worm', 'cave_bear', 'zephyr_hound'] },
    { id: 'north_pasture', name: 'Severní pastvina', x0: 25, y0: 29, x1: 32, y1: 37, level: [3, 5], species: ['wild_boar', 'goblin', 'forest_sprite'] },
    { id: 'rocky_slope', name: 'Skalní stráň', x0: 79, y0: 33, x1: 86, y1: 48, level: [8, 10], species: ['hobgoblin', 'cave_worm', 'cave_bear', 'zephyr_hound'] },
    { id: 'lodge_meadow', name: 'Louka za Loveckou chatou', x0: 25, y0: 49, x1: 33, y1: 60, level: [1, 3], species: ['dire_wolf', 'wild_boar'] },
    { id: 'south_plains', name: 'Jižní pláně', x0: 1, y0: 56, x1: 12, y1: 68, level: [5, 7], species: ['goblin', 'giant_spider', 'zephyr_hound'] },
    { id: 'forest_glade', name: 'Lesní paseka', x0: 18, y0: 86, x1: 27, y1: 96, level: [7, 9], species: ['giant_spider', 'galecrest_lynx', 'briarbound_wisp'] },
    { id: 'meadow_west_cliffs', name: 'Louka nad západními útesy', x0: 3, y0: 87, x1: 11, y1: 97, level: [12, 14], species: ['thornroot_stag', 'earth_elemental', 'mossveil_lynx'] },
    { id: 'lost_cliff', name: 'Útes ztracených', x0: 93, y0: 104, x1: 101, y1: 114, level: [14, 16], species: ['thornroot_stag', 'earth_elemental', 'mossveil_lynx'], rare: true },
    { id: 'meadow_far_east', name: 'Odlehlá východní pláň', x0: 103, y0: 104, x1: 112, y1: 117, level: [14, 16], species: ['thornroot_stag', 'earth_elemental', 'mossveil_lynx'] },
    { id: 'meadow_south_glade', name: 'Jižní paseka', x0: 39, y0: 107, x1: 47, y1: 115, level: [11, 13], species: ['thornroot_stag', 'earth_elemental', 'mossveil_lynx'] },
    { id: 'meadow_far_south', name: 'Jihozápadní výběžek', x0: 8, y0: 111, x1: 18, y1: 120, level: [14, 16], species: ['thornroot_stag', 'earth_elemental', 'mossveil_lynx'] },
    { id: 'meadow_pond', name: 'Louka u jezírka', x0: 34, y0: 115, x1: 41, y1: 120, level: [13, 15], species: ['thornroot_stag', 'earth_elemental', 'mossveil_lynx'] }
  ],

  // Skryté mýtiny v lese: v každé se střídavě objevuje vzácné naleziště (úr. ~15). Aktivní jsou
  // vždy 2 mýtiny, výběr se mění každé 3 hodiny (data/maps/index.js – activeRareSpots).
  rareSpots: [
    { kind: 'herb', site: 'H12', x: 16, y: 79 },
    { kind: 'mining', deposit: 'N16', x: 31, y: 79 },
    { kind: 'mining', deposit: 'N03', x: 64, y: 93 },
    { kind: 'herb', site: 'H12', x: 40, y: 72 },
    { kind: 'fishing', location: 'verdant_river', x: 46, y: 92 }
  ],

  // Naleziště Sběru bylin (src/data/herbalism.js) – v Greenvale jen bylinky do úrovně 10:
  // divoká naleziště H01–H07, zahrádky domů G01–G12 a záhony uvnitř ohrady statku (Z01–Z03,
  // L01–L09 a Hustý bylinný porost SH1). Naleziště dalších oblastí přijdou s nimi.
  herbSpots: [
    {site: 'H01', x: 12, y: 117},
    {site: 'H02', x: 49, y: 72}, // Břeh řeky za kostelem – cíl úkolu Byliny od řeky (pevné místo)
    {site: 'H03', x: 6, y: 65},
    {site: 'H04', x: 6, y: 96},
    {site: 'H05', x: 22, y: 21},
    {site: 'H06', x: 98, y: 78},
    {site: 'H07', x: 82, y: 34},
    {site: 'G01', x: 77, y: 39},
    {site: 'G02', x: 72, y: 41},
    {site: 'G03', x: 63, y: 34},
    {site: 'G04', x: 58, y: 36},
    {site: 'G05', x: 48, y: 49},
    {site: 'G06', x: 53, y: 52},
    {site: 'G07', x: 34, y: 61},
    {site: 'G08', x: 40, y: 46},
    {site: 'G09', x: 46, y: 43},
    {site: 'G10', x: 87, y: 53},
    {site: 'G11', x: 74, y: 60},
    {site: 'G12', x: 67, y: 63},
    // Záhony statku (Z) u mlýna, divoké byliny (L) a Hustý porost (SH1) – vše uvnitř ohrady statku.
    {site: 'Z01', x: 79, y: 76},
    {site: 'Z02', x: 80, y: 77},
    {site: 'Z03', x: 79, y: 78},
    {site: 'L01', x: 83, y: 81},
    {site: 'L02', x: 85, y: 81},
    {site: 'L03', x: 87, y: 81},
    {site: 'L04', x: 89, y: 81},
    {site: 'L05', x: 84, y: 82},
    {site: 'L06', x: 86, y: 82},
    {site: 'L07', x: 88, y: 82},
    {site: 'L08', x: 90, y: 80},
    {site: 'L09', x: 90, y: 82},
    {site: 'SH1', x: 80, y: 79}
  ],
  hiddenVeinSpot: { x: 59, y: 89 }, // Skrytá žíla (mapa / Průzkumník)
  meteorSpot: { x: 8, y: 119 }, // Hvězdný meteorit (Těžba 85+, dočasně vždy do Greenvale) – v Opuštěném lomu, ne v hlavním

  // Zajímavá místa – zatím jen značky v ladicím režimu.
  points: [
    { id: 'cave', name: 'Jeskyně', x: 7, y: 57 },
    { id: 'encounter', name: 'Zóna setkání', x: 26, y: 57 },
    { id: 'fishing_dock', name: 'Rybářské místo (molo)', x: 93, y: 56 }
  ]
};
