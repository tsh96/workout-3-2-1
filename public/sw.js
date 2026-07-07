const CACHE_PREFIX = 'workout-3-2-1-'
const CACHE_NAME = `${CACHE_PREFIX}v2`
const BASE_PATH = new URL(self.registration.scope).pathname
const APP_SHELL = [BASE_PATH, `${BASE_PATH}manifest.webmanifest`, `${BASE_PATH}icon.svg`]

const cacheResponse = async (request, response) => {
  if (!response || !response.ok) return response

  const cache = await caches.open(CACHE_NAME)
  await cache.put(request, response.clone())
  return response
}

const fromNetworkFirst = async (request) => {
  try {
    const fresh = await fetch(new Request(request, { cache: 'reload' }))
    return cacheResponse(request, fresh)
  } catch {
    return caches.match(request).then((cached) => cached || caches.match(BASE_PATH))
  }
}

const fromCacheFirst = async (request) => {
  const cached = await caches.match(request)
  if (cached) return cached

  const response = await fetch(request)
  return cacheResponse(request, response)
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      const oldCacheKeys = keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)

      await Promise.all(oldCacheKeys.map((key) => caches.delete(key)))
      await self.clients.claim()

      if (oldCacheKeys.length === 0) return

      const clients = await self.clients.matchAll({ type: 'window' })
      await Promise.all(clients.map((client) => client.navigate(client.url)))
    }),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  if (event.request.mode === 'navigate') {
    event.respondWith(fromNetworkFirst(event.request))
    return
  }

  event.respondWith(fromCacheFirst(event.request))
})
