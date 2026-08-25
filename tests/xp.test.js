/**
 * xp.test.js — Expérience, niveaux, points de compétence, endurance, effets.
 */

import { suite, expect } from './harness.js';
import { createRng, createScriptedRng } from '../src/core/rng.js';
import { SEUILS, NIVEAU_MAX, XP_PROGRESSION, pointsCompetencePour, xpDUnEnnemi } from '../src/rules/xp.js';
import { creerProgression, gagnerXp, avancement, xpPourEnnemi } from '../src/systems/progression.js';
import { actionsParTour, statsParDefaut, STAT_MAX } from '../src/rules/stats.js';
import { creerPersonnage, actionsDisponibles, armureTotale, pvMaxTotal } from '../src/systems/personnage.js';
import * as Inv from '../src/systems/inventaire.js';
import * as Portage from '../src/systems/portage.js';
import * as Effets from '../src/systems/effets.js';
import * as Run from '../src/systems/run.js';
import { rangDe, varianteDe, ENNEMI_PAR_ID } from '../src/data/monde.js';
import { ciblesDisponibles, toutesLesCibles } from '../src/systems/competences.js';
import { roll } from '../src/core/dice.js';

const perso = (stats = {}) =>
  creerPersonnage({ nom: 'T', race: 'humain', sexe: 'homme', classe: 'chevalier',
    stats: { ...statsParDefaut(), ...stats } });

/* ------------------------------------------------------------------ */

suite('Courbe d’expérience', ({ test }) => {
  test('les seuils cumulés sont ceux de la table', () => {
    expect(SEUILS.slice(1)).toEqual([0, 10, 24, 43, 69, 104, 151, 214, 299, 414]);
  });

  test('le niveau maximum est 10', () => {
    expect(NIVEAU_MAX).toBe(10);
  });

  test('10 XP font passer au niveau 2', () => {
    const p = creerProgression();
    gagnerXp(p, 10);
    expect(p.niveau).toBe(2);
  });

  test('9 XP ne suffisent pas', () => {
    const p = creerProgression();
    gagnerXp(p, 9);
    expect(p.niveau).toBe(1);
  });

  test('un gros gain franchit plusieurs niveaux d’un coup', () => {
    const p = creerProgression();
    const r = gagnerXp(p, 43);
    expect(p.niveau).toBe(4);
    expect(r.niveauxGagnes.length).toBe(3);
  });

  test('le niveau ne dépasse jamais 10', () => {
    const p = creerProgression();
    gagnerXp(p, 100000);
    expect(p.niveau).toBe(10);
  });

  test('l’XP reçue au niveau 10 est enregistrée sans effet', () => {
    const p = creerProgression();
    gagnerXp(p, 414);
    const xpAvant = p.xp;
    gagnerXp(p, 50);
    expect(p.niveau).toBe(10);
    expect(p.xp).toBe(xpAvant);
    expect(p.xpExcedentaire).toBe(50);
  });

  test('l’avancement dans le niveau suit l’exemple du document', () => {
    const p = creerProgression();
    gagnerXp(p, 42); // niveau 3, 18 XP au-delà du seuil de 24
    expect(p.niveau).toBe(3);
    expect(avancement(p)).toEqual({ actuel: 18, requis: 19, complet: false });
  });

  test('au niveau 10 l’avancement est complet', () => {
    const p = creerProgression();
    gagnerXp(p, 414);
    expect(avancement(p).complet).toBe(true);
  });
});

/* ------------------------------------------------------------------ */

suite('Points de compétence', ({ test }) => {
  test('les niveaux 2 à 4 donnent 1 point', () => {
    expect([2, 3, 4].map(pointsCompetencePour)).toEqual([1, 1, 1]);
  });

  test('les niveaux 5 à 10 donnent 2 points', () => {
    expect([5, 6, 7, 8, 9, 10].map(pointsCompetencePour)).toEqual([2, 2, 2, 2, 2, 2]);
  });

  test('atteindre le niveau 10 donne 15 points au total', () => {
    const p = creerProgression();
    gagnerXp(p, 414);
    expect(p.pointsDisponibles).toBe(15);
  });

  test('les cibles proposées sont les statistiques existantes', () => {
    expect(toutesLesCibles().length).toBe(8);
  });

  test('une statistique au maximum n’est plus proposée', () => {
    const p = perso({ sante: STAT_MAX });
    expect(ciblesDisponibles(p).some((c) => c.id === 'stat:sante')).toBe(false);
  });
});

/* ------------------------------------------------------------------ */

