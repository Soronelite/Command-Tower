/**
 * equipement.test.js — Emplacements, mains, ceinture, sac et usure.
 */

import { suite, expect } from './harness.js';
import { statsParDefaut } from '../src/rules/stats.js';
import { creerPersonnage, armureTotale, pvMaxTotal, initiativeTotale } from '../src/systems/personnage.js';
import * as Inv from '../src/systems/inventaire.js';
import * as Eq from '../src/systems/equipement.js';
import * as Portage from '../src/systems/portage.js';
import { objet, OBJETS } from '../src/data/objets.js';
import { EMPLACEMENTS } from '../src/data/emplacements.js';

const heros = () =>
  creerPersonnage({
    nom: 'Test', race: 'humain', sexe: 'homme', classe: 'chevalier',
    stats: statsParDefaut(),
  });

const nu = () => Portage.creerPortage();

/* ------------------------------------------------------------------ */

suite('Emplacements', ({ test }) => {
  test('les onze emplacements existent, cape comprise', () => {
    const ids = EMPLACEMENTS.map((e) => e.id);
    expect(ids).toEqual([
      'tete', 'armure', 'mainGauche', 'mainDroite', 'ceinture',
      'dos', 'cape', 'bijou1', 'bijou2', 'bijou3',
    ]);
  });

  test('un casque ne va pas sur la ceinture', () => {
    const p = nu();
    const uid = Inv.ajouter(p.sac, 'casque_fer').uid;
    expect(Portage.equiper(p, uid, 'ceinture').ok).toBe(false);
  });

  test('trois bijoux peuvent être portés en même temps', () => {
    const p = nu();
    Portage.equiper(p, Inv.ajouter(p.sac, 'anneau_vigueur').uid, 'bijou1');
    Portage.equiper(p, Inv.ajouter(p.sac, 'amulette_chance').uid, 'bijou2');
    Portage.equiper(p, Inv.ajouter(p.sac, 'broche_veteran').uid, 'bijou3');
    expect(Eq.objetsEquipes(p.equipement).length).toBe(3);
  });

  test('un bouclier va en main ou dans le dos', () => {
    const p = nu();
    const uid = Inv.ajouter(p.sac, 'bouclier_bois').uid;
    expect(Portage.equiper(p, uid, 'dos').ok).toBe(true);
    expect(Portage.equiper(p, uid, 'mainDroite').ok).toBe(true);
  });
});

/* ------------------------------------------------------------------ */

suite('Mains et armes à deux mains', ({ test }) => {
  test('une arme à deux mains exige les deux mains libres', () => {
    const p = nu();
    Portage.equiper(p, Inv.ajouter(p.sac, 'dague').uid, 'mainGauche');
    // Le sac par défaut fait 2×2 : l'épée 1×4 n'y tient pas, on la crée à part.
    const epee = Eq.instancier('epee_deux_mains');
    p.equipement.mainDroite = null;
    const verdict = Eq.peutEquiper(p.equipement, epee.objetId, 'mainDroite');
    expect(verdict.ok).toBe(false);
  });

  test('elle passe si les deux mains sont libres', () => {
    const p = nu();
    expect(Eq.peutEquiper(p.equipement, 'epee_deux_mains', 'mainDroite').ok).toBe(true);
  });

  test('elle grise l’autre main', () => {
    const p = nu();
    p.equipement.mainDroite = Eq.instancier('epee_deux_mains');
    expect(Eq.deuxMainsOccupees(p.equipement)).toBe(true);
    expect(Eq.mainGrisee(p.equipement, 'mainGauche')).toBe(true);
  });

  test('rien ne peut aller dans la main grisée', () => {
    const p = nu();
    p.equipement.mainDroite = Eq.instancier('epee_deux_mains');
    expect(Eq.peutEquiper(p.equipement, 'dague', 'mainGauche').ok).toBe(false);
  });

  test('une arme à une main n’occupe qu’une main', () => {
    const p = nu();
    Portage.equiper(p, Inv.ajouter(p.sac, 'dague').uid, 'mainGauche');
    expect(Eq.mainGrisee(p.equipement, 'mainDroite')).toBe(false);
  });
});

