import { expect } from '@esm-bundle/chai';
import { createNotifier } from '../js/notifier.js';

describe('createNotifier', () => {
  const originalNotification = window.Notification;
  let requests;
  let created;

  function stubNotification(permission, { constructorThrows = false } = {}) {
    requests = 0;
    created = [];
    window.Notification = class {
      static permission = permission;

      static requestPermission() {
        requests++;
        return Promise.resolve('granted');
      }

      constructor(title, options) {
        if (constructorThrows) {
          throw new TypeError('Illegal constructor');
        }
        created.push({ title, options });
      }
    };
  }

  afterEach(() => {
    window.Notification = originalNotification;
  });

  describe('requestPermission()', () => {
    it('asks the browser only while permission is still undecided', () => {
      stubNotification('default');
      createNotifier().requestPermission();
      expect(requests).to.equal(1);
    });

    it('does not ask again once permission was granted', () => {
      stubNotification('granted');
      createNotifier().requestPermission();
      expect(requests).to.equal(0);
    });

    it('does not ask again once permission was denied', () => {
      stubNotification('denied');
      createNotifier().requestPermission();
      expect(requests).to.equal(0);
    });

    it('does nothing when the Notification API is unavailable', () => {
      delete window.Notification;
      expect(() => createNotifier().requestPermission()).to.not.throw();
    });

    it('tolerates a browser whose requestPermission rejects', async () => {
      stubNotification('default');
      window.Notification.requestPermission = () => Promise.reject(new Error('blocked'));

      const notifier = createNotifier();
      expect(() => notifier.requestPermission()).to.not.throw();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  });

  describe('notify()', () => {
    it('shows a notification with the title and body when permission is granted', () => {
      stubNotification('granted');
      createNotifier().notify('Goal reached', 'Deep work hit 02:00:00');

      expect(created).to.deep.equal([
        { title: 'Goal reached', options: { body: 'Deep work hit 02:00:00' } }
      ]);
    });

    it('shows nothing when permission was not granted', () => {
      stubNotification('default');
      createNotifier().notify('Goal reached', 'body');
      expect(created).to.have.lengthOf(0);

      stubNotification('denied');
      createNotifier().notify('Goal reached', 'body');
      expect(created).to.have.lengthOf(0);
    });

    it('does nothing when the Notification API is unavailable', () => {
      delete window.Notification;
      expect(() => createNotifier().notify('Goal reached', 'body')).to.not.throw();
    });

    it('swallows constructor errors from browsers that only notify via service workers', () => {
      stubNotification('granted', { constructorThrows: true });
      expect(() => createNotifier().notify('Goal reached', 'body')).to.not.throw();
    });
  });
});
