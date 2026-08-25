/**
 * dice.js — Moteur de dés.
 *
 * Rôle : transformer une notation (« 2d6 », « 2d6 + 2 ») en un résultat
 * chiffré, en laissant les modificateurs s'insérer à chaque étape, et en
 * produisant une trace complète de ce qui s'est passé.
 *
 * La trace n'est pas un luxe : c'est ce qui rend le système débogable quand
 * dix effets se combinent, et ce qui permettra d'expliquer un jet au joueur
 * (document général §19, « Lisibilité »).
 *
 * Ce module ne contient AUCUNE règle de combat. Il ne sait pas ce qu'est un
 * point de vie, une attaque ou une défense. Il lance des dés.
 */

import { defaultRng } from './rng.js';
import { PHASES, EMPTY_PIPELINE, formatSpec } from './modifiers.js';

export class DiceError extends Error {}

const MAX_DEPTH = 8; // garde-fou contre les effets qui relancent à l'infini

/* ------------------------------------------------------------------ */
/* Analyse de la notation                                              */
/* ------------------------------------------------------------------ */

const TOKEN = /([+-]?)(?:(\d*)d(\d+)|(\d+))/g;

/**
 * Analyse une notation de dés.
 *
 * Accepte : « 2d6 », « d20 », « 2d6+2 », « 1d8 - 1 », « 2d6 + 1d4 + 3 », « 5 »,
 * ou un nombre.
 *
 * @returns {{groups: Array<{count:number,faces:number,sign:number}>,
 *            flat:number, source:string}}
 */
export function parseNotation(notation) {
  if (typeof notation === 'number') {
    if (!Number.isInteger(notation)) {
      throw new DiceError(`Valeur non entière : ${notation}`);
    }
    return { groups: [], flat: notation, source: String(notation) };
  }

  const source = String(notation ?? '').trim();
  if (!source) throw new DiceError('Notation vide.');

  const cleaned = source.replace(/\s+/g, '').toLowerCase();
  const groups = [];
  let flat = 0;
  let consumed = 0;
  let match;

  TOKEN.lastIndex = 0;
  while ((match = TOKEN.exec(cleaned)) !== null) {
    if (match.index !== consumed) break; // trou = caractère invalide
    consumed = TOKEN.lastIndex;

    const sign = match[1] === '-' ? -1 : 1;

    if (match[3] !== undefined) {
      const count = match[2] === '' ? 1 : Number.parseInt(match[2], 10);
      const faces = Number.parseInt(match[3], 10);
      if (count < 1) throw new DiceError(`Nombre de dés invalide dans « ${source} ».`);
      if (faces < 1) throw new DiceError(`Nombre de faces invalide dans « ${source} ».`);
      groups.push({ count, faces, sign });
    } else {
      flat += sign * Number.parseInt(match[4], 10);
    }
  }

  if (consumed !== cleaned.length) {
    throw new DiceError(`Notation invalide : « ${source} ».`);
  }

  return { groups, flat, source };
}

/** Notation lisible à partir d'une spec (réexporté pour confort). */
export { formatSpec };

/** Valeur moyenne d'une spec, sans lancer les dés (utile pour l'équilibrage). */
export function averageOf(notation) {
  const spec = typeof notation === 'object' ? notation : parseNotation(notation);
  const dice = spec.groups.reduce(
    (sum, g) => sum + g.sign * g.count * ((g.faces + 1) / 2),
    0
  );
  return dice + spec.flat;
}

/** Bornes minimale et maximale d'une spec. */
export function rangeOf(notation) {
  const spec = typeof notation === 'object' ? notation : parseNotation(notation);
  let min = spec.flat;
  let max = spec.flat;
  for (const g of spec.groups) {
    const lo = g.sign * g.count * (g.sign > 0 ? 1 : g.faces);
    const hi = g.sign * g.count * (g.sign > 0 ? g.faces : 1);
    min += Math.min(lo, hi);
    max += Math.max(lo, hi);
  }
  return { min, max };
}

/* ------------------------------------------------------------------ */
/* Exécution d'un jet                                                  */
/* ------------------------------------------------------------------ */

/**
 * Lance un jet.
 *
 * @param {string|number} notation  ex. '2d6 + 2'
 * @param {object} [options]
 * @param {object} [options.rng]       générateur à utiliser
 * @param {object} [options.pipeline]  modificateurs actifs
 * @param {string[]} [options.tags]    nature du jet, ex. ['damage','melee']
 * @param {object} [options.actor]     qui lance (opaque pour ce module)
 * @param {object} [options.target]    contre qui (opaque pour ce module)
 * @param {object} [options.meta]      données libres passées aux modificateurs
 * @returns {object} résultat détaillé, avec .total et .trace
 */
