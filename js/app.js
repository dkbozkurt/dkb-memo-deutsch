const STORAGE_PREFIX = 'memo-deutsch:v1';

const TYPE_LABELS = {
  noun: 'Noun',
  verb: 'Verb',
  adjective: 'Adjective',
  adverb: 'Adverb',
  preposition: 'Preposition',
  conjunction: 'Conjunction',
  'question word': 'Question word',
  pronoun: 'Pronoun',
  phrase: 'Phrase',
  number: 'Number',
};

const LANG_LABELS = { de: 'Deutsch', en: 'English' };
const FLY_MS = 320;

const $ = (id) => document.getElementById(id);

const els = {
  stage: document.querySelector('.stage'),
  position: $('position'),
  total: $('total'),
  progressFill: $('progressFill'),
  correctChip: $('correctChip'),
  wrongChip: $('wrongChip'),
  correctCount: $('correctCount'),
  wrongCount: $('wrongCount'),
  modeBadge: $('modeBadge'),
  deck: $('deck'),
  shell: $('cardShell'),
  card: $('card'),
  faceFront: $('faceFront'),
  faceBack: $('faceBack'),
  stampCorrect: $('stampCorrect'),
  stampWrong: $('stampWrong'),
  controls: $('controls'),
  correctBtn: $('correctBtn'),
  wrongBtn: $('wrongBtn'),
  undoBtn: $('undoBtn'),
  hint: document.querySelector('.hint'),
  finished: $('finished'),
  finishedText: $('finishedText'),
  reviewWrongBtn: $('reviewWrongBtn'),
  restartBtn: $('restartBtn'),
  settingsBtn: $('settingsBtn'),
  settingsClose: $('settingsClose'),
  drawer: $('settings'),
  scrim: $('scrim'),
  librarySelect: $('librarySelect'),
  libraryDescription: $('libraryDescription'),
  shuffleToggle: $('shuffleToggle'),
  typeFilters: $('typeFilters'),
  resetBtn: $('resetBtn'),
  infoDialog: $('infoDialog'),
  infoKicker: $('infoKicker'),
  infoTitle: $('infoTitle'),
  infoBody: $('infoBody'),
  listDialog: $('listDialog'),
  listTitle: $('listTitle'),
  wordList: $('wordList'),
  listFoot: $('listFoot'),
  practiceListBtn: $('practiceListBtn'),
  tabCorrectCount: $('tabCorrectCount'),
  tabWrongCount: $('tabWrongCount'),
};

/* ---------- Storage (best effort: private mode etc. may throw) ---------- */

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}:${key}`);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}:${key}`, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
};

/* ---------- State ---------- */

const state = {
  libraries: [],
  library: null,
  wordsById: new Map(),
  settings: { libraryId: null, front: 'de', shuffle: true, types: null },
  deck: [], // word ids for the current round
  history: [], // [wordId, 1 = knew it | 0 = missed]
  mode: 'all', // 'all' | 'wrong' | 'correct'
  busy: false,
  listTab: 'correct',
};

const libraryCache = new Map();

/* ---------- Helpers ---------- */

