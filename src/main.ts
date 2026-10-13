import './styles.css';

import { attachSwipe, flip, flyOut, renderCard, renderGhost, visibleLang } from './card';
import { askConfirm } from './confirm';
import { els, frontInputs, targetEl } from './dom';
import { openInfo } from './info';
import { fetchLibrary, fetchLibraryList } from './library';
import {
  counts,
  enabledTypes,
  idsWithResult,
  library,
  loadSettings,
  restoreProgress,
  roundInProgress,
  saveProgress,
  saveSettings,
  state,
  typesInLibrary,
  wordAt,
} from './state';
import type { Lang, ListTab, Mode, Result, WordType } from './types';
import { esc, replayClass, shuffled } from './util';
import { TYPE_LABELS, germanHTML } from './words';

/* ---------- Rounds ---------- */

function newRound({ ids, mode = 'all' }: { ids?: string[]; mode?: Mode } = {}): void {
  const types = new Set(enabledTypes());
  const pool = ids ?? library().words.filter((w) => types.has(w.type)).map((w) => w.id);
  state.deck = state.settings.shuffle ? shuffled(pool) : pool;
  state.history = [];
  state.mode = mode;
  saveProgress();
  render({ animate: true });
}

function answer(result: Result): void {
  const word = wordAt();
  if (state.busy || !word) return;
  state.busy = true;
  flyOut(result, () => {
    state.history.push([word.id, result]);
    saveProgress();
    replayClass(result ? els.correctChip : els.wrongChip, 'is-bump');
    render();
    state.busy = false;
  });
}

function undo(): void {
  if (state.busy || !state.history.length) return;
  state.history.pop();
  saveProgress();
  render({ animate: true });
}

function flipCard(): void {
  if (!state.busy && wordAt()) flip();
}

/* ---------- Rendering ---------- */

function render({ animate = false } = {}): void {
  const total = state.deck.length;
  const pos = state.history.length;
  const done = pos >= total;
  const { correct, wrong } = counts();

  els.position.textContent = String(total ? Math.min(pos + 1, total) : 0);
  els.total.textContent = String(total);
  els.progressFill.style.width = total ? `${(pos / total) * 100}%` : '0';
  els.correctCount.textContent = String(correct);
  els.wrongCount.textContent = String(wrong);

  els.modeBadge.hidden = state.mode === 'all';
  els.modeBadge.textContent = state.mode === 'correct' ? 'Reviewing known words' : 'Reviewing missed words';

  els.deck.hidden = done;
  els.hint.hidden = done;
  els.correctBtn.hidden = done;
  els.wrongBtn.hidden = done;
  els.finished.hidden = !done;
  els.undoBtn.disabled = !state.history.length;
  els.deck.classList.toggle('is-last', pos >= total - 1);

  const word = wordAt();
  if (word) {
    renderCard(word, state.settings.front, animate);
    renderGhost(wordAt(1), state.settings.front);
    return;
  }

  const pct = total ? Math.round((correct / total) * 100) : 0;
  els.finishedText.textContent = total
    ? `You knew ${correct} of ${total} words (${pct}%).${wrong ? ` ${wrong} to practise again.` : ' Perfekt!'}`
    : 'No words match the selected word types.';
  els.reviewWrongBtn.hidden = !wrong;
  els.reviewWrongBtn.textContent = `Practice missed words (${wrong})`;
}

/* ---------- Known / missed lists ---------- */

function listIds(): string[] {
  return idsWithResult(state.listTab === 'correct' ? 1 : 0).reverse();
}