/* ------------------------------------------------------------------ */

suite('Sac à dos', ({ test }) => {
  test('sans sac la grille fait 2 sur 2', () => {
    expect(Eq.tailleDuSac(nu().equipement)).toEqual({ largeur: 2, hauteur: 2 });
  });

  test('un sac à dos porte la grille à 4 sur 4', () => {
    const p = nu();
    p.equipement.dos = Eq.instancier('sac_a_dos');
    Portage.resynchroniser(p);
    expect(p.sac.largeur).toBe(4);
    expect(p.sac.hauteur).toBe(4);
  });

  test('retirer le sac rend les objets qui ne rentrent plus', () => {
    const p = nu();
    p.equipement.dos = Eq.instancier('sac_a_dos');
    Portage.resynchroniser(p);
    for (let i = 0; i < 6; i++) Inv.ajouter(p.sac, 'dague');
    expect(p.sac.contenu.length).toBe(6);

    p.equipement.dos = null;
    const restants = Portage.resynchroniser(p);
    expect(p.sac.contenu.length).toBe(4);
    expect(restants.length).toBe(2);
  });

  test('aucun objet n’est détruit en silence lors du redimensionnement', () => {
    const inv = Inv.creerInventaire(4, 4);
    for (let i = 0; i < 5; i++) Inv.ajouter(inv, 'dague');
    const expulses = Inv.redimensionner(inv, 2, 2);
    expect(inv.contenu.length + expulses.length).toBe(5);
  });
});

/* ------------------------------------------------------------------ */

suite('Ceinture et emplacements rapides', ({ test }) => {
  test('la ceinture de corde ouvre 2 emplacements', () => {
    const p = nu();
    p.equipement.ceinture = Eq.instancier('ceinture_corde');
    Portage.resynchroniser(p);
    expect(p.raccourcis.length).toBe(2);
  });

  test('la ceinture d’apothicaire ouvre 3 libres et 2 potions', () => {
    const p = nu();
    p.equipement.ceinture = Eq.instancier('ceinture_apothicaire');
    Portage.resynchroniser(p);
    expect(p.raccourcis.map((e) => e.type)).toEqual([
      'libre', 'libre', 'libre', 'potion', 'potion',
    ]);
  });

  test('la ceinture de plaque apporte aussi son armure', () => {
    const p = nu();
    Portage.equiper(p, Inv.ajouter(p.sac, 'ceinture_plaque').uid, 'ceinture');
    expect(Portage.passif(p, 'armure')).toBe(2);
  });

  test('un emplacement potion refuse le pain', () => {
    const p = nu();
    p.equipement.ceinture = Eq.instancier('ceinture_apothicaire');
    Portage.resynchroniser(p);
    const uid = Inv.ajouter(p.sac, 'pain_rassis').uid;
    expect(Portage.mettreEnRapide(p, uid, 3).ok).toBe(false);
    expect(Portage.mettreEnRapide(p, uid, 0).ok).toBe(true);
  });

  test('un emplacement potion accepte une potion', () => {
    const p = nu();
    p.equipement.ceinture = Eq.instancier('ceinture_apothicaire');
    Portage.resynchroniser(p);
    const uid = Inv.ajouter(p.sac, 'potion_soin').uid;
    expect(Portage.mettreEnRapide(p, uid, 3).ok).toBe(true);
  });

  test('un objet de plus d’une case ne tient pas en emplacement rapide', () => {
    const p = nu();
    p.equipement.ceinture = Eq.instancier('ceinture_cuir');
    Portage.resynchroniser(p);
    // La torche fait 1×2 : elle ne tient pas en emplacement rapide.
    const uid = Inv.ajouter(p.sac, 'torche').uid;
    expect(Portage.mettreEnRapide(p, uid, 0).ok).toBe(false);
  });

  test('le parchemin tient désormais en emplacement rapide', () => {
    const p = nu();
    p.equipement.ceinture = Eq.instancier('ceinture_cuir');
    Portage.resynchroniser(p);
    const uid = Inv.ajouter(p.sac, 'parchemin_boule_feu').uid;
    expect(Portage.mettreEnRapide(p, uid, 0).ok).toBe(true);
  });

  test('changer pour une ceinture plus courte rend le surplus', () => {
    const p = nu();
    p.equipement.dos = Eq.instancier('sac_a_dos');
    p.equipement.ceinture = Eq.instancier('ceinture_cuir');
    Portage.resynchroniser(p);
    for (let i = 0; i < 3; i++) {
      Portage.mettreEnRapide(p, Inv.ajouter(p.sac, 'potion_soin').uid, i);
    }
    p.equipement.ceinture = Eq.instancier('ceinture_corde');
    Portage.resynchroniser(p);
    expect(p.raccourcis.length).toBe(2);
    expect(p.sac.contenu.length).toBe(1);
  });
});

