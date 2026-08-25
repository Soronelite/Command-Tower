/**
 * ecran-jeu.js — Interface de run.
 *
 * Découpage décidé : deux quarts de zone visuelle, un quart de texte,
 * un quart d'actions. Les trois zones ont une hauteur fixe ; le journal
 * défile à l'intérieur de la sienne et ne fait jamais grandir la page.
 */

import { el, vider, visuelManquant } from './dom.js';

import * as Run from '../systems/run.js';
import { ciblesDisponibles } from '../systems/competences.js';
import { vueInventaire } from './vue-inventaire.js';
import { PROVISOIRE } from '../rules/provisoire.js';

export function ecranJeu({ personnage, graine, onTerminer }) {
  const run = Run.creerRun(personnage, { graine });

  const zoneVisuelle = el('div', { class: 'zone zone-visuelle' });
  const zoneTexte = el('div', { class: 'zone zone-texte' });
  const zoneActions = el('div', { class: 'zone zone-actions' });

  const racine = el('div', { class: 'ecran jeu' }, [zoneVisuelle, zoneTexte, zoneActions]);

  let inventaireOuvert = null;
  let modaleNiveau = null;
  const piecesDepliees = new Set();

  /* ---------------- zone visuelle ---------------- */

  function rendreVisuel() {
    vider(zoneVisuelle);

    const info = Run.resume(run);
    const combat = run.combat;
    const piece = Run.pieceCourante(run);

    const xpTexte = info.xp.complet
      ? 'XP max'
      : `${info.xp.actuel}/${info.xp.requis} XP`;
    const xpPart = info.xp.complet ? 1 : info.xp.actuel / info.xp.requis;

    const hud = el('div', { class: 'hud' }, [
      el('span', { class: 'nom', text: personnage.nom }),
      el('span', { class: 'niveau', text: `Niv. ${info.niveau}` }),
      el('div', { class: 'jauge xp', title: xpTexte }, [
        el('i', { style: { width: `${xpPart * 100}%` } }),
      ]),
      el('span', { class: 'xp-texte', text: xpTexte }),
      el('span', { class: `pv${info.pv <= info.pvMax / 3 ? ' bas' : ''}`, text: `${info.pv}/${info.pvMax} PV` }),
      el('div', { class: 'jauge' }, [el('i', { style: { width: `${(info.pv / info.pvMax) * 100}%` } })]),
      el('span', { class: 'armure', text: `${info.armure} armure` }),
      el('span', { class: 'piece', text: `Étage ${info.piece.etage} · pièce ${info.piece.piece}/${info.piece.total}` }),
    ]);

    let contenu;
    if (combat && !combat.termine) {
      contenu = el('div', {}, [
        visuelManquant(combat.ennemi.nom, combat.ennemi.icone),
        el('div', { class: 'hud statique' }, [
          combat.ennemi.rang ? el('span', { class: 'niveau', text: `Rang ${combat.ennemi.rang}` + (combat.ennemi.variante > 1 ? ` · V${combat.ennemi.variante}` : '') }) : null,
          el('span', { text: `${combat.ennemi.pv}/${combat.ennemi.pvMax} PV` }),
          el('div', { class: 'jauge ennemi' }, [
            el('i', { style: { width: `${(combat.ennemi.pv / combat.ennemi.pvMax) * 100}%` } }),
          ]),
          el('span', { class: 'armure', text: `${combat.ennemi.armure} armure` }),
        ]),
      ]);
    } else if (run.phase === Run.PHASES.FIN) {
      contenu = visuelManquant(
        run.issue === 'mort' ? 'Mort du personnage'
        : run.issue === 'arrete' ? 'Retour à la surface'
        : 'Fin du donjon'
      );
    } else if (run.phase === Run.PHASES.FIN_ETAGE) {
      contenu = visuelManquant(`Escalier vers l'étage ${run.etage + 1}`);
    } else {
      contenu = visuelManquant(piece ? piece.visuel : 'Lieu');
    }

    const statuts = el('div', { class: 'statuts' });

    if (run.piece?.eclairee) {
      statuts.append(el('span', { class: 'statut lumiere', text: '🔥 Pièce éclairée' }));
    }
    for (const label of info.effets) {
      if (label === 'Torches allumées') continue; // déjà signalé ci-dessus
      statuts.append(el('span', { class: 'statut', text: label }));
    }
    if (run.combat && !run.combat.termine) {
      for (const e of run.combat.effets) {
        statuts.append(el('span', { class: 'statut', text: `${combat.ennemi.nom} : ${e.label}` }));
      }
    }

    zoneVisuelle.append(hud, el('div', {}, [contenu, statuts.children.length ? statuts : null]));

    if (info.effets.length) {
      zoneVisuelle.append(
        el('div', { class: 'effets-actifs' }, info.effets.map((label) =>
          el('span', { class: 'pastille', text: label })
        ))
      );
    }
  }

  /* ---------------- journal ---------------- */

  function rendreJournal() {
    vider(zoneTexte);

    const groupes = [];
    for (const entree of run.journal) {
      const dernier = groupes[groupes.length - 1];
      if (dernier && dernier.piece === entree.piece) dernier.entrees.push(entree);
      else groupes.push({ piece: entree.piece, entrees: [entree] });
    }

    groupes.forEach((groupe, index) => {
      const courant = index === groupes.length - 1;
      const lignes = groupe.entrees.map((e) => el('p', { class: e.type, text: e.texte }));

      if (courant) {
        zoneTexte.append(...lignes);
        return;
      }

      // Les pièces précédentes sont repliées pour garder le cadre lisible.
      const ouvert = piecesDepliees.has(index);
      const titre = groupe.entrees.find((e) => e.type === 'lieu')?.texte.replace(/^— | —$/g, '')
        ?? groupe.entrees.find((e) => e.type === 'etage')?.texte
        ?? 'Passage';
      const bloc = el('details', { class: 'piece-repliee', open: ouvert }, [
        el('summary', { text: titre }),
        ...lignes,
      ]);
      bloc.addEventListener('toggle', () => {
        if (bloc.open) piecesDepliees.add(index);
        else piecesDepliees.delete(index);
      });
      zoneTexte.append(bloc);
    });

    zoneTexte.scrollTop = zoneTexte.scrollHeight;
  }

  /* ---------------- actions ---------------- */

  function utilisableMaintenant(def, position = null) {
    const a = def.action;
    if (!a) return false;
    if (Run.attendUnChoixDeCompetence(run)) return false;
    const enCombat = run.phase === Run.PHASES.COMBAT;
    // Fouiller son sac au milieu d'un échange n'a pas de sens.
    if (position?.zone === 'sac' && enCombat) return false;
    if (a.type === 'attaque' || a.cible === 'ennemi' || a.seulementEnCombat) {
      return enCombat && run.combat.actionsRestantes > 0;
    }
    if (enCombat && run.combat.actionsRestantes <= 0) return false;
    return run.phase !== Run.PHASES.FIN;
  }

  function rendreActions() {
    vider(zoneActions);

    if (run.phase === Run.PHASES.FIN) {
      zoneActions.append(
        el('div', { class: 'rangee' }, [
          el('button', { class: 'primaire', text: 'Terminer la run', onclick: () => onTerminer(run) }),
        ])
      );
      return;
    }

    if (run.phase === Run.PHASES.FIN_ETAGE) {
      zoneActions.append(
        el('p', {
          class: 'note',
          text: `Étage ${run.etage} terminé. Descendre augmente la difficulté ; s'arrêter met fin à la run.`,
        }),
        el('div', { class: 'rangee' }, [
          el('button', {
            class: 'primaire',
            text: `Descendre à l'étage ${run.etage + 1}`,
            onclick: () => Run.descendre(run),
          }),
          el('button', { text: 'Arrêter la run', onclick: () => Run.arreterLaRun(run) }),
        ])
      );
      return;
    }

    const bloque = Run.attendUnChoixDeCompetence(run);

    if (run.phase === Run.PHASES.COMBAT) {
      const info = Run.resume(run);
      zoneActions.append(
        el('div', { class: 'compteur-actions' }, [
          el('span', { text: `Tour ${run.combat.tour}` }),
          el('span', { class: 'points-action' }, Array.from({ length: info.actionsMax }, (_, i) =>
            el('span', { class: `point-action${i < info.actions ? ' plein' : ''}` })
          )),
          el('span', { text: `${info.actions} / ${info.actionsMax} action${info.actionsMax > 1 ? 's' : ''}` }),
        ])
      );
    }

    const rencontre = el('div', { class: 'rangee' });
    for (const action of Run.actionsDeRencontre(run)) {
      rencontre.append(
        el('button', {
          class: action.type === 'avancer' ? 'primaire' : '',
          text: action.libelle,
          disabled: bloque,
          onclick: () => Run.executerAction(run, action.id),
        })
      );
    }
    if (rencontre.children.length) zoneActions.append(rencontre);

    const utilisables = Run.objetsUtilisables(run);
    const repli = Run.attaqueDeRepli(run);

    if (utilisables.length || repli) {
      const raccourcis = el('div', { class: 'raccourcis' });

      if (repli) {
        raccourcis.append(
          el('button', {
            class: 'raccourci',
            disabled: bloque || run.combat.actionsRestantes <= 0,
            onclick: () => Run.utiliserAttaqueDeRepli(run),
          }, [
            el('span', { class: 'icone', text: '✊' }),
            el('span', {}, [
              document.createTextNode(repli.nom),
              el('small', { text: ` ${repli.des}` }),
            ]),
          ])
        );
      }

      for (const { slot, def } of utilisables) {
        raccourcis.append(
          el('button', {
            class: 'raccourci',
            disabled: !utilisableMaintenant(def),
            onclick: () => Run.utiliserObjet(run, slot.uid),
          }, [
            el('span', { class: 'icone', text: def.icone }),
            el('span', {}, [
              document.createTextNode(def.action.verbe),
              el('small', { text: ` ${detailCourt(def)}` }),
            ]),
          ])
        );
      }

      zoneActions.append(raccourcis);
    }

    const bas = el('div', { class: 'rangee' }, [
      el('button', { class: 'discret', text: 'Inventaire', onclick: ouvrirInventaire }),
    ]);

    if (run.phase === Run.PHASES.COMBAT && PROVISOIRE.combat.boutonTerminerLeTour) {
      bas.append(
        el('button', {
          class: 'discret',
          text: 'Terminer le tour',
          disabled: bloque,
          onclick: () => Run.terminerLeTour(run),
        })
      );
    }

    zoneActions.append(bas);
  }

  /* ---------------- montée de niveau ---------------- */

  function rendreModaleNiveau() {
    const necessaire = Run.attendUnChoixDeCompetence(run);

    if (!necessaire) {
      modaleNiveau?.remove();
      modaleNiveau = null;
      return;
    }

    modaleNiveau?.remove();

    const points = personnage.progression.pointsDisponibles;
    const cibles = ciblesDisponibles(personnage);

    modaleNiveau = el('div', { class: 'plein-ecran modale' }, [
      el('header', {}, [
        el('h2', { text: 'Niveau supérieur' }),
        el('span', { class: 'etiquette', text: `Niveau ${personnage.progression.niveau}` }),
      ]),
      el('p', {
        class: 'note',
        text: `${points} point${points > 1 ? 's' : ''} de compétence à attribuer. Le choix est nécessaire pour continuer.`,
      }),
      el('div', { class: 'liste-competences' }, cibles.map((c) =>
        el('button', { class: 'competence', onclick: () => Run.attribuerPoint(run, c.id) }, [
          el('span', {}, [
            el('strong', { text: c.nom }),
            el('small', { text: c.description ?? '' }),
          ]),
          el('span', { class: 'valeur-competence', text: c.valeur ? c.valeur(personnage) : '' }),
        ])
      )),
      el('p', {
        class: 'note',
        text: 'Aucune liste de compétences n’ayant été définie, les points vont aux statistiques existantes.',
      }),
    ]);

    document.body.append(modaleNiveau);
  }

  /* ---------------- inventaire ---------------- */

  function ouvrirInventaire() {
    if (inventaireOuvert) return;
    inventaireOuvert = vueInventaire({
      portage: personnage.portage,
      utilisableMaintenant,
      onUtiliser: (uid) => {
        Run.utiliserObjet(run, uid);
        fermerInventaire();
      },
      onJeter: (uid) => Run.jeterObjet(run, uid),
      onFermer: fermerInventaire,
    });
    document.body.append(inventaireOuvert);
    inventaireOuvert.monter();
  }

  function fermerInventaire() {
    if (!inventaireOuvert) return;
    inventaireOuvert.demonter();
    inventaireOuvert.remove();
    inventaireOuvert = null;
    rendre();
  }

  /* ---------------- boucle de rendu ---------------- */

  function rendre() {
    rendreVisuel();
    rendreJournal();
    rendreActions();
    rendreModaleNiveau();
    if (inventaireOuvert) inventaireOuvert.rafraichir();
  }

  run.onChangement = rendre;
  rendre();

  racine.demonter = () => {
    fermerInventaire();
    modaleNiveau?.remove();
    modaleNiveau = null;
  };
  return racine;
}

function detailCourt(def) {
  const a = def.action;
  if (a.des) return a.des;
  if (a.pv) return `+${a.pv} PV`;
  if (a.effet?.armure) return `+${a.effet.armure} armure`;
  if (a.effet?.degats) return `+${a.effet.degats} dégâts`;
  if (a.effet?.actions) return `+${a.effet.actions} action`;
  return '';
}
