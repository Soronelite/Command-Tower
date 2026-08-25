/**
 * bestiaire.test.js — Variantes, attaques pondérées, effets ennemis, initiative.
 */

import { suite, expect } from './harness.js';
import { createRng, createScriptedRng } from '../src/core/rng.js';
import {
  ENNEMIS, ENNEMI_PAR_ID, ennemisDeFamille, statsDeVariante,
} from '../src/data/monde.js';
import * as Combat from '../src/systems/combat.js';
import * as Effets from '../src/systems/effets.js';
import * as Donjon from '../src/systems/donjon.js';
import { xpDUnEnnemi } from '../src/rules/xp.js';

/* ------------------------------------------------------------------ */

suite('Bestiaire', ({ test }) => {
  test('les quatre ennemis ont trois variantes chacun', () => {
    for (const e of ENNEMIS) expect(e.variantes.length).toBe(3);
  });

  test('les variantes du garde suivent la table proposée', () => {
    const g = ENNEMI_PAR_ID.garde;
    expect(statsDeVariante(g, 1)).toEqual({ pv: 15, armure: 4, initiative: 3 });
    expect(statsDeVariante(g, 3)).toEqual({ pv: 26, armure: 6, initiative: 5 });
  });

  test('la variante 1 du garde reprend les valeurs décidées', () => {
    const v = statsDeVariante(ENNEMI_PAR_ID.garde, 1);
    expect(v.pv).toBe(15);
    expect(v.armure).toBe(4);
  });

  test('chaque ennemi déclare au moins trois attaques', () => {
    for (const e of ENNEMIS) expect(e.attaques.length >= 3).toBe(true);
  });

  test('les poids d’attaque sont tous positifs', () => {
    for (const e of ENNEMIS) {
      for (const a of e.attaques) expect(a.poids > 0).toBe(true);
    }
  });

  test('une variante hors bornes est ramenée dans la plage', () => {
    expect(statsDeVariante(ENNEMI_PAR_ID.rat_geant, 9)).toEqual(
      statsDeVariante(ENNEMI_PAR_ID.rat_geant, 3)
    );
  });
});

/* ------------------------------------------------------------------ */

suite('Étage minimum des ennemis', ({ test }) => {
  test('le garde n’apparaît pas à l’étage 1', () => {
    expect(ennemisDeFamille('garde', 1).length).toBe(0);
  });

  test('le garde apparaît à partir de l’étage 2', () => {
    expect(ennemisDeFamille('garde', 2).map((e) => e.id)).toEqual(['garde']);
  });

  test('les morts-vivants non plus n’apparaissent pas à l’étage 1', () => {
    expect(ennemisDeFamille('mort-vivant', 1).length).toBe(0);
  });

  test('le rat géant reste disponible dès l’étage 1', () => {
    expect(ennemisDeFamille('vermine', 1).map((e) => e.id)).toEqual(['rat_geant']);
  });

  test('aucune rencontre n’est tirée si la famille n’a aucun candidat', () => {
    const rng = createRng('vide');
    const r = Donjon.choisirEnnemi(
      { etage: 1, niveauJoueur: 1, familles: ['garde'] },
      rng
    );
    expect(r).toBe(null);
  });

  test('sur cent étages 1, aucun garde n’apparaît jamais', () => {
    const rng = createRng('sansgarde');
    for (let i = 0; i < 100; i++) {
      const r = Donjon.choisirEnnemi(
        { etage: 1, niveauJoueur: 1, familles: ['vermine', 'mort-vivant', 'garde'] },
        rng
      );
      if (r) expect(r.ennemiId).toBe('rat_geant');
    }
  });
});

/* ------------------------------------------------------------------ */