/* ------------------------------------------------------------------ */

suite('Seul ce qui est porté agit', ({ test }) => {
  test('le contenu du sac n’est pas utilisable', () => {
    const p = heros();
    Inv.ajouter(p.portage.sac, 'potion_soin');
    const utilisables = Portage.actionsDisponibles(p.portage).map((a) => a.instance.objetId);
    expect(utilisables.includes('potion_soin')).toBe(false);
  });

  test('le pain en emplacement rapide est utilisable', () => {
    const p = heros();
    const utilisables = Portage.actionsDisponibles(p.portage).map((a) => a.instance.objetId);
    expect(utilisables.includes('pain_rassis')).toBe(true);
  });

  test('un bouclier dans le dos donne son armure mais pas le blocage', () => {
    const p = nu();
    Portage.equiper(p, Inv.ajouter(p.sac, 'bouclier_bois').uid, 'dos');
    expect(Portage.passif(p, 'armure')).toBe(2);
    const actions = Portage.actionsDisponibles(p).map((a) => a.instance.objetId);
    expect(actions.includes('bouclier_bois')).toBe(false);
  });

  test('le même bouclier en main permet le blocage', () => {
    const p = nu();
    Portage.equiper(p, Inv.ajouter(p.sac, 'bouclier_bois').uid, 'mainDroite');
    const actions = Portage.actionsDisponibles(p).map((a) => a.instance.objetId);
    expect(actions.includes('bouclier_bois')).toBe(true);
  });

  test('la broche du vétéran donne armure et initiative', () => {
    const p = heros();
    const avantArmure = armureTotale(p);
    const avantInit = initiativeTotale(p);
    Portage.equiper(p.portage, Inv.ajouter(p.portage.sac, 'broche_veteran').uid, 'bijou1');
    expect(armureTotale(p)).toBe(avantArmure + 1);
    expect(initiativeTotale(p)).toBe(avantInit + 1);
  });

  test('l’anneau de vigueur n’agit qu’une fois équipé', () => {
    const p = heros();
    const base = pvMaxTotal(p);
    const uid = Inv.ajouter(p.portage.sac, 'anneau_vigueur').uid;
    expect(pvMaxTotal(p)).toBe(base);
    Portage.equiper(p.portage, uid, 'bijou1');
    expect(pvMaxTotal(p)).toBe(base + 2);
  });
});

/* ------------------------------------------------------------------ */

