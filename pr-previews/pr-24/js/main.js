import { App } from './app.js';
import { registerServiceWorker } from './pwa.js';
import { setupInstallButton } from './installButton.js';

// Wired before DOMContentLoaded so an early beforeinstallprompt is never missed
setupInstallButton({
  button: document.getElementById('install-btn'),
  hint: document.getElementById('install-hint')
});

document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});

// After load so the worker's own downloads never compete with the page's first paint
window.addEventListener('load', () => {
  registerServiceWorker(navigator.serviceWorker);
});