function esc(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function shuffled(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function germanHTML(word) {
  let lead = '';
  if (word.article) lead = `(${word.article})`;
  else if (word.prefix) lead = word.prefix;
  return `${lead ? `<span class="word__article">${esc(lead)}</span>` : ''}${esc(word.de)}`;
}

function germanPlain(word) {
  if (word.article) return `${word.article} ${word.de}`;
  if (word.prefix) return `${word.prefix.replace(/[()]/g, '')} ${word.de}`;
  return word.de;
}

function sizeClass(text) {
  const n = text.length;
  if (n > 28) return 'word--xs';
  if (n > 16) return 'word--sm';
  if (n > 11) return 'word--md';
  return '';
}

function currentWord() {
  const id = state.deck[state.history.length];
  return id ? state.wordsById.get(id) : null;
}

function counts() {
  let correct = 0;
  for (const [, r] of state.history) correct += r;
  return { correct, wrong: state.history.length - correct };
}

function otherLang(lang) {
  return lang === 'de' ? 'en' : 'de';
}

function visibleLang() {
  return els.card.classList.contains('is-flipped') ? otherLang(state.settings.front) : state.settings.front;
}

function typesInLibrary() {
  const map = new Map();
  for (const w of state.library.words) map.set(w.type, (map.get(w.type) || 0) + 1);
  return Object.keys(TYPE_LABELS).filter((t) => map.has(t)).map((t) => [t, map.get(t)]);
}

function enabledTypes() {
  const available = typesInLibrary().map(([t]) => t);
  const chosen = state.settings.types?.filter((t) => available.includes(t));
  return chosen?.length ? chosen : available;
}

/* ---------- Persistence ---------- */

function saveSettings() {
  store.set('settings', state.settings);
}

function saveProgress() {
  store.set(`progress:${state.library.id}`, {
    deck: state.deck,
    history: state.history,
    mode: state.mode,
  });
}

function restoreProgress() {
  const saved = store.get(`progress:${state.library.id}`, null);
  if (!saved || !Array.isArray(saved.deck)) return false;
  const deck = saved.deck.filter((id) => state.wordsById.has(id));
  if (!deck.length) return false;
  const inDeck = new Set(deck);
  state.deck = deck;
  state.history = (saved.history || []).filter(([id]) => inDeck.has(id)).slice(0, deck.length);
  state.mode = saved.mode || 'all';
  return true;
}

/* ---------- Rounds ---------- */

function newRound({ ids = null, mode = 'all' } = {}) {
  const types = new Set(enabledTypes());
  const pool = ids ?? state.library.words.filter((w) => types.has(w.type)).map((w) => w.id);
  state.deck = state.settings.shuffle ? shuffled(pool) : pool;
  state.history = [];
  state.mode = mode;
  saveProgress();
  render({ animate: true });
}

function record(result) {
  const word = currentWord();
  if (!word) return;
  state.history.push([word.id, result]);
  saveProgress();
  const chip = result ? els.correctChip : els.wrongChip;
  chip.classList.remove('is-bump');
  void chip.offsetWidth;
  chip.classList.add('is-bump');
}

function undo() {
  if (state.busy || !state.history.length) return;
  state.history.pop();
  saveProgress();
  render({ animate: true });
}

/* ---------- Rendering ---------- */

function faceHTML(word, lang) {
  const text = lang === 'de' ? germanPlain(word) : word.en;
  const inner = lang === 'de' ? germanHTML(word) : esc(word.en);
  return `
    <button class="face__info" type="button" data-info="${lang}" aria-label="More about this word">i</button>
    <span class="face__type">${esc(TYPE_LABELS[word.type] || word.type)}</span>
    <p class="word ${sizeClass(text)}" lang="${lang}">${inner}</p>
    <span class="face__lang">${LANG_LABELS[lang]}</span>`;
}

function renderCard(word, animate) {
  const front = state.settings.front;
  const back = otherLang(front);
  els.faceFront.className = `face face--front face--${front}`;
  els.faceBack.className = `face face--back face--${back}`;
  els.faceFront.innerHTML = faceHTML(word, front);
  els.faceBack.innerHTML = faceHTML(word, back);

  els.card.classList.add('no-anim');
  els.card.classList.remove('is-flipped');
  void els.card.offsetWidth;
  els.card.classList.remove('no-anim');
  els.card.setAttribute('aria-label', `Flash card: ${front === 'de' ? germanPlain(word) : word.en}. Press to flip.`);

  if (animate) {
    els.shell.classList.remove('is-entering');
    void els.shell.offsetWidth;
    els.shell.classList.add('is-entering');
  }
}

function render({ animate = false } = {}) {
  const total = state.deck.length;
  const pos = state.history.length;
  const done = pos >= total;
  const { correct, wrong } = counts();

  els.position.textContent = total ? Math.min(pos + 1, total) : 0;
  els.total.textContent = total;
  els.progressFill.style.width = total ? `${(pos / total) * 100}%` : '0';
  els.correctCount.textContent = correct;
  els.wrongCount.textContent = wrong;

  els.modeBadge.hidden = state.mode === 'all';
  els.modeBadge.textContent = state.mode === 'correct' ? 'Reviewing known words' : 'Reviewing missed words';

  els.deck.hidden = done;
  els.hint.hidden = done;
  els.correctBtn.hidden = done;
  els.wrongBtn.hidden = done;
  els.finished.hidden = !done;
  els.undoBtn.disabled = !state.history.length;
  els.deck.classList.toggle('is-last', pos >= total - 1);

  if (done) {
    const pct = total ? Math.round((correct / total) * 100) : 0;
    els.finishedText.textContent = total
      ? `You knew ${correct} of ${total} words (${pct}%).${wrong ? ` ${wrong} to practise again.` : ' Perfekt!'}`
      : 'No words match the selected word types.';
    els.reviewWrongBtn.hidden = !wrong;
    els.reviewWrongBtn.textContent = `Practice missed words (${wrong})`;
  } else {
    renderCard(currentWord(), animate);
  }
}

/* ---------- Card interaction ---------- */

function flip() {
  if (state.busy || !currentWord()) return;
  els.card.classList.toggle('is-flipped');
}

function setStamps(progress) {
  els.stampCorrect.style.opacity = Math.max(0, Math.min(1, progress));
  els.stampWrong.style.opacity = Math.max(0, Math.min(1, -progress));
}

function swipeThreshold() {
  return Math.min(120, els.deck.offsetWidth * 0.3);
}

function commit(result) {
  if (state.busy || !currentWord()) return;
  state.busy = true;
  const dir = result ? 1 : -1;
  const shell = els.shell;
  setStamps(dir);
  shell.classList.remove('is-entering');
  shell.style.transition = `transform ${FLY_MS}ms cubic-bezier(.4, 0, .9, .6)`;
  shell.style.transform = `translate(${dir * (window.innerWidth * 0.75 + 200)}px, -30px) rotate(${dir * 24}deg)`;

  setTimeout(() => {
    record(result);
    shell.style.transition = 'none';
    shell.style.transform = '';
    setStamps(0);
    state.busy = false;
    render({ animate: true });
  }, FLY_MS);
}

function snapBack() {
  els.shell.style.transition = 'transform .35s cubic-bezier(.2, .9, .3, 1.25)';
  els.shell.style.transform = '';
  setStamps(0);
}

function setupSwipe() {
  const shell = els.shell;
  let drag = null;

  shell.addEventListener('pointerdown', (e) => {
    if (state.busy || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (e.target.closest('[data-info]')) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0, moved: false };
    shell.setPointerCapture(e.pointerId);
  });

  shell.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.dx = e.clientX - drag.x;
    drag.dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(drag.dx, drag.dy) > 8) {
      drag.moved = true;
      shell.classList.add('is-dragging');
      shell.classList.remove('is-entering');
      shell.style.transition = 'none';
    }
    if (drag.moved) {
      shell.style.transform = `translate(${drag.dx}px, ${drag.dy * 0.25}px) rotate(${drag.dx * 0.05}deg)`;
      setStamps(drag.dx / swipeThreshold());
    }
  });

  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    shell.classList.remove('is-dragging');
    if (e.type === 'pointercancel') return snapBack();
    if (!d.moved) return flip();
    if (Math.abs(d.dx) > swipeThreshold()) commit(d.dx > 0 ? 1 : 0);
    else snapBack();
  };
  shell.addEventListener('pointerup', end);
  shell.addEventListener('pointercancel', end);

  els.card.addEventListener('click', (e) => {
    const info = e.target.closest('[data-info]');
    if (info) openInfo(currentWord(), info.dataset.info);
  });
}

