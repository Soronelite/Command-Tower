/**
 * donjon.js — Génération d'un étage et résolution d'une pièce.
 *
 * Tout ce qui est tiré ici passe par `rngMonde`, jamais par le flux de combat :
 * une même graine produit toujours le même étage, quoi que fasse le joueur.
 *
 * Une pièce est vide par défaut. Ce qu'elle contient est décidé à l'entrée du
 * joueur, pas à la génération de l'étage : le niveau du personnage au moment
 * où il pousse la porte doit compter.
 */

import { piecesDeLEtage, piece } from '../data/pieces.js';
import { ENNEMIS, ennemisDeFamille } from '../data/monde.js';
import {
  PIECES_PAR_ETAGE,
  poidsDeRang,
  poidsDeVariante,
  tirerPondere,
} from '../rules/etages.js';

/**
 * Construit la liste des pièces d'un étage.
 * Le contenu de chaque pièce n'est PAS résolu ici.
 */
export function genererEtage(etage, rngMonde, longueur = PIECES_PAR_ETAGE) {
  const disponibles = piecesDeLEtage(etage);
  if (disponibles.length === 0) {
    throw new Error(`Aucune pièce définie pour l'étage ${etage}.`);
  }

  const pieces = [];
  let derniere = null;

  for (let i = 0; i < longueur; i++) {
    // On évite deux fois la même pièce d'affilée tant qu'un choix existe.
    const choix = disponibles.length > 1
      ? disponibles.filter((p) => p.id !== derniere)
      : disponibles;
    const tiree = rngMonde.pick(choix);
    pieces.push(tiree.id);
    derniere = tiree.id;
  }

  return pieces;
}

/**
 * Choisit l'ennemi d'une rencontre.
 *
 * Le rang vient de l'étage, la variante du niveau du joueur. Si le rang tiré
 * n'a aucun ennemi dans les familles de la pièce, on retombe sur le rang
 * disponible le plus proche plutôt que d'annuler la rencontre.
 *
 * @returns {{ennemiId:string, rang:number, variante:number, approxime:boolean}|null}
 */
export function choisirEnnemi({ etage, niveauJoueur, familles }, rngMonde) {
  // L'étage filtre les candidats : un ennemi ne peut pas apparaître avant
  // son etageMini, même par repli de rang.
  const candidats = familles.flatMap((f) => ennemisDeFamille(f, etage));
  if (candidats.length === 0) return null;

  const rangVoulu = tirerPondere(poidsDeRang(etage), rngMonde);
  const variante = tirerPondere(poidsDeVariante(niveauJoueur), rngMonde) ?? 1;

  let retenus = candidats.filter((e) => e.rang === rangVoulu);
  let approxime = false;

  if (retenus.length === 0) {
    // Rang absent du bestiaire : on prend le plus proche.
    approxime = true;
    const ecartMini = Math.min(...candidats.map((e) => Math.abs(e.rang - rangVoulu)));
    retenus = candidats.filter((e) => Math.abs(e.rang - rangVoulu) === ecartMini);
  }

  const choisi = rngMonde.pick(retenus);
  return { ennemiId: choisi.id, rang: choisi.rang, variante, approxime, rangVoulu };
}

/**
 * Résout le contenu d'une pièce à l'entrée du joueur.
 *
 * @returns {{def:object, eclairee:boolean, ennemi:object|null, fouilles:Set}}
 */
export function resoudrePiece(pieceId, { etage, niveauJoueur }, rngMonde) {
  const def = piece(pieceId);

  const chanceEclairage = def.eclairage?.chance ?? 0;
  const eclairee = rngMonde.int(1, 100) <= chanceEclairage;

  const rencontre = def.rencontre;
  let ennemi = null;

  if (rencontre) {
    const chance = eclairee
      ? rencontre.chanceSiEclairee ?? rencontre.chance
      : rencontre.chance;

    if (rngMonde.int(1, 100) <= chance) {
      ennemi = choisirEnnemi(
        { etage, niveauJoueur, familles: rencontre.familles ?? [] },
        rngMonde
      );
    }
  }

  return { def, eclairee, ennemi, fouilles: new Set() };
}

/** Bestiaire lisible, pour le débogage et l'équilibrage. */
export function bestiaireParRang() {
  const parRang = {};
  for (const e of ENNEMIS) {
    (parRang[e.rang] ??= []).push(e.nom);
  }
  return parRang;
}
