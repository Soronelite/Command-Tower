/**
 * vue-inventaire.js — Inventaire plein écran.
 *
 * Trois zones : équipement, emplacements rapides de ceinture, sac.
 * Un objet se glisse librement d'une zone à l'autre.
 *
 * Le glissé est piloté par des écouteurs posés sur `window`, jamais sur le
 * nœud tiré : un re-rendu peut détruire ce nœud en cours de route, et les
 * événements suivants seraient alors perdus — c'est ce qui laissait un objet
 * fantôme en lévitation sur tous les écrans.
 */

import { el, vider } from './dom.js';
import { objet, estPivotable } from '../data/objets.js';
import { RARETE_PAR_ID } from '../data/personnage.js';
import { EMPLACEMENTS } from '../data/emplacements.js';
import * as Inv from '../systems/inventaire.js';
import * as Eq from '../systems/equipement.js';
import * as Portage from '../systems/portage.js';

const SEUIL_DEPLACEMENT = 6;

export function vueInventaire({ portage, onFermer, onUtiliser, onJeter, utilisableMaintenant }) {
  let selection = null;
  let confirmationJet = null;

  const zoneEquipement = el('div', { class: 'equipement' });
  const zoneCeinture = el('div', { class: 'ceinture-rapide' });
  const grille = el('div', { class: 'grille' });
  const fiche = el('div', { class: 'bloc fiche' });
  const message = el('p', { class: 'note' });

  const corps = el('div', { class: 'inv-corps' }, [
    zoneEquipement,
    el('h3', { class: 'sous-titre-inv', text: 'Emplacements rapides' }),
    zoneCeinture,
    el('h3', { class: 'sous-titre-inv', text: 'Sac' }),
    el('div', { class: 'grille-zone' }, [grille]),
    fiche,
    message,
  ]);

  const racine = el('div', { class: 'plein-ecran inventaire' }, [
    el('header', { class: 'inv-entete' }, [
      el('h2', { text: 'Équipement' }),
      el('span', { class: 'etiquette', id: 'inv-libre' }),
    ]),
    corps,
    el('div', { class: 'inv-pied' }, [
      el('button', { class: 'primaire', text: 'Fermer', onclick: onFermer }),
    ]),
  ]);

  function signaler(texte) {
    message.textContent = texte;
    clearTimeout(signaler.minuteur);
    signaler.minuteur = setTimeout(() => { message.textContent = ''; }, 2600);
  }

  const sac = () => portage.sac;

  /* ------------------------------------------------------------------ */
  /* Déplacement d'un objet vers une zone                                */
  /* ------------------------------------------------------------------ */

  function deposer(uid, cible) {
    let resultat;

    if (cible.zone === 'equipement') {
      resultat = Portage.equiper(portage, uid, cible.emplacementId);
    } else if (cible.zone === 'raccourci') {
      resultat = Portage.mettreEnRapide(portage, uid, cible.index);
    } else if (cible.zone === 'sac') {
      resultat = versLeSac(uid, cible);
    } else {
      return false;
    }

    if (!resultat.ok) {
      signaler(resultat.raison);
      return false;
    }
    for (const reste of resultat.expulses ?? []) {
      signaler(`${objet(reste.objetId).nom} ne rentre plus dans le sac.`);
    }
    return true;
  }

  /** Vers le sac : déplacement interne si l'objet y est déjà, sinon transfert. */
  function versLeSac(uid, cible) {
    const position = Portage.localiser(portage, uid);
    if (!position) return { ok: false, raison: 'Objet introuvable.' };

    if (position.zone === 'sac') {
      const slot = position.slot;
      const ok = cible.x === undefined
        ? true
        : Inv.deplacer(sac(), uid, cible.x, cible.y, slot.pivote);
      return ok ? { ok: true } : { ok: false, raison: 'Pas de place à cet endroit.' };
    }

    const instance = position.instance;
    const place = cible.x === undefined
      ? Inv.trouverPlace(sac(), instance.objetId)
      : (Inv.peutPlacer(sac(), instance.objetId, cible.x, cible.y, false)
          ? { x: cible.x, y: cible.y, pivote: false }
          : Inv.trouverPlace(sac(), instance.objetId));

    if (!place) return { ok: false, raison: 'Le sac est plein.' };

    Portage.extraire(portage, uid);
    Inv.poser(sac(), instance, place.x, place.y, place.pivote);
    const expulses = Portage.resynchroniser(portage);
    return { ok: true, expulses };
  }

  /* ------------------------------------------------------------------ */
  /* Rendu                                                               */
  /* ------------------------------------------------------------------ */

  function rendreEquipement() {
    vider(zoneEquipement);

    for (const emplacement of EMPLACEMENTS) {
      const instance = portage.equipement[emplacement.id];
      const grisee = Eq.mainGrisee(portage.equipement, emplacement.id);
      const def = instance ? objet(instance.objetId) : null;

      const noeud = el(
        'div',
        {
          class: `slot${instance ? ' rempli' : ''}${grisee ? ' grise' : ''}` +
                 `${selection === instance?.uid ? ' selectionne' : ''}`,
          role: 'button',
          tabindex: '0',
          'data-zone': 'equipement',
          'data-emplacement': emplacement.id,
          title: grisee ? 'Occupée par une arme à deux mains' : emplacement.nom,
        },
        [
          el('span', { class: 'slot-nom', text: emplacement.nom }),
          el('span', { class: 'slot-icone', text: def ? def.icone : emplacement.icone }),
          el('span', {
            class: 'slot-objet',
            text: grisee ? '— deux mains —' : def ? def.nom : 'vide',
          }),
          instance?.brise ? el('span', { class: 'brise', text: 'BRISÉ' }) : null,
        ]
      );

      if (instance && !grisee) {
        noeud.addEventListener('pointerdown', (e) =>
          commencer(e, instance, noeud, { zone: 'equipement', emplacementId: emplacement.id })
        );
      } else if (!grisee) {
        noeud.addEventListener('click', () => {
          if (selection && deposer(selection, { zone: 'equipement', emplacementId: emplacement.id })) {
            selection = null;
          }
          rendre();
        });
      }
      zoneEquipement.append(noeud);
    }
  }

  function rendreCeinture() {
    vider(zoneCeinture);

    if (portage.raccourcis.length === 0) {
      zoneCeinture.append(
        el('p', { class: 'note', text: 'Aucune ceinture équipée : aucun emplacement rapide.' })
      );
      return;
    }

    portage.raccourcis.forEach((emplacement, index) => {
      const instance = emplacement.contenu;
      const def = instance ? objet(instance.objetId) : null;

      const noeud = el(
        'div',
        {
          class: `rapide${instance ? ' rempli' : ''}${emplacement.type === 'potion' ? ' potion' : ''}` +
                 `${selection === instance?.uid ? ' selectionne' : ''}`,
          role: 'button',
          tabindex: '0',
          'data-zone': 'raccourci',
          'data-index': String(index),
          title: emplacement.type === 'potion' ? 'Potions uniquement' : 'Emplacement rapide',
        },
        [
          el('span', {
            class: 'slot-icone',
            text: def ? def.icone : emplacement.type === 'potion' ? '⚗️' : '+',
          }),
          el('span', { class: 'slot-objet', text: def ? def.nom : 'vide' }),
        ]
      );

      if (instance) {
        noeud.addEventListener('pointerdown', (e) =>
          commencer(e, instance, noeud, { zone: 'raccourci', index })
        );
      } else {
        noeud.addEventListener('click', () => {
          if (selection && deposer(selection, { zone: 'raccourci', index })) selection = null;
          rendre();
        });
      }
      zoneCeinture.append(noeud);
    });
  }

  function tailleCase() {
    const rect = grille.getBoundingClientRect();
    return (rect.width - 4 * (sac().largeur + 1)) / sac().largeur;
  }

  function positionner(noeud, slot) {
    const f = Inv.forme(slot.objetId, slot.pivote);
    const c = tailleCase();
    noeud.style.left = `${4 + slot.x * (c + 4)}px`;
    noeud.style.top = `${4 + slot.y * (c + 4)}px`;
    noeud.style.width = `${f.l * c + (f.l - 1) * 4}px`;
    noeud.style.height = `${f.h * c + (f.h - 1) * 4}px`;
  }

  function rendreSac() {
    vider(grille);
    grille.style.gridTemplateColumns = `repeat(${sac().largeur}, 1fr)`;
    grille.style.gridTemplateRows = `repeat(${sac().hauteur}, 1fr)`;

    for (let i = 0; i < sac().largeur * sac().hauteur; i++) {
      grille.append(el('div', { class: 'case' }));
    }

    for (const slot of sac().contenu) {
      const def = objet(slot.objetId);
      const noeud = el(
        'div',
        {
          class: `objet${selection === slot.uid ? ' selectionne' : ''}${slot.brise ? ' brise-fond' : ''}`,
          'data-uid': slot.uid,
          title: def.nom,
        },
        [
          el('span', { class: 'icone', text: def.icone }),
          el('span', { class: 'nom', text: def.nom }),
        ]
      );
      noeud.addEventListener('pointerdown', (e) => commencer(e, slot, noeud, { zone: 'sac' }));
      grille.append(noeud);
      positionner(noeud, slot);
    }

    const libres = Inv.casesLibres(sac());
    racine.querySelector('#inv-libre').textContent =
      `sac ${sac().largeur}×${sac().hauteur} — ${libres} libre${libres > 1 ? 's' : ''}`;
  }

  /* ------------------------------------------------------------------ */
  /* Fiche                                                               */
  /* ------------------------------------------------------------------ */

  function rendreFiche() {
    vider(fiche);
    const position = selection ? Portage.localiser(portage, selection) : null;

    if (!position) {
      fiche.append(
        el('p', { class: 'vide', text: 'Touche un objet, ou glisse-le d’une zone à l’autre.' })
      );
      return;
    }

    const instance = position.instance ?? position.slot;
    const def = objet(instance.objetId);
    const rarete = RARETE_PAR_ID[def.rarete];

    fiche.append(
      el('div', { class: 'titre' }, [
        el('span', { class: 'icone', text: def.icone }),
        el('strong', { text: def.nom }),
        el('span', { class: 'rarete', style: { color: rarete.couleur }, text: rarete.nom }),
      ]),
      el('p', { class: 'detail', text: decrire(def, instance, position) })
    );

    const actions = el('div', { class: 'rangee' });

    if (def.action && !instance.brise) {
      const permis = utilisableMaintenant(def, position);
      actions.append(
        el('button', {
          class: permis ? 'primaire' : '',
          text: def.action.verbe,
          disabled: !permis,
          onclick: () => onUtiliser(instance.uid),
        })
      );
    }

    if (position.zone !== 'equipement') {
      for (const emplacement of EMPLACEMENTS) {
        if (!emplacement.accepte.includes(def.port)) continue;
        if (portage.equipement[emplacement.id]) continue;
        if (Eq.mainGrisee(portage.equipement, emplacement.id)) continue;
        actions.append(
          el('button', {
            text: `→ ${emplacement.nom}`,
            onclick: () => {
              if (deposer(instance.uid, { zone: 'equipement', emplacementId: emplacement.id })) {
                selection = null;
              }
              rendre();
            },
          })
        );
      }
    }

    // Vers la ceinture : premier emplacement rapide compatible et libre.
    if (position.zone !== 'raccourci') {
      const libre = portage.raccourcis.findIndex(
        (e, i) => !e.contenu && Eq.peutMettreEnRapide(e.type, instance.objetId).ok
      );
      if (libre !== -1) {
        actions.append(
          el('button', {
            text: '→ Ceinture',
            onclick: () => {
              if (deposer(instance.uid, { zone: 'raccourci', index: libre })) selection = null;
              rendre();
            },
          })
        );
      }
    }

    if (position.zone !== 'sac') {
      actions.append(
        el('button', {
          text: '→ Sac',
          onclick: () => {
            if (deposer(instance.uid, { zone: 'sac' })) selection = null;
            rendre();
          },
        })
      );
    }

    if (position.zone === 'sac' && estPivotable(def)) {
      actions.append(
        el('button', {
          text: 'Pivoter',
          onclick: () => {
            if (!Inv.pivoter(sac(), instance.uid)) signaler('Pas assez de place pour pivoter.');
            rendre();
          },
        })
      );
    }

    if (onJeter) {
      const aConfirmer = confirmationJet === instance.uid;
      actions.append(
        el('button', {
          class: aConfirmer ? 'danger' : '',
          text: aConfirmer ? `Confirmer : détruire ${def.nom}` : 'Jeter',
          onclick: () => {
            if (!aConfirmer) {
              confirmationJet = instance.uid;
              rendreFiche();
              return;
            }
            confirmationJet = null;
            selection = null;
            onJeter(instance.uid);
            rendre();
          },
        })
      );
    }

    if (actions.children.length) fiche.append(actions);
  }

  /* ------------------------------------------------------------------ */
  /* Glissé, toutes zones                                                */
  /* ------------------------------------------------------------------ */

  let drag = null;

  function commencer(evenement, instance, noeud, origine) {
    if (evenement.button !== undefined && evenement.button !== 0) return;
    evenement.preventDefault();
    annulerDrag();

    const rect = noeud.getBoundingClientRect();
    drag = {
      uid: instance.uid,
      objetId: instance.objetId,
      pivote: instance.pivote ?? false,
      origine,
      depart: { x: evenement.clientX, y: evenement.clientY },
      decalage: { x: evenement.clientX - rect.left, y: evenement.clientY - rect.top },
      taille: { l: rect.width, h: rect.height },
      apercu: noeud.cloneNode(true),
      noeud,
      actif: false,
      flottant: null,
    };

    // Écouteurs sur window : le nœud d'origine peut disparaître à tout moment.
    window.addEventListener('pointermove', bouger);
    window.addEventListener('pointerup', relacher);
    window.addEventListener('pointercancel', annulerDrag);
    window.addEventListener('blur', annulerDrag);
  }

  function bouger(evenement) {
    if (!drag) return;
    const dx = evenement.clientX - drag.depart.x;
    const dy = evenement.clientY - drag.depart.y;
    if (!drag.actif && Math.hypot(dx, dy) < SEUIL_DEPLACEMENT) return;

    if (!drag.actif) {
      drag.actif = true;
      drag.noeud.classList.add('fantome');
      const clone = drag.apercu;
      clone.classList.remove('fantome', 'selectionne');
      clone.classList.add('objet-flottant');
      clone.style.width = `${drag.taille.l}px`;
      clone.style.height = `${drag.taille.h}px`;
      document.body.append(clone);
      drag.flottant = clone;
    }

    drag.flottant.style.left = `${evenement.clientX - drag.decalage.x}px`;
    drag.flottant.style.top = `${evenement.clientY - drag.decalage.y}px`;
    surligner(evenement);
  }

  /** Zone survolée, d'après l'élément sous le curseur. */
  function cibleSous(evenement) {
    const rectGrille = grille.getBoundingClientRect();
    const dansGrille =
      evenement.clientX >= rectGrille.left && evenement.clientX <= rectGrille.right &&
      evenement.clientY >= rectGrille.top && evenement.clientY <= rectGrille.bottom;

    if (dansGrille) {
      const c = tailleCase();
      return {
        zone: 'sac',
        x: Math.round((evenement.clientX - drag.decalage.x - rectGrille.left - 4) / (c + 4)),
        y: Math.round((evenement.clientY - drag.decalage.y - rectGrille.top - 4) / (c + 4)),
      };
    }

    const sous = document.elementFromPoint(evenement.clientX, evenement.clientY);
    const hote = sous?.closest('[data-zone]');
    if (!hote) return null;

    if (hote.dataset.zone === 'equipement') {
      return { zone: 'equipement', emplacementId: hote.dataset.emplacement, noeud: hote };
    }
    if (hote.dataset.zone === 'raccourci') {
      return { zone: 'raccourci', index: Number(hote.dataset.index), noeud: hote };
    }
    return null;
  }

  function surligner(evenement) {
    for (const c of grille.querySelectorAll('.case')) c.classList.remove('cible-ok', 'cible-non');
    for (const s of racine.querySelectorAll('[data-zone]')) s.classList.remove('survole', 'refuse');

    const cible = cibleSous(evenement);
    if (!cible) return;

    if (cible.zone === 'sac') {
      const cellules = grille.querySelectorAll('.case');
      const interne = drag.origine.zone === 'sac';
      const possible = Inv.peutPlacer(
        sac(), drag.objetId, cible.x, cible.y, drag.pivote, interne ? drag.uid : null
      );
      const f = Inv.forme(drag.objetId, drag.pivote);
      for (let dy = 0; dy < f.h; dy++) {
        for (let dx = 0; dx < f.l; dx++) {
          const cx = cible.x + dx;
          const cy = cible.y + dy;
          if (cx < 0 || cy < 0 || cx >= sac().largeur || cy >= sac().hauteur) continue;
          cellules[cy * sac().largeur + cx]?.classList.add(possible ? 'cible-ok' : 'cible-non');
        }
      }
      return;
    }

    const verdict = cible.zone === 'equipement'
      ? Eq.peutEquiper(portage.equipement, drag.objetId, cible.emplacementId)
      : Eq.peutMettreEnRapide(portage.raccourcis[cible.index]?.type, drag.objetId);
    cible.noeud.classList.add(verdict.ok ? 'survole' : 'refuse');
  }

  function relacher(evenement) {
    if (!drag) return;
    const { uid, actif } = drag;
    const cible = actif ? cibleSous(evenement) : null;

    nettoyer();

    if (!actif) {
      selection = selection === uid ? null : uid;
    } else if (cible) {
      if (deposer(uid, cible)) selection = null;
    }
    rendre();
  }

  function annulerDrag() {
    if (!drag) return;
    nettoyer();
    rendre();
  }

  /** Retire le fantôme et TOUS les écouteurs, quoi qu'il arrive. */
  function nettoyer() {
    if (!drag) return;
    drag.flottant?.remove();
    drag.noeud?.classList.remove('fantome');
    drag = null;

    window.removeEventListener('pointermove', bouger);
    window.removeEventListener('pointerup', relacher);
    window.removeEventListener('pointercancel', annulerDrag);
    window.removeEventListener('blur', annulerDrag);

    for (const c of grille.querySelectorAll('.case')) c.classList.remove('cible-ok', 'cible-non');
    for (const s of racine.querySelectorAll('[data-zone]')) s.classList.remove('survole', 'refuse');
    // Filet de sécurité : aucun fantôme ne doit survivre.
    for (const f of document.querySelectorAll('.objet-flottant')) f.remove();
  }

  /* ------------------------------------------------------------------ */

  function ajusterTaille() {
    const largeurDispo = Math.min(corps.clientWidth - 8, 20 * 16);
    if (largeurDispo <= 0) return;
    grille.style.width = `${largeurDispo}px`;
    grille.style.height = `${largeurDispo * (sac().hauteur / sac().largeur)}px`;
    for (const noeud of grille.querySelectorAll('.objet')) {
      const slot = Inv.trouver(sac(), noeud.dataset.uid);
      if (slot) positionner(noeud, slot);
    }
  }

  function rendre() {
    rendreEquipement();
    rendreCeinture();
    rendreSac();
    rendreFiche();
    ajusterTaille();
  }

  const observer = new ResizeObserver(ajusterTaille);
  racine.monter = () => { rendre(); observer.observe(corps); };
  racine.demonter = () => { nettoyer(); observer.disconnect(); };
  racine.rafraichir = rendre;

  return racine;
}