function renderList(): void {
  const ids = listIds();
  const { correct, wrong } = counts();

  els.tabCorrectCount.textContent = String(correct);
  els.tabWrongCount.textContent = String(wrong);
  for (const btn of els.listTabs.querySelectorAll<HTMLElement>('[data-tab]')) {
    btn.setAttribute('aria-selected', String(btn.dataset.tab === state.listTab));
  }

  const items = ids.flatMap((id) => {
    const w = state.wordsById.get(id);
    if (!w) return [];
    return [
      `<li><button type="button" data-word="${esc(id)}">
        <span class="wl-de" lang="de">${germanHTML(w)}</span>
        <span class="wl-en">${esc(w.en)}</span>
      </button></li>`,
    ];
  });
  const empty = state.listTab === 'correct' ? 'No known words yet — swipe right when you know one.' : 'No missed words yet. 🎯';
  els.wordList.innerHTML = items.join('') || `<li class="word-list__empty">${empty}</li>`;
  els.listFoot.hidden = !ids.length;
}

function openList(tab: ListTab): void {
  state.listTab = tab;
  renderList();
  els.listDialog.showModal();
  els.wordList.scrollTop = 0;
}

/* ---------- Settings drawer ---------- */

function openDrawer(): void {
  els.drawer.classList.add('is-open');
  els.drawer.setAttribute('aria-hidden', 'false');
  els.settingsBtn.setAttribute('aria-expanded', 'true');
  els.scrim.hidden = false;
  els.settingsClose.focus();
}

function closeDrawer(): void {
  if (!els.drawer.classList.contains('is-open')) return;
  els.drawer.classList.remove('is-open');
  els.drawer.setAttribute('aria-hidden', 'true');
  els.settingsBtn.setAttribute('aria-expanded', 'false');
  els.scrim.hidden = true;
  els.settingsBtn.focus();
}

async function confirmRestart(): Promise<boolean> {
  return (
    !roundInProgress() ||
    askConfirm('Start a new round?', 'Your progress in the current round will be reset.', 'Start new round')
  );
}

function renderSettings(): void {
  const current = library();
  els.librarySelect.innerHTML = state.libraries
    .map((l) => `<option value="${esc(l.id)}"${l.id === current.id ? ' selected' : ''}>${esc(l.name)}</option>`)
    .join('');
  const meta = state.libraries.find((l) => l.id === current.id);
  els.libraryDescription.textContent = meta ? `${meta.description} · ${current.words.length} words` : '';

  for (const input of frontInputs()) input.checked = input.value === state.settings.front;
  els.shuffleToggle.checked = state.settings.shuffle;

  const enabled = new Set(enabledTypes());
  els.typeFilters.innerHTML = typesInLibrary()
    .map(
      ([t, n]) => `<label class="type-pill"><input type="checkbox" value="${esc(t)}"${enabled.has(t) ? ' checked' : ''}>
        <span>${esc(TYPE_LABELS[t])} <small>${n}</small></span></label>`,
    )
    .join('');
}

/* ---------- Loading ---------- */

async function loadLibrary(id: string | null): Promise<void> {
  const meta = state.libraries.find((l) => l.id === id) ?? state.libraries[0];
  if (!meta) return showLoadError(new Error('No libraries configured'));

  els.stage.classList.add('is-loading');
  try {
    state.library = await fetchLibrary(meta);
  } catch (err) {
    return showLoadError(err);
  } finally {
    els.stage.classList.remove('is-loading');
  }

  state.wordsById = new Map(library().words.map((w) => [w.id, w]));
  state.settings.libraryId = meta.id;
  saveSettings();
  els.libraryTitle.textContent = meta.name;
  document.title = `${meta.name} · Memo Deutsch`;

  renderSettings();
  if (restoreProgress()) render({ animate: true });
  else newRound();
}

function showLoadError(err: unknown): void {
  console.error(err);
  const message = err instanceof Error ? err.message : String(err);
  els.stage.innerHTML = `<p class="load-error">Couldn't load the word list.<br>${esc(message)}</p>`;
}

/* ---------- Wiring ---------- */

