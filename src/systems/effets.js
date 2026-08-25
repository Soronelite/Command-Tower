/**
 * effets.js — Effets temporaires et passifs d'objets.
 *
 * Un effet est une donnée déclarée dans le catalogue d'objets. Le moteur ne
 * connaît aucun effet en particulier : il sait seulement les faire durer,
 * les additionner et, quand ils touchent un jet de dés, les traduire en
 * modificateurs pour le pipeline.
 *
 * Deux durées existent :
 *   - dureeTours  : en tours de combat ;
 *   - dureePieces : en pièces traversées.
 */

import { ModifierPipeline, PHASES } from '../core/modifiers.js';
import { objet } from '../data/objets.js';
import * as Portage from './portage.js';
import { PROVISOIRE } from '../rules/provisoire.js';

export function creerListeEffets() {
  return [];
}

/** Ajoute un effet. Un effet déjà présent voit sa durée réinitialisée. */
export function appliquer(liste, modele, source = null) {
  // `immediat` : l'effet vaut pour le tour en cours, riposte ennemie comprise.
  // Sinon « prochainTour » le décale d'un tour.
  const duree = modele.immediat
    ? modele.dureeTours ?? 1
    : modele.dureeTours === 'prochainTour'
      ? PROVISOIRE.effets.dureeAuProchainTour + 1
      : modele.dureeTours ?? null;

  const existant = liste.find((e) => e.id === modele.id);
  if (existant) {
    existant.toursRestants = duree;
    existant.piecesRestantes = modele.dureePieces ?? null;
    return existant;
  }

  const effet = {
    ...modele,
    source,
    toursRestants: duree,
    piecesRestantes: modele.dureePieces ?? null,
  };
  liste.push(effet);
  return effet;
}

/** Décrémente les durées en tours. Renvoie les effets qui viennent d'expirer. */
export function finDeTour(liste) {
  const expires = [];
  for (let i = liste.length - 1; i >= 0; i--) {
    const e = liste[i];
    if (e.toursRestants === null) continue;
    e.toursRestants--;
    if (e.toursRestants <= 0) expires.push(...liste.splice(i, 1));
  }
  return expires;
}

/** Décrémente les durées en pièces. Renvoie les effets qui viennent d'expirer. */
export function changementDePiece(liste) {
  const expires = [];
  for (let i = liste.length - 1; i >= 0; i--) {
    const e = liste[i];
    if (e.piecesRestantes === null) continue;
    e.piecesRestantes--;
    if (e.piecesRestantes <= 0) expires.push(...liste.splice(i, 1));
  }
  return expires;
}

/** Vide les effets de combat en fin de combat, garde ceux qui durent en pièces. */
export function finDeCombat(liste) {
  for (let i = liste.length - 1; i >= 0; i--) {
    if (liste[i].toursRestants !== null) liste.splice(i, 1);
  }
}

const somme = (liste, champ) =>
  liste.reduce((total, e) => total + (e[champ] ?? 0), 0);

export const bonusArmure = (liste) => somme(liste, 'armure');
export const bonusActions = (liste) => somme(liste, 'actions');
export const bonusDegats = (liste) => somme(liste, 'degats');
export const lootAmeliore = (liste) => liste.some((e) => e.bonusLoot);

/* ------------------------------------------------------------------ */
/* Passifs d'objets                                                    */
/* ------------------------------------------------------------------ */

/** Somme d'un passif sur les objets ÉQUIPÉS. Le sac n'agit pas. */
export function passifCumule(portage, champ) {
  return Portage.passif(portage, champ);
}

/* ------------------------------------------------------------------ */
/* Pipeline                                                            */
/* ------------------------------------------------------------------ */

/**
 * Reconstruit le pipeline de modificateurs à partir de l'inventaire et des
 * effets actifs. Reconstruire à chaque jet évite toute désynchronisation
 * quand un objet est consommé ou trouvé en cours de combat.
 *
 * Les modificateurs du joueur portent le tag « joueur », ce qui les empêche
 * de s'appliquer aux attaques ennemies.
 */
export function construirePipeline(portage, effets) {
  const pipeline = new ModifierPipeline();

  const bonusJet = passifCumule(portage, 'bonusJet');
  if (bonusJet !== 0) {
    pipeline.add({
      id: 'passif-bonus-jet',
      label: 'Bonus aux jets',
      source: 'inventaire',
      phase: PHASES.FLAT,
      requires: ['joueur'],
      apply: (v) => v + bonusJet,
    });
  }

  const degats = bonusDegats(effets);
  if (degats !== 0) {
    const label = effets.find((e) => e.degats)?.label ?? 'Effet';
    pipeline.add({
      id: 'effet-degats',
      label,
      source: 'effet',
      phase: PHASES.FLAT,
      requires: ['joueur', 'degats'],
      apply: (v) => v + degats,
    });
  }

  return pipeline;
}