suite('XP des ennemis', ({ test }) => {
  test('une variante supérieure vaut le rang au-dessus', () => {
    expect(xpDUnEnnemi(1, 1)).toBe(5);
    expect(xpDUnEnnemi(1, 2)).toBe(8);
    expect(xpDUnEnnemi(1, 3)).toBe(12);
    expect(xpDUnEnnemi(3, 3)).toBe(24);
  });

  test('un rang 10 en variante 3 reste défini', () => {
    expect(xpDUnEnnemi(10, 3)).toBe(237);
  });

  test('la table suit le document', () => {
    expect([1, 2, 3, 4, 5].map((rang) => xpDUnEnnemi(rang))).toEqual([5, 8, 12, 17, 24]);
  });

  test('le garde est au rang 3 et vaut 12 XP', () => {
    expect(rangDe(ENNEMI_PAR_ID.garde)).toBe(3);
    expect(xpPourEnnemi(rangDe(ENNEMI_PAR_ID.garde))).toBe(12);
  });

  test('un ennemi sans niveau ne donne aucune XP', () => {
    expect(xpPourEnnemi(null)).toBe(0);
  });
});

/* ------------------------------------------------------------------ */

suite('Endurance', ({ test }) => {
  test('une endurance à 0 donne 1 action', () => {
    expect(actionsParTour({ endurance: 0 })).toBe(1);
  });

  test('l’endurance par défaut de 2 donne 1 action', () => {
    expect(actionsParTour(statsParDefaut())).toBe(1);
  });

  test('une endurance à 3 donne 2 actions, à 6 en donne 3', () => {
    expect(actionsParTour({ endurance: 3 })).toBe(2);
    expect(actionsParTour({ endurance: 6 })).toBe(3);
  });

  test('les statistiques montent jusqu’à 12', () => {
    expect(STAT_MAX).toBe(12);
    expect(actionsParTour({ endurance: 12 })).toBe(5);
  });

  test('une potion d’endurance ajoute une action', () => {
    const p = perso();
    const effets = Effets.creerListeEffets();
    expect(actionsDisponibles(p, effets)).toBe(1);
    Effets.appliquer(effets, { id: 'e', label: 'E', actions: 1, dureeTours: 'prochainTour' });
    expect(actionsDisponibles(p, effets)).toBe(2);
  });
});

/* ------------------------------------------------------------------ */

suite('Effets temporaires', ({ test }) => {
  test('un blocage ajoute 4 armure puis expire', () => {
    const p = perso();
    const effets = Effets.creerListeEffets();
    Effets.appliquer(effets, { id: 'blocage', label: 'Blocage', armure: 4, dureeTours: 'prochainTour' });
    const base = armureTotale(p);
    expect(armureTotale(p, effets)).toBe(base + 4);
    Effets.finDeTour(effets);
    expect(armureTotale(p, effets)).toBe(base + 4);
    Effets.finDeTour(effets);
    expect(armureTotale(p, effets)).toBe(base);
  });

  test('un effet en pièces survit aux tours et expire au changement de pièce', () => {
    const effets = Effets.creerListeEffets();
    Effets.appliquer(effets, { id: 'lumiere', label: 'Torche', bonusLoot: true, dureePieces: 1 });
    Effets.finDeTour(effets);
    expect(Effets.lootAmeliore(effets)).toBe(true);
    Effets.changementDePiece(effets);
    expect(Effets.lootAmeliore(effets)).toBe(false);
  });

  test('la potion de force ajoute 2 dégâts aux jets du joueur', () => {
    const portage = Portage.creerPortage();
    const effets = Effets.creerListeEffets();
    Effets.appliquer(effets, { id: 'force', label: 'Force', degats: 2, dureeTours: 'prochainTour' });
    const pipeline = Effets.construirePipeline(portage, effets);
    const jet = roll('2d6', { rng: createScriptedRng([3, 3]), pipeline, tags: ['degats', 'joueur'] });
    expect(jet.total).toBe(8);
  });

  test('la potion de force n’aide pas l’ennemi', () => {
    const portage = Portage.creerPortage();
    const effets = Effets.creerListeEffets();
    Effets.appliquer(effets, { id: 'force', label: 'Force', degats: 2, dureeTours: 'prochainTour' });
    const pipeline = Effets.construirePipeline(portage, effets);
    const jet = roll('2d6', { rng: createScriptedRng([3, 3]), pipeline, tags: ['degats', 'ennemi'] });
    expect(jet.total).toBe(6);
  });

  test('l’amulette de chance ajoute 1 à tous les jets du joueur', () => {
    const portage = Portage.creerPortage();
    Portage.equiper(portage, Inv.ajouter(portage.sac, 'amulette_chance').uid, 'bijou1');
    const pipeline = Effets.construirePipeline(portage, []);
    const jet = roll('2d6', { rng: createScriptedRng([3, 3]), pipeline, tags: ['degats', 'joueur'] });
    expect(jet.total).toBe(7);
  });

  test('une amulette restée dans le sac ne change rien', () => {
    const portage = Portage.creerPortage();
    Inv.ajouter(portage.sac, 'amulette_chance');
    const pipeline = Effets.construirePipeline(portage, []);
    const jet = roll('2d6', { rng: createScriptedRng([3, 3]), pipeline, tags: ['degats', 'joueur'] });
    expect(jet.total).toBe(6);
  });

  test('l’anneau de vigueur augmente les PV maximum', () => {
    const p = perso();
    expect(pvMaxTotal(p)).toBe(10);
    Portage.equiper(p.portage, Inv.ajouter(p.portage.sac, 'anneau_vigueur').uid, 'bijou1');
    expect(pvMaxTotal(p)).toBe(12);
  });
});

