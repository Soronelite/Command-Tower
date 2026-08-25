/**
 * dom.js — Aides minimales de construction du DOM.
 * Pas de framework : le jeu doit rester une webapp autonome et hors ligne.
 */

export function el(tag, attrs = {}, enfants = []) {
  const noeud = document.createElement(tag);
  for (const [cle, valeur] of Object.entries(attrs)) {
    if (valeur === null || valeur === undefined || valeur === false) continue;
    if (cle === 'class') noeud.className = valeur;
    else if (cle === 'text') noeud.textContent = valeur;
    else if (cle === 'html') noeud.innerHTML = valeur;
    else if (cle === 'style') Object.assign(noeud.style, valeur);
    else if (cle.startsWith('on')) noeud.addEventListener(cle.slice(2).toLowerCase(), valeur);
    else noeud.setAttribute(cle, valeur === true ? '' : valeur);
  }
  for (const enfant of [].concat(enfants)) {
    if (enfant === null || enfant === undefined || enfant === false) continue;
    noeud.append(enfant);
  }
  return noeud;
}

export function vider(noeud) {
  while (noeud.firstChild) noeud.removeChild(noeud.firstChild);
  return noeud;
}

/** Encadré de remplacement pour un visuel non fourni. */
export function visuelManquant(nom, icone = null) {
  return el('div', { class: 'cadre-visuel' }, [
    icone ? el('span', { class: 'ennemi', text: icone }) : null,
    el('span', { text: `<${nom}>` }),
  ]);
}