function decrire(def, instance, position) {
  const morceaux = [];

  if (def.action?.des) morceaux.push(`${def.action.des} dégâts`);
  if (def.action?.pv) morceaux.push(`rend ${def.action.pv} PV`);
  if (def.passif?.armure) morceaux.push(`+${def.passif.armure} armure`);
  if (def.passif?.pvMax) morceaux.push(`+${def.passif.pvMax} PV maximum`);
  if (def.passif?.bonusJet) morceaux.push(`+${def.passif.bonusJet} aux jets`);
  if (def.passif?.initiative) morceaux.push(`+${def.passif.initiative} initiative`);
  if (def.ceinture) {
    const p = def.ceinture;
    morceaux.push(
      `${p.rapides} rapide${p.rapides > 1 ? 's' : ''}` +
      (p.rapidesPotion ? ` + ${p.rapidesPotion} potions` : '')
    );
  }
  if (def.sac) morceaux.push(`sac ${def.sac.largeur}×${def.sac.hauteur}`);
  if (def.mains === 2) morceaux.push('deux mains');

  if (def.usure) {
    morceaux.push(
      instance.brise
        ? 'BRISÉ'
        : `${instance.utilisations}/${def.usure.max} utilisations` +
          (def.usure.reparable === false ? ' — irréparable' : '')
    );
  }

  const f = def.forme;
  morceaux.push(f.l === 1 && f.h === 1 ? '1 case' : `${f.l * f.h} cases (${f.l}×${f.h})`);
  if (position.zone === 'sac') morceaux.push('dans le sac : passifs inactifs');

  return morceaux.join(' · ');
}
