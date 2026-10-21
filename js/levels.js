// Données des niveaux de STATION KRYOS.
//
// Légende des cartes :
//   Murs      # acier   + acier éclairé   = cloison rayée   ~ hublot   $ emblème
//             % labo hexagonal   & baies serveur   ^ glace   ! rouille
//             @ réacteur   ? biomasse   | tuyauterie   X interrupteur de sortie
//   Portes    D normale   B verrou bleu   R verrou rouge   * mur secret (à pousser)
//   Joueur    P
//   Ennemis   g drone   s sentinelle   m broyeur   O Archonte (boss)
//   Objets    h trousse   H médikit   r armure   a cellules   c cartouches
//             k carte bleue   K carte rouge   t cristal de données
//             w fusil plasma   W fusil à dispersion   Z canon à arc
//   Décor     l plafonnier   o baril explosif   y colonne   n console
//             q cuve cryogénique   f flaque de biomasse

export const WALL_CHARS = {
  '#': 'steel', '+': 'steelLight', '=': 'bulkhead', '~': 'window', '$': 'emblem',
  '%': 'hexlab', '&': 'servers', '^': 'ice', '!': 'rust', '@': 'reactor',
  '?': 'biomass', '|': 'pipes', 'X': 'exitOff',
};

export const LEVELS = [
  {
    name: "Quai d'amarrage",
    subtitle: 'Niveau 1 — Secteur Arrimage',
    briefing:
      "La station minière KRYOS ne répond plus depuis 72 heures. Votre navette s'arrime au quai. " +
      "Les automates de maintenance ont été réécrits par quelque chose… Trouvez la carte bleue et rejoignez l'ascenseur de service.",
    floor: 'grate', ceiling: 'ceilPanel',
    fog: [8, 14, 24], light: 1.0,
    angle: 0,
    secretTex: 'steel',
    variants: { '#': ['steel', 'steel', 'steel', 'steelLight', 'pipes', 'steel', 'bulkhead'] },
    music: { root: 45, scale: [0, 3, 5, 7, 10], tempo: 92 },
    loadout: { weapons: [0, 1], cells: 40, shells: 0, health: 100, armor: 0 },
    map: [
      '############~~~#~~~#~~~#~~~#~~~#',
      '#.....#t..t#o.................o#',
      '#.....#W..t#...y.....g.....y...#',
      '#..l..##*###.........l.........#',
      '#P....D....D....g.........g....#',
      '#.....######...y.....o.....y...#',
      '###D########........s..........#',
      '#.h.......##...y.....g.....y...#',
      '#.........##.........l.........#',
      '#...s.....##o.................o#',
      '#....l....#####D##########B#####',
      '#a........#o........o#.n.....n.#',
      '#.........D.....g....#....s....#',
      '#.......c.#...w......#.........#',
      '#####D#####......s...#..g......#',
      '#.........#o........o#.........#',
      '#....l....#..........#...h.....#',
      '#.........#....a.....#.n.....n.#',
      '#...m.....#####D######====D=====',
      '#.........#t........t=....l....=',
      '#....k....#..o....o..=.........=',
      '#.........#....s.....=y.......y=',
      '#H........#t........t=.........=',
      '######################====X=====',
    ],
  },
  {
    name: 'Laboratoires cryogéniques',
    subtitle: 'Niveau 2 — Secteur Recherche',
    briefing:
      "L'ascenseur s'ouvre sur les laboratoires. Les cuves de cryogénie sont fissurées et la glace a envahi l'aile est. " +
      "Deux cartes d'accès sont nécessaires pour atteindre le monte-charge vers le réacteur.",
    floor: 'tiles', ceiling: 'ceilLab',
    fog: [18, 30, 38], light: 1.05,
    angle: 0,
    secretTex: 'hexlab',
    variants: { '%': ['hexlab', 'hexlab', 'hexlab', 'emblem', 'hexlab', 'steelLight'] },
    music: { root: 43, scale: [0, 2, 3, 7, 8], tempo: 84 },
    loadout: { weapons: [0, 1, 2], cells: 80, shells: 0, health: 100, armor: 25 },
    map: [
      '%%%%%%%%%%%%%%%%%%%%%%%%^^^^^^^^^^^^',
      '%..........%.&.&.&.&.&.^^^^......^^^',
      '%...l......%.....g.....^^^....K...^^',
      '%..........%...........^^.....m...^^',
      '%.P........D....l......^^........^^^',
      '%...l......%.........s.^^^..t....^^^',
      '%h........a%...........^^^^.....^^^^',
      '%..........%t.........t^^^^^...^^^^^',
      '%%%%%D%%%%%%%%%%%%D%%%%%^^^^^D^^^^^^',
      '%..........%...........%^^^^...^^^^^',
      '%.n..n..n..%.q.......q.%^^^.....^^^^',
      '%..........%....g.g....%^^...g...^^^',
      '%....s.....%.q...l...q.%^.........^^',
      '%........c.D...........B....h.....^^',
      '%..........%.q.......q.%^....s....^^',
      '%...k......%...g...g...%^^.......^^^',
      '%.n..W..n..%.q...s...q.%^^^..a..^^^^',
      '%..........%...........%^^^^...^^^^^',
      '%%%%%*%%%%%%%%%%%%D%%%%%^^^^^^^^^^^^',
      '%t........t%...........%...........%',
      '%...t..t...%....s......%....l......%',
      '%....Z.....%..o.....o..%.y.......y.%',
      '%..........%...g...g...%...........%',
      '%H........H%...........R...........%',
      '%..........%....m......%.y.......y.%',
      '%t........t%..h.....a..%...........%',
      '%..........%...........%...........%',
      '%%%%%%%%%%%%%%%%%%%%%%%%%%%%%X%%%%%%',
    ],
  },
  {
    name: 'Cœur du réacteur',
    subtitle: 'Niveau 3 — Secteur Énergie',
    briefing:
      "La biomasse pulse dans les conduits. Au centre du réacteur, l'Archonte — l'intelligence qui a corrompu KRYOS — " +
      "vous attend. Détruisez-le, puis activez l'arrêt d'urgence pour vous échapper.",
    floor: 'organic', ceiling: 'ceilRock',
    fog: [26, 6, 12], light: 0.95,
    angle: 0,
    secretTex: 'biomass',
    variants: { '?': ['biomass', 'biomass', 'rust', 'biomass', 'pipes', 'biomass'] },
    requireBoss: true,
    music: { root: 40, scale: [0, 1, 5, 7, 8], tempo: 104 },
    loadout: { weapons: [0, 1, 2, 3], cells: 120, shells: 20, health: 100, armor: 50 },
    map: [
      '????????????@@@@@@@@@@@@@@@@X@@@@@@@',
      '????????????.......................@',
      '????????????..@@...............@@..@',
      '????????????..@@.......l.......@@..@',
      '????????????h.....................h@',
      '?t...t....t?...........O...........@',
      '?..........?.......................@',
      '?H........a?..@@...............@@..@',
      '?..........?..@@.......l.......@@..@',
      '?r........c?a.....................a@',
      '?t........t?.......................@',
      '?????*???????@@@@R@@@@@@@@@@@@@@@@@@',
      '?..........?...........?...........@',
      '?.||....||.?..f...f....?.?.?.?.?.?.@',
      '?....s.....?.....l.....?....m......@',
      '?..........D...g...g...B....K......@',
      '?....k.....?...........?.?.?.?.?.?.@',
      '?.||....||.?..f..s..f..?...s...s...@',
      '?g........g?...........?h.........a@',
      '?c........h?...........?...........@',
      '?????????????????D??????????????????',
      '?..........?...........?...........@',
      '?..l.......?.f..g...f..?.n...l...n.@',
      '?..........?...........?...........@',
      '?.P........D...s.......?....m......@',
      '?..........?...........D....Z......@',
      '?..l.......?.f...g..f..?.n.......n.@',
      '?a........h?o.........o?c....a....c@',
      '?..........?...........?H.........r@',
      '????????????????????????@@@@@@@@@@@@',
    ],
  },
];