suite('Choix des attaques', ({ test }) => {
  const combatRat = () => Combat.creerCombat('rat_geant');

  test('un ennemi en pleine forme utilise surtout ses attaques', () => {
    const combat = combatRat();
    const rng = createRng('forme');
    const compte = {};
    for (let i = 0; i < 3000; i++) {
      const a = Combat.choisirAttaque(combat, { partSoi: 1, partCible: 1 }, rng);
      compte[a.id] = (compte[a.id] ?? 0) + 1;
    }
    // 50 / 30 / 20 : le retranchement reste minoritaire.
    expect(compte.retranchement < compte.griffe).toBe(true);
  });

  test('un rat blessé se retranche beaucoup plus souvent', () => {
    const combat = combatRat();
    const rng = createRng('blesse');
    let retranche = 0;
    for (let i = 0; i < 3000; i++) {
      if (Combat.choisirAttaque(combat, { partSoi: 0.2, partCible: 1 }, rng).id === 'retranchement') {
        retranche++;
      }
    }
    expect(retranche / 3000 > 0.35).toBe(true);
  });

  test('face à un joueur mourant, le rat cesse de se retrancher', () => {
    const combat = combatRat();
    const rng = createRng('mourant');
    let retranche = 0;
    for (let i = 0; i < 3000; i++) {
      if (Combat.choisirAttaque(combat, { partSoi: 1, partCible: 0.2 }, rng).id === 'retranchement') {
        retranche++;
      }
    }
    expect(retranche / 3000 < 0.1).toBe(true);
  });

  test('les ajustements changent bien le poids effectif', () => {
    const retranchement = ENNEMI_PAR_ID.rat_geant.attaques.find((a) => a.id === 'retranchement');
    expect(Combat.poidsEffectif(retranchement, { partSoi: 1, partCible: 1 })).toBe(20);
    expect(Combat.poidsEffectif(retranchement, { partSoi: 0.2, partCible: 1 })).toBe(60);
    expect(Combat.poidsEffectif(retranchement, { partSoi: 1, partCible: 0.2 })).toBe(5);
  });

  test('le garde privilégie son épée face à un joueur mourant', () => {
    const epee = ENNEMI_PAR_ID.garde.attaques.find((a) => a.id === 'coup_epee');
    expect(Combat.poidsEffectif(epee, { partSoi: 1, partCible: 0.2 })).toBe(75);
  });
});

/* ------------------------------------------------------------------ */

suite('Effets portés par l’ennemi', ({ test }) => {
  test('le retranchement augmente l’armure de l’ennemi seul', () => {
    const combat = Combat.creerCombat('rat_geant');
    expect(Combat.armureEnnemi(combat)).toBe(0);
    const retranchement = ENNEMI_PAR_ID.rat_geant.attaques.find((a) => a.id === 'retranchement');
    Effets.appliquer(combat.effets, retranchement.effet);
    expect(Combat.armureEnnemi(combat)).toBe(6);
  });

  test('il ne dure qu’un tour', () => {
    const combat = Combat.creerCombat('rat_geant');
    const retranchement = ENNEMI_PAR_ID.rat_geant.attaques.find((a) => a.id === 'retranchement');
    Effets.appliquer(combat.effets, retranchement.effet);
    Effets.finDeTour(combat.effets);
    expect(Combat.armureEnnemi(combat)).toBe(0);
  });

  test('le retranchement absorbe réellement des dégâts', () => {
    const combat = Combat.creerCombat('rat_geant');
    const retranchement = ENNEMI_PAR_ID.rat_geant.attaques.find((a) => a.id === 'retranchement');
    Effets.appliquer(combat.effets, retranchement.effet);
    const r = Combat.frapperEnnemi(combat, '2d6', {
      rng: createScriptedRng([3, 3]), personnage: null,
    });
    expect(r.brut).toBe(6);
    expect(r.degats).toBe(0);
  });

  test('la rage du zombie ajoute ses dégâts à l’attaque', () => {
    const combat = Combat.creerCombat('zombie');
    const rage = ENNEMI_PAR_ID.zombie.attaques.find((a) => a.id === 'rage_sourde');
    Effets.appliquer(combat.effets, rage.effet);
    const attaque = ENNEMI_PAR_ID.zombie.attaques.find((a) => a.id === 'griffes_putrides');
    const r = Combat.attaqueEnnemie(combat, attaque, {
      rng: createScriptedRng([4]), personnage: { pv: 20 }, armureJoueur: 0,
    });
    expect(r.bonus).toBe(2);
    expect(r.brut).toBe(6);
  });

  test('le squelette se soigne sans dépasser son maximum', () => {
    const combat = Combat.creerCombat('squelette');
    combat.ennemi.pv = 2;
    const soin = ENNEMI_PAR_ID.squelette.attaques.find((a) => a.id === 'reconstituer');
    const r = Combat.soinEnnemi(combat, soin, { rng: createScriptedRng([4]) });
    expect(r.rendus).toBe(4);
    expect(combat.ennemi.pv).toBe(6);

    combat.ennemi.pv = 11;
    const r2 = Combat.soinEnnemi(combat, soin, { rng: createScriptedRng([4]) });
    expect(r2.rendus).toBe(1);
    expect(combat.ennemi.pv).toBe(12);
  });
});

