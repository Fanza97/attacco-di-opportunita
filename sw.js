// Programma per l'uso offline di Attacco di Opportunità (service worker).
// Alla prima apertura salva l'app sul dispositivo; dopo si apre anche senza internet. Quando sul sito c'è una versione
// nuova la scarica, ma la mette in uso solo quando chi gioca sceglie "Aggiorna" (così non cambia a metà sessione).
// Riceve anche le schede condivise da altre app (menu "Condividi" di Android) e le passa all'app.

// Versione e impronta della pagina, scritte dalla compilazione: cambiano a ogni versione e fanno partire l'aggiornamento.
const VERSION = '0.15.0-e247f11c5a'
const CACHE = `ado-${VERSION}`
const SHARED = 'ado-condivisi'
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ado-') && k !== CACHE && k !== SHARED).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

// "Aggiorna" nell'app: la versione nuova, già scaricata, prende il posto di quella vecchia.
self.addEventListener('message', (event) => {
  if (event.data === 'aggiorna') self.skipWaiting()
  if (event.data === 'versione') event.source?.postMessage({ versione: VERSION })
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method === 'POST' && url.searchParams.has('condivisione')) {
    event.respondWith(receiveShared(request))
    return
  }
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  // Prima la copia salvata (funziona offline), altrimenti la rete. Le pagine aprono sempre l'app.
  const key = request.mode === 'navigate' ? 'index.html' : request
  event.respondWith(caches.match(key, { ignoreSearch: true }).then((cached) => cached ?? fetch(request)))
})

/** Schede arrivate dal menu "Condividi": si mettono da parte e si apre l'app, che le importa. */
async function receiveShared(request) {
  const data = await request.formData()
  const files = data.getAll('schede').filter((f) => typeof f !== 'string')
  const cache = await caches.open(SHARED)
  const now = Date.now()
  await Promise.all(
    files.map((file, i) => cache.put(`condivisi/${now}-${i}`, new Response(file, { headers: { 'x-nome-file': encodeURIComponent(file.name) } }))),
  )
  return Response.redirect('./#/ricevuti', 303)
}
