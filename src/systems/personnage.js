/**
 * personnage.js — État du personnage.
 *
 * PV maximum et armure sont calculés, jamais figés : équiper une armure de
 * mailles ou un anneau de vigueur est pris en compte immédiatement.
 *
 * Seuls les objets ÉQUIPÉS apportent leurs passifs. Ce qui dort dans le sac
 * n'a aucun effet.
 */

import { pvMax, armureDeBase, actionsParTour, statsParDefaut } from '../rules/stats.js';
import { CLASSE_PAR_ID } from '../data/personnage.js';
import { creerProgression } from './progression.js';
import * as Portage from './portage.js';
import * as Inv from './inventaire.js';
import { instancier } from './equipement.js';

export function creerPersonnage({ nom, race, sexe, classe, stats }) {
  const modele = CLASSE_PAR_ID[classe];
  if (!modele) throw new Error(`Classe inconnue : ${classe}`);

  const perso = {
    nom: (nom ?? '').trim() || 'Sans nom',
    race,
    sexe,
    classe,
    stats: { ...statsParDefaut(), ...stats },
    portage: Portage.creerPortage(),
    progression: creerProgression(),
  };

  equiperLeDepart(perso, modele);

  perso.pv = pvMaxTotal(perso);
  return perso;
}

/**
 * Équipe la tenue de départ d'une classe.
 * L'ordre compte : le sac à dos d'abord, sinon la grille reste en 2×2 et le
 * reste ne rentre pas.
 */
function equiperLeDepart(perso, modele) {
  for (const entree of modele.equipementDeDepart ?? []) {
    const instance = instancier(entree.objetId);
    if (entree.emplacement) {
      perso.portage.equipement[entree.emplacement] = instance;
      Portage.resynchroniser(perso.portage);
    } else if (entree.rapide !== undefined) {
      Portage.resynchroniser(perso.portage);
      const emplacement = perso.portage.raccourcis[entree.rapide];
      if (emplacement) emplacement.contenu = instance;
    }
  }
  Portage.resynchroniser(perso.portage);

  for (const objetId of modele.objetsDeDepart ?? []) {
    Inv.ajouter(perso.portage.sac, objetId);
  }
}

/* ------------------------------------------------------------------ */

/** Raccourci de lecture : la grille du sac. */
export function sacDe(perso) {
  return perso.portage.sac;
}

/** PV maximum : statistiques + passifs des objets équipés. */
export function pvMaxTotal(perso) {
  return pvMax(perso.stats) + Portage.passif(perso.portage, 'pvMax');
}

/** Armure totale : statistiques + objets équipés + effets temporaires. */
export function armureTotale(perso, effets = []) {
  const temporaire = effets.reduce((t, e) => t + (e.armure ?? 0), 0);
  return armureDeBase(perso.stats) + Portage.passif(perso.portage, 'armure') + temporaire;
}

/** Initiative : statistique + passifs équipés. */
export function initiativeTotale(perso) {
  return perso.stats.initiative + Portage.passif(perso.portage, 'initiative');
}

/** Actions par tour : statistiques + effets temporaires. */
export function actionsDisponibles(perso, effets = []) {
  const bonus = effets.reduce((t, e) => t + (e.actions ?? 0), 0);
  return actionsParTour(perso.stats) + bonus;
}

export function soigner(perso, pv) {
  const max = pvMaxTotal(perso);
  const avant = perso.pv;
  perso.pv = Math.min(max, perso.pv + pv);
  return perso.pv - avant;
}

export function blesser(perso, pv) {
  const avant = perso.pv;
  perso.pv = Math.max(0, perso.pv - pv);
  return avant - perso.pv;
}

export function estMort(perso) {
  return perso.pv <= 0;
}

/** Ramène les PV sous le maximum courant, après tout changement d'équipement. */
export function recaler(perso) {
  perso.pv = Math.min(perso.pv, pvMaxTotal(perso));
}

/** Après une montée de niveau : les PV suivent le nouveau maximum. */
export function apresGainDeStatistique(perso, statId) {
  if (statId === 'sante') perso.pv += 2;
  recaler(perso);
}
