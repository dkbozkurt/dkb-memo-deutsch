import { els } from './dom';

/** In-app replacement for window.confirm(), which some embedded browsers block. */
export function askConfirm(title: string, text: string, confirmLabel: string): Promise<boolean> {
  const dialog = els.confirmDialog;
  els.confirmTitle.textContent = title;
  els.confirmText.textContent = text;
  els.confirmYes.textContent = confirmLabel;
  dialog.returnValue = '';
  dialog.showModal();
  els.confirmYes.focus();
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'yes'), { once: true });
  });
}
