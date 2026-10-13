import { els } from './dom';
import type { Lang, Row, Word } from './types';
import { esc } from './util';
import { LANG_LABELS, TYPE_LABELS, germanHTML } from './words';

const NO_INFO = `<p class="muted">No extra info for this word yet.</p>`;

function section(title: string, html: string): string {
  return `<section class="info-section"><h3>${esc(title)}</h3>${html}</section>`;
}

function pairs(items: string[], cls = ''): string {
  return `<div class="pairs">${items.map((i) => `<span class="pair ${cls}">${i}</span>`).join('')}</div>`;
}

function table(rows: Row[]): string {
  const body = rows.map(([label, value]) => `<tr><th scope="row">${esc(label)}</th><td>${esc(value)}</td></tr>`).join('');
  return `<div class="conj-wrap"><table class="conj">${body}</table></div>`;
}

function oppositesTitle(word: Word): string {
  return (word.opposites?.length ?? 0) > 1 ? 'Opposites' : 'Opposite';
}

function germanInfo(word: Word): string {
  const parts: string[] = [];

  if (word.type === 'noun') {
    if (word.plural) parts.push(section('Plural', `<p><span class="muted">die</span> <b>${esc(word.plural)}</b></p>`));
    if (word.number) parts.push(section('Number', `<p>${esc(word.number)}</p>`));
    if (word.feminine) parts.push(section('Feminine', `<p><b>${esc(word.feminine)}</b></p>`));
  }

  if (word.table) parts.push(section(word.table.title, table(word.table.rows)));
  if (word.conjugation) parts.push(section('Präsens · present tense', table(word.conjugation)));
  if (word.perfekt) {
    const [only] = word.conjugation?.length === 1 ? word.conjugation : [];
    const subject = only ? only[0] : 'er/sie/es';
    parts.push(section('Perfekt · past', `<p><span class="muted">${esc(subject)}</span> <b>${esc(word.perfekt)}</b></p>`));
  }

  if (word.comparison) parts.push(section('Comparison', pairs([word.de, ...word.comparison].map(esc))));

  if (word.opposites?.length) {
    const items = word.opposites.map((o) => `${esc(o.de)}${o.en ? ` <small>${esc(o.en)}</small>` : ''}`);
    parts.push(section(oppositesTitle(word), pairs(items, 'pair--opp')));
  }

  if (word.note) parts.push(section('Note', `<p>${esc(word.note)}</p>`));

  return parts.join('') || NO_INFO;
}

function englishInfo(word: Word): string {
  const items = (word.opposites ?? []).flatMap((o) => (o.en ? [esc(o.en)] : []));
  return items.length ? section(oppositesTitle(word), pairs(items, 'pair--opp')) : NO_INFO;
}

export function openInfo(word: Word | undefined, lang: Lang): void {
  if (!word) return;
  els.infoKicker.textContent = `${TYPE_LABELS[word.type] ?? word.type} · ${LANG_LABELS[lang]}`;
  els.infoTitle.innerHTML = lang === 'de' ? germanHTML(word) : esc(word.en);
  els.infoTitle.lang = lang;
  els.infoBody.innerHTML = lang === 'de' ? germanInfo(word) : englishInfo(word);
  els.infoDialog.showModal();
  els.infoBody.scrollTop = 0;
}
