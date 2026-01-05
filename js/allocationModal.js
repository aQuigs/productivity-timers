export class AllocationModal {
  constructor(idleMs, timers, previousRunningId) {
    this.idleMs = idleMs;
    this.timers = timers;
    this.previousRunningId = previousRunningId;
    this.modalElement = null;
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

  show() {
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

    dialog.appendChild(title);
    dialog.appendChild(idleTimeDisplay);
    dialog.appendChild(strategiesForm);
    this.modalElement.appendChild(dialog);
    document.body.appendChild(this.modalElement);
  }
}
