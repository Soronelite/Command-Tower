/**
 * sauvegarde.js — Sauvegarde locale.
 *
 * Choix technique : localStorage. C'est synchrone, disponible partout, ne
 * demande aucune permission et fonctionne hors connexion. Une bascule vers
 * IndexedDB sera possible sans toucher aux appels : seul ce fichier changerait.
 *
 * Ce qui est sauvegardé reste volontairement minimal tant que les systèmes
 * d'expérience et de progression permanente ne sont pas définis.
 */

const CLE = 'roguelite.sauvegarde.v1';
const VERSION = 1;

function disponible() {
  try {
    const t = '__test__';
    localStorage.setItem(t, t);
    localStorage.removeItem(t);
    return true;
  } catch {
    return false;
  }
}

export const SAUVEGARDE_DISPONIBLE = disponible();

export function ecrire(donnees) {
  if (!SAUVEGARDE_DISPONIBLE) return false;
  try {
    localStorage.setItem(CLE, JSON.stringify({ version: VERSION, ...donnees }));
    return true;
  } catch (err) {
    console.error('Sauvegarde impossible :', err);
    return false;
  }
}

export function lire() {
  if (!SAUVEGARDE_DISPONIBLE) return null;
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return null;
    const donnees = JSON.parse(brut);
    if (donnees.version !== VERSION) return null;
    return donnees;
  } catch (err) {
    console.error('Sauvegarde illisible :', err);
    return null;
  }
}

export function effacer() {
  if (!SAUVEGARDE_DISPONIBLE) return;
  localStorage.removeItem(CLE);
}

export function sauvegarderPersonnage(perso) {
  return ecrire({
    enregistreLe: new Date().toISOString(),
    personnage: {
      nom: perso.nom,
      race: perso.race,
      sexe: perso.sexe,
      classe: perso.classe,
      stats: perso.stats,
      pv: perso.pv,
      // Les PV maximum ne sont pas stockés : ils se recalculent à partir des
      // statistiques et des passifs de l'inventaire.
      portage: perso.portage,
      progression: perso.progression,
    },
  });
}
