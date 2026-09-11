import { expect } from '@esm-bundle/chai';
import {
  APP_SHELL,
  CACHE_VERSION,
  shellCacheName,
  isAppRequest,
  precache,
  pruneCaches,
  networkFirst
} from '../js/offlineCache.js';

const PRODUCTION_SCOPE = 'https://aquigs.github.io/productivity-timers/';
const PREVIEW_SCOPE = 'https://aquigs.github.io/productivity-timers/pr-previews/pr-12/';

async function deleteCachesMatching(predicate) {
  const names = await caches.keys();
  await Promise.all(names.filter(predicate).map(name => caches.delete(name)));
}

describe('offlineCache', () => {
  describe('APP_SHELL', () => {
    it('lists the files the app needs to open offline', () => {
      expect(APP_SHELL).to.include.members([
        './index.html',
        './css/styles.css',
        './manifest.webmanifest',
        './js/main.js',
        './js/app.js',
        './js/pwa.js'
      ]);
    });

    it('names every module the app imports', async () => {
      const listed = new Set(APP_SHELL.map(url => new URL(url, location.href).pathname));
      const seen = new Set();
      const queue = ['/js/main.js'];
      while (queue.length) {
        const path = queue.shift();
        if (seen.has(path)) continue;
        seen.add(path);
        const source = await (await fetch(path)).text();
        for (const match of source.matchAll(/from\s+'(\.\/[^']+)'/g)) {
          queue.push(new URL(match[1], location.origin + path).pathname);
        }
      }
      const missing = [...seen].filter(path => !listed.has(path));
      expect(missing, 'modules missing from APP_SHELL').to.deep.equal([]);
    });

    it('only names files the server actually serves', async function () {
      this.timeout(10000);
      const statuses = await Promise.all(APP_SHELL.map(async url => {
        const response = await fetch(url, { cache: 'no-store' });
        return `${url} ${response.status}`;
      }));
      expect(statuses.filter(line => !line.endsWith(' 200'))).to.deep.equal([]);
    });
  });

  describe('shellCacheName(scope)', () => {
    it('keys the cache on the registration scope path and the cache version', () => {
      expect(shellCacheName(PRODUCTION_SCOPE)).to.equal(`timers:/productivity-timers/:${CACHE_VERSION}`);
    });

    it('gives a PR preview a different cache than production', () => {
      expect(shellCacheName(PREVIEW_SCOPE)).to.not.equal(shellCacheName(PRODUCTION_SCOPE));
      expect(shellCacheName(PREVIEW_SCOPE)).to.equal(`timers:/productivity-timers/pr-previews/pr-12/:${CACHE_VERSION}`);
    });

    it('accepts an explicit version', () => {
      expect(shellCacheName(PRODUCTION_SCOPE, 'v9')).to.equal('timers:/productivity-timers/:v9');
    });
  });

  describe('isAppRequest(request, origin)', () => {
    it('accepts same-origin GET requests', () => {
      expect(isAppRequest(new Request('/js/app.js'), location.origin)).to.equal(true);
    });

    it('rejects requests to other origins, such as the web font stylesheet', () => {
      const fonts = new Request('https://fonts.googleapis.com/css2?family=Inter');
      expect(isAppRequest(fonts, location.origin)).to.equal(false);
    });

    it('rejects anything but GET', () => {
      expect(isAppRequest(new Request('/js/app.js', { method: 'POST' }), location.origin)).to.equal(false);
    });
  });

  describe('precache(cacheStorage, cacheName, urls)', () => {
    const cacheName = 'timers:/__precache-test__/:v1';

    afterEach(async () => {
      await caches.delete(cacheName);
    });

    it('stores every url in the named cache', async () => {
      await precache(caches, cacheName, ['./css/styles.css', './js/main.js']);

      const cache = await caches.open(cacheName);
      const paths = (await cache.keys()).map(request => new URL(request.url).pathname);
      expect(paths).to.have.members(['/css/styles.css', '/js/main.js']);
    });

    it('rejects when a url is missing so a broken install is not treated as complete', async () => {
      let error = null;
      try {
        await precache(caches, cacheName, ['./css/styles.css', './js/does-not-exist.js']);
      } catch (e) {
        error = e;
      }
      expect(error).to.be.instanceOf(Error);
    });
  });

  describe('pruneCaches(cacheStorage, keep)', () => {
    const keep = 'timers:/__prune-test__/:v2';
    const stale = 'timers:/__prune-test__/:v1';
    const preview = 'timers:/__prune-test__/pr-previews/pr-3/:v1';
    const unrelated = 'unrelated-cache-for-prune-test';

    beforeEach(async () => {
      await Promise.all([keep, stale, preview, unrelated].map(name => caches.open(name)));
    });

    afterEach(async () => {
      await deleteCachesMatching(name => name.includes('__prune-test__') || name === unrelated);
    });

    it('deletes older versions of this scope and keeps the current one', async () => {
      await pruneCaches(caches, keep);

      expect(await caches.has(stale)).to.equal(false);
      expect(await caches.has(keep)).to.equal(true);
    });

    it('leaves other deployments and unrelated caches alone', async () => {
      await pruneCaches(caches, keep);

      expect(await caches.has(preview)).to.equal(true);
      expect(await caches.has(unrelated)).to.equal(true);
    });
  });

  describe('networkFirst(request, options)', () => {
    const cacheName = 'timers:/__network-first-test__/:v1';
    const fallbackUrl = '/__network-first-test__/index.html';
    let cache;

    function fetchThat(outcome) {
      return async () => {
        if (outcome instanceof Error) throw outcome;
        return new Response(outcome.body, { status: outcome.status, headers: { 'Content-Type': 'text/plain' } });
      };
    }

    function options(fetch) {
      return { cacheStorage: caches, cacheName, fetch, fallbackUrl };
    }

    function navigationRequest(url) {
      const request = new Request(url);
      Object.defineProperty(request, 'mode', { value: 'navigate' });
      return request;
    }

    beforeEach(async () => {
      cache = await caches.open(cacheName);
    });

    afterEach(async () => {
      await caches.delete(cacheName);
    });

    it('returns the network response and stores a copy', async () => {
      const request = new Request('/__network-first-test__/app.js');

      const response = await networkFirst(request, options(fetchThat({ body: 'fresh', status: 200 })));

      expect(await response.text()).to.equal('fresh');
      const stored = await cache.match(request);
      expect(await stored.text()).to.equal('fresh');
    });

    it('returns but does not store an error response', async () => {
      const request = new Request('/__network-first-test__/missing.js');

      const response = await networkFirst(request, options(fetchThat({ body: 'nope', status: 404 })));

      expect(response.status).to.equal(404);
      expect(await cache.match(request)).to.equal(undefined);
    });

    it('serves the cached copy when the network is unreachable', async () => {
      const request = new Request('/__network-first-test__/app.js');
      await cache.put(request, new Response('cached'));

      const response = await networkFirst(request, options(fetchThat(new TypeError('Failed to fetch'))));

      expect(await response.text()).to.equal('cached');
    });

    it('ignores the query string when looking up the cached copy', async () => {
      await cache.put(new Request('/__network-first-test__/app.js'), new Response('cached'));
      const request = new Request('/__network-first-test__/app.js?idle=1');

      const response = await networkFirst(request, options(fetchThat(new TypeError('Failed to fetch'))));

      expect(await response.text()).to.equal('cached');
    });

    it('serves the cached page for an offline navigation to any url in scope', async () => {
      await cache.put(new Request(fallbackUrl), new Response('<!doctype html>shell'));
      const request = navigationRequest('/__network-first-test__/');

      const response = await networkFirst(request, options(fetchThat(new TypeError('Failed to fetch'))));

      expect(await response.text()).to.equal('<!doctype html>shell');
    });

    it('uses the real fetch unless one is injected', async () => {
      const request = new Request('/css/styles.css');

      const response = await networkFirst(request, { cacheStorage: caches, cacheName, fallbackUrl });

      expect(response.status).to.equal(200);
      expect(await cache.match(request)).to.not.equal(undefined);
    });

    it('rethrows the network error when nothing cached can answer', async () => {
      const request = new Request('/__network-first-test__/never-seen.js');
      const failure = new TypeError('Failed to fetch');

      let error = null;
      try {
        await networkFirst(request, options(fetchThat(failure)));
      } catch (e) {
        error = e;
      }
      expect(error).to.equal(failure);
    });
  });
});
