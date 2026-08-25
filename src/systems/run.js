/**
 * run.js — Déroulement d'une run.
 *
 * Seul module qui enchaîne les systèmes. Il ne contient aucun texte de
 * rencontre, aucune donnée d'ennemi et aucune valeur d'équilibrage.
 */

import { createRng } from '../core/rng.js';
import { ENNEMI_PAR_ID } from '../data/monde.js';
import * as Donjon from './donjon.js';
import {
  PIECES_PAR_ETAGE,
  ETAGE_DEPART,
  ETAGE_MAX,
  CHANCE_DE_FUITE,
  estDernierEtage,
} from '../rules/etages.js';
import { objet, OBJET_PAR_ID } from '../data/objets.js';
import { RARETE_PAR_ID } from '../data/personnage.js';
import {
  armureTotale,
  initiativeTotale,
  actionsDisponibles,
  pvMaxTotal,
  recaler,
  soigner,
  blesser,
  estMort,
  apresGainDeStatistique,
} from './personnage.js';
import * as Inv from './inventaire.js';
import * as Portage from './portage.js';
import * as Eq from './equipement.js';
import * as Combat from './combat.js';
import * as Effets from './effets.js';
import * as Prog from './progression.js';
import { cible as competence } from './competences.js';
import { tirerButin } from './loot.js';
import { PROVISOIRE } from '../rules/provisoire.js';

export const PHASES = {
  EXPLORATION: 'exploration',
  COMBAT: 'combat',
  APRES_COMBAT: 'apres_combat',
  /** Fin d'étage : continuer plus bas, ou s'arrêter là. */
  FIN_ETAGE: 'fin_etage',
  FIN: 'fin',
};

export function creerRun(personnage, { graine = Date.now() } = {}) {
  const rng = createRng(graine);

  const run = {
    personnage,
    graine,
    /**
     * Deux flux distincts. Le monde ne doit jamais dépendre du nombre de dés
     * lancés en combat, sinon une même graine ne produirait plus le même étage.
     */
    rngMonde: rng.deriver('monde'),
    rngCombat: rng.deriver('combat'),
    effets: Effets.creerListeEffets(),
    etage: ETAGE_DEPART,
    pieces: [],
    indexPiece: 0,
    piece: null,
    phase: PHASES.EXPLORATION,
    combat: null,
    transitionsRecompensees: new Set(),
    /** Objets trouvés mais non ramassés, par clé étage:pièce. */
    objetsAuSol: new Map(),
    journal: [],
    issue: null,
    onChangement: null,
  };

  // `rng` reste exposé pour le combat : tout le code de jets l'utilise.
  Object.defineProperty(run, 'rng', { get: () => run.rngCombat });

  entrerDansLEtage(run);
  return run;
}

/* ------------------------------------------------------------------ */

function noter(run, texte, type = 'recit') {
  run.journal.push({ texte, type, piece: cleDePiece(run), etage: run.etage });
}

const cleDePiece = (run) => `${run.etage}:${run.indexPiece}`;

const prevenir = (run) => run.onChangement?.(run);

export function pieceCourante(run) {
  return run.piece;
}

export function progression(run) {
  return {
    piece: run.indexPiece + 1,
    total: run.pieces.length,
    etage: run.etage,
    etageMax: ETAGE_MAX,
  };
}

/** Pipeline reconstruit à chaque jet, à partir de l'inventaire et des effets. */
const pipelineDe = (run) => Effets.construirePipeline(run.personnage.portage, run.effets);

/* ------------------------------------------------------------------ */
/* Expérience                                                          */
/* ------------------------------------------------------------------ */

