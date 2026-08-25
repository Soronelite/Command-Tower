
/**
 * monde.js — Ennemis, tables de loot et rencontres.
 *
 * Les rencontres sont des données : le moteur les lit, il ne les connaît pas.
 * Ajouter une quatrième pièce se fait ici, sans toucher au moteur.
 */

/**
 * Bestiaire.
 *
 *   rang       : archétype (1 à 10), il détermine l'XP
 *   variantes  : trois déclinaisons, écrites en dur pour garder la main sur
 *                l'équilibrage plutôt que dérivées d'une formule
 *   etageMini  : premier étage où l'ennemi peut apparaître
 *   attaques   : sélection pondérée, les poids se réajustent selon l'état
 *
 * Une attaque de type `effet` ou `soin` REMPLACE l'attaque du tour : se
 * retrancher coûte son tour.
 */
export const ENNEMIS = [
  {
    id: 'rat_geant',
    nom: 'Rat géant',
    icone: '🐀',
    familles: ['vermine'],
    rang: 1,
    etageMini: 1,
    variantes: [
      { pv: 10, armure: 0, initiative: 6 },
      { pv: 14, armure: 0, initiative: 7 },
      { pv: 18, armure: 1, initiative: 8 },
    ],
    attaques: [
      {
        id: 'griffe', nom: 'Coup de griffe', type: 'degats', des: '2d4', poids: 50,
        ajustements: [{ quand: { pvCibleSous: 0.33 }, poids: 70 }],
      },
      { id: 'morsure', nom: 'Morsure', type: 'degats', des: '1d8', poids: 30 },
      {
        id: 'retranchement', nom: 'Retranchement', type: 'effet', poids: 20,
        effet: { id: 'retranchement', label: 'Retranchement', armure: 6, dureeTours: 1, immediat: true },
        ajustements: [
          { quand: { pvSoiSous: 0.33 }, poids: 60 },
          { quand: { pvCibleSous: 0.33 }, poids: 5 },
        ],
      },
    ],
  },

  {
    id: 'squelette',
    nom: 'Squelette',
    icone: '💀',
    familles: ['mort-vivant'],
    rang: 2,
    etageMini: 2,
    variantes: [
      { pv: 12, armure: 2, initiative: 4 },
      { pv: 16, armure: 3, initiative: 5 },
      { pv: 21, armure: 3, initiative: 5 },
    ],
    attaques: [
      {
        id: 'epee_ebrechee', nom: 'Épée ébréchée', type: 'degats', des: '1d6', poids: 55,
        ajustements: [{ quand: { pvCibleSous: 0.33 }, poids: 70 }],
      },
      { id: 'coup_crane', nom: 'Coup de crâne', type: 'degats', des: '1d4', poids: 25 },
      {
        id: 'reconstituer', nom: 'Se reconstituer', type: 'soin', des: '1d4', poids: 20,
        ajustements: [{ quand: { pvSoiSous: 0.33 }, poids: 55 }],
      },
    ],
  },

  {
    id: 'zombie',
    nom: 'Zombie',
    icone: '🧟',
    familles: ['mort-vivant'],
    rang: 2,
    etageMini: 2,
    variantes: [
      { pv: 20, armure: 0, initiative: 1 },
      { pv: 26, armure: 1, initiative: 1 },
      { pv: 33, armure: 1, initiative: 2 },
    ],
    attaques: [
      { id: 'griffes_putrides', nom: 'Griffes putrides', type: 'degats', des: '1d6', poids: 55 },
      {
        id: 'morsure', nom: 'Morsure', type: 'degats', des: '2d4', poids: 30,
        ajustements: [{ quand: { pvCibleSous: 0.33 }, poids: 60 }],
      },
      {
        id: 'rage_sourde', nom: 'Rage sourde', type: 'effet', poids: 15,
        effet: { id: 'rage_sourde', label: 'Rage sourde', degats: 2, dureeTours: 2, immediat: true },
        ajustements: [{ quand: { pvSoiSous: 0.33 }, poids: 45 }],
      },
    ],
  },

  {
    id: 'garde',
    nom: 'Garde',
    icone: '💂',
    familles: ['garde'],
    rang: 3,
    // Décidé : le garde n'apparaît qu'à partir du deuxième étage.
    etageMini: 2,
    variantes: [
      { pv: 15, armure: 4, initiative: 3 },
      { pv: 20, armure: 5, initiative: 4 },
      { pv: 26, armure: 6, initiative: 5 },
    ],
    attaques: [
      {
        id: 'coup_epee', nom: "Coup d'épée", type: 'degats', des: '2d6', poids: 60,
        ajustements: [{ quand: { pvCibleSous: 0.33 }, poids: 75 }],
      },
      { id: 'coup_bouclier', nom: 'Coup de bouclier', type: 'degats', des: '1d4', poids: 20 },
      {
        id: 'garde_haute', nom: 'Garde haute', type: 'effet', poids: 20,
        effet: { id: 'garde_haute', label: 'Garde haute', armure: 4, dureeTours: 1, immediat: true },
        ajustements: [{ quand: { pvSoiSous: 0.33 }, poids: 50 }],
      },
    ],
  },
];

export const ENNEMI_PAR_ID = Object.fromEntries(ENNEMIS.map((e) => [e.id, e]));

/**
 * Vocabulaire, à ne pas confondre :
 *   niveau   → le personnage joueur (1 à 10)
 *   étage    → palier de donjon (1 à 5)
 *   rang     → archétype d'ennemi (1 à 10), c'est lui qui donne l'XP
 *   variante → déclinaison d'un même ennemi (1 à 3)
 *
 * Un ennemi sans rang déclaré ne rapporte pas d'XP : le champ doit être
 * renseigné dans sa fiche, jamais deviné ici.
 */
