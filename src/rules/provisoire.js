/**
 * provisoire.js — VALEURS NON VALIDÉES.
 *
 * Tout ce qui se trouve ici a dû être fixé pour que le prototype fonctionne,
 * mais n'a PAS été décidé. Rien n'est dispersé ailleurs : changer une valeur
 * ici suffit.
 *
 * QUESTIONS_OUVERTES est affiché dans l'écran Réglages.
 */

export const PROVISOIRE = {
  combat: {
    armureMode: 'soustraction',
    degatsMinimum: 0,
    joueurCommenceParDefaut: true,
    initiativeUtiliseeEnCombat: false,
    attaqueSansArme: { nom: 'Coup de poing', des: '1d2' },
    /** Bouton nécessaire techniquement dès qu'un tour compte plusieurs actions. */
    boutonTerminerLeTour: true,
  },

  effets: {
    /**
     * Portée retenue pour « au prochain tour » : l'effet est actif dès son
     * utilisation et jusqu'à la fin du tour de jeu suivant. Un bouclier
     * protège donc de la riposte immédiate.
     */
    dureeAuProchainTour: 1,
    /** Les actions supplémentaires ne sont lues qu'au début d'un tour. */
    actionsBonusAuTourSuivantUniquement: true,
  },

  loot: {
    poidsParRarete: {
      frequent: 60,
      commun: 25,
      peu_commun: 10,
      rare: 4,
      legendaire: 1,
      mythique: 0,
    },
    /**
     * Torche allumée. Valeurs décidées : 10 % de monter d'un cran de rareté
     * (sans jamais dépasser le plafond de la table), 25 % de trouver deux
     * objets au lieu d'un.
     */
    torche: { rareteSuperieure: 10, objetDouble: 25 },

    /** Décidé : l'objet qui ne rentre pas reste au sol et peut être repris. */
    siInventairePlein: 'laisser_au_sol',
  },

  objets: {
    /** Décidé : seuls les objets équipés ou en emplacement rapide agissent. */
    passifsActifsDansLInventaire: false,
    /** Un objet brisé garde-t-il ses passifs ? */
    passifsConservesSiBrise: true,
  },

  personnage: {
    /**
     * Lecture retenue de « démarrer avec 10 PV et 0 armure » : ces valeurs
     * correspondent aux statistiques par défaut (2 partout).
     */
    statsDeReference: 2,
    /** Un point de Santé gagné en montant de niveau soigne aussi du même montant. */
    monteeDeNiveauSoigne: true,
  },

  competences: {
    /**
     * Aucune liste de compétences n'a été définie. Les points de compétence
     * sont donc attribuables aux statistiques existantes, qui sont la seule
     * liste validée à ce jour. Le registre accepte d'autres entrées.
     */
    cibleParDefaut: 'statistiques',
  },
};

export const QUESTIONS_OUVERTES = [
  {
    sujet: 'Armure',
    question: "L'armure se soustrait-elle aux dégâts ? Une attaque peut-elle tomber à 0 ?",
    provisoire: 'Soustraction, plancher à 0.',
  },
  {
    sujet: 'PV et armure de base',
    question: '« 10 PV, 0 armure » correspond-il aux stats par défaut (2 partout), ou à des stats à 0 ?',
    provisoire: 'Aux stats par défaut.',
  },
  {
    sujet: 'Liste de compétences',
    question: "Aucune compétence n'est définie. Les points sont attribués aux 8 statistiques existantes.",
    provisoire: 'Les statistiques servent de liste, plafond 12.',
  },
  {
    sujet: 'Montée de niveau et Santé',
    question: 'Un point de Santé gagné en niveau soigne-t-il aussi le personnage, ou augmente-t-il seulement le maximum ?',
    provisoire: 'Il soigne du même montant.',
  },
  {
    sujet: '« Au prochain tour »',
    question: "Bouclier et potion de force : l'effet couvre-t-il la riposte immédiate, ou seulement le tour suivant ?",
    provisoire: 'Actif immédiatement et jusqu’à la fin du tour suivant.',
  },
  {
    sujet: 'Fin de tour',
    question: "Avec plusieurs actions par tour, un bouton « Terminer le tour » devient nécessaire. Non demandé.",
    provisoire: 'Bouton présent.',
  },
  {
    sujet: 'Toucher',
    question: 'Y a-t-il un jet pour toucher, ou toute attaque touche-t-elle ?',
    provisoire: 'Toute attaque touche.',
  },
  {
    sujet: 'Initiative',
    question: "« 10 % d'initiative » par point : 10 % de quoi ?",
    provisoire: "Stockée, sans effet en combat.",
  },
  {
    sujet: 'Probabilités de loot',
    question: "À l'intérieur d'une rareté maximale autorisée, quelle répartition ?",
    provisoire: 'Fréquent 60, Commun 25, Peu commun 10, Rare 4, Légendaire 1.',
  },
  {
    sujet: 'Races',
    question: "Aucune liste de races ni aucun effet n'est défini.",
    provisoire: 'Humain, Elfe, Nain, Orc — cosmétiques.',
  },
  {
    sujet: 'Statistiques inutilisées',
    question: "Intelligence, Perception, Courage et Charisme n'ont pas d'effet défini.",
    provisoire: 'Stockées, sans effet.',
  },
  {
    sujet: 'Arme utilisée',
    question: "Que se passe-t-il si le joueur n'a plus aucune arme ?",
    provisoire: 'Attaque de repli à 1d2.',
  },
  {
    sujet: 'Objet brisé',
    question:
      "Une arme brisée garde-t-elle ses passifs, ou devient-elle totalement inerte ?",
    provisoire: 'Elle garde ses passifs mais ne peut plus être utilisée.',
  },
  {
    sujet: 'Réparation',
    question:
      "Aucune forge, aucun PNJ, aucun matériau n'existe : qui répare, à quel coût, et le maximum est-il restauré entièrement ?",
    provisoire: 'La structure existe (reparer), aucune source en jeu.',
  },
  {
    sujet: 'Dos encombré',
    question:
      "Sac à dos, bouclier de dos et cape se disputaient l'emplacement Dos. Une cape a désormais son propre emplacement, mais sac et bouclier restent en concurrence.",
    provisoire: 'Sac et bouclier de dos restent exclusifs.',
  },
  {
    sujet: 'Torche et parchemin',
    question:
      "Tous deux occupent 2 cases et ne tiennent donc dans aucun emplacement rapide. Faut-il les réduire à 1 case, ou les rendre utilisables depuis le sac ?",
    provisoire: 'Ils ne sont pas utilisables sans main libre.',
  },
  {
    sujet: 'Emplacements rapides et coût',
    question:
      "Utiliser un objet de ceinture coûte-t-il une action de combat comme une attaque ?",
    provisoire: 'Oui, une action.',
  },
];