function donnerXp(run, montant, raison) {
  if (montant <= 0) return;
  const prog = run.personnage.progression;
  const dejaAuMax = prog.niveau >= Prog.NIVEAU_MAX;
  const resultat = Prog.gagnerXp(prog, montant);

  noter(run, `+${montant} XP — ${raison}`, 'xp');

  if (dejaAuMax) {
    noter(run, 'Niveau maximum atteint : l’XP est enregistrée sans effet.', 'xp');
    return;
  }

  for (const gain of resultat.niveauxGagnes) {
    noter(
      run,
      `NIVEAU SUPÉRIEUR ! Niveau ${gain.niveau} — ${gain.points} point${gain.points > 1 ? 's' : ''} de compétence.`,
      'niveau'
    );
  }

  const avancement = Prog.avancement(prog);
  noter(
    run,
    avancement.complet
      ? `Niveau ${prog.niveau} — maximum atteint`
      : `Niveau ${prog.niveau} — ${avancement.actuel} / ${avancement.requis} XP`,
    'xp'
  );
}

/** Vrai tant que le joueur doit attribuer des points avant de continuer. */
export function attendUnChoixDeCompetence(run) {
  return run.personnage.progression.pointsDisponibles > 0;
}

export function attribuerPoint(run, cibleId) {
  const prog = run.personnage.progression;
  if (prog.pointsDisponibles <= 0) return false;

  const c = competence(cibleId);
  if (c.disponible && !c.disponible(run.personnage)) return false;

  c.appliquer(run.personnage);
  if (cibleId.startsWith('stat:')) {
    apresGainDeStatistique(run.personnage, cibleId.slice(5));
  }
  Prog.depenserPoint(prog);
  noter(run, `Point de compétence attribué : ${c.nom}.`, 'niveau');
  prevenir(run);
  return true;
}

/* ------------------------------------------------------------------ */
/* Pièces                                                              */
/* ------------------------------------------------------------------ */

function entrerDansLEtage(run) {
  run.pieces = Donjon.genererEtage(run.etage, run.rngMonde, PIECES_PAR_ETAGE);
  run.indexPiece = 0;
  noter(run, `ÉTAGE ${run.etage}`, 'etage');
  entrerDansLaPiece(run);
}

function entrerDansLaPiece(run) {
  const pieceId = run.pieces[run.indexPiece];
  if (!pieceId) return finirLEtage(run);

  run.piece = Donjon.resoudrePiece(
    pieceId,
    { etage: run.etage, niveauJoueur: run.personnage.progression.niveau },
    run.rngMonde
  );

  run.phase = PHASES.EXPLORATION;
  run.combat = null;

  const { def, eclairee, ennemi } = run.piece;
  noter(run, `— ${def.nom} —`, 'lieu');
  noter(run, def.description);

  if (eclairee) {
    Effets.appliquer(
      run.effets,
      {
        id: 'lumiere',
        label: 'Torches allumées',
        bonusLoot: { rareteSuperieure: 10, objetDouble: 25 },
        dureePieces: 1,
      },
      'piece'
    );
    noter(run, 'Des torches brûlent encore : la pièce est éclairée.', 'effet');
  }

  if (ennemi) {
    const modele = ENNEMI_PAR_ID[ennemi.ennemiId];
    noter(run, `${modele.nom} se dresse devant toi.`, 'alerte');
  }
}

function finirLEtage(run) {
  if (estDernierEtage(run.etage)) return terminer(run, 'termine');
  run.phase = PHASES.FIN_ETAGE;
  run.combat = null;
  noter(run, `Étage ${run.etage} terminé. Un escalier descend plus bas.`, 'etage');
}

/** Descend d'un étage. */
export function descendre(run) {
  if (run.phase !== PHASES.FIN_ETAGE) return;
  run.etage++;
  entrerDansLEtage(run);
  prevenir(run);
}

/** Arrête la run volontairement, à la fin d'un étage. */
export function arreterLaRun(run) {
  if (run.phase !== PHASES.FIN_ETAGE) return;
  terminer(run, 'arrete');
  prevenir(run);
}

