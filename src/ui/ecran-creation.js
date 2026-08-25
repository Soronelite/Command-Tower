/**
 * ecran-creation.js — Création du personnage.
 *
 * Décidé : race, sexe, nom, classe, 7 statistiques à 2 points, maximum 10,
 * 2 points à répartir, graduation de 1 à 10 avec − à gauche et + à droite.
 */

import { el, vider } from './dom.js';
import { RACES, SEXES, CLASSES } from '../data/personnage.js';
import {
  STATS,
  STAT_MIN,
  minimumDe,
  STAT_MAX,
  POINTS_A_REPARTIR,
  statsParDefaut,
  pointsRestants,
  pvMax,
  armureDeBase,
  actionsParTour,
  pourcentage,
} from '../rules/stats.js';
import { creerPersonnage } from '../systems/personnage.js';
import { sauvegarderPersonnage, SAUVEGARDE_DISPONIBLE } from '../systems/sauvegarde.js';

export function ecranCreation({ onLancer, onRetour }) {
  const brouillon = {
    nom: '',
    race: RACES[0].id,
    sexe: SEXES[0].id,
    classe: CLASSES[0].id,
    stats: statsParDefaut(),
  };

  let personnageCree = null;

  const racine = el('div', { class: 'ecran' });
  const page = el('div', { class: 'page' });
  const barre = el('div', { class: 'barre-bas' });
  racine.append(page, barre);

  /* ---------------- sélecteurs ---------------- */

  function groupeDeChoix(options, cle, avecIcone = false) {
    const boite = el('div', { class: 'choix' });
    for (const opt of options) {
      const bouton = el(
        'button',
        {
          type: 'button',
          'aria-pressed': brouillon[cle] === opt.id ? 'true' : 'false',
          onclick: () => {
            brouillon[cle] = opt.id;
            for (const b of boite.children) b.setAttribute('aria-pressed', 'false');
            bouton.setAttribute('aria-pressed', 'true');
          },
        },
        [
          avecIcone && opt.icone ? el('span', { class: 'icone', text: opt.icone }) : null,
          el('span', { text: opt.nom }),
        ]
      );
      boite.append(bouton);
    }
    return boite;
  }

  /* ---------------- statistiques ---------------- */

  const listeStats = el('div');
  const compteur = el('span', { class: 'points-restants' });
  const derives = el('p', { class: 'note' });

  function rendreStats() {
    vider(listeStats);
    const restants = pointsRestants(brouillon.stats);
    compteur.textContent = `${restants} point${restants > 1 ? 's' : ''} à répartir`;

    for (const stat of STATS) {
      const valeur = brouillon.stats[stat.id];
      // Chaque statistique a son propre plancher : l'Endurance démarre à 0.
      const minimum = minimumDe(stat.id);
      const peutBaisser = valeur > minimum;
      const peutMonter = valeur < STAT_MAX && restants > 0;

      const moins = el('button', {
        type: 'button',
        class: `pas${peutBaisser ? ' actif' : ''}`,
        text: '−',
        disabled: !peutBaisser,
        'aria-label': `Retirer un point en ${stat.nom}`,
        onclick: () => {
          brouillon.stats[stat.id]--;
          rendreStats();
        },
      });

      const plus = el('button', {
        type: 'button',
        class: `pas${peutMonter ? ' actif' : ''}`,
        text: '+',
        disabled: !peutMonter,
        'aria-label': `Ajouter un point en ${stat.nom}`,
        onclick: () => {
          brouillon.stats[stat.id]++;
          rendreStats();
        },
      });

      const graduation = el(
        'div',
        {
          class: 'graduation',
          role: 'img',
          'aria-label': `${stat.nom} : ${valeur} sur ${STAT_MAX}`,
        },
        Array.from({ length: STAT_MAX }, (_, i) => {
          const rang = i + 1;
          const classe =
            rang <= minimum && rang <= valeur
              ? 'cran plein'
              : rang <= valeur
                ? 'cran bonus'
                : 'cran';
          return el('span', { class: classe });
        })
      );

      listeStats.append(
        el('div', { class: 'stat' }, [
          el('span', { class: 'stat-nom' }, [
            document.createTextNode(stat.nom),
            el('small', { text: stat.effet }),
          ]),
          moins,
          graduation,
          plus,
        ])
      );
    }

    const s = brouillon.stats;
    const actions = actionsParTour(s);
    derives.textContent =
      `${pvMax(s)} PV · ${armureDeBase(s)} armure · ` +
      `${actions} action${actions > 1 ? 's' : ''} par tour · ` +
      `initiative ${pourcentage(s, 'initiative')} %`;
  }

  /* ---------------- assemblage ---------------- */

  const champNom = el('input', {
    type: 'text',
    maxlength: '24',
    placeholder: 'Nom du personnage',
    oninput: (e) => {
      brouillon.nom = e.target.value;
    },
  });

  page.append(
    el('div', { class: 'page-titre' }, [
      el('h2', { text: 'Création du personnage' }),
      el('span', { class: 'etiquette', text: 'Étape 1' }),
    ]),

    el('div', { class: 'bloc' }, [el('h3', { text: 'Nom' }), champNom]),
    el('div', { class: 'bloc' }, [el('h3', { text: 'Race' }), groupeDeChoix(RACES, 'race', true)]),
    el('div', { class: 'bloc' }, [el('h3', { text: 'Sexe' }), groupeDeChoix(SEXES, 'sexe')]),
    el('div', { class: 'bloc' }, [
      el('h3', { text: 'Classe' }),
      groupeDeChoix(CLASSES, 'classe', true),
      el('p', { class: 'note', text: 'Seul le chevalier est disponible pour ce test.' }),
    ]),
    el('div', { class: 'bloc' }, [
      el('h3', {}, [document.createTextNode('Statistiques'), compteur]),
      listeStats,
      derives,
    ])
  );

  /* ---------------- barre du bas ---------------- */

  const boutonValider = el('button', {
    class: 'primaire',
    text: 'Créer le personnage',
    onclick: valider,
  });

  const boutonLancer = el('button', {
    class: 'primaire',
    text: 'Lancer la run',
    onclick: () => onLancer(personnageCree),
  });

  const etatSauvegarde = el('p', { class: 'note' });

  barre.append(
    el('button', { class: 'discret', text: 'Retour', onclick: onRetour }),
    boutonValider
  );

  function valider() {
    if (pointsRestants(brouillon.stats) > 0) {
      const reste = pointsRestants(brouillon.stats);
      etatSauvegarde.textContent = `Il reste ${reste} point${reste > 1 ? 's' : ''} à répartir.`;
      page.append(etatSauvegarde);
      return;
    }

    personnageCree = creerPersonnage(brouillon);
    const enregistre = sauvegarderPersonnage(personnageCree);

    etatSauvegarde.textContent = enregistre
      ? `${personnageCree.nom} est enregistré dans la sauvegarde locale.`
      : SAUVEGARDE_DISPONIBLE
        ? "L'enregistrement a échoué."
        : "Le stockage local est indisponible : le personnage n'est pas enregistré.";

    page.append(
      el('div', { class: 'bloc' }, [
        el('h3', { text: 'Personnage' }),
        el('p', {
          text: `${personnageCree.nom} — ${labelDe(RACES, brouillon.race)}, ${labelDe(
            SEXES,
            brouillon.sexe
          )}, ${labelDe(CLASSES, brouillon.classe)}`,
        }),
        el('p', {
          class: 'note',
          text: `${personnageCree.pv} PV · sac ${personnageCree.portage.sac.largeur}×${personnageCree.portage.sac.hauteur}`,
        }),
        etatSauvegarde,
      ])
    );

    vider(barre).append(boutonLancer);
    page.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }

  rendreStats();
  return racine;
}

function labelDe(liste, id) {
  return liste.find((x) => x.id === id)?.nom ?? id;
}

/** Ce paragraphe n'est utile qu'à la première ouverture. */
export const POINTS_TOTAL = POINTS_A_REPARTIR;
