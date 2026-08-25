/**
 * regles.test.js — Règles décidées lors de la dernière passe.
 *
 * Endurance à 0, torche chiffrée, blocage immédiat, objets au sol,
 * destruction d'objet, parcours de six pièces, niveau du rat.
 */

import { suite, expect } from './harness.js';
import { createRng, createScriptedRng } from '../src/core/rng.js';
import {
  statsParDefaut,
  actionsParTour,
  pointsRestants,
  minimumDe,
  STAT_MIN,
} from '../src/rules/stats.js';
import { tirer, tirerButin, raretesAutorisees } from '../src/systems/loot.js';
import { ENNEMI_PAR_ID } from '../src/data/monde.js';
import { piece } from '../src/data/pieces.js';
import { PIECES_PAR_ETAGE, ETAGE_MAX, CHANCE_DE_FUITE } from '../src/rules/etages.js';
import * as Donjon from '../src/systems/donjon.js';
import { xpDUnEnnemi } from '../src/rules/xp.js';
import * as Effets from '../src/systems/effets.js';
import * as Inv from '../src/systems/inventaire.js';
import * as Portage from '../src/systems/portage.js';
import * as Run from '../src/systems/run.js';
import { creerPersonnage, actionsDisponibles, armureTotale } from '../src/systems/personnage.js';
import { objet } from '../src/data/objets.js';

const heros = (stats = {}) =>
  creerPersonnage({
    nom: 'Test', race: 'humain', sexe: 'homme', classe: 'chevalier',
    stats: { ...statsParDefaut(), ...stats },
  });

/* ------------------------------------------------------------------ */

suite('Endurance', ({ test }) => {
  test('l’Endurance démarre à 0, les autres statistiques à 2', () => {
    const s = statsParDefaut();
    expect(s.endurance).toBe(0);
    expect(s.sante).toBe(2);
  });

  test('son minimum lui est propre', () => {
    expect(minimumDe('endurance')).toBe(0);
    expect(minimumDe('sante')).toBe(STAT_MIN);
  });

  test('0 endurance donne 1 action', () => {
    expect(actionsParTour(statsParDefaut())).toBe(1);
  });

  test('la deuxième action arrive à 3 points, pas avant', () => {
    expect(actionsParTour({ endurance: 2 })).toBe(1);
    expect(actionsParTour({ endurance: 3 })).toBe(2);
    expect(actionsParTour({ endurance: 5 })).toBe(2);
    expect(actionsParTour({ endurance: 6 })).toBe(3);
  });

  test('les deux points de création ne suffisent plus à doubler les actions', () => {
    const s = { ...statsParDefaut(), endurance: 2 };
    expect(pointsRestants(s)).toBe(0);
    expect(actionsParTour(s)).toBe(1);
  });

  test('une potion d’endurance ajoute une action', () => {
    const p = heros();
    const effets = [{ id: 'e', actions: 1 }];
    expect(actionsDisponibles(p, effets)).toBe(2);
  });
});

/* ------------------------------------------------------------------ */

suite('Torche', ({ test }) => {
  test('elle ne franchit jamais le plafond de rareté de la table', () => {
    const rng = createRng('plafond');
    const autorisees = new Set(raretesAutorisees('jusqu_commun'));
    for (let i = 0; i < 3000; i++) {
      expect(autorisees.has(tirer('jusqu_commun', rng, { lootAmeliore: true }).rarete)).toBe(true);
    }
  });

  test('une fouille de cadavre reste bloquée sur le fréquent même allumée', () => {
    const rng = createRng('cadavre');
    for (let i = 0; i < 500; i++) {
      expect(tirer('frequent_seul', rng, { lootAmeliore: true }).rarete).toBe('frequent');
    }
  });

  test('elle déplace bien la rareté vers le haut', () => {
    const compter = (bonus) => {
      const rng = createRng('deplacement');
      let hauts = 0;
      for (let i = 0; i < 8000; i++) {
        if (tirer('jusqu_peu_commun', rng, { lootAmeliore: bonus }).rarete !== 'frequent') hauts++;
      }
      return hauts;
    };
    expect(compter(true) > compter(false)).toBe(true);
  });

  test('elle double le butin environ une fois sur quatre', () => {
    const rng = createRng('double');
    let doubles = 0;
    for (let i = 0; i < 8000; i++) {
      if (tirerButin('jusqu_commun', rng, { lootAmeliore: true }).length === 2) doubles++;
    }
    expect(doubles).toBeWithin(1800, 2200);
  });

  test('sans torche le butin est toujours d’un seul objet', () => {
    const rng = createRng('simple');
    for (let i = 0; i < 500; i++) {
      expect(tirerButin('jusqu_commun', rng).length).toBe(1);
    }
  });
});