/* ---------- Info dialog ---------- */

function section(title, html) {
  return `<section class="info-section"><h3>${esc(title)}</h3>${html}</section>`;
}

function pairs(items, cls = '') {
  return `<div class="pairs">${items.map((i) => `<span class="pair ${cls}">${i}</span>`).join('')}</div>`;
}

function maskGerman(word) {
  const masked = word.de
    .split(' ')
    .map((part) => [part[0], ...'_'.repeat(Math.max(0, part.length - 1))].join(' '))
    .join('   ');
  const lead = word.article || (word.prefix ? word.prefix.replace(/[()]/g, '') : '');
  return lead ? `${lead} ${masked}` : masked;
}

function germanInfo(word) {
  const parts = [];

  if (word.type === 'noun') {
    if (word.plural) parts.push(section('Plural', `<p><span class="muted">die</span> <b>${esc(word.plural)}</b></p>`));
    if (word.number) parts.push(section('Number', `<p>${esc(word.number)}</p>`));
    if (word.feminine) parts.push(section('Feminine', `<p><b>${esc(word.feminine)}</b></p>`));
  }

  if (word.conjugation) {
    const rows = word.conjugation.map(([p, f]) => `<tr><th scope="row">${esc(p)}</th><td>${esc(f)}</td></tr>`).join('');
    parts.push(section('Präsens · present tense', `<div class="conj-wrap"><table class="conj">${rows}</table></div>`));
  }
  if (word.perfekt) {
    const subject = word.conjugation?.length === 1 ? word.conjugation[0][0] : 'er/sie/es';
    parts.push(section('Perfekt · past', `<p><span class="muted">${esc(subject)}</span> <b>${esc(word.perfekt)}</b></p>`));
  }

  if (word.comparison) {
    parts.push(section('Comparison', pairs([esc(word.de), ...word.comparison.map(esc)])));
  }

  if (word.opposites?.length) {
    parts.push(section(word.opposites.length > 1 ? 'Opposites' : 'Opposite',
      pairs(word.opposites.map((o) => `${esc(o.de)}${o.en ? ` <small>${esc(o.en)}</small>` : ''}`), 'pair--opp')));
  }

  if (word.note) parts.push(section('Note', `<p>${esc(word.note)}</p>`));

  if (!parts.length) parts.push(`<p class="muted">No extra info for this word yet.</p>`);
  return parts.join('');
}

