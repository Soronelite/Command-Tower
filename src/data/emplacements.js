/**
 * emplacements.js — Emplacements d'équipement.
 *
 * Un objet déclare un `port` (ce qu'il est : casque, arme, bijou…).
 * Un emplacement déclare les `ports` qu'il accepte.
 *
 * Règle structurante : seuls les objets ÉQUIPÉS agissent. Ce qui dort dans le
 * sac n'apporte aucun passif et n'est pas utilisable.
 */

/** Nature d'un objet, du point de vue du portage. */
export const PORTS = {
  CASQUE: 'casque',
  ARMURE: 'armure',
  ARME: 'arme',
  BOUCLIER: 'bouclier',
  CEINTURE: 'ceinture',
  SAC: 'sac',
  CAPE: 'cape',
  BIJOU: 'bijou',
};

export const EMPLACEMENTS = [
  { id: 'tete', nom: 'Tête', icone: '⛑️', accepte: [PORTS.CASQUE] },
  { id: 'armure', nom: 'Armure', icone: '🥋', accepte: [PORTS.ARMURE] },
  { id: 'mainGauche', nom: 'Main gauche', icone: '🤚', accepte: [PORTS.ARME, PORTS.BOUCLIER], main: true },
  { id: 'mainDroite', nom: 'Main droite', icone: '✋', accepte: [PORTS.ARME, PORTS.BOUCLIER], main: true },
  { id: 'ceinture', nom: 'Ceinture', icone: '🎗️', accepte: [PORTS.CEINTURE] },
  { id: 'dos', nom: 'Dos', icone: '🎒', accepte: [PORTS.SAC, PORTS.BOUCLIER] },
  { id: 'cape', nom: 'Cape', icone: '🧣', accepte: [PORTS.CAPE] },
  { id: 'bijou1', nom: 'Bijou', icone: '💍', accepte: [PORTS.BIJOU] },
  { id: 'bijou2', nom: 'Bijou', icone: '💍', accepte: [PORTS.BIJOU] },
  { id: 'bijou3', nom: 'Bijou', icone: '💍', accepte: [PORTS.BIJOU] },
];

export const EMPLACEMENT_PAR_ID = Object.fromEntries(
  EMPLACEMENTS.map((e) => [e.id, e])
);

export const MAINS = ['mainGauche', 'mainDroite'];

/** Emplacements pouvant accueillir un objet donné. */
export function emplacementsPour(objetDef) {
  if (!objetDef.port) return [];
  return EMPLACEMENTS.filter((e) => e.accepte.includes(objetDef.port));
}

/** Sac par défaut, quand aucun sac n'est porté sur le dos. */
export const SAC_SANS_SAC = { largeur: 2, hauteur: 2 };