const FINS = {
  mort: (run) => `${run.personnage.nom} s'effondre. La run s'arrête ici.`,
  arrete: (run) => `${run.personnage.nom} remonte à la surface après l'étage ${run.etage}.`,
  termine: () => `Le dernier étage est derrière toi.`,
};

function terminer(run, issue) {
  run.phase = PHASES.FIN;
  run.issue = issue;
  run.combat = null;
  noter(run, FINS[issue](run), issue === 'mort' ? 'alerte' : 'lieu');
}

/* ------------------------------------------------------------------ */
/* Actions de rencontre                                                */
/* ------------------------------------------------------------------ */

export function actionsDeRencontre(run) {
  const etat = run.piece;
  if (!etat) return [];

  // Les objets laissés au sol restent proposés tant qu'on est dans la pièce.
  const auSol = objetsAuSol(run).map((id) => ({
    id: `ramasser:${id}`,
    libelle: `Ramasser ${objet(id).nom}`,
    type: 'ramasser',
    objetId: id,
  }));

  // Pendant un combat, aucune action de rencontre : ni fouille, ni avancée.
  if (run.phase === PHASES.COMBAT) return [];

  const actions = [];
  const ennemiPresent = Boolean(etat.ennemi) && run.phase === PHASES.EXPLORATION;

  if (ennemiPresent) {
    // Fouiller est impossible tant qu'un ennemi occupe la pièce.
    actions.push({ id: 'attaquer', libelle: 'Attaquer', type: 'combat' });
    actions.push({
      id: 'fuir',
      libelle: `Fuir (${CHANCE_DE_FUITE} %)`,
      type: 'fuite',
      chance: CHANCE_DE_FUITE,
    });
    return [...auSol, ...actions];
  }

  if (run.phase === PHASES.APRES_COMBAT && !etat.fouilles.has('cadavre')) {
    actions.push({
      id: 'fouiller_cadavre',
      libelle: 'Fouiller le cadavre',
      type: 'loot',
      table: 'frequent_seul',
      marque: 'cadavre',
    });
  }

  if (!etat.fouilles.has('piece')) {
    actions.push({
      id: 'fouiller_piece',
      libelle: 'Fouiller la pièce',
      type: 'loot',
      table: etat.def.fouille?.table ?? 'jusqu_commun',
      marque: 'piece',
    });
  }

  actions.push({ id: 'avancer', libelle: 'Avancer', type: 'avancer' });
  return [...auSol, ...actions];
}

export function executerAction(run, actionId) {
  if (attendUnChoixDeCompetence(run)) return;

  const action = actionsDeRencontre(run).find((a) => a.id === actionId);
  if (!action) return;

  switch (action.type) {
    case 'combat': engagerCombat(run, false); break;
    case 'fuite': fuir(run, action); break;
    case 'loot': fouiller(run, action); break;
    case 'ramasser': ramasserAuSol(run, action.objetId); return;
    case 'avancer': avancer(run); break;
    default: noter(run, `Action non implémentée : ${action.type}`, 'alerte');
  }
  prevenir(run);
}

function engagerCombat(run, ennemiImpose = false) {
  const rencontre = run.piece.ennemi;
  const provisoire = Combat.creerCombat(rencontre.ennemiId, {
    variante: rencontre.variante,
  });

  // Une fuite ratée donne l'initiative à l'ennemi, sans jet.
  let ennemiCommence = ennemiImpose;
  if (!ennemiImpose) {
    const jet = Combat.jetDInitiative(
      {
        initiativeJoueur: initiativeTotale(run.personnage),
        initiativeEnnemi: provisoire.ennemi.initiative,
      },
      run.rngCombat
    );
    ennemiCommence = jet.ennemiCommence;
    noter(
      run,
      `Initiative — toi ${jet.detailJoueur} = ${jet.scoreJoueur}, ` +
      `${provisoire.ennemi.nom} ${jet.detailEnnemi} = ${jet.scoreEnnemi}.`,
      'jet'
    );
  }

  run.combat = provisoire;
  run.combat.aQui = ennemiCommence ? 'ennemi' : 'joueur';
  run.phase = PHASES.COMBAT;

  if (ennemiCommence) {
    riposteEnnemi(run);
    if (run.phase === PHASES.COMBAT) ouvrirTourJoueur(run);
  } else {
    noter(run, `Le combat commence contre ${run.combat.ennemi.nom}.`, 'alerte');
    ouvrirTourJoueur(run);
  }
}