suite('Usure', ({ test }) => {
  test('chaque objet usable annonce son maximum', () => {
    expect(objet('epee_deux_mains').usure.max).toBe(50);
    expect(objet('epee_courte').usure.max).toBe(40);
    expect(objet('dague').usure.max).toBe(30);
  });

  test('une instance neuve est à son maximum', () => {
    expect(Eq.instancier('epee_courte').utilisations).toBe(40);
  });

  test('une arme se brise à zéro et reste en place', () => {
    const instance = Eq.instancier('dague');
    for (let i = 0; i < 29; i++) Eq.user(instance);
    expect(instance.brise).toBe(false);
    const etat = Eq.user(instance);
    expect(etat.brise).toBe(true);
    expect(etat.detruit).toBe(false);
    expect(instance.brise).toBe(true);
  });

  test('un consommable est détruit et non brisé', () => {
    const instance = Eq.instancier('potion_soin');
    const etat = Eq.user(instance);
    expect(etat.detruit).toBe(true);
    expect(etat.brise).toBe(false);
  });

  test('une arme brisée n’est plus utilisable', () => {
    const p = nu();
    const slot = Inv.ajouter(p.sac, 'dague');
    Portage.equiper(p, slot.uid, 'mainDroite');
    const instance = p.equipement.mainDroite;
    for (let i = 0; i < 30; i++) Eq.user(instance);
    expect(Portage.actionsDisponibles(p).length).toBe(0);
  });

  test('la réparation restaure le maximum', () => {
    const instance = Eq.instancier('epee_courte');
    for (let i = 0; i < 40; i++) Eq.user(instance);
    expect(Eq.reparer(instance)).toBe(true);
    expect(instance.utilisations).toBe(40);
    expect(instance.brise).toBe(false);
  });

  test('la lame mythique est irréparable', () => {
    const instance = Eq.instancier('lame_serments_rompus');
    expect(instance.utilisations).toBe(25);
    expect(Eq.reparer(instance)).toBe(false);
  });

  test('la lame mythique se recharge sur les victoires', () => {
    const instance = Eq.instancier('lame_serments_rompus');
    for (let i = 0; i < 10; i++) Eq.user(instance);
    expect(instance.utilisations).toBe(15);
    expect(Eq.rechargerSurVictoire(instance)).toBe(5);
    expect(instance.utilisations).toBe(20);
  });

  test('la recharge ne dépasse pas le maximum', () => {
    const instance = Eq.instancier('lame_serments_rompus');
    Eq.user(instance);
    expect(Eq.rechargerSurVictoire(instance)).toBe(1);
    expect(instance.utilisations).toBe(25);
  });

  test('une armure ne s’use pas', () => {
    const instance = Eq.instancier('casque_fer');
    expect(instance.utilisations).toBe(null);
    expect(Eq.user(instance).use).toBe(false);
  });
});

/* ------------------------------------------------------------------ */

suite('Catalogue', ({ test }) => {
  test('les vingt-quatre objets sont définis', () => {
    expect(OBJETS.length).toBe(24);
  });

  test('les quatre ceintures existent avec leurs emplacements', () => {
    expect(objet('ceinture_corde').ceinture.rapides).toBe(2);
    expect(objet('ceinture_cuir').ceinture.rapides).toBe(3);
    expect(objet('ceinture_plaque').ceinture.rapides).toBe(2);
    expect(objet('ceinture_apothicaire').ceinture.rapidesPotion).toBe(2);
  });

  test('les ceintures ne prennent qu’une case', () => {
    for (const id of ['ceinture_corde', 'ceinture_cuir', 'ceinture_plaque', 'ceinture_apothicaire']) {
      expect(objet(id).forme).toEqual({ l: 1, h: 1 });
    }
  });

  test('la lame des serments rompus est mythique et frappe en 3d6', () => {
    const def = objet('lame_serments_rompus');
    expect(def.rarete).toBe('mythique');
    expect(def.action.des).toBe('3d6');
    expect(def.mains).toBe(2);
  });

  test('chaque objet équipable déclare un emplacement valide', () => {
    const ports = new Set(EMPLACEMENTS.flatMap((e) => e.accepte));
    for (const def of OBJETS) {
      if (!def.port) continue;
      expect(ports.has(def.port)).toBe(true);
    }
  });

  test('tout objet à action déclare un coût en actions', () => {
    for (const def of OBJETS) {
      if (!def.action) continue;
      expect(typeof def.action.cout).toBe('number');
    }
  });
});
