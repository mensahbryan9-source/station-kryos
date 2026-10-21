// FICHIER GÉNÉRÉ par tools/sync-shared.mjs depuis js/ — ne pas modifier ici.
// Configuration centrale du jeu et du concours.
// Ce fichier est partagé tel quel avec les Edge Functions Supabase
// (copié dans supabase/functions/_shared/ par tools/sync-shared.mjs) :
// toute modification du barème s'applique donc au jeu ET au serveur.

export const CONFIG = {
  title: 'Le Manoir des Ombres',
  event: {
    organizer: 'BDE Epitech Bénin',
    name: 'Soirée Halloween',
    date: 'samedi 31 octobre 2026',
  },

  // URL des Edge Functions en production (https://<projet>.supabase.co/functions/v1).
  api: { url: 'https://qbghpplxnxzhwovobozu.supabase.co/functions/v1', forceRemote: false },

  contest: {
    // Fin du concours : samedi 24/10/2026 23:59:59, heure de Cotonou (UTC+1).
    end: '2026-10-24T23:59:59+01:00',
    timezone: 'Africa/Porto-Novo',
    // Un résultat joué hors ligne est accepté s'il arrive dans ce délai après
    // la fin, à condition que sa session ait démarré avant la fin.
    lateGraceMinutes: 15,
  },

  // `scoreMult` est le coefficient de difficulté du score.
  // Les autres valeurs règlent le jeu (multiplicateurs par rapport à Normal…
  // sauf `spawnTier` : les marqueurs 2/3/4 des cartes n'apparaissent
  // qu'à partir de ce palier).
  difficulties: [
    { id: 'easy', name: 'Facile', scoreMult: 1.0, enemyHp: 0.8, enemyDmg: 0.6, enemySpeed: 1.0, enemyCooldown: 1.25, spawnTier: 0, battery: 1.5 },
    { id: 'normal', name: 'Normal', scoreMult: 1.5, enemyHp: 1.0, enemyDmg: 1.0, enemySpeed: 1.1, enemyCooldown: 1.0, spawnTier: 1, battery: 1.0 },
    { id: 'hard', name: 'Difficile', scoreMult: 2.0, enemyHp: 1.25, enemyDmg: 1.3, enemySpeed: 1.2, enemyCooldown: 0.9, spawnTier: 2, battery: 0.8 },
    { id: 'nightmare', name: 'Cauchemar', scoreMult: 3.0, enemyHp: 1.5, enemyDmg: 1.7, enemySpeed: 1.3, enemyCooldown: 0.75, spawnTier: 3, battery: 0.6 },
  ],

  scoring: {
    // Points par ennemi éliminé, selon la lettre de la carte.
    enemy: { g: 100, s: 200, m: 300, G: 2500, O: 5000 },
    secret: 750,
    perHpLeft: 10,       // points par PV restant en fin de niveau
    deathPenalty: 1000,  // retirés par mort pendant le niveau
    timeCoef: { min: 0.5, max: 2.0 },
  },

  // Par niveau (même ordre que LEVELS) : temps de référence et temps minimum
  // plausible, en secondes de jeu.
  levels: [
    // par ≈ chemin + 4 s par ennemi (Normal) + 30 s, boss compris ; minTime = temps
    // d'un parcours parfait en courant (vérifié par tools/validate-levels.mjs).
    { id: 'cimetiere', par: 150, minTime: 8 },
    { id: 'catacombes', par: 210, minTime: 12 },
    { id: 'crypte', par: 230, minTime: 12 },
    { id: 'jardins', par: 170, minTime: 7 },
    { id: 'manoir', par: 290, minTime: 16 },
  ],

  antiCheat: {
    // Le temps de jeu annoncé ne peut pas dépasser le temps réel mesuré par le serveur.
    clientClockTolerance: 15,
    // Partie marquée suspecte si un niveau est bouclé en moins de par × ratio…
    fastRatio: 0.25,
    // …ou si tous les ennemis sont tués à un rythme supérieur à ce seuil (kills / min).
    maxKillsPerMinute: 40,
  },

  rateLimit: {
    perIpPerMinute: 60,
    perPlayerPerMinute: 30,
  },

  player: { maxHp: 100 },

  // Lampe torche : autonomie en secondes à Normal (multipliée par `battery`
  // de la difficulté), recharge d'une pile ramassée, seuil d'alerte en %.
  lamp: { seconds: 200, pickup: 40, lowWarn: 20, power: 1.1 },
};

export const contestEnd = () => new Date(CONFIG.contest.end);
export const contestOpen = (now = new Date()) => now < contestEnd();
