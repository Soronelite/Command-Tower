/**
 * pieces.js — Catalogue des pièces.
 *
 * Une pièce est vide par défaut. À l'entrée du joueur, deux tirages sont
 * résolus :
 *   1. l'éclairage — des torches déjà allumées reproduisent l'effet de l'objet
 *      torche, mais rendent aussi la pièce plus dangereuse ;
 *   2. la rencontre — un ennemi apparaît ou non.
 *
 * La pièce déclare une FAMILLE d'ennemis, jamais un rang : c'est l'étage qui
 * décide de la puissance. Sinon un cellier cracherait encore des rats au
 * cinquième étage et la difficulté ne monterait jamais.
 *
 * Ajouter une pièce ici suffit : le moteur ne connaît aucune pièce en propre.
 */

export const PIECES = [
  {
    id: 'cave_lugubre',
    nom: 'Cave lugubre',
    visuel: 'Cave lugubre',
    description:
      "L'air est froid et humide. Les murs de pierre sont couverts de traces de moisissure et l'obscurité rend difficile de distinguer les recoins de la cave. Une odeur désagréable flotte dans l'air.",
    etages: [1, 2, 3],
    eclairage: { chance: 15 },
    rencontre: { chance: 35, chanceSiEclairee: 60, familles: ['vermine'] },
    fouille: { table: 'jusqu_commun' },
  },
  {
    id: 'cellier',
    nom: 'Cellier',
    visuel: 'Ancien cellier',
    description:
      'De vieilles étagères en bois occupent les murs du cellier. Des caisses poussiéreuses sont empilées dans les coins et quelques bocaux oubliés depuis longtemps couvrent les étagères. Malgré l’abandon des lieux, certaines réserves semblent encore intactes.',
    etages: [1, 2, 3],
    eclairage: { chance: 25 },
    rencontre: { chance: 25, chanceSiEclairee: 50, familles: ['vermine'] },
    fouille: { table: 'jusqu_peu_commun' },
  },
  {
    id: 'cuisine',
    nom: 'Cuisine abandonnée',
    visuel: 'Cuisine abandonnée',
    description:
      'Un âtre éteint occupe tout un mur. Des ustensiles rouillés pendent encore à leurs crochets et une longue table de bois porte les traces de découpes anciennes. Quelque chose a fouillé les réserves avant toi.',
    etages: [1, 2, 3],
    eclairage: { chance: 30 },
    rencontre: { chance: 30, chanceSiEclairee: 55, familles: ['vermine'] },
    fouille: { table: 'jusqu_peu_commun' },
  },
  {
    id: 'couloir_pierre',
    nom: 'Couloir de pierre',
    visuel: 'Couloir de pierre',
    description:
      'Le couloir est étroit et faiblement éclairé. Les dalles sonnent creux sous les pas et le passage se resserre encore vers le fond.',
    etages: [1, 2, 3, 4, 5],
    eclairage: { chance: 45 },
    rencontre: { chance: 30, chanceSiEclairee: 55, familles: ['garde'] },
    fouille: { table: 'jusqu_commun' },
  },
  {
    id: 'puits',
    nom: 'Puits asséché',
    visuel: 'Puits asséché',
    description:
      "Un puits de pierre s'ouvre au centre de la salle, sec depuis longtemps. Des cordes pourries pendent le long de la margelle et l'écho renvoie des bruits qui ne viennent pas de toi.",
    etages: [1, 2, 3, 4],
    eclairage: { chance: 10 },
    rencontre: { chance: 35, chanceSiEclairee: 60, familles: ['vermine', 'mort-vivant'] },
    fouille: { table: 'jusqu_peu_commun' },
  },
  {
    id: 'geoles',
    nom: 'Geôles',
    visuel: 'Geôles',
    description:
      'Une rangée de cellules aux barreaux tordus longe le mur. Les serrures ont été forcées de l’intérieur. Sur le sol, des chaînes brisées et de la paille noircie.',
    etages: [2, 3, 4, 5],
    eclairage: { chance: 20 },
    rencontre: { chance: 45, chanceSiEclairee: 65, familles: ['mort-vivant', 'garde'] },
    fouille: { table: 'jusqu_commun' },
  },
  {
    id: 'salle_garde',
    nom: 'Salle de garde',
    visuel: 'Salle de garde',
    description:
      'Des bancs renversés, un râtelier vide et les restes d’un repas interrompu. Quelqu’un montait la garde ici, et n’est jamais parti.',
    etages: [2, 3, 4, 5],
    eclairage: { chance: 50 },
    rencontre: { chance: 50, chanceSiEclairee: 70, familles: ['garde'] },
    fouille: { table: 'jusqu_peu_commun' },
  },
  {
    id: 'crypte',
    nom: 'Crypte',
    visuel: 'Crypte',
    description:
      'Des niches funéraires s’enfoncent dans la roche, la plupart descellées. Une poussière fine et sèche recouvre tout, et le silence y a un poids particulier.',
    etages: [2, 3, 4, 5],
    eclairage: { chance: 10 },
    rencontre: { chance: 50, chanceSiEclairee: 70, familles: ['mort-vivant'] },
    fouille: { table: 'jusqu_peu_commun' },
  },
  {
    id: 'armurerie',
    nom: 'Armurerie',
    visuel: 'Armurerie',
    description:
      'Des supports d’armes vides bordent les murs, mais quelques pièces sont restées en place, oubliées ou trop lourdes à emporter. Une odeur de graisse et de métal froid.',
    etages: [3, 4, 5],
    eclairage: { chance: 40 },
    rencontre: { chance: 55, chanceSiEclairee: 70, familles: ['garde'] },
    fouille: { table: 'jusqu_peu_commun' },
  },
  {
    id: 'sanctuaire',
    nom: 'Sanctuaire profané',
    visuel: 'Sanctuaire profané',
    description:
      'L’autel a été renversé et les symboles grattés jusqu’à la pierre. Des cierges consumés forment des flaques de cire durcie, et quelque chose veille encore ici.',
    etages: [3, 4, 5],
    eclairage: { chance: 25 },
    rencontre: { chance: 60, chanceSiEclairee: 75, familles: ['mort-vivant'] },
    fouille: { table: 'jusqu_peu_commun' },
  },
];

export const PIECE_PAR_ID = Object.fromEntries(PIECES.map((p) => [p.id, p]));

export function piece(id) {
  const p = PIECE_PAR_ID[id];
  if (!p) throw new Error(`Pièce inconnue : ${id}`);
  return p;
}

/** Pièces pouvant apparaître à un étage donné. */
export function piecesDeLEtage(etage) {
  return PIECES.filter((p) => p.etages.includes(etage));
}
