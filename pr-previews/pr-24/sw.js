import {
  APP_SHELL,
  shellCacheName,
  isAppRequest,
  precache,
  pruneCaches,
  networkFirst
} from './js/offlineCache.js';

const CACHE_NAME = shellCacheName(self.registration.scope);

self.addEventListener('install', event => {
  event.waitUntil(precache(caches, CACHE_NAME, APP_SHELL).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(pruneCaches(caches, CACHE_NAME).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (!isAppRequest(event.request, self.location.origin)) {
    return;
  }
  event.respondWith(networkFirst(event.request, {
    cacheStorage: caches,
    cacheName: CACHE_NAME,
    fallbackUrl: './index.html'
  }));
});
