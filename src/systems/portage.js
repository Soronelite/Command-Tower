/**
 * portage.js — Orchestration des trois contenants.
 *
 * Le sac, l'équipement et les emplacements rapides sont trois modules séparés.
 * Déplacer un objet de l'un à l'autre demande de coordonner les trois : c'est
 * le rôle de ce module, et le seul endroit où cette coordination existe.
 */

import { objet } from '../data/objets.js';
import * as Inv from './inventaire.js';
import * as Eq from './equipement.js';

/* ------------------------------------------------------------------ */
/* Construction                                                        */
/* ------------------------------------------------------------------ */

export function creerPortage() {
  const equipement = Eq.creerEquipement();
  const taille = Eq.tailleDuSac(equipement);
  return {
    equipement,
    sac: Inv.creerInventaire(taille.largeur, taille.hauteur),
    raccourcis: [],
  };
}

/**
 * Recale le sac et les emplacements rapides après un changement d'équipement.
 * @returns {Array} instances expulsées, à replacer ou à laisser au sol.
 */
export function resynchroniser(portage) {
  const expulses = [];

  const taille = Eq.tailleDuSac(portage.equipement);
  if (taille.largeur !== portage.sac.largeur || taille.hauteur !== portage.sac.hauteur) {
    expulses.push(...Inv.redimensionner(portage.sac, taille.largeur, taille.hauteur));
  }

  const plan = Eq.planDeCeinture(portage.equipement);
  const ancien = portage.raccourcis;
  portage.raccourcis = plan.map((type, i) => ({ type, contenu: ancien[i]?.contenu ?? null }));

  // Les emplacements disparus rendent leur contenu.
  for (let i = plan.length; i < ancien.length; i++) {
    if (ancien[i]?.contenu) expulses.push(ancien[i].contenu);
  }

  // Un emplacement redevenu « potion » peut refuser ce qu'il contenait.
  for (const emplacement of portage.raccourcis) {
    if (!emplacement.contenu) continue;
    const verdict = Eq.peutMettreEnRapide(emplacement.type, emplacement.contenu.objetId);
    if (!verdict.ok) {
      expulses.push(emplacement.contenu);
      emplacement.contenu = null;
    }
  }

  // Ce qui peut être rangé dans le sac y retourne ; le reste remonte.
  const restants = [];
  for (const instance of expulses) {
    if (!Inv.ranger(portage.sac, instance)) restants.push(instance);
  }
  return restants;
}

/* ------------------------------------------------------------------ */
/* Recherche                                                           */
/* ------------------------------------------------------------------ */

/** Où se trouve une instance ? */
export function localiser(portage, uid) {
  const dansLeSac = Inv.trouver(portage.sac, uid);
  if (dansLeSac) return { zone: 'sac', slot: dansLeSac };

  for (const emplacement of Eq.EMPLACEMENTS) {
    const instance = portage.equipement[emplacement.id];
    if (instance?.uid === uid) return { zone: 'equipement', emplacementId: emplacement.id, instance };
  }

  for (let i = 0; i < portage.raccourcis.length; i++) {
    if (portage.raccourcis[i].contenu?.uid === uid) {
      return { zone: 'raccourci', index: i, instance: portage.raccourcis[i].contenu };
    }
  }
  return null;
}

/** Retire une instance d'où qu'elle soit. */
export function extraire(portage, uid) {
  const position = localiser(portage, uid);
  if (!position) return null;

  if (position.zone === 'sac') return Inv.retirer(portage.sac, uid);
  if (position.zone === 'equipement') {
    portage.equipement[position.emplacementId] = null;
    return position.instance;
  }
  portage.raccourcis[position.index].contenu = null;
  return position.instance;
}

/* ------------------------------------------------------------------ */
/* Déplacements                                                        */
/* ------------------------------------------------------------------ */

/**
 * Équipe un objet à un emplacement. L'objet déjà en place retourne au sac.
 * @returns {{ok:boolean, raison?:string, expulses?:Array}}
 */