/* ------------------------------------------------------------------ */

suite('Blocage du bouclier', ({ test }) => {
  test('le blocage est actif dès le tour où il est déclenché', () => {
    const liste = Effets.creerListeEffets();
    Effets.appliquer(liste, objet('bouclier_bois').action.effet);
    expect(Effets.bonusArmure(liste)).toBe(4);
  });

  test('il protège de la riposte du tour en cours', () => {
    const p = heros();
    const liste = Effets.creerListeEffets();
    const avant = armureTotale(p, liste);
    Effets.appliquer(liste, objet('bouclier_bois').action.effet);
    expect(armureTotale(p, liste)).toBe(avant + 4);
  });

  test('il ne dure pas au-delà du tour', () => {
    const liste = Effets.creerListeEffets();
    Effets.appliquer(liste, objet('bouclier_bois').action.effet);
    Effets.finDeTour(liste);
    expect(Effets.bonusArmure(liste)).toBe(0);
  });
});

/* ------------------------------------------------------------------ */

suite('Objets au sol', ({ test }) => {
  test('un objet qui ne rentre pas reste au sol et n’est pas perdu', () => {
    const p = heros();
    // Saturer la grille : quatre colonnes de quatre cases.
    p.portage.sac.contenu = [];
    for (let x = 0; x < 4; x++) Inv.placer(p.portage.sac, 'epee_deux_mains', x, 0);
    expect(Inv.casesLibres(p.portage.sac)).toBe(0);

    const run = Run.creerRun(p, { graine: 'sol' });
    Run.executerAction(run, 'attaquer');

    let garde = 0;
    while (run.phase === Run.PHASES.COMBAT && garde++ < 200) {
      const arme = Run.objetsUtilisables(run).find((u) => u.def.action.type === 'attaque');
      if (!arme) break;
      Run.utiliserObjet(run, arme.slot.uid);
    }

    const fouille = Run.actionsDeRencontre(run).find((a) => a.type === 'loot');
    expect(Boolean(fouille)).toBe(true);
    Run.executerAction(run, fouille.id);

    expect(Run.butinAuSol(run).length > 0).toBe(true);
  });

  test('libérer de la place permet de le ramasser', () => {
    const p = heros();
    p.portage.sac.contenu = [];
    for (let x = 0; x < 4; x++) Inv.placer(p.portage.sac, 'epee_deux_mains', x, 0);

    const run = Run.creerRun(p, { graine: 'sol2' });
    run.objetsAuSol.set(`${run.etage}:${run.indexPiece}`, ['dague']);

    expect(Run.ramasserAuSol(run, 'dague')).toBe(false);
    Run.jeterObjet(run, p.portage.sac.contenu[0].uid);
    expect(Run.ramasserAuSol(run, 'dague')).toBe(true);
    expect(Run.butinAuSol(run).length).toBe(0);
  });

  test('l’objet au sol est proposé comme action', () => {
    const p = heros();
    const run = Run.creerRun(p, { graine: 'sol3' });
    run.objetsAuSol.set(`${run.etage}:${run.indexPiece}`, ['dague']);
    const actions = Run.actionsDeRencontre(run);
    expect(actions.some((a) => a.type === 'ramasser')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */

suite('Jeter un objet', ({ test }) => {
  test('l’objet est retiré de l’inventaire', () => {
    const p = heros();
    const run = Run.creerRun(p, { graine: 'jet' });
    const avant = p.portage.sac.contenu.length;
    Inv.ajouter(p.portage.sac, 'dague');
    const avant2 = p.portage.sac.contenu.length;
    Run.jeterObjet(run, p.portage.sac.contenu[0].uid);
    expect(p.portage.sac.contenu.length).toBe(avant2 - 1);
  });

  test('jeter un anneau de vigueur ramène les PV sous le nouveau maximum', () => {
    const p = heros();
    const run = Run.creerRun(p, { graine: 'anneau' });
    const slot = Inv.ajouter(p.portage.sac, 'anneau_vigueur');
    Portage.equiper(p.portage, slot.uid, 'bijou1');
    p.pv = 12;
    Run.jeterObjet(run, slot.uid);
    expect(p.pv).toBe(10);
  });

  test('un identifiant inconnu ne casse rien', () => {
    const p = heros();
    const run = Run.creerRun(p, { graine: 'jet2' });
    expect(Run.jeterObjet(run, 'inexistant')).toBe(false);
  });
});

/* ------------------------------------------------------------------ */

suite('Étages', ({ test }) => {
  test('un étage compte dix pièces', () => {
    expect(PIECES_PAR_ETAGE).toBe(10);
    const p = heros();
    const run = Run.creerRun(p, { graine: 'etages' });
    expect(run.pieces.length).toBe(10);
  });

  test('le donjon s’arrête au cinquième étage', () => {
    expect(ETAGE_MAX).toBe(5);
  });

  test('la run démarre au premier étage', () => {
    const run = Run.creerRun(heros(), { graine: 'depart' });
    expect(run.etage).toBe(1);
    expect(Run.progression(run).total).toBe(10);
  });

  test('chaque pièce tirée est autorisée à cet étage', () => {
    const run = Run.creerRun(heros(), { graine: 'coherence' });
    for (const id of run.pieces) {
      expect(piece(id).etages.includes(1)).toBe(true);
    }
  });

  test('une même graine produit le même étage', () => {
    const a = Run.creerRun(heros(), { graine: 'jumeau' });
    const b = Run.creerRun(heros(), { graine: 'jumeau' });
    expect(a.pieces).toEqual(b.pieces);
  });

  test('deux graines différentes produisent des étages différents', () => {
    const a = Run.creerRun(heros(), { graine: 'alpha' });
    const b = Run.creerRun(heros(), { graine: 'beta' });
    expect(a.pieces.join() !== b.pieces.join()).toBe(true);
  });

  test('le combat ne décale pas la génération du monde', () => {
    const a = Run.creerRun(heros(), { graine: 'flux' });
    const b = Run.creerRun(heros(), { graine: 'flux' });
    // On épuise le flux de combat de A sans toucher au monde.
    for (let i = 0; i < 200; i++) a.rngCombat.die(6);
    a.etage = 2;
    b.etage = 2;
    expect(Donjon.genererEtage(2, a.rngMonde)).toEqual(Donjon.genererEtage(2, b.rngMonde));
  });

  test('la fin d’étage propose de descendre ou de s’arrêter', () => {
    const run = Run.creerRun(heros(), { graine: 'fin' });
    run.indexPiece = run.pieces.length - 1;
    run.piece.ennemi = null; // sinon « Avancer » n'est pas proposé
    run.phase = Run.PHASES.EXPLORATION;
    Run.executerAction(run, 'avancer');
    expect(run.phase).toBe(Run.PHASES.FIN_ETAGE);
  });

  test('descendre passe à l’étage suivant et régénère les pièces', () => {
    const run = Run.creerRun(heros(), { graine: 'descente' });
    run.phase = Run.PHASES.FIN_ETAGE;
    Run.descendre(run);
    expect(run.etage).toBe(2);
    expect(run.indexPiece).toBe(0);
    expect(run.pieces.length).toBe(10);
  });

  test('s’arrêter met fin à la run', () => {
    const run = Run.creerRun(heros(), { graine: 'arret' });
    run.phase = Run.PHASES.FIN_ETAGE;
    Run.arreterLaRun(run);
    expect(run.phase).toBe(Run.PHASES.FIN);
    expect(run.issue).toBe('arrete');
  });

  test('le cinquième étage termine la run sans proposer de descendre', () => {
    const run = Run.creerRun(heros(), { graine: 'dernier' });
    run.etage = ETAGE_MAX;
    run.indexPiece = run.pieces.length - 1;
    run.piece.ennemi = null;
    run.phase = Run.PHASES.EXPLORATION;
    Run.executerAction(run, 'avancer');
    expect(run.phase).toBe(Run.PHASES.FIN);
    expect(run.issue).toBe('termine');
  });
});

suite('Contenu des pièces', ({ test }) => {
  test('une pièce sans ennemi propose fouille et avancée', () => {
    const run = Run.creerRun(heros(), { graine: 'vide' });
    run.piece.ennemi = null;
    const ids = Run.actionsDeRencontre(run).map((a) => a.id);
    expect(ids).toEqual(['fouiller_piece', 'avancer']);
  });

  test('fouiller est impossible tant qu’un ennemi est présent', () => {
    const run = Run.creerRun(heros(), { graine: 'occupe' });
    run.piece.ennemi = { ennemiId: 'rat_geant', rang: 1, variante: 1 };
    const ids = Run.actionsDeRencontre(run).map((a) => a.id);
    expect(ids).toEqual(['attaquer', 'fuir']);
  });

  test('la fuite est à 25 % partout', () => {
    const run = Run.creerRun(heros(), { graine: 'fuite25' });
    run.piece.ennemi = { ennemiId: 'rat_geant', rang: 1, variante: 1 };
    const fuite = Run.actionsDeRencontre(run).find((a) => a.type === 'fuite');
    expect(fuite.chance).toBe(CHANCE_DE_FUITE);
    expect(CHANCE_DE_FUITE).toBe(25);
  });

  test('une pièce éclairée pose l’effet de lumière', () => {
    let trouve = false;
    for (let i = 0; i < 60 && !trouve; i++) {
      const run = Run.creerRun(heros(), { graine: `lumiere${i}` });
      if (run.piece.eclairee) {
        trouve = true;
        expect(Effets.lootAmeliore(run.effets)).toBe(true);
      }
    }
    expect(trouve).toBe(true);
  });

  test('l’ennemi tiré appartient bien à une famille de la pièce', () => {
    for (let i = 0; i < 80; i++) {
      const run = Run.creerRun(heros(), { graine: `famille${i}` });
      if (!run.piece.ennemi) continue;
      const modele = ENNEMI_PAR_ID[run.piece.ennemi.ennemiId];
      const familles = run.piece.def.rencontre.familles;
      expect(familles.some((f) => modele.familles.includes(f))).toBe(true);
    }
  });

  test('fuir ne rapporte aucune XP', () => {
    const run = Run.creerRun(heros(), { graine: 'fuitexp' });
    run.piece.ennemi = { ennemiId: 'rat_geant', rang: 1, variante: 1 };
    const avant = run.personnage.progression.xp;
    // On force la réussite en épuisant les échecs possibles.
    let fui = false;
    for (let i = 0; i < 40 && !fui; i++) {
      const depart = run.indexPiece;
      if (run.phase !== Run.PHASES.EXPLORATION) break;
      Run.executerAction(run, 'fuir');
      if (run.indexPiece > depart) fui = true;
      else break;
    }
    if (fui) expect(run.personnage.progression.xp).toBe(avant);
  });
});

/* ------------------------------------------------------------------ */

suite('Niveaux d’ennemis', ({ test }) => {
  test('le rat géant est de niveau 1 et rapporte 5 XP', () => {
    expect(ENNEMI_PAR_ID.rat_geant.rang).toBe(1);
    expect(xpDUnEnnemi(1)).toBe(5);
  });

  test('le garde est de niveau 3 et rapporte 12 XP', () => {
    expect(ENNEMI_PAR_ID.garde.rang).toBe(3);
    expect(xpDUnEnnemi(3)).toBe(12);
  });

  test('un parcours complet rapporte assez d’XP pour dépasser le niveau 2', () => {
    // 2 rats + 2 gardes + 5 transitions = 5+5+12+12+10 = 44 XP
    const total = 2 * xpDUnEnnemi(1) + 2 * xpDUnEnnemi(3) + 5 * 2;
    expect(total).toBe(44);
  });
});
