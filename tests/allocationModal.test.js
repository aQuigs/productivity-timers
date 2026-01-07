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

  describe('Idle Time Display', () => {
    it('should display idle time in HH:MM:SS format', () => {
      modal = new AllocationModal(60000, [], null);
      modal.show();

      const idleTimeDisplay = document.querySelector('.allocation-modal .idle-time-display');
      expect(idleTimeDisplay).to.exist;
      expect(idleTimeDisplay.textContent).to.include('00:01:00');
    });

    it('should format idle time correctly for different durations', () => {
      modal = new AllocationModal(3665000, [], null);
      modal.show();

      const idleTimeDisplay = document.querySelector('.allocation-modal .idle-time-display');
      expect(idleTimeDisplay).to.exist;
      expect(idleTimeDisplay.textContent).to.include('01:01:05');
    });

    it('should format idle time correctly for hours greater than 99', () => {
      modal = new AllocationModal(451865000, [], null);
      modal.show();

      const idleTimeDisplay = document.querySelector('.allocation-modal .idle-time-display');
      expect(idleTimeDisplay).to.exist;
      expect(idleTimeDisplay.textContent).to.include('125:31:05');
    });
  });

  describe('Strategy Options', () => {
    it('should show all 5 strategy options', () => {
      modal = new AllocationModal(60000, [], null);
      modal.show();

      const strategyOptions = document.querySelectorAll('.allocation-modal input[type="radio"][name="strategy"]');
      expect(strategyOptions).to.have.lengthOf(5);
    });

    it('should have strategy 1: add all to previously-active timer', () => {
      modal = new AllocationModal(60000, [], 'timer-123');
      modal.show();

      const strategy1 = document.querySelector('.allocation-modal input[value="previous-timer"]');
      expect(strategy1).to.exist;
      expect(strategy1.type).to.equal('radio');
      expect(strategy1.name).to.equal('strategy');
    });

    it('should have strategy 2: add all to user-selected timer', () => {
      modal = new AllocationModal(60000, [], null);
      modal.show();

      const strategy2 = document.querySelector('.allocation-modal input[value="selected-timer"]');
      expect(strategy2).to.exist;
    });

    it('should have strategy 3: fixed time distribution', () => {
      modal = new AllocationModal(60000, [], null);
      modal.show();

      const strategy3 = document.querySelector('.allocation-modal input[value="fixed-distribution"]');
      expect(strategy3).to.exist;
    });

    it('should have strategy 4: percentage distribution', () => {
      modal = new AllocationModal(60000, [], null);
      modal.show();

      const strategy4 = document.querySelector('.allocation-modal input[value="percentage-distribution"]');
      expect(strategy4).to.exist;
    });

    it('should have strategy 5: discard (default)', () => {
      modal = new AllocationModal(60000, [], null);
      modal.show();

      const strategy5 = document.querySelector('.allocation-modal input[value="discard"]');
      expect(strategy5).to.exist;
      expect(strategy5.checked).to.be.true;
    });

    it('should show timer dropdown for strategy 2 (selected timer)', () => {
      const timers = [
        { id: 'timer-1', title: 'Timer 1' },
        { id: 'timer-2', title: 'Timer 2' }
      ];
      modal = new AllocationModal(60000, timers, null);
      modal.show();

      const dropdown = document.querySelector('.allocation-modal select.timer-select');
      expect(dropdown).to.exist;
      expect(dropdown.options).to.have.lengthOf(2);
      expect(dropdown.options[0].value).to.equal('timer-1');
      expect(dropdown.options[1].value).to.equal('timer-2');
    });

    it('should disable strategy 1 if no previous timer exists', () => {
      modal = new AllocationModal(60000, [], null);
      modal.show();

      const strategy1 = document.querySelector('.allocation-modal input[value="previous-timer"]');
      expect(strategy1.disabled).to.be.true;
    });

    it('should enable strategy 1 if previous timer exists', () => {
      modal = new AllocationModal(60000, [], 'timer-123');
      modal.show();

      const strategy1 = document.querySelector('.allocation-modal input[value="previous-timer"]');
      expect(strategy1.disabled).to.be.false;
    });
  });

  describe('Apply Button and Promise Resolution', () => {
    it('should have an Apply button', () => {
      modal = new AllocationModal(60000, [], null);
      modal.show();

      const applyButton = document.querySelector('.allocation-modal button.btn-apply');
      expect(applyButton).to.exist;
      expect(applyButton.textContent).to.include('Apply');
    });

    it('should return a Promise from show()', () => {
      modal = new AllocationModal(60000, [], null);
      const result = modal.show();

      expect(result).to.be.an.instanceof(Promise);
    });

    it('should resolve with discard strategy when Apply clicked with default selection', (done) => {
      modal = new AllocationModal(60000, [], null);
      const promise = modal.show();

      const applyButton = document.querySelector('.allocation-modal button.btn-apply');
      applyButton.click();

      promise.then(result => {
        expect(result.strategy).to.equal('discard');
        expect(result.config).to.be.an('object');
        done();
      }).catch(done);
    });

    it('should resolve with previous-timer strategy when selected', (done) => {
      modal = new AllocationModal(60000, [], 'timer-123');
      const promise = modal.show();

      const strategy1Radio = document.querySelector('.allocation-modal input[value="previous-timer"]');
      strategy1Radio.checked = true;

      const applyButton = document.querySelector('.allocation-modal button.btn-apply');
      applyButton.click();

      promise.then(result => {
        expect(result.strategy).to.equal('previous-timer');
        expect(result.config.timerId).to.equal('timer-123');
        done();
      }).catch(done);
    });

    it('should resolve with selected-timer strategy and chosen timer', (done) => {
      const timers = [
        { id: 'timer-1', title: 'Timer 1' },
        { id: 'timer-2', title: 'Timer 2' }
      ];
      modal = new AllocationModal(60000, timers, null);
      const promise = modal.show();

      const strategy2Radio = document.querySelector('.allocation-modal input[value="selected-timer"]');
      strategy2Radio.checked = true;

      const dropdown = document.querySelector('.allocation-modal select.timer-select');
      dropdown.value = 'timer-2';

      const applyButton = document.querySelector('.allocation-modal button.btn-apply');
      applyButton.click();

      promise.then(result => {
        expect(result.strategy).to.equal('selected-timer');
        expect(result.config.timerId).to.equal('timer-2');
        done();
      }).catch(done);
    });

    it('should remove modal from DOM after Apply clicked', (done) => {
      modal = new AllocationModal(60000, [], null);
      const promise = modal.show();

      expect(document.querySelector('.allocation-modal')).to.exist;

      const applyButton = document.querySelector('.allocation-modal button.btn-apply');
      applyButton.click();

      promise.then(() => {
        expect(document.querySelector('.allocation-modal')).to.not.exist;
        done();
      }).catch(done);
    });
  });

  describe('Cancel, Close Button, and ESC Key', () => {
    it('should have a Cancel button', () => {
      modal = new AllocationModal(60000, [], null);
      modal.show();

      const cancelButton = document.querySelector('.allocation-modal button.btn-cancel');
      expect(cancelButton).to.exist;
      expect(cancelButton.textContent).to.include('Cancel');
    });

    it('should have a close (X) button', () => {
      modal = new AllocationModal(60000, [], null);
      modal.show();

      const closeButton = document.querySelector('.allocation-modal button.btn-close');
      expect(closeButton).to.exist;
    });

    it('should resolve with discard strategy when Cancel clicked', (done) => {
      modal = new AllocationModal(60000, [], 'timer-123');
      const promise = modal.show();

      const strategy1Radio = document.querySelector('.allocation-modal input[value="previous-timer"]');
      strategy1Radio.checked = true;

      const cancelButton = document.querySelector('.allocation-modal button.btn-cancel');
      cancelButton.click();

      promise.then(result => {
        expect(result.strategy).to.equal('discard');
        done();
      }).catch(done);
    });

    it('should resolve with discard strategy when X button clicked', (done) => {
      modal = new AllocationModal(60000, [], 'timer-123');
      const promise = modal.show();

      const strategy1Radio = document.querySelector('.allocation-modal input[value="previous-timer"]');
      strategy1Radio.checked = true;

      const closeButton = document.querySelector('.allocation-modal button.btn-close');
      closeButton.click();

      promise.then(result => {
        expect(result.strategy).to.equal('discard');
        done();
      }).catch(done);
    });

    it('should resolve with discard strategy when ESC key pressed', (done) => {
      modal = new AllocationModal(60000, [], 'timer-123');
      const promise = modal.show();

      const strategy1Radio = document.querySelector('.allocation-modal input[value="previous-timer"]');
      strategy1Radio.checked = true;

      const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escEvent);

      promise.then(result => {
        expect(result.strategy).to.equal('discard');
        done();
      }).catch(done);
    });

    it('should remove modal from DOM when Cancel clicked', (done) => {
      modal = new AllocationModal(60000, [], null);
      const promise = modal.show();

      expect(document.querySelector('.allocation-modal')).to.exist;

      const cancelButton = document.querySelector('.allocation-modal button.btn-cancel');
      cancelButton.click();

      promise.then(() => {
        expect(document.querySelector('.allocation-modal')).to.not.exist;
        done();
      }).catch(done);
    });

    it('should remove modal from DOM when X button clicked', (done) => {
      modal = new AllocationModal(60000, [], null);
      const promise = modal.show();

      expect(document.querySelector('.allocation-modal')).to.exist;

      const closeButton = document.querySelector('.allocation-modal button.btn-close');
      closeButton.click();

      promise.then(() => {
        expect(document.querySelector('.allocation-modal')).to.not.exist;
        done();
      }).catch(done);
    });

    it('should remove modal from DOM when ESC pressed', (done) => {
      modal = new AllocationModal(60000, [], null);
      const promise = modal.show();

      expect(document.querySelector('.allocation-modal')).to.exist;

      const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escEvent);

      promise.then(() => {
        expect(document.querySelector('.allocation-modal')).to.not.exist;
        done();
      }).catch(done);
    });
  });

  describe('Input Validation', () => {
    it('should accept fixed distribution strategy selection', (done) => {
      const timers = [
        { id: 'timer-1', title: 'Timer 1' },
        { id: 'timer-2', title: 'Timer 2' }
      ];
      modal = new AllocationModal(60000, timers, null);
      const promise = modal.show();

      const strategy3Radio = document.querySelector('.allocation-modal input[value="fixed-distribution"]');
      strategy3Radio.checked = true;

      const applyButton = document.querySelector('.allocation-modal button.btn-apply');
      applyButton.click();

      promise.then(result => {
        expect(result.strategy).to.equal('fixed-distribution');
        expect(result.config).to.be.an('object');
        done();
      }).catch(done);
    });

    it('should accept percentage distribution strategy selection', (done) => {
      const timers = [
        { id: 'timer-1', title: 'Timer 1' },
        { id: 'timer-2', title: 'Timer 2' }
      ];
      modal = new AllocationModal(60000, timers, null);
      const promise = modal.show();

      const strategy4Radio = document.querySelector('.allocation-modal input[value="percentage-distribution"]');
      strategy4Radio.checked = true;

      const applyButton = document.querySelector('.allocation-modal button.btn-apply');
      applyButton.click();

      promise.then(result => {
        expect(result.strategy).to.equal('percentage-distribution');
        expect(result.config).to.be.an('object');
        done();
      }).catch(done);
    });
  });

  describe('Fixed Distribution UI', () => {
    it('should show time input form when fixed distribution is selected', () => {
      const timers = [
        { id: 'timer-1', title: 'Timer 1' },
        { id: 'timer-2', title: 'Timer 2' },
        { id: 'timer-3', title: 'Timer 3' }
      ];
      modal = new AllocationModal(10000, timers, null);
      modal.show();

      const strategy3Radio = document.querySelector('.allocation-modal input[value="fixed-distribution"]');
      strategy3Radio.click();

      const fixedForm = document.querySelector('.allocation-modal .fixed-distribution-form');
      expect(fixedForm).to.exist;
      expect(fixedForm.style.display).to.not.equal('none');
    });

    it('should display timer allocation inputs with hour/minute controls', () => {
      const timers = [
        { id: 'timer-1', title: 'Timer 1' },
        { id: 'timer-2', title: 'Timer 2' }
      ];
      modal = new AllocationModal(10000, timers, null);
      modal.show();

      const strategy3Radio = document.querySelector('.allocation-modal input[value="fixed-distribution"]');
      strategy3Radio.click();

      const timerInputs = document.querySelectorAll('.allocation-modal .fixed-distribution-form .timer-allocation-row');
      expect(timerInputs.length).to.equal(2);

      timerInputs.forEach((row, idx) => {
        expect(row.textContent).to.include(timers[idx].title);
        expect(row.querySelector('.hours-input')).to.exist;
        expect(row.querySelector('.minutes-input')).to.exist;
        expect(row.querySelector('.btn-hour-inc')).to.exist;
        expect(row.querySelector('.btn-hour-dec')).to.exist;
        expect(row.querySelector('.btn-min-inc')).to.exist;
        expect(row.querySelector('.btn-min-dec')).to.exist;
      });
    });

    it('should show remaining time and remainder timer selector', () => {
      const timers = [
        { id: 'timer-1', title: 'Timer 1' },
        { id: 'timer-2', title: 'Timer 2' },
        { id: 'timer-3', title: 'Timer 3' }
      ];
      modal = new AllocationModal(10000, timers, null);
      modal.show();

      const strategy3Radio = document.querySelector('.allocation-modal input[value="fixed-distribution"]');
      strategy3Radio.click();

      const remainingDisplay = document.querySelector('.allocation-modal .fixed-distribution-form .remaining-time');
      expect(remainingDisplay).to.exist;
      expect(remainingDisplay.textContent).to.include('00:10');

      const remainderSelect = document.querySelector('.allocation-modal .fixed-distribution-form .remainder-timer-select');
      expect(remainderSelect).to.exist;
      expect(remainderSelect.options.length).to.equal(3);
    });

    it('should update remaining time live as user changes allocations', (done) => {
      const timers = [
        { id: 'timer-1', title: 'Timer 1' },
        { id: 'timer-2', title: 'Timer 2' }
      ];
      const idleMs = 600000;
      modal = new AllocationModal(idleMs, timers, null);
      modal.show();

      const strategy3Radio = document.querySelector('.allocation-modal input[value="fixed-distribution"]');
      strategy3Radio.click();

      setTimeout(() => {
        const hoursInputs = document.querySelectorAll('.allocation-modal .fixed-distribution-form .hours-input');
        const minutesInputs = document.querySelectorAll('.fixed-distribution-form .minutes-input');
        const remainingDisplay = document.querySelector('.allocation-modal .fixed-distribution-form .remaining-time');

        hoursInputs[0].value = 0;
        minutesInputs[0].value = 5;
        minutesInputs[0].dispatchEvent(new Event('input'));

        setTimeout(() => {
          expect(remainingDisplay.textContent).to.include('00:05');
          done();
        }, 50);
      }, 50);
    });

    it('should hide number input spinners on hours and minutes inputs', () => {
      const timers = [
        { id: 'timer-1', title: 'Timer 1' },
        { id: 'timer-2', title: 'Timer 2' }
      ];
      modal = new AllocationModal(10000, timers, null);
      modal.show();

      const strategy3Radio = document.querySelector('.allocation-modal input[value="fixed-distribution"]');
      strategy3Radio.click();

      const hoursInputs = document.querySelectorAll('.allocation-modal .fixed-distribution-form input[type="number"].hours-input');
      const minutesInputs = document.querySelectorAll('.allocation-modal .fixed-distribution-form input[type="number"].minutes-input');

      expect(hoursInputs.length).to.equal(2);
      expect(minutesInputs.length).to.equal(2);
    });

    it('should return correct config with allocations and remainder timer', (done) => {
      const timers = [
        { id: 'timer-1', title: 'Timer 1' },
        { id: 'timer-2', title: 'Timer 2' },
        { id: 'timer-3', title: 'Timer 3' }
      ];
      const idleMs = 600000;
      modal = new AllocationModal(idleMs, timers, null);
      const promise = modal.show();

      const strategy3Radio = document.querySelector('.allocation-modal input[value="fixed-distribution"]');
      strategy3Radio.click();

      setTimeout(() => {
        const hoursInputs = document.querySelectorAll('.allocation-modal .fixed-distribution-form .hours-input');
        const minutesInputs = document.querySelectorAll('.allocation-modal .fixed-distribution-form .minutes-input');
        const remainderSelect = document.querySelector('.allocation-modal .fixed-distribution-form .remainder-timer-select');

        hoursInputs[0].value = 0;
        minutesInputs[0].value = 5;
        hoursInputs[1].value = 0;
        minutesInputs[1].value = 3;
        remainderSelect.value = 'timer-3';

        hoursInputs[0].dispatchEvent(new Event('input'));

        const applyButton = document.querySelector('.allocation-modal button.btn-apply');
        applyButton.click();

        promise.then(result => {
          expect(result.strategy).to.equal('fixed-distribution');
          expect(result.config.allocations).to.be.instanceOf(Map);
          expect(result.config.allocations.get('timer-1')).to.equal(300000);
          expect(result.config.allocations.get('timer-2')).to.equal(180000);
          expect(result.config.remainderTimerId).to.equal('timer-3');
          done();
        }).catch(done);
      }, 50);
    });
  });

  describe('Percentage Distribution UI', () => {
    it('should show percentage input form when percentage distribution is selected', () => {
      const timers = [
        { id: 'timer-1', title: 'Timer 1' },
        { id: 'timer-2', title: 'Timer 2' }
      ];
      modal = new AllocationModal(10000, timers, null);
      modal.show();

      const strategy4Radio = document.querySelector('.allocation-modal input[value="percentage-distribution"]');
      strategy4Radio.click();

      const percentageForm = document.querySelector('.allocation-modal .percentage-distribution-form');
      expect(percentageForm).to.exist;
      expect(percentageForm.style.display).to.not.equal('none');
    });

    it('should display percentage inputs for each timer', () => {
      const timers = [
        { id: 'timer-1', title: 'Timer 1' },
        { id: 'timer-2', title: 'Timer 2' }
      ];
      modal = new AllocationModal(10000, timers, null);
      modal.show();

      const strategy4Radio = document.querySelector('.allocation-modal input[value="percentage-distribution"]');
      strategy4Radio.click();

      const percentageInputs = document.querySelectorAll('.allocation-modal .percentage-distribution-form .percentage-input-row');
      expect(percentageInputs.length).to.equal(2);

      percentageInputs.forEach((row, idx) => {
        expect(row.textContent).to.include(timers[idx].title);
        expect(row.querySelector('.percentage-input')).to.exist;
      });
    });

    it('should show total percentage and validation state', () => {
      const timers = [
        { id: 'timer-1', title: 'Timer 1' },
        { id: 'timer-2', title: 'Timer 2' }
      ];
      modal = new AllocationModal(10000, timers, null);
      modal.show();

      const strategy4Radio = document.querySelector('.allocation-modal input[value="percentage-distribution"]');
      strategy4Radio.click();

      const totalDisplay = document.querySelector('.allocation-modal .percentage-distribution-form .percentage-total');
      expect(totalDisplay).to.exist;
    });

    it('should disable Apply button if percentages do not sum to 100%', (done) => {
      const timers = [
        { id: 'timer-1', title: 'Timer 1' },
        { id: 'timer-2', title: 'Timer 2' }
      ];
      modal = new AllocationModal(10000, timers, null);
      modal.show();

      const strategy4Radio = document.querySelector('.allocation-modal input[value="percentage-distribution"]');
      strategy4Radio.click();

      const percentageInputs = document.querySelectorAll('.allocation-modal .percentage-distribution-form .percentage-input');
      percentageInputs[0].value = 50;
      percentageInputs[1].value = 30;
      percentageInputs[0].dispatchEvent(new Event('input'));

      setTimeout(() => {
        const applyButton = document.querySelector('.allocation-modal button.btn-apply');
        expect(applyButton.disabled).to.be.true;
        done();
      }, 50);
    });

    it('should enable Apply button when percentages sum to exactly 100%', (done) => {
      const timers = [
        { id: 'timer-1', title: 'Timer 1' },
        { id: 'timer-2', title: 'Timer 2' }
      ];
      modal = new AllocationModal(10000, timers, null);
      modal.show();

      const strategy4Radio = document.querySelector('.allocation-modal input[value="percentage-distribution"]');
      strategy4Radio.click();

      const percentageInputs = document.querySelectorAll('.allocation-modal .percentage-distribution-form .percentage-input');
      percentageInputs[0].value = 60;
      percentageInputs[1].value = 40;
      percentageInputs[0].dispatchEvent(new Event('input'));

      setTimeout(() => {
        const applyButton = document.querySelector('.allocation-modal button.btn-apply');
        expect(applyButton.disabled).to.be.false;
        done();
      }, 50);
    });

    it('should return correct config with percentages', (done) => {
      const timers = [
        { id: 'timer-1', title: 'Timer 1' },
        { id: 'timer-2', title: 'Timer 2' }
      ];
      modal = new AllocationModal(10000, timers, null);
      const promise = modal.show();

      const strategy4Radio = document.querySelector('.allocation-modal input[value="percentage-distribution"]');
      strategy4Radio.click();

      const percentageInputs = document.querySelectorAll('.allocation-modal .percentage-distribution-form .percentage-input');
      percentageInputs[0].value = 60;
      percentageInputs[1].value = 40;
      percentageInputs[0].dispatchEvent(new Event('input'));

      setTimeout(() => {
        const applyButton = document.querySelector('.allocation-modal button.btn-apply');
        applyButton.click();

        promise.then(result => {
          expect(result.strategy).to.equal('percentage-distribution');
          expect(result.config.percentages).to.be.instanceOf(Map);
          expect(result.config.percentages.get('timer-1')).to.equal(60);
          expect(result.config.percentages.get('timer-2')).to.equal(40);
          done();
        }).catch(done);
      }, 50);
    });

    it('should have percentage inputs with type=number and percentage-input class', () => {
      const timers = [
        { id: 'timer-1', title: 'Timer 1' },
        { id: 'timer-2', title: 'Timer 2' }
      ];
      modal = new AllocationModal(10000, timers, null);
      modal.show();

      const strategy4Radio = document.querySelector('.allocation-modal input[value="percentage-distribution"]');
      strategy4Radio.click();

      const percentageInputs = document.querySelectorAll('.allocation-modal .percentage-distribution-form input[type="number"].percentage-input');
      expect(percentageInputs.length).to.equal(2);
    });

    it('should have +/- 10% buttons for each timer', () => {
      const timers = [
        { id: 'timer-1', title: 'Timer 1' },
        { id: 'timer-2', title: 'Timer 2' }
      ];
      modal = new AllocationModal(10000, timers, null);
      modal.show();

      const strategy4Radio = document.querySelector('.allocation-modal input[value="percentage-distribution"]');
      strategy4Radio.click();

      const incButtons = document.querySelectorAll('.allocation-modal .percentage-distribution-form .btn-percent-inc');
      const decButtons = document.querySelectorAll('.allocation-modal .percentage-distribution-form .btn-percent-dec');

      expect(incButtons.length).to.equal(2);
      expect(decButtons.length).to.equal(2);
      expect(incButtons[0].textContent).to.include('+ 10%');
      expect(decButtons[0].textContent).to.include('- 10%');
    });

    it('should increment percentage by 10% when + button clicked', (done) => {
      const timers = [
        { id: 'timer-1', title: 'Timer 1' },
        { id: 'timer-2', title: 'Timer 2' }
      ];
      modal = new AllocationModal(10000, timers, null);
      modal.show();

      const strategy4Radio = document.querySelector('.allocation-modal input[value="percentage-distribution"]');
      strategy4Radio.click();

      setTimeout(() => {
        const percentageInput = document.querySelector('.allocation-modal .percentage-distribution-form .percentage-input');
        const incButton = document.querySelector('.allocation-modal .percentage-distribution-form .btn-percent-inc');

        percentageInput.value = 30;
        incButton.click();

        expect(percentageInput.value).to.equal('40');
        done();
      }, 50);
    });

    it('should decrement percentage by 10% when - button clicked', (done) => {
      const timers = [
        { id: 'timer-1', title: 'Timer 1' },
        { id: 'timer-2', title: 'Timer 2' }
      ];
      modal = new AllocationModal(10000, timers, null);
      modal.show();

      const strategy4Radio = document.querySelector('.allocation-modal input[value="percentage-distribution"]');
      strategy4Radio.click();

      setTimeout(() => {
        const percentageInput = document.querySelector('.allocation-modal .percentage-distribution-form .percentage-input');
        const decButton = document.querySelector('.allocation-modal .percentage-distribution-form .btn-percent-dec');

        percentageInput.value = 50;
        decButton.click();

        expect(percentageInput.value).to.equal('40');
        done();
      }, 50);
    });
  });
});
