/**
 * combat.js — Combat tour par tour.
 *
 * L'ennemi possède plusieurs attaques, tirées au sort avec des poids qui se
 * réajustent selon l'état du combat. Un ennemi bas en PV se retranche plus
 * souvent ; face à un joueur bas en PV il privilégie sa meilleure attaque.
 *
 * Les conditions sont des données (`ajustements`), pas du code : ajouter un
 * comportement se fait dans le bestiaire.
 *
 * Le joueur et l'ennemi ont chacun leur liste d'effets : un retranchement de
 * rat ne doit pas profiter au héros.
 */

import { roll } from '../core/dice.js';
import { PROVISOIRE } from '../rules/provisoire.js';
import { ENNEMI_PAR_ID, statsDeVariante } from '../data/monde.js';
import * as Effets from './effets.js';

/* ------------------------------------------------------------------ */
/* Création                                                            */
/* ------------------------------------------------------------------ */

export function creerCombat(ennemiId, { ennemiCommence = false, variante = 1 } = {}) {
  const modele = ENNEMI_PAR_ID[ennemiId];
  if (!modele) throw new Error(`Ennemi inconnu : ${ennemiId}`);

  const stats = statsDeVariante(modele, variante);

  return {
    ennemi: {
      id: modele.id,
      nom: modele.nom,
      icone: modele.icone,
      rang: modele.rang,
      variante,
      pv: stats.pv,
      pvMax: stats.pv,
      armure: stats.armure,
      initiative: stats.initiative,
      attaques: modele.attaques,
    },
    /** Effets portés par l'ennemi seul. */
    effets: Effets.creerListeEffets(),
    tour: 1,
    aQui: ennemiCommence ? 'ennemi' : 'joueur',
    actionsRestantes: 0,
    termine: false,
    vainqueur: null,
  };
}

/* ------------------------------------------------------------------ */
/* Initiative                                                          */
/* ------------------------------------------------------------------ */

/**
 * Détermine qui frappe en premier : 1d10 + Initiative de chaque côté,
 * le plus haut commence. Égalité : avantage au joueur.
 *
 * Un jet plutôt qu'une comparaison sèche, sinon un même duel donnerait
 * toujours le même ordre.
 */
export function jetDInitiative({ initiativeJoueur, initiativeEnnemi }, rng) {
  const joueur = roll('1d10', { rng, tags: ['initiative', 'joueur'] });
  const ennemi = roll('1d10', { rng, tags: ['initiative', 'ennemi'] });

  const scoreJoueur = joueur.total + initiativeJoueur;
  const scoreEnnemi = ennemi.total + initiativeEnnemi;

  return {
    scoreJoueur,
    scoreEnnemi,
    detailJoueur: `${joueur.total} + ${initiativeJoueur}`,
    detailEnnemi: `${ennemi.total} + ${initiativeEnnemi}`,
    ennemiCommence: scoreEnnemi > scoreJoueur,
  };
}

/* ------------------------------------------------------------------ */
/* Choix de l'attaque ennemie                                          */
/* ------------------------------------------------------------------ */

function conditionRemplie(quand, etat) {
  if (quand.pvSoiSous !== undefined && !(etat.partSoi < quand.pvSoiSous)) return false;
  if (quand.pvCibleSous !== undefined && !(etat.partCible < quand.pvCibleSous)) return false;
  return true;
}

/** Poids effectif d'une attaque, ajustements appliqués. */
export function poidsEffectif(attaque, etat) {
  let poids = attaque.poids ?? 1;
  for (const ajustement of attaque.ajustements ?? []) {
    if (conditionRemplie(ajustement.quand, etat)) poids = ajustement.poids;
  }
  return Math.max(0, poids);
}

/**
 * Choisit l'attaque de l'ennemi.
 * @param {object} etat { partSoi, partCible } — parts de PV restantes (0 à 1)
 */
export function choisirAttaque(combat, etat, rng) {
  const attaques = combat.ennemi.attaques ?? [];
  if (attaques.length === 0) return null;

  const pesees = attaques.map((a) => ({ attaque: a, poids: poidsEffectif(a, etat) }));
  const total = pesees.reduce((s, p) => s + p.poids, 0);
  if (total <= 0) return attaques[0];

  let seuil = rng.next() * total;
  for (const p of pesees) {
    seuil -= p.poids;
    if (seuil <= 0) return p.attaque;
  }
  return pesees[pesees.length - 1].attaque;
}

export function etatDuCombat(combat, personnage, pvMaxJoueur) {
  return {
    partSoi: combat.ennemi.pv / combat.ennemi.pvMax,
    partCible: personnage.pv / pvMaxJoueur,
  };
}

/* ------------------------------------------------------------------ */
/* Résolution                                                          */
/* ------------------------------------------------------------------ */

export function degatsApresArmure(brut, armure) {
  if (PROVISOIRE.combat.armureMode !== 'soustraction') {
    throw new Error(`Mode d'armure non implémenté : ${PROVISOIRE.combat.armureMode}`);
  }
  return Math.max(PROVISOIRE.combat.degatsMinimum, brut - armure);
}

/** Armure de l'ennemi, effets temporaires compris. */
export function armureEnnemi(combat) {
  return combat.ennemi.armure + Effets.bonusArmure(combat.effets);
}

/** Le joueur inflige des dégâts. */
export function frapperEnnemi(combat, des, { rng, pipeline, personnage }) {
  const jet = roll(des, {
    rng,
    pipeline,
    tags: ['degats', 'joueur'],
    actor: personnage,
    target: combat.ennemi,
  });
  const degats = degatsApresArmure(jet.total, armureEnnemi(combat));
  combat.ennemi.pv = Math.max(0, combat.ennemi.pv - degats);

  const mort = combat.ennemi.pv === 0;
  if (mort) {
    combat.termine = true;
    combat.vainqueur = 'joueur';
  }
  return { jet, brut: jet.total, absorbe: jet.total - degats, degats, mort };
}

/** L'ennemi exécute une attaque de dégâts. */
export function attaqueEnnemie(combat, attaque, { rng, pipeline, personnage, armureJoueur }) {
  const bonus = Effets.bonusDegats(combat.effets);
  const jet = roll(attaque.des, {
    rng,
    pipeline,
    tags: ['degats', 'ennemi'],
    actor: combat.ennemi,
    target: personnage,
  });
  const brut = jet.total + bonus;
  const degats = degatsApresArmure(brut, armureJoueur);
  return { jet, bonus, brut, absorbe: brut - degats, degats };
}

/** L'ennemi se soigne. */
export function soinEnnemi(combat, attaque, { rng }) {
  const jet = roll(attaque.des, { rng, tags: ['soin', 'ennemi'] });
  const avant = combat.ennemi.pv;
  combat.ennemi.pv = Math.min(combat.ennemi.pvMax, combat.ennemi.pv + jet.total);
  return { jet, rendus: combat.ennemi.pv - avant };
}

export function finirTour(combat) {
  combat.aQui = combat.aQui === 'joueur' ? 'ennemi' : 'joueur';
  if (combat.aQui === 'joueur') combat.tour++;
}

export function marquerDefaite(combat) {
  combat.termine = true;
  combat.vainqueur = 'ennemi';
}

export function tenterFuite(chance, rng) {
  return rng.int(1, 100) <= chance;
}