function englishInfo(word) {
  const parts = [];
  if (word.opposites?.length) {
    parts.push(section(word.opposites.length > 1 ? 'Opposites' : 'Opposite',
      pairs(word.opposites.filter((o) => o.en).map((o) => esc(o.en)), 'pair--opp')));
  }
  parts.push(section('Hint · the German word', `<div class="hint-box" lang="de">${esc(maskGerman(word))}</div>`));
  return parts.join('');
}

function openInfo(word, lang) {
  if (!word) return;
  els.infoKicker.textContent = `${TYPE_LABELS[word.type] || word.type} · ${LANG_LABELS[lang]}`;
  els.infoTitle.innerHTML = lang === 'de' ? germanHTML(word) : esc(word.en);
  els.infoTitle.lang = lang;
  els.infoBody.innerHTML = lang === 'de' ? germanInfo(word) : englishInfo(word);
  els.infoDialog.showModal();
  els.infoBody.scrollTop = 0;
}

/* ---------- Correct / wrong lists ---------- */

function renderList() {
  const tab = state.listTab;
  const want = tab === 'correct' ? 1 : 0;
  const ids = state.history.filter(([, r]) => r === want).map(([id]) => id).reverse();
  const { correct, wrong } = counts();

  els.tabCorrectCount.textContent = correct;
  els.tabWrongCount.textContent = wrong;
  for (const btn of els.listDialog.querySelectorAll('[data-tab]')) {
    btn.setAttribute('aria-selected', String(btn.dataset.tab === tab));
  }

  els.wordList.innerHTML = ids.length
    ? ids.map((id) => {
        const w = state.wordsById.get(id);
        return `<li><button type="button" data-word="${esc(id)}">
          <span class="wl-de" lang="de">${germanHTML(w)}</span>
          <span class="wl-en">${esc(w.en)}</span>
        </button></li>`;
      }).join('')
    : `<li class="word-list__empty">${tab === 'correct' ? 'No known words yet — swipe right when you know one.' : 'No missed words yet. 🎯'}</li>`;

  els.listFoot.hidden = !ids.length;
  els.practiceListBtn.dataset.ids = JSON.stringify(ids);
}