function fuir(run, action) {
  const reussi = Combat.tenterFuite(action.chance, run.rngCombat);
  noter(run, `Tentative de fuite (${action.chance} %) : ${reussi ? 'réussie' : 'échouée'}.`, 'jet');

  if (reussi) {
    noter(run, 'Tu quittes la pièce sans demander ton reste.');
    // Fuir ne rapporte aucune XP de progression.
    avancer(run, { xp: false });
  } else {
    noter(run, "L'ennemi te coupe la route et frappe le premier.", 'alerte');
    engagerCombat(run, true);
  }
}

function objetsAuSol(run) {
  return run.objetsAuSol.get(cleDePiece(run)) ?? [];
}

function poserAuSol(run, objetDef) {
  const liste = run.objetsAuSol.get(cleDePiece(run)) ?? [];
  liste.push(objetDef.id);
  run.objetsAuSol.set(cleDePiece(run), liste);
}

/** Tente de ranger un objet. Sinon il reste au sol, récupérable plus tard. */
function recupererOuLaisser(run, objetDef) {
  const rarete = RARETE_PAR_ID[objetDef.rarete].nom;
  const slot = Inv.ajouter(run.personnage.portage.sac, objetDef.id);

  if (slot) {
    noter(run, `Tu trouves : ${objetDef.nom} (${rarete}).`, 'butin');
    return true;
  }

  poserAuSol(run, objetDef);
  noter(
    run,
    `${objetDef.nom} (${rarete}) ne rentre pas dans ton inventaire. L'objet reste au sol.`,
    'alerte'
  );
  return false;
}

function fouiller(run, action) {
  run.piece.fouilles.add(action.marque);

  const ameliore = Effets.lootAmeliore(run.effets);
  const butin = tirerButin(action.table, run.rng, { lootAmeliore: ameliore });

  if (butin.length === 0) {
    noter(run, 'La fouille ne donne rien.');
    return;
  }

  if (butin.length > 1) {
    noter(run, 'La lumière de la torche révèle un second objet.', 'butin');
  }

  for (const objetDef of butin) recupererOuLaisser(run, objetDef);
}

/** Ramasse un objet laissé au sol dans la pièce courante. */
export function ramasserAuSol(run, objetId) {
  const liste = run.objetsAuSol.get(cleDePiece(run)) ?? [];
  const index = liste.indexOf(objetId);
  if (index === -1) return false;

  const objetDef = objet(objetId);
  const slot = Inv.ajouter(run.personnage.portage.sac, objetId);
  if (!slot) {
    noter(run, `${objetDef.nom} ne rentre toujours pas.`, 'alerte');
    prevenir(run);
    return false;
  }

  liste.splice(index, 1);
  if (liste.length === 0) run.objetsAuSol.delete(cleDePiece(run));
  noter(run, `Tu ramasses ${objetDef.nom}.`, 'butin');
  prevenir(run);
  return true;
}

/** Objets au sol de la pièce courante, sous forme de définitions. */
export function butinAuSol(run) {
  return objetsAuSol(run).map((id) => objet(id));
}

