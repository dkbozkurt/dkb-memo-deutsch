export const WORD_TYPES = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'preposition',
  'conjunction',
  'question word',
  'pronoun',
  'phrase',
  'number',
] as const;

export type WordType = (typeof WORD_TYPES)[number];
export type Lang = 'de' | 'en';

/** A two-column table row: [label, value], e.g. ["ich", "fahre ab"]. */
export type Row = [label: string, value: string];

export interface Opposite {
  de: string;
  en?: string;
}

export interface InfoTable {
  title: string;
  rows: Row[];
}

export interface Word {
  id: string;
  type: WordType;
  de: string;
  en: string;
  /** Nouns: der / die / das / der/die */
  article?: string;
  /** Reflexive verbs: "sich" or "(sich)" */
  prefix?: string;
  plural?: string;
  /** Nouns without a plural: "singular only" / "plural only" */
  number?: string;
  feminine?: string;
  table?: InfoTable;
  conjugation?: Row[];
  perfekt?: string;
  comparison?: [comparative: string, superlative: string];
  opposites?: Opposite[];
  note?: string;
}

/** Shape of a data/*.json word file. */
export interface LibraryFile {
  id: string;
  name: string;
  description?: string;
  words: Word[];
}

/** An entry in data/libraries.json. A library is one file or several merged files. */
export interface LibraryMeta {
  id: string;
  name: string;
  description: string;
  file?: string;
  files?: string[];
}

export interface Library {
  id: string;
  name: string;
  words: Word[];
}

/** 1 = knew it, 0 = missed */
export type Result = 0 | 1;
export type Mode = 'all' | 'wrong' | 'correct';
export type ListTab = 'correct' | 'wrong';

export interface Progress {
  deck: string[];
  history: [wordId: string, result: Result][];
  mode: Mode;
}

export interface Settings {
  libraryId: string | null;
  front: Lang;
  shuffle: boolean;
  /** null = all types */
  types: WordType[] | null;
}
