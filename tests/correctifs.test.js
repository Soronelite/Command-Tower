/**
 * correctifs.test.js — Non-régression des correctifs signalés.
 *
 * Chaque test correspond à un problème constaté en jeu.
 */

import { suite, expect } from './harness.js';
import { statsParDefaut, minimumDe, STAT_MIN, pointsRestants } from '../src/rules/stats.js';
import { creerPersonnage } from '../src/systems/personnage.js';
import * as Inv from '../src/systems/inventaire.js';
import * as Eq from '../src/systems/equipement.js';
import * as Portage from '../src/systems/portage.js';
import * as Run from '../src/systems/run.js';
import * as Effets from '../src/systems/effets.js';
import { objet } from '../src/data/objets.js';

const heros = () =>
  creerPersonnage({
    nom: 'Test', race: 'humain', sexe: 'homme', classe: 'chevalier',
    stats: statsParDefaut(),
  });

/** Première run dont la pièce d'entrée contient un ennemi. */
function runAvecEnnemi(prefixe = 'ennemi') {
  for (let i = 0; i < 80; i++) {
    const run = Run.creerRun(heros(), { graine: `${prefixe}-${i}` });
    if (run.piece.ennemi) return run;
  }
  throw new Error('Aucune rencontre trouvée.');
}

/* ------------------------------------------------------------------ */

suite('Correctif — retrait d’un point d’Endurance', ({ test }) => {
  test('chaque statistique expose son propre plancher', () => {
    expect(minimumDe('endurance')).toBe(0);
    expect(minimumDe('sante')).toBe(STAT_MIN);
    expect(minimumDe('charisme')).toBe(STAT_MIN);
  });

  test('un point d’Endurance attribué peut être repris', () => {
    const stats = statsParDefaut();
    stats.endurance += 1;
    expect(pointsRestants(stats)).toBe(1);
    // Le bouton « − » s'active dès que la valeur dépasse le plancher.
    expect(stats.endurance > minimumDe('endurance')).toBe(true);
  });

  test('l’Endurance ne peut pas descendre sous zéro', () => {
    expect(statsParDefaut().endurance > minimumDe('endurance')).toBe(false);
  });

  test('le décompte des points tient compte des planchers distincts', () => {
    const stats = statsParDefaut();
    stats.endurance += 1;
    stats.sante += 1;
    expect(pointsRestants(stats)).toBe(0);
  });
});

/* ------------------------------------------------------------------ */

suite('Correctif — objets utilisables hors combat', ({ test }) => {
  test('une potion trouvée et rangée est utilisable hors combat', () => {
    const p = heros();
    Inv.ajouter(p.portage.sac, 'potion_soin');
    const run = Run.creerRun(p, { graine: 'sac-hors-combat' });
    const noms = Run.objetsUtilisables(run).map((u) => u.def.id);
    expect(noms.includes('potion_soin')).toBe(true);
  });

  test('elle ne l’est plus pendant un combat', () => {
    const run = runAvecEnnemi('sac-combat');
    Inv.ajouter(run.personnage.portage.sac, 'potion_soin');
    Run.executerAction(run, 'attaquer');
    const zones = Run.objetsUtilisables(run).map((u) => u.zone);
    expect(zones.includes('sac')).toBe(false);
  });

  test('utiliser une potion du sac hors combat rend bien des PV', () => {
    const p = heros();
    const slot = Inv.ajouter(p.portage.sac, 'potion_soin');
    const run = Run.creerRun(p, { graine: 'boire-sac' });
    p.pv = 3;
    Run.utiliserObjet(run, slot.uid);
    expect(p.pv).toBe(9);
  });

  test('l’objet consommé disparaît du sac', () => {
    const p = heros();
    const slot = Inv.ajouter(p.portage.sac, 'potion_soin');
    const run = Run.creerRun(p, { graine: 'consomme-sac' });
    p.pv = 3;
    Run.utiliserObjet(run, slot.uid);
    expect(Inv.trouver(p.portage.sac, slot.uid)).toBe(null);
  });
});

/* ------------------------------------------------------------------ */

