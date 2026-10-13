function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

function query<T extends HTMLElement = HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing element ${selector}`);
  return el;
}

export const els = {
  stage: query('.stage'),
  libraryTitle: byId('libraryTitle'),
  position: byId('position'),
  total: byId('total'),
  progressFill: byId('progressFill'),
  correctChip: byId<HTMLButtonElement>('correctChip'),
  wrongChip: byId<HTMLButtonElement>('wrongChip'),
  correctCount: byId('correctCount'),
  wrongCount: byId('wrongCount'),
  modeBadge: byId('modeBadge'),

  deck: byId('deck'),
  shell: byId('cardShell'),
  card: byId('card'),
  faceFront: byId('faceFront'),
  faceBack: byId('faceBack'),
  ghost: byId('ghost'),
  ghostFace: byId('ghostFace'),
  stampCorrect: byId('stampCorrect'),
  stampWrong: byId('stampWrong'),

  correctBtn: byId<HTMLButtonElement>('correctBtn'),
  wrongBtn: byId<HTMLButtonElement>('wrongBtn'),
  undoBtn: byId<HTMLButtonElement>('undoBtn'),
  hint: query('.hint'),
  finished: byId('finished'),
  finishedText: byId('finishedText'),
  reviewWrongBtn: byId<HTMLButtonElement>('reviewWrongBtn'),
  restartBtn: byId<HTMLButtonElement>('restartBtn'),

  settingsBtn: byId<HTMLButtonElement>('settingsBtn'),
  settingsClose: byId<HTMLButtonElement>('settingsClose'),
  drawer: byId('settings'),
  scrim: byId('scrim'),
  librarySelect: byId<HTMLSelectElement>('librarySelect'),
  libraryDescription: byId('libraryDescription'),
  shuffleToggle: byId<HTMLInputElement>('shuffleToggle'),
  typeFilters: byId('typeFilters'),
  resetBtn: byId<HTMLButtonElement>('resetBtn'),

  infoDialog: byId<HTMLDialogElement>('infoDialog'),
  infoKicker: byId('infoKicker'),
  infoTitle: byId('infoTitle'),
  infoBody: byId('infoBody'),

  listDialog: byId<HTMLDialogElement>('listDialog'),
  listTabs: query('#listDialog .tabs'),
  wordList: byId('wordList'),
  listFoot: byId('listFoot'),
  practiceListBtn: byId<HTMLButtonElement>('practiceListBtn'),
  tabCorrectCount: byId('tabCorrectCount'),
  tabWrongCount: byId('tabWrongCount'),

  confirmDialog: byId<HTMLDialogElement>('confirmDialog'),
  confirmTitle: byId('confirmTitle'),
  confirmText: byId('confirmText'),
  confirmYes: byId<HTMLButtonElement>('confirmYes'),
};

export function frontInputs(): HTMLInputElement[] {
  return [...document.querySelectorAll<HTMLInputElement>('input[name="front"]')];
}

/** Event target as an Element (events can also come from document or text nodes). */
export function targetEl(e: Event): Element {
  return e.target instanceof Element ? e.target : document.body;
}
