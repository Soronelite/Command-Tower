/**
 * personnage.js — Données de création de personnage.
 *
 * Les races n'ont aucun effet mécanique : aucune n'a été définie.
 * Une seule classe est disponible pour le test.
 */

export const RARETES = [
  { id: 'frequent', nom: 'Fréquent', rang: 1, couleur: '#9b93b0' },
  { id: 'commun', nom: 'Commun', rang: 2, couleur: '#ece6da' },
  { id: 'peu_commun', nom: 'Peu commun', rang: 3, couleur: '#82b57c' },
  { id: 'rare', nom: 'Rare', rang: 4, couleur: '#5f97c9' },
  { id: 'legendaire', nom: 'Légendaire', rang: 5, couleur: '#d8a44a' },
  { id: 'mythique', nom: 'Mythique', rang: 6, couleur: '#c9695f' },
];

export const RARETE_PAR_ID = Object.fromEntries(RARETES.map((r) => [r.id, r]));

/** Toutes les raretés jusqu'à un plafond inclus. */
export function raretesJusqua(plafondId) {
  const plafond = RARETE_PAR_ID[plafondId];
  if (!plafond) throw new Error(`Rareté inconnue : ${plafondId}`);
  return RARETES.filter((r) => r.rang <= plafond.rang).map((r) => r.id);
}

/* ------------------------------------------------------------------ */

export const RACES = [
  { id: 'humain', nom: 'Humain', icone: '🧑' },
  { id: 'elfe', nom: 'Elfe', icone: '🧝' },
  { id: 'nain', nom: 'Nain', icone: '🧔' },
  { id: 'orc', nom: 'Orc', icone: '👹' },
];

export const SEXES = [
  { id: 'homme', nom: 'Homme' },
  { id: 'femme', nom: 'Femme' },
];

export const CLASSES = [
  {
    id: 'chevalier',
    nom: 'Chevalier',
    icone: '🛡️',
    description: 'Seule classe disponible pour ce test.',
    /**
     * L'ordre compte : le sac à dos en premier, sinon la grille reste en 2×2
     * et le reste de la tenue ne rentre pas.
     */
    equipementDeDepart: [
      { objetId: 'sac_a_dos', emplacement: 'dos' },
      { objetId: 'ceinture_corde', emplacement: 'ceinture' },
      { objetId: 'epee_courte', emplacement: 'mainDroite' },
      { objetId: 'bouclier_bois', emplacement: 'mainGauche' },
      { objetId: 'pain_rassis', rapide: 0 },
    ],
    objetsDeDepart: [],
  },
];

export const CLASSE_PAR_ID = Object.fromEntries(CLASSES.map((c) => [c.id, c]));
