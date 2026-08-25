/**
 * stats.js — Statistiques et valeurs dérivées.
 *
 * Décidé :
 *   - 8 statistiques, maximum 12 ;
 *   - 2 points par défaut, sauf Endurance qui démarre à 0 ;
 *   - 2 points supplémentaires à répartir à la création ;
 *   - 10 PV et 0 armure au départ ;
 *   - 1 point de Santé   = +2 PV maximum ;
 *   - 1 point de Défense = +1 armure ;
 *   - Endurance : une action par tranche de 3 points, plus une de base
 *     (0 → 1 action, 3 → 2 actions, 6 → 3 actions) ;
 *   - les autres statistiques valent 10 % par point.
 */

import { PROVISOIRE } from './provisoire.js';

export const STATS = [
  { id: 'sante', nom: 'Santé', effet: '+2 PV maximum par point' },
  { id: 'defense', nom: 'Défense', effet: '+1 armure par point' },
  // L'Endurance démarre à 0 : 1 action de base, la 2e arrive à 3 points.
  { id: 'endurance', nom: 'Endurance', effet: '+1 action tous les 3 points', min: 0, defaut: 0 },
  { id: 'intelligence', nom: 'Intelligence', effet: 'Effet à définir' },
  { id: 'initiative', nom: 'Initiative', effet: '+10 % par point' },
  { id: 'perception', nom: 'Perception', effet: 'Effet à définir' },
  { id: 'courage', nom: 'Courage', effet: 'Effet à définir' },
  { id: 'charisme', nom: 'Charisme', effet: 'Effet à définir' },
];

/** Minimum commun. Une statistique peut déclarer le sien via `min`. */
export const STAT_MIN = 2;
export const STAT_MAX = 12;
export const POINTS_A_REPARTIR = 2;

/** Plancher d'une statistique donnée. */
export function minimumDe(statId) {
  return STATS.find((s) => s.id === statId)?.min ?? STAT_MIN;
}

export const PV_BASE = 10;
export const ARMURE_BASE = 0;
export const PV_PAR_SANTE = 2;
export const ARMURE_PAR_DEFENSE = 1;
export const POURCENT_PAR_POINT = 10;

export const ACTIONS_DE_BASE = 1;
export const ENDURANCE_PAR_ACTION = 3;

/** Statistiques de départ : 2 partout, sauf Endurance à 0. */
export function statsParDefaut() {
  return Object.fromEntries(STATS.map((s) => [s.id, s.defaut ?? STAT_MIN]));
}

const ref = () => PROVISOIRE.personnage.statsDeReference;

/** PV maximum venant des statistiques, hors objets. */
export function pvMax(stats) {
  return PV_BASE + (stats.sante - ref()) * PV_PAR_SANTE;
}

/** Armure venant des statistiques, hors objets. */
export function armureDeBase(stats) {
  return ARMURE_BASE + (stats.defense - ref()) * ARMURE_PAR_DEFENSE;
}

/** Nombre d'actions par tour de combat, hors effets temporaires. */
export function actionsParTour(stats) {
  return ACTIONS_DE_BASE + Math.floor(stats.endurance / ENDURANCE_PAR_ACTION);
}

/** Valeur en pourcentage d'une statistique non chiffrée en points. */
export function pourcentage(stats, id) {
  return stats[id] * POURCENT_PAR_POINT;
}

/** Points déjà dépensés au-delà du minimum, à la création. */
export function pointsDepenses(stats) {
  return STATS.reduce((total, s) => total + (stats[s.id] - (s.defaut ?? STAT_MIN)), 0);
}

export function pointsRestants(stats) {
  return POINTS_A_REPARTIR - pointsDepenses(stats);
}