/** Jette un objet, où qu'il soit porté. L'objet est détruit. */
export function jeterObjet(run, uid) {
  const portage = run.personnage.portage;
  const position = Portage.localiser(portage, uid);
  if (!position) return false;

  const instance = position.instance ?? position.slot;
  const objetDef = objet(instance.objetId);

  Portage.extraire(portage, uid);
  for (const reste of Portage.resynchroniser(portage)) {
    noter(run, `${objet(reste.objetId).nom} ne rentre plus et tombe au sol.`, 'alerte');
    poserAuSol(run, objet(reste.objetId));
  }
  recaler(run.personnage);

  noter(run, `${objetDef.nom} est jeté.`, 'alerte');
  prevenir(run);
  return true;
}

/* ------------------------------------------------------------------ */
/* Usure                                                               */
/* ------------------------------------------------------------------ */

/**
 * Consomme une utilisation après un usage.
 * Un consommable disparaît à zéro ; une arme se brise et reste dans l'état
 * « brisée », ses passifs conservés (voir provisoire.js).
 */
function appliquerUsure(run, instance, def) {
  if (!def.usure) return;

  const etat = Eq.user(instance);
  if (etat.detruit) {
    Portage.extraire(run.personnage.portage, instance.uid);
    Portage.resynchroniser(run.personnage.portage);
    recaler(run.personnage);
    return;
  }
  if (etat.brise) {
    noter(run, `${def.nom} se brise.`, 'alerte');
    recaler(run.personnage);
    return;
  }

  const restant = instance.utilisations;
  if (def.usure.max > 1 && restant <= 5) {
    noter(run, `${def.nom} est très usé (${restant} utilisation${restant > 1 ? 's' : ''}).`, 'alerte');
  }
}

/** Recharge les armes qui se nourrissent des victoires. */
function rechargerSurVictoire(run) {
  for (const instance of Portage.toutesLesInstances(run.personnage.portage)) {
    const gain = Eq.rechargerSurVictoire(instance);
    if (gain > 0) {
      noter(run, `${objet(instance.objetId).nom} se recharge (+${gain}).`, 'effet');
    }
  }
}

function avancer(run, { xp = true } = {}) {
  const suivante = run.indexPiece + 1;
  const cle = `${run.etage}:${suivante}`;

  // XP de progression : une seule fois par passage vers une pièce donnée.
  // Une fuite ne rapporte rien, mais consomme quand même la transition.
  if (!run.transitionsRecompensees.has(cle)) {
    run.transitionsRecompensees.add(cle);
    if (xp) donnerXp(run, Prog.XP_PROGRESSION, 'progression');
  }

  for (const expire of Effets.changementDePiece(run.effets)) {
    noter(run, `${expire.label} se dissipe.`, 'effet');
  }

  run.indexPiece = suivante;
  if (run.indexPiece >= run.pieces.length) finirLEtage(run);
  else entrerDansLaPiece(run);
}

/* ------------------------------------------------------------------ */
/* Tours de combat                                                     */
/* ------------------------------------------------------------------ */

function ouvrirTourJoueur(run) {
  run.combat.aQui = 'joueur';
  run.combat.actionsRestantes = actionsDisponibles(run.personnage, run.effets);
}

export function actionsRestantes(run) {
  return run.phase === PHASES.COMBAT ? run.combat.actionsRestantes : null;
}

export function terminerLeTour(run) {
  if (run.phase !== PHASES.COMBAT || attendUnChoixDeCompetence(run)) return;
  run.combat.actionsRestantes = 0;
  finDeTourJoueur(run);
  prevenir(run);
}

function finDeTourJoueur(run) {
  if (run.phase !== PHASES.COMBAT) return;

  riposteEnnemi(run);
  if (run.phase !== PHASES.COMBAT) return;

  for (const expire of Effets.finDeTour(run.effets)) {
    noter(run, `${expire.label} prend fin.`, 'effet');
  }

  run.combat.tour++;
  ouvrirTourJoueur(run);
}

function consommerAction(run, cout) {
  if (run.phase !== PHASES.COMBAT || cout <= 0) return;
  run.combat.actionsRestantes -= cout;
  if (run.combat.actionsRestantes <= 0) finDeTourJoueur(run);
}

