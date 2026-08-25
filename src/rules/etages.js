/**
 * etages.js — Structure du donjon.
 *
 * Deux axes séparés, volontairement :
 *   - l'ÉTAGE décide du rang de l'ennemi, donc de quel monstre apparaît ;
 *   - le NIVEAU du joueur décide de la variante, donc de sa puissance.
 *
 * Ainsi un joueur faible croise des rangs faibles en variante faible, sans que
 * les deux axes se marchent dessus.
 *
 * Les deux tables de pondération sont des PROPOSITIONS, pas des valeurs
 * validées. Elles vivent ici pour être réglées sans toucher au moteur.
 */

export const PIECES_PAR_ETAGE = 10;
export const ETAGE_DEPART = 1;
export const ETAGE_MAX = 5;

/** Chance de réussite d'une fuite, en pourcentage. Décidé : 25 % partout. */
export const CHANCE_DE_FUITE = 25;

/** Fuir ne rapporte aucune XP de progression. */
export const XP_SI_FUITE = false;

/**
 * Poids du rang de l'ennemi selon l'étage. Index de colonne = rang 1 à 10.
 * Un poids nul signifie que ce rang n'apparaît pas à cet étage.
 */
export const POIDS_RANG_PAR_ETAGE = {
  1: { 1: 75, 2: 25 },
  2: { 1: 45, 2: 40, 3: 15 },
  3: { 1: 10, 2: 30, 3: 35, 4: 20, 5: 5 },
  4: { 2: 10, 3: 25, 4: 30, 5: 25, 6: 10 },
  5: { 3: 10, 4: 20, 5: 25, 6: 25, 7: 15, 8: 5 },
};

/** Poids de la variante selon le niveau du joueur. */
export const POIDS_VARIANTE_PAR_NIVEAU = [
  { jusqua: 2, poids: { 1: 80, 2: 20, 3: 0 } },
  { jusqua: 4, poids: { 1: 50, 2: 40, 3: 10 } },
  { jusqua: 6, poids: { 1: 25, 2: 50, 3: 25 } },
  { jusqua: 8, poids: { 1: 10, 2: 45, 3: 45 } },
  { jusqua: 10, poids: { 1: 5, 2: 35, 3: 60 } },
];

export function poidsDeRang(etage) {
  return POIDS_RANG_PAR_ETAGE[etage] ?? POIDS_RANG_PAR_ETAGE[ETAGE_MAX];
}

export function poidsDeVariante(niveauJoueur) {
  const ligne =
    POIDS_VARIANTE_PAR_NIVEAU.find((l) => niveauJoueur <= l.jusqua) ??
    POIDS_VARIANTE_PAR_NIVEAU[POIDS_VARIANTE_PAR_NIVEAU.length - 1];
  return ligne.poids;
}

/** Tirage pondéré générique sur un dictionnaire { clé: poids }. */
export function tirerPondere(poids, rng) {
  const entrees = Object.entries(poids).filter(([, p]) => p > 0);
  const total = entrees.reduce((s, [, p]) => s + p, 0);
  if (total <= 0) return null;

  let seuil = rng.next() * total;
  for (const [cle, p] of entrees) {
    seuil -= p;
    if (seuil <= 0) return Number(cle);
  }
  return Number(entrees[entrees.length - 1][0]);
}

export function estDernierEtage(etage) {
  return etage >= ETAGE_MAX;
}
