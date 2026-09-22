import { expect } from '@esm-bundle/chai';
import { setupInstallButton, platformHint, isStandalone } from '../js/installButton.js';

const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0 Safari/537.36';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0 Mobile Safari/537.36';
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1';

describe('installButton', () => {
  let button;
  let hint;
  let target;

  function setup({ userAgent = DESKTOP_UA, standalone = false, navigatorStandalone = false } = {}) {
    return setupInstallButton({
      button,
      hint,
      target,
      navigator: { userAgent, standalone: navigatorStandalone },
      matchMedia: query => ({ matches: standalone && query === '(display-mode: standalone)' })
    });
  }

  function installPromptEvent(outcome = 'accepted') {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompts = 0;
    event.prompt = () => {
      event.prompts++;
      return Promise.resolve();
    };
    event.userChoice = Promise.resolve({ outcome });
    return event;
  }

  async function click() {
    button.click();
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  beforeEach(() => {
    button = document.createElement('button');
    button.hidden = true;
    hint = document.createElement('p');
    hint.hidden = true;
    target = new EventTarget();
  });

  describe('platformHint(userAgent)', () => {
    it('tells iPhone and iPad users to use the Share sheet', () => {
      expect(platformHint(IOS_UA)).to.match(/Share/);
      expect(platformHint(IOS_UA)).to.match(/Add to Home Screen/);
    });

    it('tells Android users where the browser menu entry is', () => {
      expect(platformHint(ANDROID_UA)).to.match(/menu/);
      expect(platformHint(ANDROID_UA)).to.match(/Install/);
    });

    it('has nothing to say on a desktop browser', () => {
      expect(platformHint(DESKTOP_UA)).to.equal(null);
    });
  });

  describe('isStandalone()', () => {
    it('is true under the standalone display mode or the iOS standalone flag', () => {
      expect(isStandalone({ matchMedia: () => ({ matches: true }), navigator: {} })).to.equal(true);
      expect(isStandalone({ matchMedia: () => ({ matches: false }), navigator: { standalone: true } })).to.equal(true);
      expect(isStandalone({ matchMedia: () => ({ matches: false }), navigator: {} })).to.equal(false);
    });
  });

  describe('on a browser that fires beforeinstallprompt', () => {
    it('stays hidden until the browser offers installation', () => {
      setup();
      expect(button.hidden).to.equal(true);
    });

    it('keeps the browser prompt for later and shows the button when the event fires', () => {
      setup();
      const event = installPromptEvent();

      target.dispatchEvent(event);

      expect(event.defaultPrevented).to.equal(true);
      expect(button.hidden).to.equal(false);
    });

    it('opens the browser prompt on click and hides once the user accepts', async () => {
      setup();
      const event = installPromptEvent('accepted');
      target.dispatchEvent(event);

      await click();

      expect(event.prompts).to.equal(1);
      expect(button.hidden).to.equal(true);
    });

    it('hides again after a dismissed prompt, since that prompt cannot be reused', async () => {
      setup();
      const event = installPromptEvent('dismissed');
      target.dispatchEvent(event);

      await click();

      expect(event.prompts).to.equal(1);
      expect(button.hidden).to.equal(true);
    });

    it('shows again when the browser offers installation a second time', async () => {
      setup();
      target.dispatchEvent(installPromptEvent('dismissed'));
      await click();

      const again = installPromptEvent('accepted');
      target.dispatchEvent(again);
      expect(button.hidden).to.equal(false);

      await click();
      expect(again.prompts).to.equal(1);
    });

    it('hides when the app gets installed by any other route', () => {
      setup();
      target.dispatchEvent(installPromptEvent());

      target.dispatchEvent(new Event('appinstalled'));

      expect(button.hidden).to.equal(true);
    });

    it('never shows inside the installed app', () => {
      setup({ standalone: true });

      target.dispatchEvent(installPromptEvent());

      expect(button.hidden).to.equal(true);
    });
  });

  describe('on a browser with a menu path but no prompt event', () => {
    it('shows on iPhone and explains the Share sheet on click', async () => {
      setup({ userAgent: IOS_UA });
      expect(button.hidden).to.equal(false);
      expect(hint.hidden).to.equal(true);

      await click();

      expect(hint.hidden).to.equal(false);
      expect(hint.textContent).to.match(/Share/);
    });

    it('shows on Android and explains the browser menu on click', async () => {
      setup({ userAgent: ANDROID_UA });

      await click();

      expect(hint.hidden).to.equal(false);
      expect(hint.textContent).to.match(/menu/);
    });

    it('prefers the browser prompt over the hint once the event has fired', async () => {
      setup({ userAgent: ANDROID_UA });
      const event = installPromptEvent('accepted');
      target.dispatchEvent(event);

      await click();

      expect(event.prompts).to.equal(1);
      expect(hint.hidden).to.equal(true);
    });

    it('falls back to the hint after a dismissed prompt on Android', async () => {
      setup({ userAgent: ANDROID_UA });
      target.dispatchEvent(installPromptEvent('dismissed'));
      await click();
      expect(button.hidden).to.equal(false);

      await click();

      expect(hint.hidden).to.equal(false);
    });

    it('falls back to the hint when the browser prompt throws on Android, and hides elsewhere', async () => {
      const originalWarn = console.warn;
      console.warn = () => {};
      try {
        setup({ userAgent: ANDROID_UA });
        const broken = installPromptEvent();
        broken.prompt = () => Promise.reject(new Error('not triggered by a user gesture'));
        target.dispatchEvent(broken);
        await click();
        expect(button.hidden).to.equal(false);
        expect(hint.hidden).to.equal(false);

        button = document.createElement('button');
        hint = document.createElement('p');
        target = new EventTarget();
        setup();
        const brokenDesktop = installPromptEvent();
        brokenDesktop.prompt = () => Promise.reject(new Error('not triggered by a user gesture'));
        target.dispatchEvent(brokenDesktop);
        await click();
        expect(button.hidden).to.equal(true);
      } finally {
        console.warn = originalWarn;
      }
    });

    it('stays hidden on iPhone when already running from the Home Screen', () => {
      setup({ userAgent: IOS_UA, navigatorStandalone: true });
      expect(button.hidden).to.equal(true);
    });
  });
});
