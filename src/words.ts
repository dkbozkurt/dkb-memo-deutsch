import type { Lang, Word, WordType } from './types';
import { esc } from './util';

export const TYPE_LABELS: Record<WordType, string> = {
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

export const LANG_LABELS: Record<Lang, string> = { de: 'Deutsch', en: 'English' };

export function otherLang(lang: Lang): Lang {
  return lang === 'de' ? 'en' : 'de';
}

/** German word with its article (or "sich") in front, styled smaller and grey. */
export function germanHTML(word: Word): string {
  const lead = word.article ? `(${word.article})` : (word.prefix ?? '');
  return `${lead ? `<span class="word__article">${esc(lead)}</span>` : ''}${esc(word.de)}`;
}

export function germanPlain(word: Word): string {
  if (word.article) return `${word.article} ${word.de}`;
  if (word.prefix) return `${word.prefix.replace(/[()]/g, '')} ${word.de}`;
  return word.de;
}

function sizeClass(text: string): string {
  const n = text.length;
  if (n > 28) return 'word--xs';
  if (n > 16) return 'word--sm';
  if (n > 11) return 'word--md';
  return '';
}

/** Inner markup of one card face. */
export function faceHTML(word: Word, lang: Lang): string {
  const text = lang === 'de' ? germanPlain(word) : word.en;
  const inner = lang === 'de' ? germanHTML(word) : esc(word.en);
  return `
    <button class="face__info" type="button" data-info="${lang}" aria-label="More about this word">i</button>
    <span class="face__type">${esc(TYPE_LABELS[word.type] ?? word.type)}</span>
    <p class="word ${sizeClass(text)}" lang="${lang}">${inner}</p>
    <span class="face__lang">${LANG_LABELS[lang]}</span>`;
}
