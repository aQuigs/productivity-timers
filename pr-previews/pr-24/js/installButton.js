/**
 * "Install app" button for the top bar. Chromium browsers announce that a page can be
 * installed with a `beforeinstallprompt` event; the button keeps that event and replays
 * its prompt on click, so nobody has to find the entry in a browser menu. Browsers that
 * never fire the event but do have a menu path (Safari on iOS, any Android browser) get
 * the button too and a one-line hint on click
 */

const MENU_HINTS = {
  ios: 'In Safari, tap Share, then "Add to Home Screen".',
  android: 'Open the browser menu and choose "Install" or "Add to Home screen".'
};

/**
 * @param {string} userAgent
 * @returns {string|null} How to install from the browser menu, or null when there is no
 *   known path (desktop browsers either fire the event or cannot install at all)
 */
export function platformHint(userAgent) {
  if (/iPhone|iPad|iPod/.test(userAgent)) {
    return MENU_HINTS.ios;
  }
  if (/Android/.test(userAgent)) {
    return MENU_HINTS.android;
  }
  return null;
}

/**
 * Whether the page already runs as the installed app (display-mode media query, or the
 * iOS-only navigator.standalone flag)
 * @param {{ matchMedia: (query: string) => { matches: boolean }, navigator: { standalone?: boolean } }} env
 * @returns {boolean}
 */
export function isStandalone({ matchMedia, navigator }) {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

/**
 * @param {object} options
 * @param {HTMLButtonElement} options.button - Starts hidden; shown when installing is possible
 * @param {HTMLElement} options.hint - Starts hidden; shows the menu path when there is no prompt
 * @param {EventTarget} [options.target] - Where beforeinstallprompt/appinstalled arrive (window)
 * @param {Navigator} [options.navigator]
 * @param {(query: string) => { matches: boolean }} [options.matchMedia]
 */
export function setupInstallButton({
  button,
  hint,
  target = window,
  navigator: nav = window.navigator,
  matchMedia = query => window.matchMedia(query)
}) {
  if (isStandalone({ matchMedia, navigator: nav })) {
    return;
  }

  const menuHint = platformHint(nav.userAgent);
  let pendingPrompt = null;

  const show = () => {
    button.hidden = false;
  };
  const hide = () => {
    button.hidden = true;
    hint.hidden = true;
  };
  const showHint = () => {
    hint.textContent = menuHint;
    hint.hidden = false;
  };

  if (menuHint) {
    show();
  }

  target.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    pendingPrompt = event;
    hint.hidden = true;
    show();
  });

  target.addEventListener('appinstalled', hide);

  button.addEventListener('click', async () => {
    if (!pendingPrompt) {
      showHint();
      return;
    }
    // A prompt event can only be shown once, so it is consumed whatever the outcome
    const prompt = pendingPrompt;
    pendingPrompt = null;
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted' || !menuHint) {
        hide();
      }
    } catch (error) {
      console.warn('Install prompt failed:', error);
      if (menuHint) {
        showHint();
      } else {
        hide();
      }
    }
  });
}

export default setupInstallButton;
