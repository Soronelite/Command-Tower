/**
 * core.test.js — Tests du noyau.
 *
 * Ces tests portent uniquement sur des outils techniques. Aucune règle de jeu
 * n'y est supposée : ils vérifient que le moteur fait ce qu'on lui demande,
 * pas qu'une épée fait le bon nombre de dégâts.
 */

import { suite, expect } from './harness.js';
import { createRng, createScriptedRng, normalizeSeed } from '../src/core/rng.js';
import { ModifierPipeline, PHASES } from '../src/core/modifiers.js';
import {
  parseNotation,
  roll,
  rollTotal,
  averageOf,
  rangeOf,
  withExtraDice,
  withFaceShift,
  withFlatBonus,
} from '../src/core/dice.js';
import { Registry } from '../src/core/registry.js';

/* ------------------------------------------------------------------ */

suite('Notation', ({ test }) => {
  test('2d6 donne deux dés à six faces', () => {
    const spec = parseNotation('2d6');
    expect(spec.groups.length).toBe(1);
    expect(spec.groups[0].count).toBe(2);
    expect(spec.groups[0].faces).toBe(6);
    expect(spec.flat).toBe(0);
  });

  test('d20 sous-entend un seul dé', () => {
    expect(parseNotation('d20').groups[0].count).toBe(1);
  });

  test('2d6 + 2 sépare dés et bonus fixe', () => {
    const spec = parseNotation('2d6 + 2');
    expect(spec.groups[0].count).toBe(2);
    expect(spec.flat).toBe(2);
  });

  test('les espaces sont ignorés', () => {
    expect(parseNotation('  1d8   -  1 ').flat).toBe(-1);
  });

  test('plusieurs groupes cohabitent', () => {
    const spec = parseNotation('2d6 + 1d4 + 3');
    expect(spec.groups.length).toBe(2);
    expect(spec.flat).toBe(3);
  });

  test('une constante seule est acceptée', () => {
    const spec = parseNotation(5);
    expect(spec.groups.length).toBe(0);
    expect(spec.flat).toBe(5);
  });

  test('une notation absurde est rejetée', () => {
    expect(() => parseNotation('2x6')).toThrow('invalide');
  });

  test('une notation vide est rejetée', () => {
    expect(() => parseNotation('')).toThrow('vide');
  });

  test('zéro face est rejeté', () => {
    expect(() => parseNotation('2d0')).toThrow('faces');
  });
});

/* ------------------------------------------------------------------ */

suite('Statistiques de notation', ({ test }) => {
  test('la moyenne de 2d6 vaut 7', () => {
    expect(averageOf('2d6')).toBe(7);
  });

  test('la moyenne de 2d6 + 2 vaut 9', () => {
    expect(averageOf('2d6 + 2')).toBe(9);
  });

  test('2d6 va de 2 à 12', () => {
    expect(rangeOf('2d6')).toEqual({ min: 2, max: 12 });
  });

  test('2d6 + 2 va de 4 à 14', () => {
    expect(rangeOf('2d6 + 2')).toEqual({ min: 4, max: 14 });
  });
});

/* ------------------------------------------------------------------ */

suite('Jets de dés', ({ test }) => {
  test('2d6 reste dans ses bornes sur mille jets', () => {
    const rng = createRng('bornes');
    for (let i = 0; i < 1000; i++) {
      expect(rollTotal('2d6', { rng })).toBeWithin(2, 12);
    }
  });

  test('la même graine produit la même suite de jets', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const suiteA = Array.from({ length: 20 }, () => rollTotal('3d8', { rng: a }));
    const suiteB = Array.from({ length: 20 }, () => rollTotal('3d8', { rng: b }));
    expect(suiteA).toEqual(suiteB);
  });

  test('un générateur scripté rend le jet prévisible', () => {
    const rng = createScriptedRng([3, 5]);
    const result = roll('2d6', { rng });
    expect(result.total).toBe(8);
    expect(result.groups[0].dice.map((d) => d.value)).toEqual([3, 5]);
  });

  test('la trace décrit le jet', () => {
    const rng = createScriptedRng([4, 4]);
    expect(roll('2d6 + 2', { rng }).describe()).toBe('2d6 + 2 → 2d6[4, 4] + 2 = 10');
  });

  test('un jet sans modificateur ne produit aucune étape', () => {
    const result = roll('2d6', { rng: createScriptedRng([1, 1]) });
    expect(result.steps.length).toBe(0);
  });
});

/* ------------------------------------------------------------------ */