/* ------------------------------------------------------------------ */

suite('Initiative', ({ test }) => {
  test('le score le plus élevé commence', () => {
    const jet = Combat.jetDInitiative(
      { initiativeJoueur: 2, initiativeEnnemi: 8 },
      createScriptedRng([5, 5])
    );
    expect(jet.scoreJoueur).toBe(7);
    expect(jet.scoreEnnemi).toBe(13);
    expect(jet.ennemiCommence).toBe(true);
  });

  test('à égalité, le joueur garde la main', () => {
    const jet = Combat.jetDInitiative(
      { initiativeJoueur: 5, initiativeEnnemi: 5 },
      createScriptedRng([5, 5])
    );
    expect(jet.ennemiCommence).toBe(false);
  });

  test('le rat, rapide, ouvre le plus souvent contre un joueur à 2', () => {
    const rng = createRng('init-rat');
    let ennemiCommence = 0;
    for (let i = 0; i < 4000; i++) {
      if (Combat.jetDInitiative({ initiativeJoueur: 2, initiativeEnnemi: 6 }, rng).ennemiCommence) {
        ennemiCommence++;
      }
    }
    expect(ennemiCommence / 4000 > 0.55).toBe(true);
  });

  test('le zombie, lent, ouvre rarement', () => {
    const rng = createRng('init-zombie');
    let ennemiCommence = 0;
    for (let i = 0; i < 4000; i++) {
      if (Combat.jetDInitiative({ initiativeJoueur: 2, initiativeEnnemi: 1 }, rng).ennemiCommence) {
        ennemiCommence++;
      }
    }
    expect(ennemiCommence / 4000 < 0.4).toBe(true);
  });

  test('un point d’initiative améliore réellement les chances', () => {
    const mesurer = (init) => {
      const rng = createRng('init-compare');
      let gagne = 0;
      for (let i = 0; i < 4000; i++) {
        if (!Combat.jetDInitiative({ initiativeJoueur: init, initiativeEnnemi: 5 }, rng).ennemiCommence) {
          gagne++;
        }
      }
      return gagne;
    };
    expect(mesurer(6) > mesurer(2)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */

suite('XP par variante', ({ test }) => {
  test('un garde variante 3 rapporte 24 XP', () => {
    expect(xpDUnEnnemi(3, 3)).toBe(24);
  });

  test('un squelette et un zombie rapportent autant au même rang', () => {
    expect(xpDUnEnnemi(ENNEMI_PAR_ID.squelette.rang, 1))
      .toBe(xpDUnEnnemi(ENNEMI_PAR_ID.zombie.rang, 1));
  });

  test('le combat retient la variante tirée', () => {
    const combat = Combat.creerCombat('garde', { variante: 2 });
    expect(combat.ennemi.variante).toBe(2);
    expect(combat.ennemi.pv).toBe(20);
  });
});