function openList(tab) {
  state.listTab = tab;
  renderList();
  els.listDialog.showModal();
  els.wordList.scrollTop = 0;
}

/* ---------- Settings ---------- */

function openDrawer() {
  els.drawer.classList.add('is-open');
  els.drawer.setAttribute('aria-hidden', 'false');
  els.settingsBtn.setAttribute('aria-expanded', 'true');
  els.scrim.hidden = false;
  els.settingsClose.focus();
}

function closeDrawer() {
  if (!els.drawer.classList.contains('is-open')) return;
  els.drawer.classList.remove('is-open');
  els.drawer.setAttribute('aria-hidden', 'true');
  els.settingsBtn.setAttribute('aria-expanded', 'false');
  els.scrim.hidden = true;
  els.settingsBtn.focus();
}

function roundInProgress() {
  return state.history.length > 0 && state.history.length < state.deck.length;
}

function confirmRestart() {
  return !roundInProgress() || window.confirm('Start a new round with these settings? Your current progress will be reset.');
}

function renderSettings() {
  els.librarySelect.innerHTML = state.libraries
    .map((l) => `<option value="${esc(l.id)}"${l.id === state.library?.id ? ' selected' : ''}>${esc(l.name)}</option>`)
    .join('');
  const lib = state.libraries.find((l) => l.id === state.library?.id);
  els.libraryDescription.textContent = lib ? `${lib.description} · ${state.library.words.length} words` : '';

  for (const input of document.querySelectorAll('input[name="front"]')) {
    input.checked = input.value === state.settings.front;
  }
  els.shuffleToggle.checked = state.settings.shuffle;

  const enabled = new Set(enabledTypes());
  els.typeFilters.innerHTML = typesInLibrary()
    .map(([t, n]) => `<label class="type-pill"><input type="checkbox" value="${esc(t)}"${enabled.has(t) ? ' checked' : ''}>
      <span>${esc(TYPE_LABELS[t])} <small>${n}</small></span></label>`)
    .join('');
}

function setupSettings() {
  els.settingsBtn.addEventListener('click', openDrawer);
  els.settingsClose.addEventListener('click', closeDrawer);
  els.scrim.addEventListener('click', closeDrawer);

  els.librarySelect.addEventListener('change', () => loadLibrary(els.librarySelect.value));

  for (const input of document.querySelectorAll('input[name="front"]')) {
    input.addEventListener('change', () => {
      state.settings.front = input.value;
      saveSettings();
      render();
    });
  }

  els.shuffleToggle.addEventListener('change', () => {
    if (!confirmRestart()) {
      els.shuffleToggle.checked = state.settings.shuffle;
      return;
    }
    state.settings.shuffle = els.shuffleToggle.checked;
    saveSettings();
    newRound();
  });

  els.typeFilters.addEventListener('change', (e) => {
    const boxes = [...els.typeFilters.querySelectorAll('input')];
    const chosen = boxes.filter((b) => b.checked).map((b) => b.value);
    if (!chosen.length || !confirmRestart()) {
      e.target.checked = !e.target.checked;
      return;
    }
    state.settings.types = chosen.length === boxes.length ? null : chosen;
    saveSettings();
    newRound();
  });

  els.resetBtn.addEventListener('click', () => {
    if (!window.confirm('Restart this deck from the first card? Your current progress will be reset.')) return;
    newRound();
    closeDrawer();
  });
}

