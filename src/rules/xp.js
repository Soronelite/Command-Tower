/**
 * xp.js — Expérience, niveaux et points de compétence.
 *
 * Les courbes sont des tables explicites, volontairement pas recalculées.
 * Modifier l'équilibrage se fait donc ici, sans toucher au code.
 */

export const NIVEAU_INITIAL = 1;
export const NIVEAU_MAX = 10;

/**
 * XP cumulée nécessaire pour atteindre chaque niveau.
 * L'index correspond au niveau : SEUILS[3] = 24.
 */
export const SEUILS = [null, 0, 10, 24, 43, 69, 104, 151, 214, 299, 414];

/**
 * XP rapportée par un ennemi, indexée sur son rang.
 * Les entrées 11 et 12 servent aux variantes 2 et 3 d'un rang 10, en
 * prolongeant la même progression.
 */
export const XP_PAR_RANG_ENNEMI = {
  1: 5,
  2: 8,
  3: 12,
  4: 17,
  5: 24,
  6: 34,
  7: 47,
  8: 65,
  9: 90,
  10: 125,
  11: 172,
  12: 237,
};

/** XP gagnée en passant à une nouvelle pièce. */
export const XP_PROGRESSION = 2;

/** Points de compétence accordés en atteignant un niveau donné. */
export function pointsCompetencePour(niveau) {
  if (niveau <= 1) return 0;
  return niveau >= 5 ? 2 : 1;
}

/** XP cumulée requise pour atteindre un niveau. */
export function seuilCumule(niveau) {
  if (niveau < 1 || niveau > NIVEAU_MAX) return null;
  return SEUILS[niveau];
}

/** XP nécessaire pour passer du niveau donné au suivant. */
export function xpRequisePourNiveauSuivant(niveau) {
  if (niveau >= NIVEAU_MAX) return null;
  return SEUILS[niveau + 1] - SEUILS[niveau];
}

export const RANG_MAX = 10;
export const VARIANTE_MAX = 3;

/**
 * XP rapportée par un ennemi.
 *
 * Une variante supérieure vaut le rang au-dessus : plutôt qu'une seconde
 * courbe à entretenir, on décale la lecture dans la table existante.
 * Rat rang 1 : variante 1 → 5, variante 2 → 8, variante 3 → 12.
 */
export function xpDUnEnnemi(rang, variante = 1) {
  if (rang === null || rang === undefined) return 0;
  const index = rang + Math.max(1, variante) - 1;
  return XP_PAR_RANG_ENNEMI[index] ?? 0;
}
