import { expect } from '@esm-bundle/chai';
import { storageNamespace, namespacedKey } from '../js/storageNamespace.js';

describe('storageNamespace', () => {
  describe('storageNamespace(pathname)', () => {
    it('is empty for the production site', () => {
      expect(storageNamespace('/timers/')).to.equal('');
      expect(storageNamespace('/timers/index.html')).to.equal('');
      expect(storageNamespace('/')).to.equal('');
    });

    it('is the PR name for a preview under the umbrella dir', () => {
      expect(storageNamespace('/timers/pr-previews/pr-12/')).to.equal('pr-12');
      expect(storageNamespace('/timers/pr-previews/pr-12/index.html')).to.equal('pr-12');
      expect(storageNamespace('/timers/pr-previews/pr-12')).to.equal('pr-12');
    });

    it('does not depend on the repo path prefix', () => {
      expect(storageNamespace('/pr-previews/pr-7/')).to.equal('pr-7');
    });

    it('is empty for the umbrella dir itself and for look-alike paths', () => {
      expect(storageNamespace('/timers/pr-previews/')).to.equal('');
      expect(storageNamespace('/timers/pr-previews/pr-/')).to.equal('');
      expect(storageNamespace('/timers/pr-previews/pr-12abc/')).to.equal('');
      expect(storageNamespace('/timers/pr-12/')).to.equal('');
    });

    it('defaults to the current page path', () => {
      expect(storageNamespace()).to.equal(storageNamespace(location.pathname));
    });
  });

  describe('namespacedKey(key, pathname)', () => {
    it('returns the key unchanged outside a preview', () => {
      expect(namespacedKey('productivity-timers-v1', '/timers/')).to.equal('productivity-timers-v1');
    });

    it('prefixes the key with the PR name inside a preview', () => {
      expect(namespacedKey('productivity-timers-v1', '/timers/pr-previews/pr-12/'))
        .to.equal('pr-12:productivity-timers-v1');
    });

    it('gives different PRs different keys', () => {
      expect(namespacedKey('k', '/timers/pr-previews/pr-1/'))
        .to.not.equal(namespacedKey('k', '/timers/pr-previews/pr-2/'));
    });

    it('defaults to the current page path', () => {
      expect(namespacedKey('k')).to.equal(namespacedKey('k', location.pathname));
    });
  });
});
