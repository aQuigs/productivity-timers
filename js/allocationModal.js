import { formatDuration } from './formatDuration.js';

const STRATEGY_COPY = {
  'previous-timer': {
    name: 'Add all to the previous timer',
    description: 'Everything goes to the timer that was running when you stepped away.'
  },
  'selected-timer': {
    name: 'Add all to one timer',
    description: 'Pick any timer to receive the whole block.'
  },
  'fixed-distribution': {
    name: 'Split by fixed amounts',
    description: 'Give each timer a set number of hours and minutes.'
  },
  'percentage-distribution': {
    name: 'Split by percentage',
    description: 'Divide the time proportionally. Percentages must add up to 100.'
  },
  'discard': {
    name: 'Discard it',
    description: 'Nothing is added. Timers resume where they left off.'
  }
};

export class AllocationModal {
  constructor(idleMs, timers, previousRunningId) {
    this.idleMs = idleMs;
    this.timers = timers;
    this.previousRunningId = previousRunningId;
    this.modalElement = null;
    this.resolvePromise = null;
    this.fixedAllocations = new Map();
    this.percentageAllocations = new Map();
    this.updateInterval = null;
  }

  #formatTime(ms) {
    return formatDuration(ms);
  }

  #hhmmToMs(hours, minutes) {
    return (hours * 3600 + minutes * 60) * 1000;
  }

  #createStrategyOption(value, disabled = false) {
    const container = document.createElement('div');
    container.className = 'strategy-option';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'strategy';
    radio.value = value;
    radio.disabled = disabled;
    if (value === 'discard') {
      radio.checked = true;
    }
    radio.addEventListener('change', () => this.#updateStrategyForms());

    const text = document.createElement('span');
    text.className = 'strategy-text';

    const name = document.createElement('span');
    name.className = 'strategy-name';
    name.textContent = STRATEGY_COPY[value].name;

    const description = document.createElement('span');
    description.className = 'strategy-desc';
    description.textContent = STRATEGY_COPY[value].description;

    text.appendChild(name);
    text.appendChild(description);

    const labelElement = document.createElement('label');
    labelElement.className = 'strategy-label';
    labelElement.appendChild(radio);
    labelElement.appendChild(text);

    container.appendChild(labelElement);
    return container;
  }

  #createTimerDropdown() {
    const select = document.createElement('select');
    select.className = 'timer-select';
    select.setAttribute('aria-label', 'Timer to receive the idle time');

    this.timers.forEach(timer => {
      const option = document.createElement('option');
      option.value = timer.id;
      option.textContent = timer.title;
      select.appendChild(option);
    });

    return select;
  }

  #createStepButton(className, text, ariaLabel, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = text;
    button.setAttribute('aria-label', ariaLabel);
    button.addEventListener('click', (e) => {
      e.preventDefault();
      onClick();
    });
    return button;
  }

  #createNumberInput(className, timer, unitLabel, max) {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = className;
    input.inputMode = 'numeric';
    input.min = '0';
    if (max !== undefined) {
      input.max = String(max);
    }
    input.value = '0';
    input.dataset.timerId = timer.id;
    input.setAttribute('aria-label', `${timer.title} ${unitLabel}`);
    return input;
  }

  #createStepper(children) {
    const stepper = document.createElement('div');
    stepper.className = 'stepper';
    children.forEach(child => stepper.appendChild(child));
    return stepper;
  }

  #createFixedDistributionForm() {
    const form = document.createElement('div');
    form.className = 'fixed-distribution-form strategy-detail';
    form.style.display = 'none';

    const errorMsg = document.createElement('p');
    errorMsg.className = 'allocation-error';
    errorMsg.setAttribute('role', 'alert');
    errorMsg.style.display = 'none';
    form.appendChild(errorMsg);

    this.timers.forEach(timer => {
      const row = document.createElement('div');
      row.className = 'timer-allocation-row';

      const label = document.createElement('label');
      label.textContent = timer.title;

      const hoursInput = this.#createNumberInput('hours-input', timer, 'hours');
      const minutesInput = this.#createNumberInput('minutes-input', timer, 'minutes', 59);

      const bump = (input, delta, max = Infinity) => {
        input.value = String(Math.min(max, Math.max(0, Number(input.value) + delta)));
        input.dispatchEvent(new Event('input'));
      };

      const hourDecBtn = this.#createStepButton('btn-hour-dec', '- 1h', `Remove one hour from ${timer.title}`, () => bump(hoursInput, -1));
      const hourIncBtn = this.#createStepButton('btn-hour-inc', '+ 1h', `Add one hour to ${timer.title}`, () => bump(hoursInput, 1));
      const minDecBtn = this.#createStepButton('btn-min-dec', '- 1m', `Remove one minute from ${timer.title}`, () => bump(minutesInput, -1, 59));
      const minIncBtn = this.#createStepButton('btn-min-inc', '+ 1m', `Add one minute to ${timer.title}`, () => bump(minutesInput, 1, 59));

      hoursInput.addEventListener('input', () => this.#updateFixedRemaining());
      minutesInput.addEventListener('input', () => this.#updateFixedRemaining());

      row.appendChild(label);
      row.appendChild(this.#createStepper([hourDecBtn, hoursInput, hourIncBtn]));
      row.appendChild(this.#createStepper([minDecBtn, minutesInput, minIncBtn]));

      form.appendChild(row);
    });

    const remainingContainer = document.createElement('div');
    remainingContainer.className = 'fixed-distribution-remaining';

    const remainingDisplay = document.createElement('p');
    remainingDisplay.className = 'remaining-time';
    remainingDisplay.textContent = `Remaining: ${this.#formatTime(this.idleMs)}`;

    const remainderSelect = document.createElement('select');
    remainderSelect.className = 'remainder-timer-select';
    remainderSelect.id = 'remainder-timer-select';
    this.timers.forEach(timer => {
      const option = document.createElement('option');
      option.value = timer.id;
      option.textContent = timer.title;
      remainderSelect.appendChild(option);
    });

    const remainderLabel = document.createElement('label');
    remainderLabel.textContent = 'Remainder goes to';
    remainderLabel.htmlFor = remainderSelect.id;

    remainingContainer.appendChild(remainingDisplay);
    remainingContainer.appendChild(remainderLabel);
    remainingContainer.appendChild(remainderSelect);
    form.appendChild(remainingContainer);

    return form;
  }

  #createPercentageDistributionForm() {
    const form = document.createElement('div');
    form.className = 'percentage-distribution-form strategy-detail';
    form.style.display = 'none';

    this.timers.forEach(timer => {
      const row = document.createElement('div');
      row.className = 'percentage-input-row';

      const label = document.createElement('label');
      label.textContent = timer.title;

      const input = this.#createNumberInput('percentage-input', timer, 'percent', 100);
      input.addEventListener('input', () => this.#updatePercentageValidation());

      const bump = (delta) => {
        input.value = String(Math.min(100, Math.max(0, Number(input.value) + delta)));
        input.dispatchEvent(new Event('input'));
      };

      const decBtn = this.#createStepButton('btn-percent-dec', '- 10%', `Remove ten percent from ${timer.title}`, () => bump(-10));
      const incBtn = this.#createStepButton('btn-percent-inc', '+ 10%', `Add ten percent to ${timer.title}`, () => bump(10));

      const unit = document.createElement('span');
      unit.className = 'stepper-unit';
      unit.textContent = '%';

      row.appendChild(label);
      row.appendChild(this.#createStepper([decBtn, input, unit, incBtn]));

      form.appendChild(row);
    });

    const totalContainer = document.createElement('div');
    totalContainer.className = 'percentage-validation';

    const totalDisplay = document.createElement('p');
    totalDisplay.className = 'percentage-total';
    totalDisplay.textContent = 'Total: 0%';

    const meter = document.createElement('div');
    meter.className = 'percentage-meter';
    meter.setAttribute('aria-hidden', 'true');
    const meterFill = document.createElement('div');
    meterFill.className = 'percentage-meter-fill';
    meter.appendChild(meterFill);

    totalContainer.appendChild(totalDisplay);
    totalContainer.appendChild(meter);
    form.appendChild(totalContainer);

    return form;
  }

  #updateStrategyForms() {
    const selectedRadio = this.modalElement.querySelector('input[name="strategy"]:checked');
    const strategy = selectedRadio.value;

    const fixedForm = this.modalElement.querySelector('.fixed-distribution-form');
    const percentageForm = this.modalElement.querySelector('.percentage-distribution-form');
    const timerDetail = this.modalElement.querySelector('.timer-select-detail');

    fixedForm.style.display = strategy === 'fixed-distribution' ? 'block' : 'none';
    percentageForm.style.display = strategy === 'percentage-distribution' ? 'block' : 'none';
    timerDetail.style.display = strategy === 'selected-timer' ? 'block' : 'none';

    const applyButton = this.modalElement.querySelector('.btn-apply');
    if (strategy === 'percentage-distribution') {
      this.#updatePercentageValidation();
    } else {
      applyButton.disabled = false;
    }
  }

  #updateFixedRemaining() {
    if (!this.modalElement) return;

    const hoursInputs = this.modalElement.querySelectorAll('.fixed-distribution-form .hours-input');
    const minutesInputs = this.modalElement.querySelectorAll('.fixed-distribution-form .minutes-input');

    let allocatedMs = 0;
    hoursInputs.forEach((input, idx) => {
      const hours = Number(input.value) || 0;
      const minutes = Number(minutesInputs[idx].value) || 0;
      allocatedMs += this.#hhmmToMs(hours, minutes);
    });

    const remainingMs = Math.max(0, this.idleMs - allocatedMs);
    const remainingDisplay = this.modalElement.querySelector('.fixed-distribution-form .remaining-time');
    if (remainingDisplay) {
      remainingDisplay.textContent = `Remaining: ${this.#formatTime(remainingMs)}`;
    }
  }

  #updatePercentageValidation() {
    const form = this.modalElement.querySelector('.percentage-distribution-form');
    const inputs = form.querySelectorAll('.percentage-input');
    let total = 0;
    inputs.forEach(input => {
      total += Number(input.value) || 0;
    });

    const totalDisplay = form.querySelector('.percentage-total');
    if (totalDisplay) {
      totalDisplay.textContent = `Total: ${total}%`;
      totalDisplay.className = total === 100 ? 'percentage-total valid' : 'percentage-total invalid';
    }

    const meterFill = form.querySelector('.percentage-meter-fill');
    if (meterFill) {
      meterFill.style.setProperty('--pct', `${Math.min(100, total)}%`);
    }

    const applyButton = this.modalElement.querySelector('.btn-apply');
    applyButton.disabled = total !== 100;
  }

  #getSelectedStrategy() {
    const selectedRadio = this.modalElement.querySelector('input[name="strategy"]:checked');
    const strategy = selectedRadio.value;
    const config = {};

    if (strategy === 'previous-timer') {
      config.timerId = this.previousRunningId;
    } else if (strategy === 'selected-timer') {
      const dropdown = this.modalElement.querySelector('select.timer-select');
      config.timerId = dropdown.value;
    } else if (strategy === 'fixed-distribution') {
      config.allocations = new Map();
      const hoursInputs = this.modalElement.querySelectorAll('.fixed-distribution-form .hours-input');
      const minutesInputs = this.modalElement.querySelectorAll('.fixed-distribution-form .minutes-input');

      hoursInputs.forEach((input, idx) => {
        const timerId = input.dataset.timerId;
        const hours = Number(input.value) || 0;
        const minutes = Number(minutesInputs[idx].value) || 0;
        const ms = this.#hhmmToMs(hours, minutes);
        if (ms > 0) {
          config.allocations.set(timerId, ms);
        }
      });

      const remainderSelect = this.modalElement.querySelector('.fixed-distribution-form .remainder-timer-select');
      config.remainderTimerId = remainderSelect.value;
    } else if (strategy === 'percentage-distribution') {
      config.percentages = new Map();
      const inputs = this.modalElement.querySelectorAll('.percentage-distribution-form .percentage-input');

      inputs.forEach(input => {
        const timerId = input.dataset.timerId;
        const percentage = Number(input.value) || 0;
        if (percentage > 0) {
          config.percentages.set(timerId, percentage);
        }
      });
    }

    return { strategy, config };
  }

  #validateFixedAllocation() {
    const hoursInputs = this.modalElement.querySelectorAll('.fixed-distribution-form .hours-input');
    const minutesInputs = this.modalElement.querySelectorAll('.fixed-distribution-form .minutes-input');

    let allocatedMs = 0;
    hoursInputs.forEach((input, idx) => {
      const hours = Number(input.value) || 0;
      const minutes = Number(minutesInputs[idx].value) || 0;
      allocatedMs += this.#hhmmToMs(hours, minutes);
    });

    const errorMsg = this.modalElement.querySelector('.fixed-distribution-form .allocation-error');
    if (allocatedMs > this.idleMs) {
      if (errorMsg) {
        errorMsg.textContent = `Allocated time exceeds the idle time by ${this.#formatTime(allocatedMs - this.idleMs)}`;
        errorMsg.style.display = 'block';
      }
      return false;
    }

    if (errorMsg) {
      errorMsg.style.display = 'none';
    }
    return true;
  }

  #handleApply() {
    const selectedRadio = this.modalElement.querySelector('input[name="strategy"]:checked');
    const strategy = selectedRadio.value;

    if (strategy === 'fixed-distribution' && !this.#validateFixedAllocation()) {
      return;
    }

    const result = this.#getSelectedStrategy();
    this.#cleanup();
    if (this.resolvePromise) {
      this.resolvePromise(result);
    }
  }

  #handleCancel() {
    this.#cleanup();
    if (this.resolvePromise) {
      this.resolvePromise({ strategy: 'discard', config: {} });
    }
  }

  #handleKeydown(event) {
    if (event.key === 'Escape') {
      this.#handleCancel();
    }
  }

  #cleanup() {
    document.removeEventListener('keydown', this.boundHandleKeydown);
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    if (this.modalElement && this.modalElement.parentNode) {
      this.modalElement.remove();
    }
  }

  #startDynamicUpdate() {
    this.updateInterval = setInterval(() => {
      const accumulatedIdleMs = parseInt(localStorage.getItem('accumulated_idle_ms') || '0', 10);

      if (accumulatedIdleMs > 0 && accumulatedIdleMs !== this.idleMs) {
        this.idleMs = accumulatedIdleMs;

        if (this.modalElement) {
          const idleTimeDisplay = this.modalElement.querySelector('.idle-time-display');
          if (idleTimeDisplay) {
            idleTimeDisplay.textContent = this.#formatTime(this.idleMs);
          }

          this.#updateFixedRemaining();
        }
      }
    }, 500);
  }

  #createHeader() {
    const header = document.createElement('div');
    header.className = 'modal-header';

    const eyebrow = document.createElement('p');
    eyebrow.className = 'modal-eyebrow';
    eyebrow.textContent = 'Welcome back';

    const title = document.createElement('h2');
    title.className = 'modal-title';
    title.id = 'allocation-modal-title';
    title.textContent = 'Allocate Idle Time';

    const lead = document.createElement('p');
    lead.className = 'modal-lead';
    lead.id = 'allocation-modal-lead';

    const idleTimeDisplay = document.createElement('span');
    idleTimeDisplay.className = 'idle-time-display';
    idleTimeDisplay.textContent = this.#formatTime(this.idleMs);

    lead.append('You were away for ', idleTimeDisplay, '. Where should that time go?');

    header.appendChild(eyebrow);
    header.appendChild(title);
    header.appendChild(lead);
    return header;
  }

  show() {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this.boundHandleKeydown = (e) => this.#handleKeydown(e);
      document.addEventListener('keydown', this.boundHandleKeydown);

      this.modalElement = document.createElement('div');
      this.modalElement.className = 'allocation-modal';

      const dialog = document.createElement('div');
      dialog.className = 'modal-dialog';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', 'allocation-modal-title');
      dialog.setAttribute('aria-describedby', 'allocation-modal-lead');

      const strategiesForm = document.createElement('form');
      strategiesForm.className = 'strategies-form';
      strategiesForm.addEventListener('submit', (e) => e.preventDefault());

      const previousOption = this.#createStrategyOption('previous-timer', !this.previousRunningId);

      const selectedOption = this.#createStrategyOption('selected-timer');
      const timerDetail = document.createElement('div');
      timerDetail.className = 'strategy-detail timer-select-detail';
      timerDetail.appendChild(this.#createTimerDropdown());
      selectedOption.appendChild(timerDetail);

      const fixedOption = this.#createStrategyOption('fixed-distribution');
      fixedOption.appendChild(this.#createFixedDistributionForm());

      const percentageOption = this.#createStrategyOption('percentage-distribution');
      percentageOption.appendChild(this.#createPercentageDistributionForm());

      const discardOption = this.#createStrategyOption('discard');

      strategiesForm.appendChild(previousOption);
      strategiesForm.appendChild(selectedOption);
      strategiesForm.appendChild(fixedOption);
      strategiesForm.appendChild(percentageOption);
      strategiesForm.appendChild(discardOption);

      const closeButton = document.createElement('button');
      closeButton.className = 'btn-close';
      closeButton.type = 'button';
      closeButton.textContent = '×';
      closeButton.setAttribute('aria-label', 'Close and discard idle time');
      closeButton.addEventListener('click', () => this.#handleCancel());

      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'modal-buttons';

      const cancelButton = document.createElement('button');
      cancelButton.className = 'btn-cancel';
      cancelButton.type = 'button';
      cancelButton.textContent = 'Cancel';
      cancelButton.addEventListener('click', () => this.#handleCancel());

      const applyButton = document.createElement('button');
      applyButton.className = 'btn-apply';
      applyButton.type = 'button';
      applyButton.textContent = 'Apply';
      applyButton.addEventListener('click', () => this.#handleApply());

      buttonContainer.appendChild(cancelButton);
      buttonContainer.appendChild(applyButton);

      dialog.appendChild(closeButton);
      dialog.appendChild(this.#createHeader());
      dialog.appendChild(strategiesForm);
      dialog.appendChild(buttonContainer);
      this.modalElement.appendChild(dialog);
      document.body.appendChild(this.modalElement);

      this.#updateStrategyForms();
      applyButton.focus();

      this.#startDynamicUpdate();
    });
  }
}

export default AllocationModal;
