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

    dialog.appendChild(title);
    dialog.appendChild(idleTimeDisplay);
    this.modalElement.appendChild(dialog);
    document.body.appendChild(this.modalElement);
  }
}
