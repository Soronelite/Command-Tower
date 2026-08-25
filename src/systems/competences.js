/**
 * competences.js — Cibles d'attribution des points de compétence.
 *
 * Aucune liste de compétences n'a été définie par le game design. Les points
 * sont donc attribuables aux statistiques existantes, qui sont la seule liste
 * validée à ce jour.
 *
 * Le registre est ouvert : `enregistrer()` accepte n'importe quelle autre
 * cible, sans modifier l'écran de montée de niveau ni le reste du moteur.
 */

import { STATS, STAT_MAX } from '../rules/stats.js';

const supplementaires = [];

/**
 * Ajoute une cible d'attribution.
 * @param {{id:string, nom:string, description?:string,
 *          disponible?:(perso)=>boolean, appliquer:(perso)=>void,
 *          valeur?:(perso)=>string}} cible
 */
export function enregistrer(cible) {
  if (!cible?.id || typeof cible.appliquer !== 'function') {
    throw new Error('Cible de compétence invalide.');
  }
  if (supplementaires.some((c) => c.id === cible.id)) {
    throw new Error(`Compétence déjà enregistrée : ${cible.id}`);
  }
  supplementaires.push(cible);
  return cible;
}

/** Cibles issues des statistiques. */
function cibleStatistique(stat) {
  return {
    id: `stat:${stat.id}`,
    nom: stat.nom,
    description: stat.effet,
    disponible: (perso) => perso.stats[stat.id] < STAT_MAX,
    appliquer: (perso) => {
      perso.stats[stat.id]++;
    },
    valeur: (perso) => `${perso.stats[stat.id]} / ${STAT_MAX}`,
  };
}

/** Toutes les cibles connues. */
export function toutesLesCibles() {
  return [...STATS.map(cibleStatistique), ...supplementaires];
}

/** Cibles utilisables par ce personnage maintenant. */
export function ciblesDisponibles(personnage) {
  return toutesLesCibles().filter((c) => !c.disponible || c.disponible(personnage));
}

export function cible(id) {
  const c = toutesLesCibles().find((x) => x.id === id);
  if (!c) throw new Error(`Compétence inconnue : ${id}`);
  return c;
}
