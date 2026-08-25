/**
 * registry.js — Registre de contenu.
 *
 * Objectif (document général §18) : ajouter une arme, un ennemi ou un
 * événement ne doit pas obliger à modifier plusieurs systèmes. Chaque type de
 * contenu vit dans une collection déclarée ici ; les systèmes de jeu lisent le
 * registre, ils ne contiennent pas les données.
 *
 * Aucune collection n'est créée d'office : elles seront déclarées au fur et à
 * mesure que les systèmes correspondants seront décidés.
 */

export class RegistryError extends Error {}

export class Registry {
  #collections = new Map();

  /**
   * Déclare une collection.
   * @param {string} name          ex. 'weapons'
   * @param {object} [options]
   * @param {Function} [options.validate] contrôle appelé à chaque entrée
   */
  define(name, { validate = null } = {}) {
    if (this.#collections.has(name)) {
      throw new RegistryError(`Collection « ${name} » déjà déclarée.`);
    }
    this.#collections.set(name, { entries: new Map(), validate });
    return this;
  }

  #collection(name) {
    const c = this.#collections.get(name);
    if (!c) throw new RegistryError(`Collection inconnue : « ${name} ».`);
    return c;
  }

  /** Enregistre une entrée. Elle doit porter un `id` unique. */
  register(name, entry) {
    const c = this.#collection(name);
    if (!entry || !entry.id) {
      throw new RegistryError(`Entrée sans id dans « ${name} ».`);
    }
    if (c.entries.has(entry.id)) {
      throw new RegistryError(`« ${entry.id} » existe déjà dans « ${name} ».`);
    }
    if (c.validate) {
      const problem = c.validate(entry);
      if (problem) {
        throw new RegistryError(`« ${entry.id} » invalide dans « ${name} » : ${problem}`);
      }
    }
    c.entries.set(entry.id, Object.freeze(entry));
    return entry;
  }

  registerAll(name, entries) {
    return entries.map((e) => this.register(name, e));
  }

  get(name, id) {
    const entry = this.#collection(name).entries.get(id);
    if (!entry) throw new RegistryError(`« ${id} » introuvable dans « ${name} ».`);
    return entry;
  }

  find(name, id) {
    return this.#collection(name).entries.get(id) ?? null;
  }

  has(name, id) {
    return this.#collection(name).entries.has(id);
  }

  all(name) {
    return [...this.#collection(name).entries.values()];
  }

  filter(name, predicate) {
    return this.all(name).filter(predicate);
  }

  ids(name) {
    return [...this.#collection(name).entries.keys()];
  }

  collections() {
    return [...this.#collections.keys()];
  }

  /** Compte des entrées par collection — utile pour un écran de débogage. */
  summary() {
    const out = {};
    for (const [name, c] of this.#collections) out[name] = c.entries.size;
    return out;
  }
}

export const registry = new Registry();