export function roll(notation, options = {}) {
  const {
    rng = defaultRng,
    pipeline = EMPTY_PIPELINE,
    tags = [],
    actor = null,
    target = null,
    meta = {},
    _depth = 0,
    _active = new Set(),
  } = options;

  if (_depth > MAX_DEPTH) {
    throw new DiceError(
      `Profondeur de relance dépassée (${MAX_DEPTH}) : un modificateur relance sans fin.`
    );
  }

  const trace = { steps: [] };

  const ctx = {
    tags: new Set(tags),
    rng,
    pipeline,
    actor,
    target,
    meta,
    trace,
    depth: _depth,
    /** Modificateurs en cours d'exécution, pour éviter qu'ils se relancent eux-mêmes. */
    active: _active,
    /** Permet à un modificateur de déclencher un autre jet (§9 : « modifier un autre jet »). */
    roll: (subNotation, subOptions = {}) =>
      roll(subNotation, {
        rng,
        pipeline,
        actor,
        target,
        meta,
        ...subOptions,
        _depth: _depth + 1,
        _active,
      }),
  };

  // 1. Notation → spec, puis modificateurs d'étape SPEC.
  const original = parseNotation(notation);
  const spec = pipeline.run(PHASES.SPEC, original, ctx);
  assertSpec(spec);

  // 2. Tirage dé par dé, avec modificateurs d'étape DIE.
  const groups = [];
  for (let gi = 0; gi < spec.groups.length; gi++) {
    const g = spec.groups[gi];
    const dice = [];

    for (let i = 0; i < g.count; i++) {
      const raw = rng.die(g.faces);
      const dieCtx = {
        ...ctx,
        die: { faces: g.faces, index: i, groupIndex: gi, raw },
      };
      const value = pipeline.run(PHASES.DIE, raw, dieCtx);
      requireNumber(value, `étape ${PHASES.DIE}`);
      dice.push({ raw, value });
    }

    let subtotal = dice.reduce((s, d) => s + d.value, 0);
    const groupCtx = {
      ...ctx,
      group: { index: gi, count: g.count, faces: g.faces, dice },
    };
    subtotal = pipeline.run(PHASES.GROUP, subtotal, groupCtx);
    requireNumber(subtotal, `étape ${PHASES.GROUP}`);

    groups.push({ count: g.count, faces: g.faces, sign: g.sign, dice, subtotal });
  }

  // 3. Bonus fixe, avec modificateurs d'étape FLAT.
  const flat = pipeline.run(PHASES.FLAT, spec.flat, ctx);
  requireNumber(flat, `étape ${PHASES.FLAT}`);

  // 4. Total, avec modificateurs d'étape TOTAL.
  const rawTotal = groups.reduce((s, g) => s + g.sign * g.subtotal, 0) + flat;
  const total = pipeline.run(PHASES.TOTAL, rawTotal, ctx);
  requireNumber(total, `étape ${PHASES.TOTAL}`);

  return {
    notation: original.source,
    effective: formatSpec(spec),
    tags: [...ctx.tags],
    groups,
    flat,
    rawTotal,
    total,
    steps: trace.steps,
    /** Résumé sur une ligne, pour le journal ou le débogage. */
    describe() {
      const rolled = groups
        .map((g) => `${g.count}d${g.faces}[${g.dice.map((d) => d.value).join(', ')}]`)
        .join(' + ');
      const bonus = flat !== 0 ? ` ${flat > 0 ? '+' : '-'} ${Math.abs(flat)}` : '';
      return `${original.source} → ${rolled || '0'}${bonus} = ${total}`;
    },
  };
}

/** Raccourci quand seul le total compte. */
export function rollTotal(notation, options) {
  return roll(notation, options).total;
}

/* ------------------------------------------------------------------ */

function requireNumber(value, where) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new DiceError(`Valeur non numérique renvoyée à l'${where}.`);
  }
}

function assertSpec(spec) {
  if (!spec || !Array.isArray(spec.groups) || typeof spec.flat !== 'number') {
    throw new DiceError(
      "Un modificateur d'étape spec a renvoyé une spec invalide."
    );
  }
  for (const g of spec.groups) {
    if (!Number.isInteger(g.count) || g.count < 0) {
      throw new DiceError(`Nombre de dés invalide après modification : ${g.count}`);
    }
    if (!Number.isInteger(g.faces) || g.faces < 1) {
      throw new DiceError(`Nombre de faces invalide après modification : ${g.faces}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Aides pour écrire des modificateurs d'étape SPEC                    */
/* ------------------------------------------------------------------ */

/** Renvoie une copie de la spec avec `n` dés supplémentaires sur chaque groupe. */
export function withExtraDice(spec, n) {
  return {
    ...spec,
    groups: spec.groups.map((g) => ({ ...g, count: Math.max(0, g.count + n) })),
  };
}

/** Renvoie une copie de la spec avec les faces décalées de `n` (d6 → d8 si n=2). */
export function withFaceShift(spec, n) {
  return {
    ...spec,
    groups: spec.groups.map((g) => ({ ...g, faces: Math.max(1, g.faces + n) })),
  };
}

/** Renvoie une copie de la spec avec `n` ajouté au bonus fixe. */
export function withFlatBonus(spec, n) {
  return { ...spec, flat: spec.flat + n };
}
