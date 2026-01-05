export class AllocationModal {
  constructor(idleMs, timers, previousRunningId) {
    this.idleMs = idleMs;
    this.timers = timers;
    this.previousRunningId = previousRunningId;
    this.modalElement = null;
  }

  show() {
    this.modalElement = document.createElement('div');
    this.modalElement.className = 'allocation-modal';

    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog';

    const title = document.createElement('h2');
    title.className = 'modal-title';
    title.textContent = 'Allocate Idle Time';

    dialog.appendChild(title);
    this.modalElement.appendChild(dialog);
    document.body.appendChild(this.modalElement);
  }
}