suite('Modificateurs', ({ test }) => {
  const damage = (extra = {}) => ({
    rng: createScriptedRng([3, 3]),
    tags: ['damage'],
    ...extra,
  });

  test('un bonus fixe s’ajoute au total', () => {
    const pipeline = new ModifierPipeline();
    pipeline.add({
      id: 'perforante',
      label: 'Perforante',
      phase: PHASES.FLAT,
      requires: ['damage'],
      apply: (v) => v + 2,
    });
    expect(roll('2d6', damage({ pipeline })).total).toBe(8);
  });

  test('un modificateur ne s’applique pas si les tags ne correspondent pas', () => {
    const pipeline = new ModifierPipeline();
    pipeline.add({
      id: 'perforante',
      phase: PHASES.FLAT,
      requires: ['damage'],
      apply: (v) => v + 2,
    });
    const result = roll('2d6', {
      rng: createScriptedRng([3, 3]),
      tags: ['soin'],
      pipeline,
    });
    expect(result.total).toBe(6);
  });

  test('un dé supplémentaire est ajouté avant le tirage', () => {
    const pipeline = new ModifierPipeline();
    pipeline.add({
      id: 'de-supplementaire',
      phase: PHASES.SPEC,
      apply: (spec) => withExtraDice(spec, 1),
    });
    const result = roll('2d6', { rng: createScriptedRng([2]), pipeline });
    expect(result.groups[0].dice.length).toBe(3);
    expect(result.total).toBe(6);
  });

  test('les faces peuvent être agrandies', () => {
    const pipeline = new ModifierPipeline();
    pipeline.add({
      id: 'des-plus-grands',
      phase: PHASES.SPEC,
      apply: (spec) => withFaceShift(spec, 2),
    });
    const result = roll('2d6', { rng: createScriptedRng([1, 1]), pipeline });
    expect(result.groups[0].faces).toBe(8);
    expect(result.effective).toBe('2d8');
  });

  test('un dé individuel peut être relevé', () => {
    const pipeline = new ModifierPipeline();
    pipeline.add({
      id: 'plancher-3',
      phase: PHASES.DIE,
      apply: (v) => Math.max(v, 3),
    });
    const result = roll('2d6', { rng: createScriptedRng([1, 5]), pipeline });
    expect(result.groups[0].dice.map((d) => d.value)).toEqual([3, 5]);
    expect(result.total).toBe(8);
  });

  test('le total peut être doublé', () => {
    const pipeline = new ModifierPipeline();
    pipeline.add({
      id: 'double',
      phase: PHASES.TOTAL,
      apply: (v) => v * 2,
    });
    expect(roll('2d6', damage({ pipeline })).total).toBe(12);
  });

  test('les modificateurs se cumulent dans l’ordre des priorités', () => {
    const pipeline = new ModifierPipeline();
    pipeline.add({ id: 'double', phase: PHASES.TOTAL, priority: 10, apply: (v) => v * 2 });
    pipeline.add({ id: 'plus-un', phase: PHASES.TOTAL, priority: 0, apply: (v) => v + 1 });
    // (3+3+1) * 2 = 14, et non 3+3+1*2
    expect(roll('2d6', damage({ pipeline })).total).toBe(14);
  });

  test('trois effets se combinent sur trois étapes différentes', () => {
    const pipeline = new ModifierPipeline();
    pipeline.add({
      id: 'de-en-plus',
      phase: PHASES.SPEC,
      apply: (spec) => withExtraDice(spec, 1),
    });
    pipeline.add({ id: 'plancher-4', phase: PHASES.DIE, apply: (v) => Math.max(v, 4) });
    pipeline.add({ id: 'bonus-2', phase: PHASES.FLAT, apply: (v) => v + 2 });
    // 2d6 → 3d6, dés [1,1,1] relevés à [4,4,4], + 2
    const result = roll('2d6', { rng: createScriptedRng([1]), pipeline });
    expect(result.total).toBe(14);
    expect(result.steps.length).toBe(5); // 1 spec + 3 dés + 1 flat
  });

  test('un modificateur peut déclencher un autre jet', () => {
    const pipeline = new ModifierPipeline();
    pipeline.add({
      id: 'echo',
      phase: PHASES.TOTAL,
      apply: (v, ctx) => v + ctx.roll('1d4', { tags: [] }).total,
    });
    const result = roll('2d6', { rng: createScriptedRng([2]), pipeline });
    expect(result.total).toBe(6); // 2 + 2 puis + 2
  });

  test('un modificateur ne se réapplique pas à son propre jet secondaire', () => {
    const pipeline = new ModifierPipeline();
    pipeline.add({
      id: 'boucle',
      phase: PHASES.TOTAL,
      apply: (v, ctx) => v + ctx.roll('1d6').total,
    });
    // Sans garde de réentrance, ce jet bouclerait jusqu'au garde-fou.
    // Avec la garde : 1d6 = 1, puis un seul jet secondaire 1d6 = 1.
    expect(roll('1d6', { rng: createScriptedRng([1]), pipeline }).total).toBe(2);
  });

  test('un empilement de jets trop profond est arrêté', () => {
    const pipeline = new ModifierPipeline();
    expect(() =>
      roll('1d6', { rng: createScriptedRng([1]), pipeline, _depth: 99 })
    ).toThrow('Profondeur');
  });

  test('un modificateur peut dépendre d’une condition libre', () => {
    const pipeline = new ModifierPipeline();
    pipeline.add({
      id: 'contre-mort-vivant',
      phase: PHASES.FLAT,
      when: (ctx) => ctx.target?.famille === 'mort-vivant',
      apply: (v) => v + 3,
    });
    const sans = roll('2d6', { rng: createScriptedRng([3, 3]), pipeline });
    const avec = roll('2d6', {
      rng: createScriptedRng([3, 3]),
      pipeline,
      target: { famille: 'mort-vivant' },
    });
    expect(sans.total).toBe(6);
    expect(avec.total).toBe(9);
  });

  test('retirer une source désactive ses effets', () => {
    const pipeline = new ModifierPipeline();
    pipeline.add({
      id: 'bonus',
      phase: PHASES.FLAT,
      source: 'item:epee',
      apply: (v) => v + 5,
    });
    expect(roll('2d6', damage({ pipeline })).total).toBe(11);
    pipeline.removeBySource('item:epee');
    expect(roll('2d6', damage({ pipeline })).total).toBe(6);
  });

  test('un identifiant en double est refusé', () => {
    const pipeline = new ModifierPipeline();
    pipeline.add({ id: 'x', phase: PHASES.FLAT, apply: (v) => v });
    expect(() => pipeline.add({ id: 'x', phase: PHASES.FLAT, apply: (v) => v })).toThrow(
      'déjà présent'
    );
  });

  test('un modificateur muet est signalé', () => {
    const pipeline = new ModifierPipeline();
    pipeline.add({ id: 'muet', phase: PHASES.TOTAL, apply: () => undefined });
    expect(() => roll('1d6', { rng: createScriptedRng([1]), pipeline })).toThrow(
      "n'a rien renvoyé"
    );
  });

  test('la trace nomme l’effet responsable', () => {
    const pipeline = new ModifierPipeline();
    pipeline.add({
      id: 'perforante',
      label: 'Perforante',
      phase: PHASES.FLAT,
      source: 'item:epee_perforante',
      apply: (v) => v + 2,
    });
    const step = roll('2d6', damage({ pipeline })).steps[0];
    expect(step.label).toBe('Perforante');
    expect(step.source).toBe('item:epee_perforante');
    expect(step.before).toBe(0);
    expect(step.after).toBe(2);
  });

  test('withFlatBonus n’altère pas la spec d’origine', () => {
    const spec = parseNotation('2d6');
    withFlatBonus(spec, 4);
    expect(spec.flat).toBe(0);
  });
});

