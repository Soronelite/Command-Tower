/**
 * equipement.js — Ce que le personnage porte.
 *
 * Trois contenants distincts :
 *   - `equipement`  : les emplacements (tête, mains, ceinture, dos, cape, bijoux) ;
 *   - `raccourcis`  : les emplacements rapides ouverts par la ceinture ;
 *   - `sac`         : la grille, dont la taille dépend du sac porté au dos.
 *
 * Règle structurante : seul ce qui est équipé ou en emplacement rapide agit.
 * Le sac est un simple espace de transport.
 */

import { objet, estPotion, tientEnEmplacementRapide } from '../data/objets.js';
import {
  EMPLACEMENTS,
  EMPLACEMENT_PAR_ID,
  MAINS,
  SAC_SANS_SAC,
  PORTS,
} from '../data/emplacements.js';

export { EMPLACEMENTS, MAINS };

/* ------------------------------------------------------------------ */
/* Instances d'objets                                                  */
/* ------------------------------------------------------------------ */

let compteur = 0;

/** Crée une instance d'objet, avec son compteur d'utilisations. */
export function instancier(objetId) {
  const def = objet(objetId);
  return {
    uid: `i${++compteur}`,
    objetId,
    utilisations: def.usure ? def.usure.max : null,
    brise: false,
  };
}

export function reprendreCompteur(valeur) {
  compteur = Math.max(compteur, valeur);
}

export function estBrise(instance) {
  return instance.brise === true;
}

/** Consomme une utilisation. Renvoie l'état après usage. */
export function user(instance, nombre = 1) {
  const def = objet(instance.objetId);
  if (!def.usure) return { use: false, brise: false, detruit: false };

  instance.utilisations = Math.max(0, instance.utilisations - nombre);
  if (instance.utilisations > 0) return { use: true, brise: false, detruit: false };

  if (def.usure.detruitAZero) return { use: true, brise: false, detruit: true };
  instance.brise = true;
  return { use: true, brise: true, detruit: false };
}

/** Répare une instance. Aucune source de réparation n'existe encore en jeu. */
export function reparer(instance, montant = null) {
  const def = objet(instance.objetId);
  if (!def.usure || def.usure.reparable === false) return false;
  instance.utilisations = montant === null
    ? def.usure.max
    : Math.min(def.usure.max, instance.utilisations + montant);
  instance.brise = instance.utilisations <= 0;
  return true;
}

/** Recharge liée à une victoire (Lame des serments rompus). */
export function rechargerSurVictoire(instance) {
  const def = objet(instance.objetId);
  if (!def.rechargeParVictoire || !def.usure) return 0;
  const avant = instance.utilisations;
  instance.utilisations = Math.min(def.usure.max, avant + def.rechargeParVictoire);
  if (instance.utilisations > 0) instance.brise = false;
  return instance.utilisations - avant;
}

/* ------------------------------------------------------------------ */
/* Création                                                            */
/* ------------------------------------------------------------------ */

export function creerEquipement() {
  return Object.fromEntries(EMPLACEMENTS.map((e) => [e.id, null]));
}

/* ------------------------------------------------------------------ */
/* Interrogation                                                       */
/* ------------------------------------------------------------------ */

export function porte(equipement, emplacementId) {
  return equipement[emplacementId] ?? null;
}

/** Toutes les instances équipées, hors sac et hors emplacements rapides. */
export function objetsEquipes(equipement) {
  return EMPLACEMENTS.map((e) => equipement[e.id]).filter(Boolean);
}

/** Taille de la grille du sac, selon le sac porté au dos. */
export function tailleDuSac(equipement) {
  const dos = porte(equipement, 'dos');
  if (!dos) return { ...SAC_SANS_SAC };
  const def = objet(dos.objetId);
  return def.sac ? { ...def.sac } : { ...SAC_SANS_SAC };
}

/** Emplacements rapides ouverts par la ceinture portée. */
export function planDeCeinture(equipement) {
  const ceinture = porte(equipement, 'ceinture');
  if (!ceinture) return [];
  const def = objet(ceinture.objetId);
  const plan = def.ceinture ?? { rapides: 0, rapidesPotion: 0 };
  return [
    ...Array.from({ length: plan.rapides }, () => 'libre'),
    ...Array.from({ length: plan.rapidesPotion ?? 0 }, () => 'potion'),
  ];
}

/** Une arme à deux mains est-elle en train d'occuper les deux mains ? */
export function deuxMainsOccupees(equipement) {
  return MAINS.some((id) => {
    const instance = porte(equipement, id);
    return instance && objet(instance.objetId).mains === 2;
  });
}

/** L'autre main est grisée si une arme à deux mains est portée. */
export function mainGrisee(equipement, emplacementId) {
  if (!MAINS.includes(emplacementId)) return false;
  if (porte(equipement, emplacementId)) return false;
  return deuxMainsOccupees(equipement);
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

/**
 * Peut-on équiper cet objet à cet emplacement ?
 * @returns {{ok:boolean, raison?:string}}
 */
export function peutEquiper(equipement, objetId, emplacementId) {
  const def = objet(objetId);
  const emplacement = EMPLACEMENT_PAR_ID[emplacementId];

  if (!emplacement) return { ok: false, raison: 'Emplacement inconnu.' };
  if (!def.port) return { ok: false, raison: `${def.nom} ne s'équipe pas.` };
  if (!emplacement.accepte.includes(def.port)) {
    return { ok: false, raison: `${def.nom} ne va pas sur « ${emplacement.nom} ».` };
  }

  if (MAINS.includes(emplacementId)) {
    const autre = MAINS.find((id) => id !== emplacementId);

    if (def.mains === 2) {
      if (porte(equipement, emplacementId) || porte(equipement, autre)) {
        return { ok: false, raison: 'Il faut les deux mains libres.' };
      }
    } else if (deuxMainsOccupees(equipement)) {
      return { ok: false, raison: 'Une arme à deux mains occupe déjà les deux mains.' };
    }
  }

  return { ok: true };
}

/** Un objet peut-il aller dans cet emplacement rapide ? */
export function peutMettreEnRapide(type, objetId) {
  const def = objet(objetId);
  if (!tientEnEmplacementRapide(def)) {
    return { ok: false, raison: `${def.nom} ne tient pas en emplacement rapide.` };
  }
  if (type === 'potion' && !estPotion(def)) {
    return { ok: false, raison: 'Cet emplacement n’accepte que des potions.' };
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Passifs                                                             */
/* ------------------------------------------------------------------ */

/**
 * Somme d'un passif sur les objets équipés.
 *
 * Les objets du sac et des emplacements rapides ne comptent pas : c'est la
 * règle « seul ce qui est porté agit ».
 */
export function passifCumule(equipement, champ, { ignorerBrises = false } = {}) {
  return objetsEquipes(equipement).reduce((total, instance) => {
    if (ignorerBrises && estBrise(instance)) return total;
    return total + (objet(instance.objetId).passif?.[champ] ?? 0);
  }, 0);
}

/** Le bouclier est-il tenu en main (blocage possible) plutôt que dans le dos ? */
export function estEnMain(equipement, uid) {
  return MAINS.some((id) => porte(equipement, id)?.uid === uid);
}
