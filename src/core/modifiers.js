/**
 * modifiers.js — Pipeline d'effets composables.
 *
 * Objectif (document général §9 et §10) : ne PAS coder chaque effet comme une
 * exception dans le moteur. Un effet est une donnée : il déclare à quelle
 * étape d'un jet il s'insère, à quelles conditions, et ce qu'il fait.
 *
 * Le moteur ne connaît que des étapes. Il ne connaît aucun effet en
 * particulier. C'est ce qui permet aux effets de se combiner entre eux — donc
 * de « casser le jeu ».
 *
 * Ce module ne contient AUCUN effet concret ni aucune règle de jeu.
 */

/**
 * Étapes traversées par un jet, dans l'ordre.
 *
 *   SPEC   → modifie la notation avant tout tirage
 *            (nombre de dés, nombre de faces, bonus fixe)
 *   DIE    → modifie le résultat d'un dé, dé par dé
 *   GROUP  → modifie la somme d'un groupe de dés (ex. le total des 2d6)
 *   FLAT   → modifie le bonus fixe seul
 *   TOTAL  → modifie le total final
 *
 * Un même effet peut poser des modificateurs sur plusieurs étapes.
 */
export const PHASES = Object.freeze({
  SPEC: 'spec',
  DIE: 'die',
  GROUP: 'group',
  FLAT: 'flat',
  TOTAL: 'total',
});

const VALID_PHASES = new Set(Object.values(PHASES));

/**
 * Forme d'un modificateur :
 *
 * {
 *   id:       'perforante',            // unique dans le pipeline
 *   label:    'Perforante',            // affiché au joueur / dans la trace
 *   source:   'item:epee_perforante',  // d'où vient l'effet (pour le retirer)
 *   phase:    PHASES.FLAT,
 *   priority: 0,                       // croissant ; à égalité, ordre d'ajout
 *   requires: ['damage'],              // s'applique si le jet porte CES tags
 *   when:     (ctx) => boolean,        // condition libre, optionnelle
 *   apply:    (value, ctx) => value    // la transformation
 * }
 *
 * `apply` doit être pure et sans effet de bord sur `value`.
 * Pour l'étape SPEC, `value` est un objet spec (voir dice.js) : renvoyer un
 * NOUVEL objet plutôt que muter celui reçu.
 */

export class ModifierError extends Error {}

let autoOrder = 0;

function validate(mod) {
  if (!mod || typeof mod !== 'object') {
    throw new ModifierError('Modificateur invalide : objet attendu.');
  }
  if (!mod.id) throw new ModifierError('Modificateur sans id.');
  if (!VALID_PHASES.has(mod.phase)) {
    throw new ModifierError(
      `Modificateur « ${mod.id} » : étape inconnue « ${mod.phase} ».`
    );
  }
  if (typeof mod.apply !== 'function') {
    throw new ModifierError(`Modificateur « ${mod.id} » : apply() manquant.`);
  }
}

export class ModifierPipeline {
  #mods = [];

  /**
   * Ajoute un modificateur.
   * @returns {Function} fonction de retrait (utile pour déséquiper un objet).
   */
  add(mod) {
    validate(mod);
    if (this.#mods.some((m) => m.id === mod.id)) {
      throw new ModifierError(`Modificateur « ${mod.id} » déjà présent.`);
    }
    const entry = {
      priority: 0,
      requires: [],
      label: mod.id,
      source: null,
      ...mod,
      _order: autoOrder++,
    };
    this.#mods.push(entry);
    this.#mods.sort((a, b) => a.priority - b.priority || a._order - b._order);
    return () => this.remove(entry.id);
  }

  addAll(mods) {
    return mods.map((m) => this.add(m));
  }

  remove(id) {
    const i = this.#mods.findIndex((m) => m.id === id);
    if (i === -1) return false;
    this.#mods.splice(i, 1);
    return true;
  }

  /** Retire tous les modificateurs venant d'une même source (ex. un objet). */
  removeBySource(source) {
    const before = this.#mods.length;
    this.#mods = this.#mods.filter((m) => m.source !== source);
    return before - this.#mods.length;
  }

  clear() {
    this.#mods = [];
  }

  all() {
    return [...this.#mods];
  }

  has(id) {
    return this.#mods.some((m) => m.id === id);
  }

  /** Modificateurs actifs pour une étape et un contexte donnés. */
  matching(phase, ctx) {
    return this.#mods.filter((m) => {
      if (m.phase !== phase) return false;
      // Garde de réentrance : un modificateur qui déclenche un jet secondaire
      // ne doit pas se réappliquer à ce jet, sinon toute relance boucle.
      if (ctx.active?.has(m.id)) return false;
      if (m.requires.length && !m.requires.every((t) => ctx.tags.has(t))) {
        return false;
      }
      if (typeof m.when === 'function' && !m.when(ctx)) return false;
      return true;
    });
  }

  /**
   * Fait traverser une valeur à tous les modificateurs d'une étape.
   * Chaque transformation est enregistrée dans ctx.trace.steps.
   */
  run(phase, value, ctx) {
    let current = value;
    for (const mod of this.matching(phase, ctx)) {
      const before = current;
      let after;
      ctx.active?.add(mod.id);
      try {
        after = mod.apply(current, ctx);
      } catch (err) {
        if (err instanceof ModifierError) throw err;
        throw new ModifierError(
          `Modificateur « ${mod.id} » a échoué à l'étape ${phase} : ${err.message}`
        );
      } finally {
        ctx.active?.delete(mod.id);
      }
      if (after === undefined) {
        throw new ModifierError(
          `Modificateur « ${mod.id} » n'a rien renvoyé à l'étape ${phase}.`
        );
      }
      if (after !== before && ctx.trace) {
        ctx.trace.steps.push({
          phase,
          id: mod.id,
          label: mod.label,
          source: mod.source,
          before: summarize(before),
          after: summarize(after),
          target: describeTarget(phase, ctx),
        });
      }
      current = after;
    }
    return current;
  }
}

function summarize(value) {
  if (typeof value === 'number') return value;
  if (value && Array.isArray(value.groups)) {
    return formatSpec(value);
  }
  return value;
}

function describeTarget(phase, ctx) {
  if (phase === PHASES.DIE && ctx.die) {
    return `dé ${ctx.die.index + 1} (d${ctx.die.faces})`;
  }
  if (phase === PHASES.GROUP && ctx.group) {
    return `${ctx.group.count}d${ctx.group.faces}`;
  }
  return null;
}

/** Représentation lisible d'une spec, pour la trace. */
export function formatSpec(spec) {
  const parts = spec.groups.map(
    (g, i) => `${i > 0 || g.sign < 0 ? (g.sign < 0 ? '-' : '+') : ''}${g.count}d${g.faces}`
  );
  let out = parts.join(' ') || '0';
  if (spec.flat > 0) out += ` + ${spec.flat}`;
  if (spec.flat < 0) out += ` - ${Math.abs(spec.flat)}`;
  return out.trim();
}

/** Pipeline vide partagé : sert de défaut quand aucun effet n'est actif. */
export const EMPTY_PIPELINE = new ModifierPipeline();