function setupGameControls(): void {
  attachSwipe({
    canStart: () => !state.busy,
    onTap: flipCard,
    onSwipe: answer,
    onInfo: (lang) => openInfo(wordAt(), lang),
  });

  els.correctBtn.addEventListener('click', () => answer(1));
  els.wrongBtn.addEventListener('click', () => answer(0));
  els.undoBtn.addEventListener('click', undo);
  els.correctChip.addEventListener('click', () => openList('correct'));
  els.wrongChip.addEventListener('click', () => openList('wrong'));
  els.restartBtn.addEventListener('click', () => newRound());
  els.reviewWrongBtn.addEventListener('click', () => newRound({ ids: idsWithResult(0), mode: 'wrong' }));
}

function setupDialogs(): void {
  for (const dialog of [els.infoDialog, els.listDialog, els.confirmDialog]) {
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog || targetEl(e).closest('[data-close]')) dialog.close();
    });
  }

  els.listTabs.addEventListener('click', (e) => {
    const tab = targetEl(e).closest<HTMLElement>('[data-tab]');
    if (!tab) return;
    state.listTab = tab.dataset.tab === 'wrong' ? 'wrong' : 'correct';
    renderList();
  });

  els.wordList.addEventListener('click', (e) => {
    const item = targetEl(e).closest<HTMLElement>('[data-word]');
    if (item?.dataset.word) openInfo(state.wordsById.get(item.dataset.word), 'de');
  });

  els.practiceListBtn.addEventListener('click', async () => {
    const ids = listIds();
    if (!ids.length || !(await confirmRestart())) return;
    els.listDialog.close();
    newRound({ ids, mode: state.listTab });
  });
}

function setupSettings(): void {
  els.settingsBtn.addEventListener('click', openDrawer);
  els.settingsClose.addEventListener('click', closeDrawer);
  els.scrim.addEventListener('click', closeDrawer);

  els.librarySelect.addEventListener('change', () => void loadLibrary(els.librarySelect.value));

  for (const input of frontInputs()) {
    input.addEventListener('change', () => {
      state.settings.front = input.value as Lang;
      saveSettings();
      render();
    });
  }

  els.shuffleToggle.addEventListener('change', async () => {
    if (!(await confirmRestart())) {
      els.shuffleToggle.checked = state.settings.shuffle;
      return;
    }
    state.settings.shuffle = els.shuffleToggle.checked;
    saveSettings();
    newRound();
  });

  els.typeFilters.addEventListener('change', async (e) => {
    const changed = e.target as HTMLInputElement;
    const boxes = [...els.typeFilters.querySelectorAll<HTMLInputElement>('input')];
    const chosen = boxes.filter((b) => b.checked).map((b) => b.value as WordType);
    if (!chosen.length || !(await confirmRestart())) {
      changed.checked = !changed.checked;
      return;
    }
    state.settings.types = chosen.length === boxes.length ? null : chosen;
    saveSettings();
    newRound();
  });

  els.resetBtn.addEventListener('click', async () => {
    const ok = await askConfirm(
      'Restart this deck?',
      'You will start again from the first card and your progress will be reset.',
      'Restart',
    );
    if (!ok) return;
    newRound();
    closeDrawer();
  });
}

function setupKeyboard(): void {
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    if (els.drawer.classList.contains('is-open')) {
      if (e.key === 'Escape') closeDrawer();
      return;
    }
    const target = targetEl(e);
    if (target.closest('input, select, textarea')) return;
    const onButton = target.closest('button') !== null && target !== els.card;

    switch (e.key) {
      case ' ':
      case 'Enter':
        if (onButton) return;
        e.preventDefault();
        flipCard();
        break;
      case 'ArrowRight':
        e.preventDefault();
        answer(1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        answer(0);
        break;
      case 'i':
      case 'I':
        openInfo(wordAt(), visibleLang(state.settings.front));
        break;
      case 'z':
      case 'Z':
      case 'Backspace':
        undo();
        break;
    }
  });
}

async function init(): Promise<void> {
  setupGameControls();
  setupDialogs();
  setupSettings();
  setupKeyboard();
  loadSettings();

  try {
    state.libraries = await fetchLibraryList();
  } catch (err) {
    return showLoadError(err);
  }
  await loadLibrary(state.settings.libraryId);
}

void init();
