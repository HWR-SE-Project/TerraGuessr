import '@testing-library/jest-dom/vitest'

// jsdom does not implement <dialog>'s showModal()/close() (as of jsdom 31).
// Components like GameDialog rely on them; polyfill minimally for tests.
if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.removeAttribute('open')
    }
  }
}