export function rangDe(ennemi) {
  return ennemi.rang ?? null;
}

export function varianteDe(ennemi) {
  return ennemi.variante ?? 1;
}

/* ------------------------------------------------------------------ */
/* Tables de loot : une table déclare la rareté maximale autorisée.     */
/* ------------------------------------------------------------------ */

export const TABLES_LOOT = {
  frequent_seul: { nom: 'Fouille de cadavre', raretes: ['frequent'] },
  jusqu_commun: { nom: 'Fouille sommaire', plafond: 'commun' },
  jusqu_peu_commun: { nom: 'Réserve', plafond: 'peu_commun' },
};

/* ------------------------------------------------------------------ */

/**
 * Parcours d'une run : suite d'identifiants de rencontres.
 *
 * Les rencontres sont réutilisables : chacune peut apparaître plusieurs fois.
 * L'état d'une pièce (fouilles déjà faites, objets au sol) est suivi par
 * position dans le parcours, pas par identifiant, donc une répétition repart
 * bien de zéro.
 */
export const PARCOURS = [
  'cave_lugubre',
  'cellier',
  'couloir_garde',
  'cave_lugubre',
  'cellier',
  'couloir_garde',
];

export const RENCONTRES = [
  {
    id: 'cave_lugubre',
    lieu: 'Cave lugubre',
    visuel: 'Cave lugubre',
    description:
      "L'air est froid et humide. Les murs de pierre sont couverts de traces de moisissure et l'obscurité rend difficile de distinguer les recoins de la cave. Une odeur désagréable flotte dans l'air. Un bruit de griffes résonne soudain dans l'obscurité.",
    ennemi: 'rat_geant',
    apparition: 'Un rat géant surgit de l’ombre.',
    actions: [
      { id: 'attaquer', libelle: 'Attaquer', type: 'combat' },
      {
        id: 'fuir',
        libelle: 'Fuir',
        type: 'fuite',
        chance: 50,
        reussite: 'Tu te glisses hors de la cave avant que le rat ne te rattrape.',
        echec: 'Le rat te coupe la route. Il attaque le premier.',
        ennemiCommenceSiEchec: true,
      },
    ],
    apresCombat: [
      {
        id: 'fouiller_cadavre',
        libelle: 'Fouiller le cadavre',
        type: 'loot',
        table: 'frequent_seul',
        uneFois: true,
      },
      {
        id: 'fouiller_piece',
        libelle: 'Fouiller la pièce',
        type: 'loot',
        table: 'jusqu_commun',
        uneFois: true,
      },
      { id: 'avancer', libelle: 'Avancer', type: 'avancer' },
    ],
  },

  {
    id: 'cellier',
    lieu: 'Cellier',
    visuel: 'Ancien cellier',
    description:
      "De vieilles étagères en bois occupent les murs du cellier. Des caisses poussiéreuses sont empilées dans les coins et quelques bocaux oubliés depuis longtemps couvrent les étagères. Malgré l'abandon des lieux, certaines réserves semblent encore intactes.",
    ennemi: null,
    actions: [
      {
        id: 'fouiller_piece',
        libelle: 'Fouiller la pièce',
        type: 'loot',
        table: 'jusqu_peu_commun',
        uneFois: true,
      },
      { id: 'avancer', libelle: 'Avancer', type: 'avancer' },
    ],
  },

  {
    id: 'couloir_garde',
    lieu: 'Couloir de pierre',
    visuel: 'Couloir de pierre',
    description:
      "Le couloir est étroit et faiblement éclairé par quelques torches accrochées aux murs. Au bout du passage, un garde en armure monte la garde. À la vue du joueur, il saisit immédiatement son arme et bloque le passage.",
    ennemi: 'garde',
    apparition: 'Le garde dégaine et bloque le passage.',
    actions: [{ id: 'attaquer', libelle: 'Attaquer', type: 'combat' }],
    apresCombat: [
      {
        id: 'fouiller_cadavre',
        libelle: 'Fouiller le cadavre',
        type: 'loot',
        table: 'frequent_seul',
        uneFois: true,
      },
      {
        id: 'fouiller_piece',
        libelle: 'Fouiller le couloir',
        type: 'loot',
        table: 'jusqu_commun',
        uneFois: true,
      },
      { id: 'avancer', libelle: 'Avancer', type: 'avancer' },
    ],
  },
];

export const RENCONTRE_PAR_ID = Object.fromEntries(RENCONTRES.map((r) => [r.id, r]));

/** Rencontre occupant une position du parcours. */
export function rencontreAuRang(rang) {
  const id = PARCOURS[rang];
  return id ? RENCONTRE_PAR_ID[id] : null;
}

export const LONGUEUR_PARCOURS = PARCOURS.length;

/** Ennemis d'une famille donnée. */
export function ennemisDeFamille(famille, etage = null) {
  return ENNEMIS.filter((e) => {
    if (!(e.familles ?? []).includes(famille)) return false;
    if (etage !== null && (e.etageMini ?? 1) > etage) return false;
    return true;
  });
}

/** Statistiques d'un ennemi pour une variante donnée. */
export function statsDeVariante(ennemi, variante = 1) {
  const index = Math.min(Math.max(1, variante), ennemi.variantes.length) - 1;
  return ennemi.variantes[index];
}

/** Rangs réellement disponibles pour un ensemble de familles. */
export function rangsDisponibles(familles) {
  const set = new Set();
  for (const famille of familles) {
    for (const e of ennemisDeFamille(famille)) set.add(e.rang);
  }
  return [...set].sort((a, b) => a - b);
}