export function equiper(portage, uid, emplacementId) {
  const position = localiser(portage, uid);
  if (!position) return { ok: false, raison: 'Objet introuvable.' };

  const instance = position.instance ?? position.slot;
  const verdict = Eq.peutEquiper(portage.equipement, instance.objetId, emplacementId);
  if (!verdict.ok) return verdict;

  extraire(portage, uid);
  const precedent = portage.equipement[emplacementId];
  portage.equipement[emplacementId] = { ...instance };
  if ('x' in portage.equipement[emplacementId]) {
    delete portage.equipement[emplacementId].x;
    delete portage.equipement[emplacementId].y;
    delete portage.equipement[emplacementId].pivote;
  }

  const expulses = resynchroniser(portage);

  if (precedent && !Inv.ranger(portage.sac, precedent)) {
    expulses.push(precedent);
  }

  return { ok: true, expulses };
}

/** Déséquipe vers le sac. Échoue si le sac est plein. */
export function desequiper(portage, emplacementId) {
  const instance = portage.equipement[emplacementId];
  if (!instance) return { ok: false, raison: 'Emplacement vide.' };

  portage.equipement[emplacementId] = null;
  const expulses = resynchroniser(portage);

  if (!Inv.ranger(portage.sac, instance)) {
    portage.equipement[emplacementId] = instance;
    resynchroniser(portage);
    return { ok: false, raison: 'Le sac est plein.' };
  }

  return { ok: true, expulses };
}

/** Place un objet dans un emplacement rapide de ceinture. */
export function mettreEnRapide(portage, uid, index) {
  const emplacement = portage.raccourcis[index];
  if (!emplacement) return { ok: false, raison: 'Emplacement rapide inexistant.' };

  const position = localiser(portage, uid);
  if (!position) return { ok: false, raison: 'Objet introuvable.' };

  const instance = position.instance ?? position.slot;
  const verdict = Eq.peutMettreEnRapide(emplacement.type, instance.objetId);
  if (!verdict.ok) return verdict;

  extraire(portage, uid);
  const precedent = emplacement.contenu;
  const propre = { ...instance };
  delete propre.x;
  delete propre.y;
  delete propre.pivote;
  emplacement.contenu = propre;

  const expulses = [];
  if (precedent && !Inv.ranger(portage.sac, precedent)) expulses.push(precedent);
  return { ok: true, expulses };
}

/** Renvoie un objet d'un emplacement rapide vers le sac. */
export function retirerDuRapide(portage, index) {
  const emplacement = portage.raccourcis[index];
  if (!emplacement?.contenu) return { ok: false, raison: 'Emplacement vide.' };
  if (!Inv.ranger(portage.sac, emplacement.contenu)) {
    return { ok: false, raison: 'Le sac est plein.' };
  }
  emplacement.contenu = null;
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Ce qui agit                                                         */
/* ------------------------------------------------------------------ */

/**
 * Objets utilisables : ceux équipés et ceux en emplacement rapide.
 * Le contenu du sac n'est jamais utilisable.
 */
export function objetsActifs(portage) {
  const actifs = [];

  for (const emplacement of Eq.EMPLACEMENTS) {
    const instance = portage.equipement[emplacement.id];
    if (instance) actifs.push({ instance, zone: 'equipement', emplacementId: emplacement.id });
  }
  portage.raccourcis.forEach((e, index) => {
    if (e.contenu) actifs.push({ instance: e.contenu, zone: 'raccourci', index });
  });

  return actifs;
}

/** Objets utilisables maintenant, action disponible et non brisés. */
export function actionsDisponibles(portage) {
  return objetsActifs(portage).filter(({ instance, zone, emplacementId }) => {
    const def = objet(instance.objetId);
    if (!def.action || instance.brise) return false;
    // Un bouclier ne se bloque qu'en main, pas depuis le dos.
    if (def.action.exigeEnMain && !(zone === 'equipement' && Eq.MAINS.includes(emplacementId))) {
      return false;
    }
    return true;
  });
}

export function armesEquipees(portage) {
  return Eq.MAINS
    .map((id) => portage.equipement[id])
    .filter((i) => i && !i.brise && objet(i.objetId).action?.type === 'attaque');
}

/** Somme d'un passif sur les objets équipés. */
export function passif(portage, champ) {
  return Eq.passifCumule(portage.equipement, champ);
}

/** Toutes les instances portées, quelle que soit la zone. */
export function toutesLesInstances(portage) {
  return [
    ...portage.sac.contenu,
    ...Eq.objetsEquipes(portage.equipement),
    ...portage.raccourcis.map((e) => e.contenu).filter(Boolean),
  ];
}
