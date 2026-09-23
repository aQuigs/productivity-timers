import { expect } from '@esm-bundle/chai';
import { AllocationModal } from '../js/allocationModal.js';
import { DISCARD_REMAINDER } from '../js/timeDistributor.js';

const TIMERS = [
  { id: 'timer-1', title: 'Timer 1' },
  { id: 'timer-2', title: 'Timer 2' }
];

describe('AllocationModal', () => {
  let modal;

  function show(idleMs, timers = TIMERS, previousRunningId = null) {
    modal = new AllocationModal(idleMs, timers, previousRunningId);
    return modal.show();
  }

  function query(selector) {
    return document.querySelector(`.allocation-modal ${selector}`);
  }

  function queryAll(selector) {
    return document.querySelectorAll(`.allocation-modal ${selector}`);
  }

  function radio(value) {
    return query(`input[value="${value}"]`);
  }

  function choose(value) {
    const input = radio(value);
    input.checked = true;
    input.dispatchEvent(new Event('change'));
  }

  function apply() {
    query('button.btn-apply').click();
  }

  function applyDisabled() {
    return query('button.btn-apply').disabled;
  }

  function pressEscape() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  }

  function isVisible(el) {
    return el.getClientRects().length > 0;
  }

  function setInput(input, value) {
    input.value = String(value);
    input.dispatchEvent(new Event('input'));
  }

  function setHours(index, value) {
    setInput(queryAll('.fixed-distribution-form .hours-input')[index], value);
  }

  function setMinutes(index, value) {
    setInput(queryAll('.fixed-distribution-form .minutes-input')[index], value);
  }

  function setPercentages(values) {
    const inputs = queryAll('.percentage-distribution-form .percentage-input');
    values.forEach((value, index) => setInput(inputs[index], value));
  }

  function remainderSelect() {
    return query('.fixed-distribution-form .remainder-timer-select');
  }

  function remainingText() {
    return query('.fixed-distribution-form .remaining-time').textContent;
  }

  function totalText() {
    return query('.percentage-distribution-form .percentage-total').textContent;
  }

  function errorIn(formSelector) {
    return query(`${formSelector} .allocation-error`);
  }

  // A refused Apply leaves show() unresolved; the resolution itself is synchronous
  async function stillPending(promise) {
    let resolved = false;
    promise.then(() => { resolved = true; });
    await new Promise(resolve => setTimeout(resolve, 0));
    return !resolved;
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    // Escape cancels a modal still open, which also stops its idle-time polling
    pressEscape();
    document.querySelectorAll('.allocation-modal').forEach(el => el.remove());
    modal = null;
    localStorage.clear();
  });

  describe('Rendering', () => {
    it('should render a labelled dialog into the body showing the idle time', () => {
      show(60000);

      const modalElement = document.querySelector('.allocation-modal');
      expect(modalElement.parentNode).to.equal(document.body);

      const dialog = query('.modal-dialog');
      const title = query('.modal-title');
      expect(dialog.getAttribute('role')).to.equal('dialog');
      expect(dialog.getAttribute('aria-modal')).to.equal('true');
      expect(title.id).to.be.a('string').and.not.empty;
      expect(dialog.getAttribute('aria-labelledby')).to.equal(title.id);
      expect(title.textContent).to.include('Allocate Idle Time');
      expect(query('.idle-time-display').textContent).to.equal('00:01:00');
    });
  });

  describe('Strategy Options', () => {
    it('should offer the five strategies as one radio group', () => {
      show(60000);

      const radios = Array.from(queryAll('input[type="radio"][name="strategy"]'));
      expect(radios.map(input => input.value)).to.deep.equal([
        'previous-timer',
        'selected-timer',
        'fixed-distribution',
        'percentage-distribution',
        'discard'
      ]);
    });

    it('should default to the previous timer when one exists', () => {
      show(60000, TIMERS, 'timer-1');

      expect(radio('previous-timer').disabled).to.be.false;
      expect(radio('previous-timer').checked).to.be.true;
      expect(radio('discard').checked).to.be.false;
    });

    it('should default to discard and disable the previous-timer option when nothing was running', () => {
      show(60000);

      expect(radio('previous-timer').disabled).to.be.true;
      expect(radio('previous-timer').checked).to.be.false;
      expect(radio('discard').checked).to.be.true;
    });

    it('should list every timer in the dropdown for the selected-timer strategy', () => {
      show(60000);

      const dropdown = query('select.timer-select');
      expect(Array.from(dropdown.options, option => option.value)).to.deep.equal(['timer-1', 'timer-2']);
      expect(Array.from(dropdown.options, option => option.textContent)).to.deep.equal(['Timer 1', 'Timer 2']);
    });

    describe('previous-timer label', () => {
      const previousOptionText = (selector) => radio('previous-timer')
        .closest('.strategy-option')
        .querySelector(selector)
        .textContent;

      it('should name the timer that was running when the previous timer is known', () => {
        show(60000, [{ id: 'timer-1', title: 'Coding' }, { id: 'timer-2', title: 'Email' }], 'timer-2');

        expect(previousOptionText('.strategy-name')).to.equal('Add all to “Email”');
        expect(previousOptionText('.strategy-desc')).to.equal(
          'Everything goes to the timer that was running when you stepped away.'
        );
      });

      it('should fall back to generic copy when the previous timer is no longer in the list', () => {
        show(60000, [{ id: 'timer-1', title: 'Coding' }], 'timer-gone');

        expect(previousOptionText('.strategy-name')).to.equal('Add all to the previous timer');
      });

      it('should say nothing was running when the option is disabled', () => {
        show(60000, [{ id: 'timer-1', title: 'Coding' }], null);

        expect(previousOptionText('.strategy-name')).to.equal('Add all to the previous timer');
        expect(previousOptionText('.strategy-desc')).to.equal('No timer was running when you stepped away.');
      });
    });
  });

  describe('Strategy detail visibility', () => {
    it('should keep every strategy option visible after switching strategies', () => {
      show(60000, TIMERS, 'timer-1');

      choose('fixed-distribution');
      choose('percentage-distribution');

      const radios = queryAll('input[name="strategy"]');
      expect(radios).to.have.lengthOf(5);
      radios.forEach(input => {
        expect(isVisible(input), `${input.value} option should stay visible`).to.be.true;
      });
    });

    it('should only show the timer dropdown while selected-timer is chosen', () => {
      show(60000, TIMERS, 'timer-1');
      const dropdown = query('select.timer-select');

      expect(isVisible(dropdown), 'hidden while the default strategy is active').to.be.false;

      choose('selected-timer');
      expect(isVisible(dropdown), 'shown once selected-timer is chosen').to.be.true;

      choose('discard');
      expect(isVisible(dropdown), 'hidden again after switching away').to.be.false;
    });

    it('should only show the fixed and percentage forms for their own strategy', () => {
      show(60000, TIMERS, 'timer-1');
      const fixedForm = query('.fixed-distribution-form');
      const percentageForm = query('.percentage-distribution-form');

      expect(isVisible(fixedForm)).to.be.false;
      expect(isVisible(percentageForm)).to.be.false;

      choose('fixed-distribution');
      expect(isVisible(fixedForm)).to.be.true;
      expect(isVisible(percentageForm)).to.be.false;

      choose('percentage-distribution');
      expect(isVisible(fixedForm)).to.be.false;
      expect(isVisible(percentageForm)).to.be.true;
    });
  });

  describe('Resolving', () => {
    it('should apply the default of discarding when nothing was running, then close', async () => {
      const promise = show(60000);

      apply();

      const result = await promise;
      expect(result.strategy).to.equal('discard');
      expect(result.config).to.deep.equal({});
      expect(document.querySelector('.allocation-modal')).to.not.exist;
    });

    it('should apply the default of giving everything to the previous timer', async () => {
      const promise = show(60000, TIMERS, 'timer-1');

      apply();

      const result = await promise;
      expect(result.strategy).to.equal('previous-timer');
      expect(result.config.timerId).to.equal('timer-1');
    });

    it('should discard and close on Cancel whatever was selected', async () => {
      const promise = show(60000, TIMERS, 'timer-1');
      choose('previous-timer');

      query('button.btn-cancel').click();

      expect((await promise).strategy).to.equal('discard');
      expect(document.querySelector('.allocation-modal')).to.not.exist;
    });

    it('should discard and close on the X button', async () => {
      const promise = show(60000, TIMERS, 'timer-1');
      choose('previous-timer');

      query('button.btn-close').click();

      expect((await promise).strategy).to.equal('discard');
      expect(document.querySelector('.allocation-modal')).to.not.exist;
    });

    it('should discard and close on Escape', async () => {
      const promise = show(60000, TIMERS, 'timer-1');
      choose('previous-timer');

      pressEscape();

      expect((await promise).strategy).to.equal('discard');
      expect(document.querySelector('.allocation-modal')).to.not.exist;
    });
  });

  describe('Fixed Distribution', () => {
    it('should show a row of hour and minute controls per timer', () => {
      show(10000);
      choose('fixed-distribution');

      const rows = queryAll('.fixed-distribution-form .timer-allocation-row');
      expect(rows.length).to.equal(2);

      rows.forEach((row, idx) => {
        expect(row.textContent).to.include(TIMERS[idx].title);
        expect(row.querySelector('.hours-input')).to.exist;
        expect(row.querySelector('.minutes-input')).to.exist;
        expect(row.querySelector('.btn-hour-inc')).to.exist;
        expect(row.querySelector('.btn-hour-dec')).to.exist;
        expect(row.querySelector('.btn-min-inc')).to.exist;
        expect(row.querySelector('.btn-min-dec')).to.exist;
      });
    });

    it('should update the remaining time as amounts are entered', () => {
      show(9000000);
      choose('fixed-distribution');
      expect(remainingText()).to.include('02:30:00');

      setHours(0, 1);
      expect(remainingText()).to.include('01:30:00');

      setMinutes(1, 5);
      expect(remainingText()).to.include('01:25:00');
    });

    it('should resolve with the amounts entered and the chosen remainder timer', async () => {
      const timers = [...TIMERS, { id: 'timer-3', title: 'Timer 3' }];
      const promise = show(600000, timers);
      choose('fixed-distribution');

      setMinutes(0, 5);
      setMinutes(1, 3);
      remainderSelect().value = 'timer-3';
      apply();

      const result = await promise;
      expect(result.strategy).to.equal('fixed-distribution');
      expect(result.config.allocations).to.be.instanceOf(Map);
      expect(result.config.allocations.get('timer-1')).to.equal(300000);
      expect(result.config.allocations.get('timer-2')).to.equal(180000);
      expect(result.config.remainderTimerId).to.equal('timer-3');
    });

    it('should treat negative inputs as zero so they cannot mask an over-allocation', async () => {
      const promise = show(3600000);
      choose('fixed-distribution');

      setHours(0, -1);
      setHours(1, 2);
      expect(remainingText()).to.include('00:00:00');

      apply();

      expect(await stillPending(promise)).to.be.true;
      expect(document.querySelector('.allocation-modal')).to.exist;
      expect(errorIn('.fixed-distribution-form').style.display).to.not.equal('none');
    });
  });

  describe('Percentage Distribution', () => {
    it('should show a percentage input per timer', () => {
      show(10000);
      choose('percentage-distribution');

      const rows = queryAll('.percentage-distribution-form .percentage-input-row');
      expect(rows.length).to.equal(2);

      rows.forEach((row, idx) => {
        expect(row.textContent).to.include(TIMERS[idx].title);
        expect(row.querySelector('.percentage-input')).to.exist;
      });
    });

    it('should step a percentage by ten with the +/- buttons', () => {
      show(10000);
      choose('percentage-distribution');

      const input = query('.percentage-distribution-form .percentage-input');
      const inc = query('.percentage-distribution-form .btn-percent-inc');
      const dec = query('.percentage-distribution-form .btn-percent-dec');
      expect(inc.textContent).to.include('+ 10%');
      expect(dec.textContent).to.include('- 10%');

      input.value = 30;
      inc.click();
      expect(input.value).to.equal('40');

      dec.click();
      expect(input.value).to.equal('30');
    });

    it('should resolve with the percentages entered', async () => {
      const promise = show(10000);
      choose('percentage-distribution');

      setPercentages([60, 40]);
      expect(applyDisabled()).to.be.false;
      apply();

      const result = await promise;
      expect(result.strategy).to.equal('percentage-distribution');
      expect(result.config.percentages).to.be.instanceOf(Map);
      expect(result.config.percentages.get('timer-1')).to.equal(60);
      expect(result.config.percentages.get('timer-2')).to.equal(40);
    });

    it('should disable Apply as soon as percentage distribution is selected with nothing allocated', () => {
      show(10000);
      expect(applyDisabled()).to.be.false;

      choose('percentage-distribution');
      expect(applyDisabled()).to.be.true;
    });

    it('should re-enable Apply when switching away from an invalid percentage split', () => {
      show(10000);
      choose('percentage-distribution');

      setPercentages([70, 50]);
      expect(applyDisabled()).to.be.true;

      choose('discard');
      expect(applyDisabled()).to.be.false;
    });

    it('should refuse a forced apply with nothing allocated', async () => {
      const promise = show(10000);
      radio('percentage-distribution').checked = true;

      apply();

      expect(await stillPending(promise)).to.be.true;
      expect(document.querySelector('.allocation-modal')).to.exist;
      expect(errorIn('.percentage-distribution-form').style.display).to.not.equal('none');
    });

    it('should treat negative percentage inputs as zero when totalling', () => {
      show(10000, [...TIMERS, { id: 'timer-3', title: 'Timer 3' }]);
      choose('percentage-distribution');

      setPercentages([-50, 100, 50]);

      expect(totalText()).to.include('Total: 150%');
      expect(applyDisabled()).to.be.true;
    });
  });

  describe('Dynamic Time Updates', () => {
    it('should resolve with the initial idle time when it never changed', async () => {
      const promise = show(60000);

      apply();

      expect((await promise).idleMs).to.equal(60000);
    });

    it('should follow the accumulated idle total while open and resolve with the latest value', async () => {
      localStorage.setItem('accumulated_idle_ms', '15000');
      const promise = show(15000, TIMERS, 'timer-1');
      choose('fixed-distribution');
      expect(query('.idle-time-display').textContent).to.equal('00:00:15');
      expect(remainingText()).to.include('00:00:15');

      localStorage.setItem('accumulated_idle_ms', '25000');
      await wait(600);

      expect(query('.idle-time-display').textContent).to.equal('00:00:25');
      expect(remainingText()).to.include('00:00:25');

      choose('previous-timer');
      apply();

      const result = await promise;
      expect(result.strategy).to.equal('previous-timer');
      expect(result.idleMs).to.equal(25000);
    });
  });

  describe('Discarding part of the idle time', () => {
    const discardConfirm = () => query('.percentage-distribution-form .percentage-discard-checkbox');
    const discardConfirmLabel = () => discardConfirm().closest('label');
    const confirmDiscard = (checked = true) => {
      discardConfirm().checked = checked;
      discardConfirm().dispatchEvent(new Event('change'));
    };

    it('should offer discarding the rest after the timers in the remainder dropdown', () => {
      show(600000);
      choose('fixed-distribution');

      const options = Array.from(remainderSelect().options);
      expect(options.length).to.equal(3);
      expect(options[options.length - 1].value).to.equal(DISCARD_REMAINDER);
      expect(options[options.length - 1].textContent).to.include('Discard');
      expect(remainderSelect().value, 'first timer stays the default').to.equal('timer-1');
    });

    it('should resolve a fixed split with the remainder discarded', async () => {
      const promise = show(600000);
      choose('fixed-distribution');

      setMinutes(0, 5);
      remainderSelect().value = DISCARD_REMAINDER;
      apply();

      const result = await promise;
      expect(result.strategy).to.equal('fixed-distribution');
      expect(result.config.allocations.get('timer-1')).to.equal(300000);
      expect(result.config.allocations.has('timer-2')).to.be.false;
      expect(result.config.remainderTimerId).to.equal(DISCARD_REMAINDER);
    });

    it('should say the leftover is discarded once the remainder is dropped', () => {
      show(600000);
      choose('fixed-distribution');

      setMinutes(0, 5);
      expect(remainingText()).to.include('05:00');
      expect(remainingText()).to.not.match(/discard/i);

      remainderSelect().value = DISCARD_REMAINDER;
      remainderSelect().dispatchEvent(new Event('change'));

      expect(remainingText()).to.include('05:00');
      expect(remainingText()).to.match(/discard/i);
    });

    it('should let a percentage split under 100 apply once the discard is confirmed', async () => {
      const promise = show(600000);
      choose('percentage-distribution');

      setPercentages([50, 30]);
      expect(applyDisabled(), 'apply blocked until the leftover is confirmed').to.be.true;
      confirmDiscard();
      expect(applyDisabled(), 'apply allowed once confirmed').to.be.false;
      apply();

      const result = await promise;
      expect(result.strategy).to.equal('percentage-distribution');
      expect(result.config.percentages.get('timer-1')).to.equal(50);
      expect(result.config.percentages.get('timer-2')).to.equal(30);
      expect(result.config.remainderTimerId).to.equal(DISCARD_REMAINDER);
    });

    it('should ask before discarding, naming the share left over', () => {
      show(600000);
      choose('percentage-distribution');

      expect(isVisible(discardConfirm()), 'hidden with nothing allocated').to.be.false;

      setPercentages([50, 30]);
      expect(isVisible(discardConfirm()), 'shown once part of the time is unallocated').to.be.true;
      expect(discardConfirm().checked, 'unticked by default').to.be.false;
      expect(discardConfirmLabel().textContent).to.include('20%');

      setPercentages([50, 20]);
      expect(discardConfirmLabel().textContent, 'follows the split').to.include('30%');

      setPercentages([50, 50]);
      expect(isVisible(discardConfirm()), 'hidden once the split totals 100').to.be.false;
      expect(applyDisabled()).to.be.false;
    });

    it('should call the leftover unallocated until it is confirmed discarded', () => {
      show(600000);
      choose('percentage-distribution');

      setPercentages([50, 30]);
      expect(totalText()).to.include('80%');
      expect(totalText()).to.include('20% unallocated');

      confirmDiscard();
      expect(totalText()).to.include('20% discarded');

      setPercentages([50, 50]);
      expect(totalText()).to.include('100%');
      expect(totalText()).to.not.match(/discard|unallocated/i);
    });

    it('should block Apply again when the discard is unconfirmed', () => {
      show(600000);
      choose('percentage-distribution');

      setPercentages([50, 30]);
      confirmDiscard();
      expect(applyDisabled()).to.be.false;

      confirmDiscard(false);
      expect(applyDisabled()).to.be.true;
    });

    it('should require confirming again after the split returns to 100 and drops back below', () => {
      show(600000);
      choose('percentage-distribution');

      setPercentages([50, 30]);
      confirmDiscard();

      setPercentages([50, 50]);
      setPercentages([50, 30]);

      expect(discardConfirm().checked, 'the stale confirmation is cleared').to.be.false;
      expect(applyDisabled()).to.be.true;
    });

    it('should refuse a forced apply of a split whose leftover is unconfirmed', async () => {
      const promise = show(600000);
      choose('percentage-distribution');
      setPercentages([50, 30]);
      query('button.btn-apply').disabled = false;

      apply();

      expect(await stillPending(promise), 'nothing was allocated').to.be.true;
      const error = errorIn('.percentage-distribution-form');
      expect(error.style.display).to.not.equal('none');
      expect(error.textContent).to.include('20%');
    });

    it('should keep giving rounding dust to a timer when the split totals 100', async () => {
      const promise = show(600000);
      choose('percentage-distribution');

      setPercentages([50, 50]);
      apply();

      expect((await promise).config.remainderTimerId).to.be.undefined;
    });

    it('should still refuse a percentage split over 100', () => {
      show(600000);
      choose('percentage-distribution');

      setPercentages([70, 50]);
      expect(totalText()).to.include('120%');
      expect(applyDisabled()).to.be.true;
    });

    it('should still refuse a percentage split that allocates nothing', () => {
      show(600000);
      choose('percentage-distribution');

      setPercentages([0, 0]);
      expect(applyDisabled()).to.be.true;
    });
  });

  describe('Make-running checkbox', () => {
    const checkbox = () => query('.timer-select-detail input.make-running-checkbox');

    it('should render an unchecked, labelled checkbox in the selected-timer detail', () => {
      show(60000, TIMERS, 'timer-1');

      const box = checkbox();
      expect(box.type).to.equal('checkbox');
      expect(box.checked).to.be.false;
      expect(box.closest('label').textContent).to.include('Make this the running timer');
    });

    it('should only show the checkbox while selected-timer is chosen', () => {
      show(60000, TIMERS, 'timer-1');

      expect(isVisible(checkbox()), 'hidden under the default strategy').to.be.false;
      choose('selected-timer');
      expect(isVisible(checkbox()), 'shown once selected-timer is chosen').to.be.true;
      choose('discard');
      expect(isVisible(checkbox()), 'hidden again after switching away').to.be.false;
    });

    it('should resolve selected-timer with makeRunning false when unchecked', async () => {
      const promise = show(60000, TIMERS, 'timer-1');

      choose('selected-timer');
      query('select.timer-select').value = 'timer-2';
      apply();

      const result = await promise;
      expect(result.strategy).to.equal('selected-timer');
      expect(result.config.timerId).to.equal('timer-2');
      expect(result.config.makeRunning).to.be.false;
    });

    it('should resolve selected-timer with makeRunning true when checked', async () => {
      const promise = show(60000, TIMERS, 'timer-1');

      choose('selected-timer');
      query('select.timer-select').value = 'timer-2';
      checkbox().click();
      apply();

      const result = await promise;
      expect(result.strategy).to.equal('selected-timer');
      expect(result.config.timerId).to.equal('timer-2');
      expect(result.config.makeRunning).to.be.true;
    });

    it('should not report makeRunning for other strategies even if it was ticked', async () => {
      const promise = show(60000, TIMERS, 'timer-1');

      choose('selected-timer');
      checkbox().click();
      choose('previous-timer');
      apply();

      const result = await promise;
      expect(result.strategy).to.equal('previous-timer');
      expect(result.config).to.not.have.property('makeRunning');
    });
  });
});
