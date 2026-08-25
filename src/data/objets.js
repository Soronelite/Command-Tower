/**
 * objets.js — Catalogue d'objets.
 *
 * Champs :
 *   port    : nature du portage (voir emplacements.js). Absent = non équipable.
 *   mains   : pour une arme, 1 ou 2 mains.
 *   forme   : { l, h } encombrement dans le sac.
 *   usure   : { max, reparable, detruitAZero } — durabilité.
 *   passif  : effet permanent, actif UNIQUEMENT si l'objet est équipé.
 *   action  : ce que fait l'objet quand on l'utilise.
 *   ceinture: { rapides, rapidesPotion } pour les ceintures.
 *   sac     : { largeur, hauteur } pour les sacs.
 *
 * Ajouter un objet ici suffit : aucun autre fichier n'a besoin de le connaître.
 */

import { PORTS } from './emplacements.js';

export const OBJETS = [
  /* ---------------- armes ---------------- */
  {
    id: 'epee_deux_mains',
    nom: 'Épée à deux mains',
    categorie: 'arme',
    rarete: 'peu_commun',
    icone: '⚔️',
    port: PORTS.ARME,
    mains: 2,
    forme: { l: 1, h: 4 },
    usure: { max: 50, reparable: true },
    action: { type: 'attaque', verbe: 'Attaquer', des: '2d6', cout: 1 },
  },
  {
    id: 'epee_courte',
    nom: 'Épée courte',
    categorie: 'arme',
    rarete: 'commun',
    icone: '🗡️',
    port: PORTS.ARME,
    mains: 1,
    forme: { l: 1, h: 2 },
    usure: { max: 40, reparable: true },
    action: { type: 'attaque', verbe: 'Attaquer', des: '1d6', cout: 1 },
  },
  {
    id: 'dague',
    nom: 'Dague',
    categorie: 'arme',
    rarete: 'frequent',
    icone: '🔪',
    port: PORTS.ARME,
    mains: 1,
    forme: { l: 1, h: 1 },
    usure: { max: 30, reparable: true },
    action: { type: 'attaque', verbe: 'Attaquer', des: '1d4', cout: 1 },
  },
  {
    id: 'lame_serments_rompus',
    nom: 'Lame des serments rompus',
    categorie: 'arme',
    rarete: 'mythique',
    icone: '🌑',
    port: PORTS.ARME,
    mains: 2,
    forme: { l: 1, h: 4 },
    // Irréparable, mais se recharge sur les victoires : une arme qui pousse
    // à enchaîner les combats plutôt qu'à les éviter.
    usure: { max: 25, reparable: false },
    rechargeParVictoire: 5,
    action: { type: 'attaque', verbe: 'Trancher', des: '3d6', cout: 1 },
  },

  /* ---------------- protections ---------------- */
  {
    id: 'casque_fer',
    nom: 'Casque en fer',
    categorie: 'armure',
    rarete: 'frequent',
    icone: '⛑️',
    port: PORTS.CASQUE,
    forme: { l: 1, h: 1 },
    passif: { armure: 1 },
  },
  {
    id: 'armure_mailles',
    nom: 'Armure de mailles',
    categorie: 'armure',
    rarete: 'commun',
    icone: '🥋',
    port: PORTS.ARMURE,
    forme: { l: 2, h: 2 },
    passif: { armure: 3 },
  },
  {
    id: 'bouclier_bois',
    nom: 'Bouclier en bois',
    categorie: 'armure',
    rarete: 'frequent',
    icone: '🛡️',
    port: PORTS.BOUCLIER,
    mains: 1,
    forme: { l: 2, h: 2 },
    passif: { armure: 2 },
    usure: { max: 40, reparable: true },
    // Le blocage n'est possible que bouclier en main, pas dans le dos.
    action: {
      type: 'effet',
      verbe: 'Bloquer',
      cout: 1,
      exigeEnMain: true,
      seulementEnCombat: true,
      effet: { id: 'blocage', label: 'Blocage', armure: 4, dureeTours: 1, immediat: true },
      message: 'Tu lèves ton bouclier.',
    },
  },
  {
    id: 'bouclier_renforce',
    nom: 'Bouclier renforcé',
    categorie: 'armure',
    rarete: 'peu_commun',
    icone: '🛡️',
    port: PORTS.BOUCLIER,
    mains: 1,
    forme: { l: 2, h: 2 },
    passif: { armure: 3 },
    usure: { max: 60, reparable: true },
    action: {
      type: 'effet',
      verbe: 'Bloquer',
      cout: 1,
      exigeEnMain: true,
      seulementEnCombat: true,
      effet: { id: 'blocage', label: 'Blocage', armure: 6, dureeTours: 1, immediat: true },
      message: 'Tu lèves ton bouclier renforcé.',
    },
  },
  {
    id: 'cape_protection',
    nom: 'Cape de protection',
    categorie: 'armure',
    rarete: 'rare',
    icone: '🧣',
    port: PORTS.CAPE,
    forme: { l: 1, h: 2 },
    passif: { armure: 1 },
  },

  /* ---------------- sacs ---------------- */
  {
    id: 'sac_a_dos',
    nom: 'Sac à dos',
    categorie: 'contenant',
    rarete: 'frequent',
    icone: '🎒',
    port: PORTS.SAC,
    forme: { l: 2, h: 2 },
    sac: { largeur: 4, hauteur: 4 },
  },

  /* ---------------- ceintures ---------------- */
  {
    id: 'ceinture_corde',
    nom: 'Ceinture de corde',
    categorie: 'ceinture',
    rarete: 'frequent',
    icone: '🪢',
    port: PORTS.CEINTURE,
    forme: { l: 1, h: 1 },
    ceinture: { rapides: 2, rapidesPotion: 0 },
  },
  {
    id: 'ceinture_cuir',
    nom: 'Ceinture en cuir',
    categorie: 'ceinture',
    rarete: 'commun',
    icone: '🎗️',
    port: PORTS.CEINTURE,
    forme: { l: 1, h: 1 },
    ceinture: { rapides: 3, rapidesPotion: 0 },
  },
  {
    id: 'ceinture_plaque',
    nom: 'Ceinture de plaque',
    categorie: 'ceinture',
    rarete: 'peu_commun',
    icone: '🛡️',
    port: PORTS.CEINTURE,
    forme: { l: 1, h: 1 },
    ceinture: { rapides: 2, rapidesPotion: 0 },
    passif: { armure: 2 },
  },
  {
    id: 'ceinture_apothicaire',
    nom: "Ceinture d'apothicaire",
    categorie: 'ceinture',
    rarete: 'rare',
    icone: '⚗️',
    port: PORTS.CEINTURE,
    forme: { l: 1, h: 1 },
    ceinture: { rapides: 3, rapidesPotion: 2 },
  },

  /* ---------------- bijoux ---------------- */
  {
    id: 'anneau_vigueur',
    nom: 'Anneau de vigueur',
    categorie: 'accessoire',
    rarete: 'rare',
    icone: '💍',
    port: PORTS.BIJOU,
    forme: { l: 1, h: 1 },
    passif: { pvMax: 2 },
  },
  {
    id: 'amulette_chance',
    nom: 'Amulette de chance',
    categorie: 'accessoire',
    rarete: 'rare',
    icone: '🔮',
    port: PORTS.BIJOU,
    forme: { l: 1, h: 1 },
    passif: { bonusJet: 1 },
  },
  {
    id: 'broche_veteran',
    nom: 'Broche du vétéran',
    categorie: 'accessoire',
    rarete: 'rare',
    icone: '🎖️',
    port: PORTS.BIJOU,
    forme: { l: 1, h: 1 },
    passif: { armure: 1, initiative: 1 },
  },

  /* ---------------- consommables ---------------- */
  {
    id: 'pain_rassis',
    nom: 'Pain rassis',
    categorie: 'nourriture',
    rarete: 'frequent',
    icone: '🍞',
    forme: { l: 1, h: 1 },
    usure: { max: 1, detruitAZero: true },
    action: { type: 'soin', verbe: 'Manger', pv: 4, cout: 1 },
  },
  {
    id: 'viande_sechee',
    nom: 'Viande séchée',
    categorie: 'nourriture',
    rarete: 'frequent',
    icone: '🥩',
    forme: { l: 1, h: 1 },
    usure: { max: 1, detruitAZero: true },
    action: { type: 'soin', verbe: 'Manger', pv: 3, cout: 1 },
  },
  {
    id: 'potion_soin',
    nom: 'Potion de soin',
    categorie: 'consommable',
    rarete: 'commun',
    icone: '🧪',
    potion: true,
    forme: { l: 1, h: 1 },
    usure: { max: 1, detruitAZero: true },
    action: { type: 'soin', verbe: 'Boire', pv: 6, cout: 1 },
  },
  {
    id: 'potion_endurance',
    nom: "Potion d'endurance",
    categorie: 'consommable',
    rarete: 'rare',
    icone: '🍶',
    potion: true,
    forme: { l: 1, h: 1 },
    usure: { max: 1, detruitAZero: true },
    action: {
      type: 'effet',
      verbe: 'Boire',
      cout: 1,
      effet: { id: 'endurance_bonus', label: 'Souffle retrouvé', actions: 1, dureeTours: 'prochainTour' },
      message: 'Ton souffle revient.',
    },
  },
  {
    id: 'potion_force',
    nom: 'Potion de force',
    categorie: 'consommable',
    rarete: 'peu_commun',
    icone: '🧉',
    potion: true,
    forme: { l: 1, h: 1 },
    usure: { max: 1, detruitAZero: true },
    action: {
      type: 'effet',
      verbe: 'Boire',
      cout: 1,
      effet: { id: 'force', label: 'Force décuplée', degats: 2, dureeTours: 'prochainTour' },
      message: 'Tes muscles se durcissent.',
    },
  },
  {
    id: 'parchemin_boule_feu',
    nom: 'Parchemin de boule de feu',
    categorie: 'consommable',
    rarete: 'peu_commun',
    icone: '📜',
    forme: { l: 1, h: 1 },
    usure: { max: 1, detruitAZero: true },
    action: { type: 'degats', verbe: 'Lancer', des: '2d6', cout: 1, cible: 'ennemi' },
  },
  {
    id: 'torche',
    nom: 'Torche',
    categorie: 'utilitaire',
    rarete: 'frequent',
    icone: '🔥',
    forme: { l: 1, h: 2 },
    usure: { max: 1, detruitAZero: true },
    action: {
      type: 'effet',
      verbe: 'Allumer',
      cout: 1,
      effet: {
        id: 'lumiere',
        label: 'Torche allumée',
        bonusLoot: { rareteSuperieure: 10, objetDouble: 25 },
        dureePieces: 1,
      },
      message: 'La lumière révèle des recoins jusque-là invisibles.',
    },
  },
];

export const OBJET_PAR_ID = Object.fromEntries(OBJETS.map((o) => [o.id, o]));

export function objet(id) {
  const o = OBJET_PAR_ID[id];
  if (!o) throw new Error(`Objet inconnu : ${id}`);
  return o;
}

/** Un objet est pivotable s'il occupe une ligne ou une colonne de plus d'une case. */
export function estPivotable(objetDef) {
  const { l, h } = objetDef.forme;
  return (l === 1 || h === 1) && l !== h;
}

export function tailleEnCases(objetDef) {
  return objetDef.forme.l * objetDef.forme.h;
}

export function estEquipable(objetDef) {
  return Boolean(objetDef.port);
}

/** Un objet 1×1 peut aller dans un emplacement rapide de ceinture. */
export function tientEnEmplacementRapide(objetDef) {
  return objetDef.forme.l === 1 && objetDef.forme.h === 1 && Boolean(objetDef.action);
}

export function estPotion(objetDef) {
  return objetDef.potion === true;
}