/* ------------------------------------------------------------------ */

suite('Générateur aléatoire', ({ test }) => {
  test('une graine textuelle est acceptée', () => {
    expect(typeof normalizeSeed('run-01')).toBe('number');
  });

  test('l’état se sauvegarde et se restaure', () => {
    const rng = createRng('sauvegarde');
    rng.die(6);
    rng.die(6);
    const snapshot = rng.save();
    const suiteA = [rng.die(20), rng.die(20), rng.die(20)];
    rng.load(snapshot);
    const suiteB = [rng.die(20), rng.die(20), rng.die(20)];
    expect(suiteA).toEqual(suiteB);
  });

  test('un dé couvre bien toutes ses faces', () => {
    const rng = createRng('faces');
    const vus = new Set();
    for (let i = 0; i < 500; i++) vus.add(rng.die(6));
    expect(vus.size).toBe(6);
  });

  test('le mélange conserve les éléments', () => {
    const rng = createRng('melange');
    const out = rng.shuffle([1, 2, 3, 4, 5]);
    expect(out.slice().sort().join()).toBe('1,2,3,4,5');
  });
});

/* ------------------------------------------------------------------ */

suite('Registre de contenu', ({ test }) => {
  test('une entrée se déclare puis se relit', () => {
    const r = new Registry();
    r.define('armes');
    r.register('armes', { id: 'epee', degats: '2d6' });
    expect(r.get('armes', 'epee').degats).toBe('2d6');
  });

  test('une collection inconnue est signalée', () => {
    const r = new Registry();
    expect(() => r.all('inconnue')).toThrow('inconnue');
  });

  test('un identifiant en double est refusé', () => {
    const r = new Registry();
    r.define('armes');
    r.register('armes', { id: 'epee' });
    expect(() => r.register('armes', { id: 'epee' })).toThrow('existe déjà');
  });

  test('une validation personnalisée est appliquée', () => {
    const r = new Registry();
    r.define('armes', { validate: (e) => (e.degats ? null : 'dégâts manquants') });
    expect(() => r.register('armes', { id: 'baton' })).toThrow('dégâts manquants');
  });

  test('les entrées sont figées après enregistrement', () => {
    const r = new Registry();
    r.define('armes');
    const epee = r.register('armes', { id: 'epee', degats: '2d6' });
    try {
      epee.degats = '10d10';
    } catch {
      /* mode strict */
    }
    expect(r.get('armes', 'epee').degats).toBe('2d6');
  });
});
