/**
 * inventaire.js — Le sac : une grille d'instances d'objets.
 *
 * La grille fait 2×2 sans sac à dos, 4×4 avec. Elle ne contient que des
 * instances (objet + utilisations), jamais des définitions.
 *
 * Ce module ne connaît ni l'équipement ni les emplacements rapides : il place
 * et déplace des formes dans un rectangle.
 */

import { objet, estPivotable } from '../data/objets.js';
import { SAC_SANS_SAC } from '../data/emplacements.js';
import { instancier } from './equipement.js';

export function creerInventaire(largeur = SAC_SANS_SAC.largeur, hauteur = SAC_SANS_SAC.hauteur) {
  return { largeur, hauteur, contenu: [] };
}

/** Forme effective d'un emplacement, rotation comprise. */
export function forme(objetId, pivote) {
  const f = objet(objetId).forme;
  return pivote ? { l: f.h, h: f.l } : { l: f.l, h: f.h };
}

export function cases(slot) {
  const f = forme(slot.objetId, slot.pivote);
  const out = [];
  for (let dy = 0; dy < f.h; dy++) {
    for (let dx = 0; dx < f.l; dx++) out.push({ x: slot.x + dx, y: slot.y + dy });
  }
  return out;
}

export function occupation(inv, ignoreUid = null) {
  const grille = Array.from({ length: inv.hauteur }, () => Array(inv.largeur).fill(null));
  for (const slot of inv.contenu) {
    if (slot.uid === ignoreUid) continue;
    for (const c of cases(slot)) {
      if (grille[c.y]?.[c.x] !== undefined) grille[c.y][c.x] = slot.uid;
    }
  }
  return grille;
}

export function peutPlacer(inv, objetId, x, y, pivote, ignoreUid = null) {
  const f = forme(objetId, pivote);
  if (x < 0 || y < 0 || x + f.l > inv.largeur || y + f.h > inv.hauteur) return false;
  const grille = occupation(inv, ignoreUid);
  for (let dy = 0; dy < f.h; dy++) {
    for (let dx = 0; dx < f.l; dx++) {
      if (grille[y + dy][x + dx] !== null) return false;
    }
  }
  return true;
}

export function trouverPlace(inv, objetId) {
  const orientations = estPivotable(objet(objetId)) ? [false, true] : [false];
  for (const pivote of orientations) {
    for (let y = 0; y < inv.hauteur; y++) {
      for (let x = 0; x < inv.largeur; x++) {
        if (peutPlacer(inv, objetId, x, y, pivote)) return { x, y, pivote };
      }
    }
  }
  return null;
}

/** Place une instance existante. Ne crée rien. */
export function poser(inv, instance, x, y, pivote = false) {
  if (!peutPlacer(inv, instance.objetId, x, y, pivote)) return null;
  const slot = { ...instance, x, y, pivote };
  inv.contenu.push(slot);
  return slot;
}

/** Crée une instance et la place à un endroit précis. */
export function placer(inv, objetId, x, y, pivote = false) {
  return poser(inv, instancier(objetId), x, y, pivote);
}

/** Crée une instance et la range où elle rentre. Null si le sac est plein. */
export function ajouter(inv, objetId) {
  const place = trouverPlace(inv, objetId);
  if (!place) return null;
  return placer(inv, objetId, place.x, place.y, place.pivote);
}

/** Range une instance existante où elle rentre. */
export function ranger(inv, instance) {
  const place = trouverPlace(inv, instance.objetId);
  if (!place) return null;
  return poser(inv, instance, place.x, place.y, place.pivote);
}

export function retirer(inv, uid) {
  const i = inv.contenu.findIndex((s) => s.uid === uid);
  if (i === -1) return null;
  const [slot] = inv.contenu.splice(i, 1);
  const { x, y, pivote, ...instance } = slot;
  return instance;
}

export function trouver(inv, uid) {
  return inv.contenu.find((s) => s.uid === uid) ?? null;
}

export function deplacer(inv, uid, x, y, pivote) {
  const slot = trouver(inv, uid);
  if (!slot) return false;
  const orientation = pivote ?? slot.pivote;
  if (orientation !== slot.pivote && !estPivotable(objet(slot.objetId))) return false;
  if (!peutPlacer(inv, slot.objetId, x, y, orientation, uid)) return false;
  slot.x = x;
  slot.y = y;
  slot.pivote = orientation;
  return true;
}

export function pivoter(inv, uid) {
  const slot = trouver(inv, uid);
  if (!slot) return false;
  return deplacer(inv, uid, slot.x, slot.y, !slot.pivote);
}

export function casesLibres(inv) {
  return occupation(inv).flat().filter((c) => c === null).length;
}

export function filtrer(inv, predicat) {
  return inv.contenu.filter((s) => predicat(objet(s.objetId), s));
}

/**
 * Redimensionne le sac (changement de sac à dos).
 * Les objets qui ne rentrent plus sont renvoyés à l'appelant, jamais détruits
 * en silence.
 * @returns {Array} instances expulsées
 */
export function redimensionner(inv, largeur, hauteur) {
  const anciens = inv.contenu;
  inv.largeur = largeur;
  inv.hauteur = hauteur;
  inv.contenu = [];

  const expulses = [];
  // Les objets les plus encombrants d'abord : ils sont les plus durs à caser.
  const tries = [...anciens].sort(
    (a, b) => objet(b.objetId).forme.l * objet(b.objetId).forme.h
            - objet(a.objetId).forme.l * objet(a.objetId).forme.h
  );

  for (const slot of tries) {
    const { x, y, pivote, ...instance } = slot;
    if (!ranger(inv, instance)) expulses.push(instance);
  }
  return expulses;
}

export function restaurer(donnees) {
  return {
    largeur: donnees.largeur ?? SAC_SANS_SAC.largeur,
    hauteur: donnees.hauteur ?? SAC_SANS_SAC.hauteur,
    contenu: (donnees.contenu ?? []).map((s) => ({ ...s })),
  };
}