/* ------------------------------------------------------------------ */
/* Objets                                                              */
/* ------------------------------------------------------------------ */

export function objetsUtilisables(run) {
  const enCombat = run.phase === PHASES.COMBAT;

  // En combat, seuls les objets équipés ou en emplacement rapide servent :
  // fouiller son sac au milieu d'un échange n'a pas de sens.
  // Hors combat, le contenu du sac redevient utilisable.
  const portes = [...Portage.actionsDisponibles(run.personnage.portage)];

  if (!enCombat) {
    for (const slot of run.personnage.portage.sac.contenu) {
      const def = objet(slot.objetId);
      if (def.action && !slot.brise) portes.push({ instance: slot, zone: 'sac' });
    }
  }

  return portes
    .map((porte) => ({ slot: porte.instance, def: objet(porte.instance.objetId), zone: porte.zone }))
    .filter(({ def }) => {
      const a = def.action;
      if (a.type === 'attaque' || a.cible === 'ennemi' || a.seulementEnCombat) return enCombat;
      return run.phase !== PHASES.FIN;
    });
}

export function attaqueDeRepli(run) {
  if (run.phase !== PHASES.COMBAT) return null;
  if (Portage.armesEquipees(run.personnage.portage).length > 0) return null;
  return PROVISOIRE.combat.attaqueSansArme;
}

export function utiliserObjet(run, uid) {
  if (attendUnChoixDeCompetence(run)) return;

  const position = Portage.localiser(run.personnage.portage, uid);
  if (!position) return;
  const instance = position.instance ?? position.slot;
  // Le sac n'est accessible qu'en dehors d'un combat.
  if (position.zone === 'sac' && run.phase === PHASES.COMBAT) return;
  if (instance.brise) return;

  const def = objet(instance.objetId);
  const action = def.action;
  if (!action) return;

  const enCombat = run.phase === PHASES.COMBAT;
  if (enCombat && run.combat.actionsRestantes <= 0) return;

  switch (action.type) {
    case 'attaque':
    case 'degats':
      if (!enCombat) return;
      frapper(run, def.nom, action.des);
      break;

    case 'soin': {
      const rendus = soigner(run.personnage, action.pv);
      noter(
        run,
        rendus > 0
          ? `${action.verbe} : ${def.nom} rend ${rendus} PV.`
          : `${def.nom} : tu es déjà au maximum.`,
        'soin'
      );
      break;
    }

    case 'effet': {
      Effets.appliquer(run.effets, action.effet, `objet:${def.id}`);
      noter(run, action.message ?? `${action.verbe} : ${action.effet.label} est actif.`, 'effet');
      break;
    }

    default:
      noter(run, `Effet non implémenté : ${action.type}`, 'alerte');
  }

  appliquerUsure(run, instance, def);

  if (run.phase === PHASES.COMBAT) consommerAction(run, action.cout ?? 1);
  prevenir(run);
}

export function utiliserAttaqueDeRepli(run) {
  const repli = attaqueDeRepli(run);
  if (!repli || attendUnChoixDeCompetence(run)) return;
  frapper(run, repli.nom, repli.des);
  if (run.phase === PHASES.COMBAT) consommerAction(run, 1);
  prevenir(run);
}

