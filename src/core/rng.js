/**
 * rng.js — Générateur pseudo-aléatoire déterministe.
 *
 * Pourquoi ne pas utiliser Math.random() :
 *  - Math.random() n'est pas reproductible : impossible de rejouer une run
 *    identique pour reproduire un bug ou tester un équilibrage.
 *  - Son état n'est pas sérialisable : impossible de sauvegarder une partie
 *    en cours au milieu d'une séquence aléatoire.
 *
 * Ici l'état tient sur un entier 32 bits, donc une sauvegarde JSON suffit.
 * Algorithme : mulberry32 (rapide, très bonne distribution, domaine public).
 *
 * Ce module ne contient AUCUNE règle de jeu. C'est un outil.
 */

/** Convertit une graine quelconque (nombre ou chaîne) en entier 32 bits. */
export function normalizeSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    return seed >>> 0;
  }
  // Hachage xfnv1a d'une chaîne
  const text = String(seed);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function step(state) {
  let a = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { state: a, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}

/**
 * Crée un générateur.
 * @param {number|string} [seed] graine ; par défaut aléatoire.
 * @returns {object} générateur
 */
export function createRng(seed = Date.now() ^ (Math.random() * 0xffffffff)) {
  const initialSeed = normalizeSeed(seed);
  let state = initialSeed;
  let calls = 0;

  const rng = {
    /** Graine d'origine, utile pour l'afficher au joueur ou dans un rapport de bug. */
    get seed() {
      return initialSeed;
    },

    /** Nombre de tirages effectués depuis la création (diagnostic). */
    get calls() {
      return calls;
    },

    /** Flottant dans [0, 1[. */
    next() {
      const r = step(state);
      state = r.state;
      calls++;
      return r.value;
    },

    /** Entier dans [min, max], bornes incluses. */
    int(min, max) {
      if (!Number.isInteger(min) || !Number.isInteger(max)) {
        throw new TypeError('rng.int attend des entiers.');
      }
      if (max < min) throw new RangeError('rng.int : max < min.');
      return min + Math.floor(rng.next() * (max - min + 1));
    },

    /** Un dé à `faces` faces : entier dans [1, faces]. */
    die(faces) {
      if (!Number.isInteger(faces) || faces < 1) {
        throw new RangeError(`Nombre de faces invalide : ${faces}`);
      }
      return rng.int(1, faces);
    },

    /** Un élément au hasard dans une liste non vide. */
    pick(list) {
      if (!Array.isArray(list) || list.length === 0) {
        throw new RangeError('rng.pick attend une liste non vide.');
      }
      return list[rng.int(0, list.length - 1)];
    },

    /** Copie mélangée d'une liste (Fisher-Yates). */
    shuffle(list) {
      const out = [...list];
      for (let i = out.length - 1; i > 0; i--) {
        const j = rng.int(0, i);
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },

    /** État sérialisable, à écrire dans la sauvegarde. */
    save() {
      return { seed: initialSeed, state: state >>> 0, calls };
    },

    /**
     * Dérive un générateur indépendant à partir de la même graine.
     *
     * Indispensable pour les runs reproductibles : si la génération du donjon
     * et les jets de combat puisaient dans le même flux, le nombre de dés
     * lancés pendant un combat décalerait tout le reste de l'étage. Deux
     * parties de même graine divergeraient dès que le joueur joue autrement.
     */
    deriver(etiquette) {
      return createRng(`${initialSeed}:${etiquette}`);
    },

    /** Restaure un état produit par save(). */
    load(snapshot) {
      if (!snapshot || typeof snapshot.state !== 'number') {
        throw new TypeError('rng.load : état invalide.');
      }
      state = snapshot.state >>> 0;
      calls = snapshot.calls ?? 0;
    },
  };

  return rng;
}

/**
 * Générateur scripté, pour les tests : renvoie les valeurs fournies, dans
 * l'ordre, puis boucle. Permet de tester un modificateur sans dépendre du
 * hasard.
 *
 *   const rng = createScriptedRng([1, 6, 3]); // le 1er dé fera 1, le 2e 6...
 */
export function createScriptedRng(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new RangeError('createScriptedRng attend une liste non vide.');
  }
  let i = 0;
  const take = () => values[i++ % values.length];

  return {
    seed: 0,
    get calls() {
      return i;
    },
    next: () => take() / 1000,
    int: (min, max) => Math.min(Math.max(take(), min), max),
    die: () => take(),
    pick: (list) => list[take() % list.length],
    shuffle: (list) => [...list],
    save: () => ({ seed: 0, state: i, calls: i }),
    load: (s) => {
      i = s?.state ?? 0;
    },
  };
}

/** Générateur partagé par défaut. Le moteur de jeu devra utiliser le sien. */
export const defaultRng = createRng();
