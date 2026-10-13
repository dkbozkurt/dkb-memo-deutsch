import { store } from './storage';
import type { Library, LibraryMeta, ListTab, Mode, Progress, Result, Settings, Word, WordType } from './types';
import { WORD_TYPES } from './types';

const DEFAULT_SETTINGS: Settings = { libraryId: null, front: 'de', shuffle: true, types: null };

export const state = {
  libraries: [] as LibraryMeta[],
  library: null as Library | null,
  wordsById: new Map<string, Word>(),
  settings: { ...DEFAULT_SETTINGS } as Settings,
  /** Word ids of the current round, in play order. */
  deck: [] as string[],
  /** Answers so far; its length is the position in the deck. */
  history: [] as Progress['history'],
  mode: 'all' as Mode,
  /** True while a card is flying away. */
  busy: false,
  listTab: 'correct' as ListTab,
};

export function library(): Library {
  if (!state.library) throw new Error('No library loaded');
  return state.library;
}

export function wordAt(offset = 0): Word | undefined {
  const id = state.deck[state.history.length + offset];
  return id ? state.wordsById.get(id) : undefined;
}

export function counts(): { correct: number; wrong: number } {
  let correct = 0;
  for (const [, r] of state.history) correct += r;
  return { correct, wrong: state.history.length - correct };
}

export function idsWithResult(result: Result): string[] {
  return state.history.filter(([, r]) => r === result).map(([id]) => id);
}

export function roundInProgress(): boolean {
  return state.history.length > 0 && state.history.length < state.deck.length;
}

/** [type, count] for every word type present in the library, in a fixed order. */
export function typesInLibrary(): [WordType, number][] {
  const count = new Map<WordType, number>();
  for (const w of library().words) count.set(w.type, (count.get(w.type) ?? 0) + 1);
  return WORD_TYPES.filter((t) => count.has(t)).map((t) => [t, count.get(t)!]);
}

export function enabledTypes(): WordType[] {
  const available = typesInLibrary().map(([t]) => t);
  const chosen = state.settings.types?.filter((t) => available.includes(t));
  return chosen?.length ? chosen : available;
}

/* ---------- Persistence ---------- */

export function loadSettings(): void {
  state.settings = { ...DEFAULT_SETTINGS, ...store.get<Partial<Settings>>('settings', {}) };
}

export function saveSettings(): void {
  store.set('settings', state.settings);
}

export function saveProgress(): void {
  const progress: Progress = { deck: state.deck, history: state.history, mode: state.mode };
  store.set(`progress:${library().id}`, progress);
}

/** Restore the saved round for the current library. Returns false if there is none. */
export function restoreProgress(): boolean {
  const saved = store.get<Partial<Progress> | null>(`progress:${library().id}`, null);
  if (!saved || !Array.isArray(saved.deck)) return false;
  const deck = saved.deck.filter((id) => state.wordsById.has(id));
  if (!deck.length) return false;
  const inDeck = new Set(deck);
  state.deck = deck;
  state.history = (saved.history ?? []).filter(([id]) => inDeck.has(id)).slice(0, deck.length);
  state.mode = saved.mode ?? 'all';
  return true;
}