function frapper(run, source, des) {
  const r = Combat.frapperEnnemi(run.combat, des, {
    rng: run.rng,
    pipeline: pipelineDe(run),
    personnage: run.personnage,
  });

  const detail = r.absorbe > 0 ? ` (${r.brut} − ${r.absorbe} d'armure)` : '';
  noter(run, `${source} : ${r.jet.describe()}`, 'jet');
  noter(
    run,
    `${r.degats} dégâts${detail}. ${run.combat.ennemi.nom} : ${run.combat.ennemi.pv} PV.`,
    'degats'
  );

  if (r.mort) {
    noter(run, `${run.combat.ennemi.nom} est vaincu.`, 'victoire');
    run.phase = PHASES.APRES_COMBAT;

    const { rang, variante } = run.combat.ennemi;
    if (rang === null || rang === undefined) {
      noter(run, 'Aucun rang défini pour cet ennemi : pas d’XP.', 'alerte');
    } else {
      const etiquette =
        variante > 1
          ? `${run.combat.ennemi.nom} rang ${rang} variante ${variante}`
          : `${run.combat.ennemi.nom} rang ${rang}`;
      donnerXp(run, Prog.xpPourEnnemi(rang, variante), etiquette);
    }

    rechargerSurVictoire(run);
    Effets.finDeCombat(run.effets);
    Effets.finDeCombat(run.combat.effets);
  }
}

function riposteEnnemi(run) {
  const combat = run.combat;

  // Les effets de l'ennemi vieillissent au début de son tour.
  for (const expire of Effets.finDeTour(combat.effets)) {
    noter(run, `${expire.label} de ${combat.ennemi.nom} se dissipe.`, 'effet');
  }

  const etat = Combat.etatDuCombat(combat, run.personnage, pvMaxTotal(run.personnage));
  const attaque = Combat.choisirAttaque(combat, etat, run.rngCombat);

  if (!attaque) return;

  // Une attaque de type effet ou soin REMPLACE l'attaque du tour.
  if (attaque.type === 'effet') {
    Effets.appliquer(combat.effets, attaque.effet, `ennemi:${combat.ennemi.id}`);
    noter(run, `${combat.ennemi.nom} utilise ${attaque.nom}.`, 'effet');
    return;
  }

  if (attaque.type === 'soin') {
    const r = Combat.soinEnnemi(combat, attaque, { rng: run.rngCombat });
    noter(run, `${combat.ennemi.nom} utilise ${attaque.nom} : ${r.jet.describe()}`, 'jet');
    noter(run, `${combat.ennemi.nom} récupère ${r.rendus} PV (${combat.ennemi.pv}/${combat.ennemi.pvMax}).`, 'soin');
    return;
  }

  const r = Combat.attaqueEnnemie(combat, attaque, {
    rng: run.rngCombat,
    pipeline: pipelineDe(run),
    personnage: run.personnage,
    armureJoueur: armureTotale(run.personnage, run.effets),
  });

  const bonus = r.bonus > 0 ? ` +${r.bonus}` : '';
  noter(run, `${combat.ennemi.nom} — ${attaque.nom} : ${r.jet.describe()}${bonus}`, 'jet');

  const detail = r.absorbe > 0 ? ` (${r.brut} − ${r.absorbe} d'armure)` : '';
  const subis = blesser(run.personnage, r.degats);
  noter(
    run,
    subis > 0
      ? `Tu subis ${subis} dégâts${detail}. ${run.personnage.pv} / ${pvMaxTotal(run.personnage)} PV.`
      : `L'attaque ne passe pas ton armure${detail}.`,
    'degats'
  );

  if (estMort(run.personnage)) {
    Combat.marquerDefaite(run.combat);
    terminer(run, 'mort');
  }
}

/* ------------------------------------------------------------------ */

export function resume(run) {
  const prog = run.personnage.progression;
  return {
    nom: run.personnage.nom,
    pv: run.personnage.pv,
    pvMax: pvMaxTotal(run.personnage),
    armure: armureTotale(run.personnage, run.effets),
    niveau: prog.niveau,
    xp: Prog.avancement(prog),
    points: prog.pointsDisponibles,
    actions: actionsRestantes(run),
    actionsMax: actionsDisponibles(run.personnage, run.effets),
    effets: run.effets.map((e) => e.label),
    piece: progression(run),
    phase: run.phase,
    issue: run.issue,
    ennemi: run.combat?.ennemi ?? null,
    graine: run.graine,
  };
}

export { OBJET_PAR_ID, ENNEMI_PAR_ID };
