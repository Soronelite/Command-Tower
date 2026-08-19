/*
 * Service Worker — Command Tower
 * --------------------------------------------------------------
 * Stratégie de cache :
 *  - Fichiers de l'app shell (HTML, manifest, icônes) précachés
 *    à l'installation pour un fonctionnement 100% hors-ligne.
 *  - Page HTML (navigation) : "network-first, fallback cache".
 *    → l'utilisateur reçoit toujours la dernière version quand il
 *      est en ligne, et l'app reste utilisable hors-ligne grâce
 *      à la copie mise en cache lors de la dernière visite.
 *  - Autres fichiers précachés (manifest, icônes) : "cache-first,
 *    fallback network", car ils changent rarement.
 *
 * Pour publier une mise à jour de l'app : incrémentez CACHE_VERSION
 * ci-dessous. Un nouveau cache sera créé et l'ancien sera supprimé
 * automatiquement à l'activation.
 * --------------------------------------------------------------
 */

const CACHE_VERSION = "v1";
const CACHE_NAME = `command-tower-${CACHE_VERSION}`;

// Chemin du document principal de l'app (doit rester cohérent avec
// "start_url" dans manifest.json).
const APP_SHELL_URL = "./mtg-compagnon.html";

// Fichiers mis en cache dès l'installation du service worker.
const PRECACHE_URLS = [
  APP_SHELL_URL,
  "./manifest.json",
  "./icons/icon-72.png",
  "./icons/icon-96.png",
  "./icons/icon-128.png",
  "./icons/icon-144.png",
  "./icons/icon-152.png",
  "./icons/icon-192.png",
  "./icons/icon-384.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
  "./icons/favicon-16.png"
];

/* ---------------------------------------------------------------
   Installation : on précache l'app shell.
--------------------------------------------------------------- */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

/* ---------------------------------------------------------------
   Activation : on supprime les anciens caches (versions précédentes).
--------------------------------------------------------------- */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("command-tower-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ---------------------------------------------------------------
   Fetch : deux stratégies selon le type de requête.
--------------------------------------------------------------- */
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // On ne gère que les requêtes GET (les autres passent au réseau normalement).
  if (request.method !== "GET") return;

  // Requêtes de navigation (chargement de la page) : network-first.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseCopy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(APP_SHELL_URL, responseCopy));
          return response;
        })
        .catch(() => caches.match(APP_SHELL_URL))
    );
    return;
  }

  // Autres fichiers (icônes, manifest, etc.) : cache-first.
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request)
        .then((response) => {
          // On ne met en cache que les réponses valides et de même origine.
          if (response && response.ok && response.type === "basic") {
            const responseCopy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseCopy));
          }
          return response;
        })
        .catch(() => cachedResponse);
    })
  );
});