/* ------------------------------------------------------------------ */

suite('Nouveaux objets', ({ test }) => {
  test('le bouclier en bois occupe un carré de 2 sur 2', () => {
    const inv = Inv.creerInventaire(4, 4);
    Inv.placer(inv, 'bouclier_bois', 0, 0);
    expect(Inv.casesLibres(inv)).toBe(12);
  });

  test('un carré n’est pas pivotable', () => {
    const inv = Inv.creerInventaire(4, 4);
    const slot = Inv.placer(inv, 'armure_mailles', 0, 0);
    expect(Inv.pivoter(inv, slot.uid)).toBe(false);
  });

  test('deux carrés de 2 sur 2 tiennent côte à côte', () => {
    const inv = Inv.creerInventaire(4, 4);
    expect(Inv.ajouter(inv, 'bouclier_bois') !== null).toBe(true);
    expect(Inv.ajouter(inv, 'armure_mailles') !== null).toBe(true);
    expect(Inv.casesLibres(inv)).toBe(8);
  });

  test('les armures équipées cumulent leur passif', () => {
    const portage = Portage.creerPortage();
    Portage.equiper(portage, Inv.ajouter(portage.sac, 'casque_fer').uid, 'tete');
    Portage.equiper(portage, Inv.ajouter(portage.sac, 'cape_protection').uid, 'cape');
    expect(Portage.passif(portage, 'armure')).toBe(2);
  });
});

/* ------------------------------------------------------------------ */

suite('Run complète avec XP', ({ test }) => {
  function jouer(graine) {
    const p = perso();
    const run = Run.creerRun(p, { graine });
    let garde = 0;
    while (run.phase !== Run.PHASES.FIN && garde++ < 500) {
      if (Run.attendUnChoixDeCompetence(run)) {
        Run.attribuerPoint(run, ciblesDisponibles(p)[0].id);
        continue;
      }
      if (run.phase === Run.PHASES.COMBAT) {
        const armes = Run.objetsUtilisables(run).filter((u) => u.def.action.type === 'attaque');
        if (armes.length) Run.utiliserObjet(run, armes[0].slot.uid);
        else Run.utiliserAttaqueDeRepli(run);
        continue;
      }
      const actions = Run.actionsDeRencontre(run);
      const suivante = actions.find((a) => a.type === 'loot')
        ?? actions.find((a) => a.type === 'combat')
        ?? actions.find((a) => a.type === 'avancer');
      if (!suivante) break;
      Run.executerAction(run, suivante.id);
    }
    return { run, p };
  }

  test('une run se termine sans erreur', () => {
    const { run } = jouer('run-xp');
    expect(run.phase).toBe(Run.PHASES.FIN);
  });

  test('tuer un ennemi donne son XP', () => {
    // Le donjon est procédural : on cherche une graine dont la première pièce
    // contient un ennemi, plutôt que de supposer sa présence.
    let run = null;
    for (let i = 0; i < 60 && !run; i++) {
      const candidat = Run.creerRun(perso(), { graine: `combat-xp-${i}` });
      if (candidat.piece.ennemi) run = candidat;
    }
    expect(Boolean(run)).toBe(true);

    const avant = run.personnage.progression.xp;
    Run.executerAction(run, 'attaquer');
    for (let i = 0; i < 60 && run.phase === Run.PHASES.COMBAT; i++) {
      const arme = Run.objetsUtilisables(run).find((u) => u.def.action.type === 'attaque');
      if (!arme) break;
      Run.utiliserObjet(run, arme.slot.uid);
    }

    if (run.combat?.vainqueur === 'joueur') {
      expect(run.personnage.progression.xp > avant).toBe(true);
      expect(run.journal.some((e) => e.type === 'xp')).toBe(true);
    }
  });

  test('chaque passage de pièce n’est récompensé qu’une fois', () => {
    const { run } = jouer('run-xp');
    const gains = run.journal.filter((e) => e.texte.includes('progression'));
    expect(gains.length).toBe(run.transitionsRecompensees.size);
  });

  test('l’XP de progression vaut 2', () => {
    expect(XP_PROGRESSION).toBe(2);
  });

  test('chaque entrée de journal porte sa pièce', () => {
    const { run } = jouer('run-xp');
    expect(run.journal.every((e) => typeof e.piece === 'string' && e.piece.includes(':'))).toBe(true);
  });

  test('les points de compétence gagnés sont tous dépensés', () => {
    const { p } = jouer('run-xp');
    expect(p.progression.pointsDisponibles).toBe(0);
  });
});
