/**
 * loot.js — Sélection d'objets dans une table.
 *
 * Une table déclare soit une liste explicite de raretés, soit un plafond.
 * Le plafond vient des rencontres (« Commun au maximum ») et n'est jamais
 * dépassé, torche comprise : la torche améliore les chances À L'INTÉRIEUR du
 * plafond, elle ne le franchit pas.
 */

import { OBJETS } from '../data/objets.js';
import { TABLES_LOOT } from '../data/monde.js';
import { raretesJusqua, RARETES } from '../data/personnage.js';
import { PROVISOIRE } from '../rules/provisoire.js';

/** Raretés autorisées par une table, de la plus faible à la plus forte. */
export function raretesAutorisees(tableId) {
  const table = TABLES_LOOT[tableId];
  if (!table) throw new Error(`Table de loot inconnue : ${tableId}`);
  return table.raretes ?? raretesJusqua(table.plafond);
}

/** Objets candidats pour une table. */
export function candidats(tableId) {
  const autorisees = new Set(raretesAutorisees(tableId));
  return OBJETS.filter((o) => autorisees.has(o.rarete));
}

function grouperParRarete(objets) {
  const parRarete = new Map();
  for (const o of objets) {
    if (!parRarete.has(o.rarete)) parRarete.set(o.rarete, []);
    parRarete.get(o.rarete).push(o);
  }
  return parRarete;
}

/** Rareté immédiatement supérieure, si elle reste autorisée par la table. */
function rareteSuperieure(rarete, autorisees) {
  const rangs = RARETES.map((r) => r.id);
  const suivant = rangs[rangs.indexOf(rarete) + 1];
  return suivant && autorisees.includes(suivant) ? suivant : null;
}

/**
 * Tire un seul objet.
 *
 * Le tirage se fait en deux temps : d'abord la rareté, pondérée, puis un objet
 * au hasard parmi ceux de cette rareté. Ainsi ajouter dix objets fréquents ne
 * rend pas les fréquents dix fois plus probables.
 *
 * Avec la torche, 10 % de chances que la rareté obtenue monte d'un cran, sans
 * jamais dépasser le plafond de la table.
 */
export function tirer(tableId, rng, { lootAmeliore = false } = {}) {
  const disponibles = candidats(tableId);
  if (disponibles.length === 0) return null;

  const autorisees = raretesAutorisees(tableId);
  const poids = PROVISOIRE.loot.poidsParRarete;
  const parRarete = grouperParRarete(disponibles);

  const entrees = [...parRarete.keys()].map((r) => ({ rarete: r, poids: poids[r] ?? 0 }));
  const total = entrees.reduce((s, e) => s + e.poids, 0);
  if (total <= 0) return rng.pick(disponibles);

  let seuil = rng.next() * total;
  let choisie = entrees[entrees.length - 1].rarete;
  for (const e of entrees) {
    seuil -= e.poids;
    if (seuil <= 0) {
      choisie = e.rarete;
      break;
    }
  }

  if (lootAmeliore && rng.int(1, 100) <= PROVISOIRE.loot.torche.rareteSuperieure) {
    const mieux = rareteSuperieure(choisie, autorisees);
    if (mieux && parRarete.has(mieux)) choisie = mieux;
  }

  return rng.pick(parRarete.get(choisie));
}

/**
 * Butin complet d'une fouille : un objet, ou deux si la torche est allumée et
 * que le jet à 25 % passe.
 *
 * @returns {Array} liste d'objets, vide seulement si la table n'a aucun candidat.
 */
export function tirerButin(tableId, rng, { lootAmeliore = false } = {}) {
  const premier = tirer(tableId, rng, { lootAmeliore });
  if (!premier) return [];

  if (lootAmeliore && rng.int(1, 100) <= PROVISOIRE.loot.torche.objetDouble) {
    const second = tirer(tableId, rng, { lootAmeliore });
    if (second) return [premier, second];
  }

  return [premier];
}
