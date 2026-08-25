/**
 * progression.js — Expérience et niveaux.
 *
 * Le module ne connaît ni les rencontres ni les ennemis : on lui donne un
 * montant d'XP, il renvoie ce qui en découle.
 */

import {
  NIVEAU_INITIAL,
  NIVEAU_MAX,
  SEUILS,
  XP_PROGRESSION,
  pointsCompetencePour,
  xpDUnEnnemi,
  xpRequisePourNiveauSuivant,
} from '../rules/xp.js';

export { XP_PROGRESSION, NIVEAU_MAX };

export function creerProgression() {
  return {
    niveau: NIVEAU_INITIAL,
    xp: 0,
    /** XP reçue une fois le niveau 10 atteint : enregistrée, sans effet. */
    xpExcedentaire: 0,
    pointsDisponibles: 0,
  };
}

/**
 * Ajoute de l'XP et fait monter autant de niveaux que nécessaire.
 * @returns {{montant:number, niveauxGagnes:Array<{niveau:number,points:number}>, pointsGagnes:number}}
 */
export function gagnerXp(prog, montant) {
  const resultat = { montant, niveauxGagnes: [], pointsGagnes: 0 };
  if (montant <= 0) return resultat;

  if (prog.niveau >= NIVEAU_MAX) {
    prog.xpExcedentaire += montant;
    return resultat;
  }

  prog.xp += montant;

  while (prog.niveau < NIVEAU_MAX && prog.xp >= SEUILS[prog.niveau + 1]) {
    prog.niveau++;
    const points = pointsCompetencePour(prog.niveau);
    prog.pointsDisponibles += points;
    resultat.pointsGagnes += points;
    resultat.niveauxGagnes.push({ niveau: prog.niveau, points });
  }

  return resultat;
}

/** XP gagnée pour un ennemi vaincu, d'après son rang et sa variante. */
export function xpPourEnnemi(rang, variante = 1) {
  return xpDUnEnnemi(rang, variante);
}

/**
 * Avancement à l'intérieur du niveau courant.
 * Au niveau 3 avec 42 XP cumulés : { actuel: 18, requis: 19 }.
 */
export function avancement(prog) {
  if (prog.niveau >= NIVEAU_MAX) {
    return { actuel: 0, requis: null, complet: true };
  }
  return {
    actuel: prog.xp - SEUILS[prog.niveau],
    requis: xpRequisePourNiveauSuivant(prog.niveau),
    complet: false,
  };
}

export function depenserPoint(prog) {
  if (prog.pointsDisponibles <= 0) return false;
  prog.pointsDisponibles--;
  return true;
}
