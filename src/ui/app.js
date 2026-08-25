/**
 * app.js — Point d'entrée : accueil, réglages, enchaînement des écrans.
 */

import { el, vider } from './dom.js';
import { ecranCreation } from './ecran-creation.js';
import { ecranJeu } from './ecran-jeu.js';
import { QUESTIONS_OUVERTES } from '../rules/provisoire.js';
import { lire, effacer, SAUVEGARDE_DISPONIBLE } from '../systems/sauvegarde.js';

const racine = document.getElementById('app');
let ecranActuel = null;

function afficher(noeud) {
  ecranActuel?.demonter?.();
  vider(racine).append(noeud);
  ecranActuel = noeud;
  window.scrollTo(0, 0);
}

/* ------------------------------------------------------------------ */

function accueil() {
  const sauvegarde = lire();

  return el('div', { class: 'ecran accueil' }, [
    el('div', {}, [
      el('h1', { text: 'Sans titre' }),
      el('p', { class: 'sous-titre', text: 'Prototype — 3 pièces' }),
    ]),
    el('div', { class: 'menu' }, [
      el('button', { class: 'primaire', text: 'Jouer', onclick: () => afficher(creation()) }),
      el('button', { text: 'Réglages', onclick: () => afficher(reglages()) }),
    ]),
    sauvegarde?.personnage
      ? el('p', {
          class: 'note',
          text: `Dernier personnage enregistré : ${sauvegarde.personnage.nom}`,
        })
      : null,
  ]);
}

/* ------------------------------------------------------------------ */

function creation() {
  return ecranCreation({
    onRetour: () => afficher(accueil()),
    onLancer: (personnage) => afficher(jeu(personnage)),
  });
}

function jeu(personnage) {
  return ecranJeu({
    personnage,
    graine: Date.now(),
    onTerminer: () => afficher(accueil()),
  });
}

/* ------------------------------------------------------------------ */

function reglages() {
  const etat = el('p', { class: 'note' });

  const questions = el(
    'div',
    {},
    QUESTIONS_OUVERTES.map((q) =>
      el('div', { class: 'question' }, [
        el('div', { class: 'sujet', text: q.sujet }),
        el('p', { class: 'texte', text: q.question }),
        el('p', { class: 'valeur' }, [
          document.createTextNode('Valeur provisoire : '),
          el('b', { text: q.provisoire }),
        ]),
      ])
    )
  );

  return el('div', { class: 'ecran' }, [
    el('div', { class: 'page' }, [
      el('div', { class: 'page-titre' }, [
        el('h2', { text: 'Réglages' }),
        el('span', { class: 'etiquette', text: 'À définir' }),
      ]),

      el('div', { class: 'bloc' }, [
        el('h3', { text: 'Sauvegarde locale' }),
        el('p', {
          class: 'note',
          text: SAUVEGARDE_DISPONIBLE
            ? 'Le personnage est enregistré dans le stockage local du navigateur.'
            : "Le stockage local est indisponible dans ce contexte : rien n'est enregistré.",
        }),
        el('div', { class: 'rangee' }, [
          el('button', {
            text: 'Effacer la sauvegarde',
            disabled: !SAUVEGARDE_DISPONIBLE,
            onclick: () => {
              effacer();
              etat.textContent = 'Sauvegarde effacée.';
            },
          }),
        ]),
        etat,
      ]),

      el('div', { class: 'bloc' }, [
        el('h3', { text: 'Décisions en attente' }),
        el('p', {
          class: 'note',
          text: 'Ces points ont dû être fixés pour que le prototype tourne. Aucun n’est validé.',
        }),
        questions,
      ]),

      el('div', { class: 'bloc' }, [
        el('h3', { text: 'Outils' }),
        el('p', { class: 'note' }, [
          document.createTextNode('Le banc d’essai du moteur de dés est dans '),
          el('code', { text: 'banc-dessai.html' }),
          document.createTextNode('.'),
        ]),
      ]),
    ]),

    el('div', { class: 'barre-bas' }, [
      el('button', { class: 'primaire', text: 'Retour', onclick: () => afficher(accueil()) }),
    ]),
  ]);
}

/* ------------------------------------------------------------------ */

afficher(accueil());