/* ---------- Loading ---------- */

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function loadLibrary(id) {
  const meta = state.libraries.find((l) => l.id === id) || state.libraries[0];
  els.stage.classList.add('is-loading');
  try {
    if (!libraryCache.has(meta.id)) libraryCache.set(meta.id, await fetchJSON(meta.file));
  } catch (err) {
    showLoadError(err);
    return;
  } finally {
    els.stage.classList.remove('is-loading');
  }

  state.library = libraryCache.get(meta.id);
  state.wordsById = new Map(state.library.words.map((w) => [w.id, w]));
  state.settings.libraryId = meta.id;
  saveSettings();

  renderSettings();
  if (restoreProgress()) render({ animate: true });
  else newRound();
}

function showLoadError(err) {
  console.error(err);
  const fromDisk = location.protocol === 'file:';
  els.stage.innerHTML = `<p class="load-error">Couldn't load the word list.<br>${
    fromDisk
      ? 'Browsers block loading data from files opened directly. Run <code>python3 -m http.server</code> in the project folder and open <code>http://localhost:8000</code>.'
      : esc(err.message)
  }</p>`;
}

/* ---------- Keyboard & wiring ---------- */

function setupKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    if (els.drawer.classList.contains('is-open')) {
      if (e.key === 'Escape') closeDrawer();
      return;
    }
    if (e.target.closest('input, select, textarea')) return;
    const onButton = e.target.closest('button') && e.target !== els.card;

    switch (e.key) {
      case ' ':
      case 'Enter':
        if (onButton) return;
        e.preventDefault();
        flip();
        break;
      case 'ArrowRight':
        e.preventDefault();
        commit(1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        commit(0);
        break;
      case 'i':
      case 'I':
        openInfo(currentWord(), visibleLang());
        break;
      case 'z':
      case 'Z':
      case 'Backspace':
        undo();
        break;
    }
  });
}

function setupDialogs() {
  for (const dialog of [els.infoDialog, els.listDialog]) {
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog || e.target.closest('[data-close]')) dialog.close();
    });
  }

  els.listDialog.querySelector('.tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (!tab) return;
    state.listTab = tab.dataset.tab;
    renderList();
  });

  els.wordList.addEventListener('click', (e) => {
    const item = e.target.closest('[data-word]');
    if (item) openInfo(state.wordsById.get(item.dataset.word), 'de');
  });

  els.practiceListBtn.addEventListener('click', () => {
    const ids = JSON.parse(els.practiceListBtn.dataset.ids || '[]');
    if (!ids.length || !confirmRestart()) return;
    els.listDialog.close();
    newRound({ ids, mode: state.listTab });
  });
}

function setupButtons() {
  els.correctBtn.addEventListener('click', () => commit(1));
  els.wrongBtn.addEventListener('click', () => commit(0));
  els.undoBtn.addEventListener('click', undo);
  els.correctChip.addEventListener('click', () => openList('correct'));
  els.wrongChip.addEventListener('click', () => openList('wrong'));
  els.restartBtn.addEventListener('click', () => newRound());
  els.reviewWrongBtn.addEventListener('click', () => {
    const ids = state.history.filter(([, r]) => r === 0).map(([id]) => id);
    newRound({ ids, mode: 'wrong' });
  });
}

async function init() {
  setupSwipe();
  setupButtons();
  setupDialogs();
  setupSettings();
  setupKeyboard();

  state.settings = { ...state.settings, ...store.get('settings', {}) };

  try {
    state.libraries = await fetchJSON('data/libraries.json');
  } catch (err) {
    showLoadError(err);
    return;
  }
  await loadLibrary(state.settings.libraryId);
}

init();
