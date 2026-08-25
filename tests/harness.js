/**
 * harness.js — Micro-harnais de test.
 *
 * Aucune dépendance externe, donc aucune connexion Internet requise.
 * Fonctionne dans le navigateur et sous Node.
 */

const suites = [];

export function suite(name, body) {
  const cases = [];
  body({
    test: (label, fn) => cases.push({ label, fn }),
  });
  suites.push({ name, cases });
}

export function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`attendu ${format(expected)}, obtenu ${format(actual)}`);
      }
    },
    toEqual(expected) {
      const a = JSON.stringify(actual);
      const b = JSON.stringify(expected);
      if (a !== b) throw new Error(`attendu ${b}, obtenu ${a}`);
    },
    toBeWithin(min, max) {
      if (typeof actual !== 'number' || actual < min || actual > max) {
        throw new Error(`attendu entre ${min} et ${max}, obtenu ${format(actual)}`);
      }
    },
    toThrow(fragment) {
      let thrown = null;
      try {
        actual();
      } catch (err) {
        thrown = err;
      }
      if (!thrown) throw new Error('une erreur était attendue, aucune levée');
      if (fragment && !String(thrown.message).includes(fragment)) {
        throw new Error(
          `erreur attendue contenant « ${fragment} », obtenu « ${thrown.message} »`
        );
      }
    },
  };
}

function format(v) {
  if (typeof v === 'string') return `« ${v} »`;
  return JSON.stringify(v);
}

/** Exécute toutes les suites enregistrées. */
export function runAll() {
  const results = [];
  let passed = 0;
  let failed = 0;

  for (const s of suites) {
    const cases = [];
    for (const c of s.cases) {
      try {
        c.fn();
        cases.push({ label: c.label, ok: true });
        passed++;
      } catch (err) {
        cases.push({ label: c.label, ok: false, message: err.message });
        failed++;
      }
    }
    results.push({ name: s.name, cases });
  }

  return { results, passed, failed, total: passed + failed };
}
