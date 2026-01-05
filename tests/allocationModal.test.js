import { expect } from '@esm-bundle/chai';
import { AllocationModal } from '../js/allocationModal.js';

describe('AllocationModal', () => {
  let modal;

  afterEach(() => {
    if (modal && modal.modalElement && modal.modalElement.parentNode) {
      modal.modalElement.remove();
    }
    modal = null;
  });

  describe('Basic Rendering', () => {
    it('should create modal and append to body when show() is called', () => {
      modal = new AllocationModal(60000, [], null);
      modal.show();

      const modalElement = document.querySelector('.allocation-modal');
      expect(modalElement).to.exist;
      expect(modalElement.parentNode).to.equal(document.body);
    });

    it('should have a modal dialog container', () => {
      modal = new AllocationModal(60000, [], null);
      modal.show();

      const dialog = document.querySelector('.allocation-modal .modal-dialog');
      expect(dialog).to.exist;
    });

    it('should have a title', () => {
      modal = new AllocationModal(60000, [], null);
      modal.show();

      const title = document.querySelector('.allocation-modal .modal-title');
      expect(title).to.exist;
      expect(title.textContent).to.include('Allocate Idle Time');
    });
  });
});
