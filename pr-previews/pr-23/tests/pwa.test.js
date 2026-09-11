import { expect } from '@esm-bundle/chai';
import { registerServiceWorker } from '../js/pwa.js';
import { APP_SHELL, shellCacheName } from '../js/offlineCache.js';

async function fetchDocument(path) {
  const html = await (await fetch(path, { cache: 'no-store' })).text();
  return new DOMParser().parseFromString(html, 'text/html');
}

async function fetchManifest() {
  const response = await fetch('/manifest.webmanifest', { cache: 'no-store' });
  expect(response.status).to.equal(200);
  return response.json();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`could not load ${src}`));
    image.src = src;
  });
}

describe('PWA', () => {
  describe('registerServiceWorker(container, scriptUrl)', () => {
    let warnings;
    const originalWarn = console.warn;

    beforeEach(() => {
      warnings = [];
      console.warn = (...args) => warnings.push(args);
    });

    afterEach(() => {
      console.warn = originalWarn;
    });

    it('registers ./sw.js as a module worker so it resolves inside the deployed folder', async () => {
      const calls = [];
      const registration = { scope: 'https://example.test/app/' };
      const container = {
        register(url, options) {
          calls.push({ url, options });
          return Promise.resolve(registration);
        }
      };

      const result = await registerServiceWorker(container);

      expect(calls).to.deep.equal([{ url: './sw.js', options: { type: 'module' } }]);
      expect(result).to.equal(registration);
    });

    it('resolves to null when the browser has no service worker support', async () => {
      expect(await registerServiceWorker(undefined)).to.equal(null);
      expect(warnings).to.have.lengthOf(0);
    });

    it('warns and resolves to null when registration fails instead of breaking the app', async () => {
      const container = { register: () => Promise.reject(new Error('insecure context')) };

      expect(await registerServiceWorker(container)).to.equal(null);
      expect(warnings).to.have.lengthOf(1);
    });
  });

  describe('index.html', () => {
    let doc;

    before(async () => {
      doc = await fetchDocument('/index.html');
    });

    it('links the web app manifest by a relative path', () => {
      const link = doc.querySelector('link[rel="manifest"]');
      expect(link).to.not.equal(null);
      expect(link.getAttribute('href')).to.equal('manifest.webmanifest');
    });

    it('offers a home-screen icon to iOS, which ignores manifest icons', () => {
      const link = doc.querySelector('link[rel="apple-touch-icon"]');
      expect(link).to.not.equal(null);
      expect(link.getAttribute('href')).to.equal('icons/apple-touch-icon.png');
    });

    it('opts into standalone display on browsers that read the meta tags', () => {
      expect(doc.querySelector('meta[name="mobile-web-app-capable"]').content).to.equal('yes');
      expect(doc.querySelector('meta[name="apple-mobile-web-app-capable"]').content).to.equal('yes');
    });

    it('registers the service worker from the entry module', async () => {
      const main = await (await fetch('/js/main.js', { cache: 'no-store' })).text();
      expect(main).to.include('registerServiceWorker');
    });
  });

  describe('manifest.webmanifest', () => {
    let manifest;

    before(async () => {
      manifest = await fetchManifest();
    });

    it('names the app and gives it a short home-screen label', () => {
      expect(manifest.name).to.equal('Productivity Timers');
      expect(manifest.short_name).to.be.a('string').with.length.within(1, 12);
    });

    it('opens as a standalone app', () => {
      expect(manifest.display).to.equal('standalone');
    });

    it('starts and scopes relative to the manifest so production and PR previews each install as their own app', () => {
      expect(manifest.start_url).to.equal('./');
      expect(manifest.scope).to.equal('./');
      expect(manifest).to.not.have.property('id');
    });

    it('matches the dark theme colour declared in index.html', async () => {
      const doc = await fetchDocument('/index.html');
      const dark = doc.querySelector('meta[name="theme-color"][media*="dark"]').content;
      expect(manifest.theme_color).to.equal(dark);
      expect(manifest.background_color).to.equal(dark);
    });

    it('provides the icon sizes installers require plus a maskable one', () => {
      const bySize = Object.fromEntries(manifest.icons.map(icon => [`${icon.sizes} ${icon.purpose || 'any'}`, icon]));
      expect(bySize).to.include.keys('192x192 any', '512x512 any', '512x512 maskable');
      expect(manifest.icons.some(icon => icon.type === 'image/svg+xml' && icon.sizes === 'any')).to.equal(true);
    });

    it('points every icon at a served image of the declared size', async function () {
      this.timeout(10000);
      for (const icon of manifest.icons) {
        const response = await fetch(icon.src, { cache: 'no-store' });
        expect(response.status, icon.src).to.equal(200);
        expect(response.headers.get('content-type'), icon.src).to.match(/^image\//);
        if (icon.sizes === 'any') continue;
        const [width, height] = icon.sizes.split('x').map(Number);
        const image = await loadImage(icon.src);
        expect([image.naturalWidth, image.naturalHeight], icon.src).to.deep.equal([width, height]);
      }
    });
  });

  describe('sw.js', () => {
    // Registered under a scope no test page lives in, so the worker never intercepts the
    // test runner's own requests; the precache list still resolves against /sw.js
    const scope = '/__pwa-test__/';
    let registration = null;

    function whenActivated(reg) {
      const worker = reg.installing || reg.waiting || reg.active;
      if (worker.state === 'activated') return Promise.resolve();
      return new Promise((resolve, reject) => {
        worker.addEventListener('statechange', () => {
          if (worker.state === 'activated') resolve();
          if (worker.state === 'redundant') reject(new Error('service worker failed to install'));
        });
      });
    }

    afterEach(async () => {
      if (registration) {
        await caches.delete(shellCacheName(registration.scope));
        await registration.unregister();
        registration = null;
      }
    });

    it('installs and precaches the whole app shell in a cache named for its scope', async function () {
      this.timeout(15000);
      registration = await navigator.serviceWorker.register('/sw.js', { type: 'module', scope });
      await whenActivated(registration);

      const cacheName = shellCacheName(registration.scope);
      expect(cacheName).to.equal(`timers:${scope}:v1`);
      const cache = await caches.open(cacheName);
      const cached = (await cache.keys()).map(request => new URL(request.url).pathname);
      const expected = APP_SHELL.map(url => new URL(url, location.origin + '/sw.js').pathname);
      expect(cached).to.include.members(expected);
    });
  });
});
