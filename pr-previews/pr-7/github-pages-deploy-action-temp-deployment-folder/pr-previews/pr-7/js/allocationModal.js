export class AllocationModal {
  constructor(idleMs, timers, previousRunningId) {
    this.idleMs = idleMs;
    this.timers = timers;
    this.previousRunningId = previousRunningId;
    this.modalElement = null;
    this.resolvePromise = null;
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

  #getSelectedStrategy() {
    const selectedRadio = this.modalElement.querySelector('input[name="strategy"]:checked');
    const strategy = selectedRadio.value;
    const config = {};

    if (strategy === 'previous-timer') {
      config.timerId = this.previousRunningId;
    } else if (strategy === 'selected-timer') {
      const dropdown = this.modalElement.querySelector('select.timer-select');
      config.timerId = dropdown.value;
    }

    return { strategy, config };
  }

  #handleApply() {
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
