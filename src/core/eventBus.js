/**
 * eventBus.js — Bus d'événements interne.
 *
 * Sert à découpler les systèmes : le combat annonce « dégâts infligés », le
 * journal et l'interface écoutent, sans que le combat les connaisse.
 *
 * À ne pas confondre avec les « événements » du jeu (rencontres, situations
 * narratives) : ceux-là sont du contenu et vivront dans le registre.
 */

export class EventBus {
  #listeners = new Map();

  /**
   * Écoute un canal.
   * @returns {Function} fonction de désabonnement.
   */
  on(channel, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError(`Écouteur invalide pour « ${channel} ».`);
    }
    if (!this.#listeners.has(channel)) this.#listeners.set(channel, new Set());
    this.#listeners.get(channel).add(handler);
    return () => this.off(channel, handler);
  }

  /** Écoute une seule fois. */
  once(channel, handler) {
    const off = this.on(channel, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off(channel, handler) {
    this.#listeners.get(channel)?.delete(handler);
  }

  /** Diffuse un message. Une erreur dans un écouteur n'interrompt pas les autres. */
  emit(channel, payload) {
    const set = this.#listeners.get(channel);
    if (!set) return 0;
    let delivered = 0;
    for (const handler of [...set]) {
      try {
        handler(payload);
        delivered++;
      } catch (err) {
        console.error(`Écouteur de « ${channel} » en erreur :`, err);
      }
    }
    return delivered;
  }

  clear(channel) {
    if (channel) this.#listeners.delete(channel);
    else this.#listeners.clear();
  }

  channels() {
    return [...this.#listeners.keys()];
  }
}

export const bus = new EventBus();
