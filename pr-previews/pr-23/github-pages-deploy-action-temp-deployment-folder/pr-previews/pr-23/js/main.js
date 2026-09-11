import { App } from './app.js';
import { registerServiceWorker } from './pwa.js';

document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});

// After load so the worker's own downloads never compete with the page's first paint
window.addEventListener('load', () => {
  registerServiceWorker(navigator.serviceWorker);
});
