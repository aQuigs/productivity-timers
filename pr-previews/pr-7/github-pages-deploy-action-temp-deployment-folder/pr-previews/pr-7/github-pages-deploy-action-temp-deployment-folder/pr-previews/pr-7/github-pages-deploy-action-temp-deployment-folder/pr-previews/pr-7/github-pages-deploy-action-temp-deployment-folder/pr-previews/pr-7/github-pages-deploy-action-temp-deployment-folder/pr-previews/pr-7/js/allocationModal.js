export class AllocationModal {
  constructor(idleMs, timers, previousRunningId) {
    this.idleMs = idleMs;
    this.timers = timers;
    this.previousRunningId = previousRunningId;
    this.modalElement = null;
    this.resolvePromise = null;
    this.fixedAllocations = new Map();
    this.percentageAllocations = new Map();
  }

  #formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');

    return `${hh}:${mm}:${ss}`;
  }

  #msToHHMM(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return { hours, minutes };
  }

  #hhmmToMs(hours, minutes) {
    return (hours * 3600 + minutes * 60) * 1000;
  }

  #createStrategyOption(value, label, disabled = false) {
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

    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    labelElement.prepend(radio);

    container.appendChild(labelElement);
    return container;
  }

  #createTimerDropdown() {
    const select = document.createElement('select');
    select.className = 'timer-select';

    this.timers.forEach(timer => {
      const option = document.createElement('option');
      option.value = timer.id;
      option.textContent = timer.title;
      select.appendChild(option);
    });

    return select;
  }

  #createFixedDistributionForm() {
    const form = document.createElement('div');
    form.className = 'fixed-distribution-form';
    form.style.display = 'none';

    const errorMsg = document.createElement('p');
    errorMsg.className = 'allocation-error';
    errorMsg.style.display = 'none';
    errorMsg.style.color = '#ef4444';
    errorMsg.style.marginBottom = '12px';
    errorMsg.style.fontSize = '0.875rem';
    form.appendChild(errorMsg);

    this.timers.forEach(timer => {
      const row = document.createElement('div');
      row.className = 'timer-allocation-row';

      const label = document.createElement('label');
      label.textContent = timer.title;

      const hoursInput = document.createElement('input');
      hoursInput.type = 'number';
      hoursInput.className = 'hours-input';
      hoursInput.min = '0';
      hoursInput.value = '0';
      hoursInput.dataset.timerId = timer.id;

      const hourIncBtn = document.createElement('button');
      hourIncBtn.type = 'button';
      hourIncBtn.className = 'btn-hour-inc';
      hourIncBtn.textContent = '+ 1h';
      hourIncBtn.addEventListener('click', (e) => {
        e.preventDefault();
        hoursInput.value = String(Number(hoursInput.value) + 1);
        hoursInput.dispatchEvent(new Event('input'));
      });

      const hourDecBtn = document.createElement('button');
      hourDecBtn.type = 'button';
      hourDecBtn.className = 'btn-hour-dec';
      hourDecBtn.textContent = '- 1h';
      hourDecBtn.addEventListener('click', (e) => {
        e.preventDefault();
        hoursInput.value = String(Math.max(0, Number(hoursInput.value) - 1));
        hoursInput.dispatchEvent(new Event('input'));
      });

      const minutesInput = document.createElement('input');
      minutesInput.type = 'number';
      minutesInput.className = 'minutes-input';
      minutesInput.min = '0';
      minutesInput.max = '59';
      minutesInput.value = '0';
      minutesInput.dataset.timerId = timer.id;

      const minIncBtn = document.createElement('button');
      minIncBtn.type = 'button';
      minIncBtn.className = 'btn-min-inc';
      minIncBtn.textContent = '+ 1m';
      minIncBtn.addEventListener('click', (e) => {
        e.preventDefault();
        minutesInput.value = String(Math.min(59, Number(minutesInput.value) + 1));
        minutesInput.dispatchEvent(new Event('input'));
      });

      const minDecBtn = document.createElement('button');
      minDecBtn.type = 'button';
      minDecBtn.className = 'btn-min-dec';
      minDecBtn.textContent = '- 1m';
      minDecBtn.addEventListener('click', (e) => {
        e.preventDefault();
        minutesInput.value = String(Math.max(0, Number(minutesInput.value) - 1));
        minutesInput.dispatchEvent(new Event('input'));
      });

      hoursInput.addEventListener('input', () => this.#updateFixedRemaining());
      minutesInput.addEventListener('input', () => this.#updateFixedRemaining());

      row.appendChild(label);
      row.appendChild(hourDecBtn);
      row.appendChild(hoursInput);
      row.appendChild(hourIncBtn);
      row.appendChild(minDecBtn);
      row.appendChild(minutesInput);
      row.appendChild(minIncBtn);

      form.appendChild(row);
    });

    const remainingContainer = document.createElement('div');
    remainingContainer.className = 'fixed-distribution-remaining';

    const remainingDisplay = document.createElement('p');
    remainingDisplay.className = 'remaining-time';
    remainingDisplay.textContent = `Remaining: ${this.#formatTime(this.idleMs).substring(3)}`;

    const remainderLabel = document.createElement('label');
    remainderLabel.textContent = 'Remainder goes to:';

    const remainderSelect = document.createElement('select');
    remainderSelect.className = 'remainder-timer-select';
    this.timers.forEach(timer => {
      const option = document.createElement('option');
      option.value = timer.id;
      option.textContent = timer.title;
      remainderSelect.appendChild(option);
    });

    remainingContainer.appendChild(remainingDisplay);
    remainingContainer.appendChild(remainderLabel);
    remainingContainer.appendChild(remainderSelect);
    form.appendChild(remainingContainer);

    return form;
  }

  #createPercentageDistributionForm() {
    const form = document.createElement('div');
    form.className = 'percentage-distribution-form';
    form.style.display = 'none';

    this.timers.forEach(timer => {
      const row = document.createElement('div');
      row.className = 'percentage-input-row';

      const label = document.createElement('label');
      label.textContent = timer.title;

      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'percentage-input';
      input.min = '0';
      input.max = '100';
      input.value = '0';
      input.dataset.timerId = timer.id;

      input.addEventListener('input', () => this.#updatePercentageValidation());

      row.appendChild(label);
      row.appendChild(input);
      row.appendChild(document.createElement('span')).textContent = '%';

      form.appendChild(row);
    });

    const totalContainer = document.createElement('div');
    totalContainer.className = 'percentage-validation';

    const totalDisplay = document.createElement('p');
    totalDisplay.className = 'percentage-total';
    totalDisplay.textContent = 'Total: 0%';

    totalContainer.appendChild(totalDisplay);
    form.appendChild(totalContainer);

    return form;
  }

  #updateStrategyForms() {
    const selectedRadio = this.modalElement.querySelector('input[name="strategy"]:checked');
    const strategy = selectedRadio.value;

    const fixedForm = this.modalElement.querySelector('.fixed-distribution-form');
    const percentageForm = this.modalElement.querySelector('.percentage-distribution-form');
    const timerDropdown = this.modalElement.querySelector('.timer-select');

    fixedForm.style.display = strategy === 'fixed-distribution' ? 'block' : 'none';
    percentageForm.style.display = strategy === 'percentage-distribution' ? 'block' : 'none';

    if (timerDropdown) {
      timerDropdown.parentElement.style.display = strategy === 'selected-timer' ? 'block' : 'none';
    }
  }

  #updateFixedRemaining() {
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
      const { hours: h, minutes: m } = this.#msToHHMM(remainingMs);
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      remainingDisplay.textContent = `Remaining: ${hh}:${mm}`;
    }
  }

  #updatePercentageValidation() {
    const inputs = this.modalElement.querySelectorAll('.percentage-distribution-form .percentage-input');
    let total = 0;
    inputs.forEach(input => {
      total += Number(input.value) || 0;
    });

    const totalDisplay = this.modalElement.querySelector('.percentage-distribution-form .percentage-total');
    if (totalDisplay) {
      totalDisplay.textContent = `Total: ${total}%`;
      totalDisplay.className = total === 100 ? 'percentage-total valid' : 'percentage-total invalid';
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

    if (allocatedMs > this.idleMs) {
      const errorMsg = this.modalElement.querySelector('.fixed-distribution-form .allocation-error');
      if (errorMsg) {
        errorMsg.textContent = `Error: Allocated time exceeds available idle time by ${this.#formatTime(allocatedMs - this.idleMs)}`;
        errorMsg.style.display = 'block';
      }
      return false;
    }

    const errorMsg = this.modalElement.querySelector('.fixed-distribution-form .allocation-error');
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
    if (this.modalElement && this.modalElement.parentNode) {
      this.modalElement.remove();
    }
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

      const title = document.createElement('h2');
      title.className = 'modal-title';
      title.textContent = 'Allocate Idle Time';

      const idleTimeDisplay = document.createElement('p');
      idleTimeDisplay.className = 'idle-time-display';
      idleTimeDisplay.textContent = `Idle time: ${this.#formatTime(this.idleMs)}`;

      const strategiesForm = document.createElement('form');
      strategiesForm.className = 'strategies-form';

      const strategy1 = this.#createStrategyOption(
        'previous-timer',
        'Add all to previously-active timer',
        !this.previousRunningId
      );

      const strategy2Container = document.createElement('div');
      strategy2Container.className = 'strategy-option';
      const strategy2 = this.#createStrategyOption(
        'selected-timer',
        'Add all to selected timer:'
      );
      const timerDropdown = this.#createTimerDropdown();
      strategy2.appendChild(timerDropdown);

      const strategy3 = this.#createStrategyOption(
        'fixed-distribution',
        'Fixed time distribution'
      );

      const strategy4 = this.#createStrategyOption(
        'percentage-distribution',
        'Percentage distribution'
      );

      const strategy5 = this.#createStrategyOption(
        'discard',
        'Discard idle time (no allocation)'
      );

      strategiesForm.appendChild(strategy1);
      strategiesForm.appendChild(strategy2);
      strategiesForm.appendChild(strategy3);
      strategiesForm.appendChild(strategy4);
      strategiesForm.appendChild(strategy5);

      const fixedForm = this.#createFixedDistributionForm();
      strategiesForm.appendChild(fixedForm);

      const percentageForm = this.#createPercentageDistributionForm();
      strategiesForm.appendChild(percentageForm);

      const closeButton = document.createElement('button');
      closeButton.className = 'btn-close';
      closeButton.type = 'button';
      closeButton.textContent = '×';
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
      dialog.appendChild(title);
      dialog.appendChild(idleTimeDisplay);
      dialog.appendChild(strategiesForm);
      dialog.appendChild(buttonContainer);
      this.modalElement.appendChild(dialog);
      document.body.appendChild(this.modalElement);

      applyButton.focus();
    });
  }
}

export default AllocationModal;