suite('Correctif — actions masquées en combat', ({ test }) => {
  test('aucune action de rencontre pendant un combat', () => {
    const run = runAvecEnnemi('actions-combat');
    Run.executerAction(run, 'attaquer');
    expect(Run.actionsDeRencontre(run).length).toBe(0);
  });

  test('ni fouille ni avancée ne sont proposées', () => {
    const run = runAvecEnnemi('fouille-combat');
    Run.executerAction(run, 'attaquer');
    const types = Run.actionsDeRencontre(run).map((a) => a.type);
    expect(types.includes('loot')).toBe(false);
    expect(types.includes('avancer')).toBe(false);
  });

  test('elles reviennent une fois le combat terminé', () => {
    const run = runAvecEnnemi('apres-combat');
    Run.executerAction(run, 'attaquer');
    for (let i = 0; i < 80 && run.phase === Run.PHASES.COMBAT; i++) {
      const arme = Run.objetsUtilisables(run).find((u) => u.def.action.type === 'attaque');
      if (!arme) break;
      Run.utiliserObjet(run, arme.slot.uid);
    }
    if (run.phase === Run.PHASES.APRES_COMBAT) {
      expect(Run.actionsDeRencontre(run).length > 0).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------ */

suite('Correctif — parchemin sur la ceinture', ({ test }) => {
  test('le parchemin n’occupe plus qu’une case', () => {
    expect(objet('parchemin_boule_feu').forme).toEqual({ l: 1, h: 1 });
  });

  test('il peut être placé en emplacement rapide', () => {
    const p = heros();
    const uid = Inv.ajouter(p.portage.sac, 'parchemin_boule_feu').uid;
    expect(Portage.mettreEnRapide(p.portage, uid, 1).ok).toBe(true);
  });

  test('mais pas dans un emplacement réservé aux potions', () => {
    const p = Portage.creerPortage();
    p.equipement.ceinture = Eq.instancier('ceinture_apothicaire');
    Portage.resynchroniser(p);
    const uid = Inv.ajouter(p.sac, 'parchemin_boule_feu').uid;
    expect(Portage.mettreEnRapide(p, uid, 3).ok).toBe(false);
  });
});

/* ------------------------------------------------------------------ */

suite('Correctif — transferts entre zones', ({ test }) => {
  test('un casque équipé peut redescendre dans le sac', () => {
    const p = heros();
    Portage.equiper(p.portage, Inv.ajouter(p.portage.sac, 'casque_fer').uid, 'tete');
    expect(p.portage.equipement.tete !== null).toBe(true);

    const uid = p.portage.equipement.tete.uid;
    const r = Portage.desequiper(p.portage, 'tete');
    expect(r.ok).toBe(true);
    expect(p.portage.equipement.tete).toBe(null);
    expect(Inv.trouver(p.portage.sac, uid) !== null).toBe(true);
  });

  test('une potion du sac rejoint la ceinture puis en revient', () => {
    const p = heros();
    const uid = Inv.ajouter(p.portage.sac, 'potion_soin').uid;

    expect(Portage.mettreEnRapide(p.portage, uid, 1).ok).toBe(true);
    expect(Inv.trouver(p.portage.sac, uid)).toBe(null);
    expect(p.portage.raccourcis[1].contenu.uid).toBe(uid);

    expect(Portage.retirerDuRapide(p.portage, 1).ok).toBe(true);
    expect(Inv.trouver(p.portage.sac, uid) !== null).toBe(true);
  });

  test('un objet ne se duplique jamais lors d’un transfert', () => {
    const p = heros();
    const uid = Inv.ajouter(p.portage.sac, 'casque_fer').uid;

    const compter = () =>
      Portage.toutesLesInstances(p.portage).filter((i) => i.uid === uid).length;

    expect(compter()).toBe(1);
    Portage.equiper(p.portage, uid, 'tete');
    expect(compter()).toBe(1);
    Portage.desequiper(p.portage, 'tete');
    expect(compter()).toBe(1);
  });

  test('un transfert refusé laisse l’objet à sa place', () => {
    const p = heros();
    const uid = Inv.ajouter(p.portage.sac, 'casque_fer').uid;
    // La ceinture de corde n'a que des emplacements libres 1×1 : le casque
    // y tiendrait, mais l'emplacement 0 est déjà occupé par le pain.
    const r = Portage.mettreEnRapide(p.portage, uid, 99);
    expect(r.ok).toBe(false);
    expect(Inv.trouver(p.portage.sac, uid) !== null).toBe(true);
  });
});

/* ------------------------------------------------------------------ */

suite('Correctif — pièce éclairée', ({ test }) => {
  test('des pièces éclairées apparaissent bien', () => {
    let eclairees = 0;
    for (let i = 0; i < 200; i++) {
      if (Run.creerRun(heros(), { graine: `ecl-${i}` }).piece.eclairee) eclairees++;
    }
    expect(eclairees > 0).toBe(true);
  });

  test('l’éclairage reste dans une fourchette plausible', () => {
    let eclairees = 0;
    for (let i = 0; i < 400; i++) {
      if (Run.creerRun(heros(), { graine: `taux-${i}` }).piece.eclairee) eclairees++;
    }
    const taux = eclairees / 400;
    expect(taux > 0.1 && taux < 0.5).toBe(true);
  });

  test('une pièce éclairée pose l’effet et améliore le loot', () => {
    for (let i = 0; i < 200; i++) {
      const run = Run.creerRun(heros(), { graine: `effet-${i}` });
      if (!run.piece.eclairee) continue;
      expect(Effets.lootAmeliore(run.effets)).toBe(true);
      expect(Run.resume(run).effets.includes('Torches allumées')).toBe(true);
      return;
    }
    throw new Error('Aucune pièce éclairée rencontrée.');
  });

  test('l’état eclairee est exposé pour l’affichage du statut', () => {
    const run = Run.creerRun(heros(), { graine: 'statut' });
    expect(typeof run.piece.eclairee).toBe('boolean');
  });
});
