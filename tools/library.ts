/**
 * Helpers for editing word library JSON files (public/data/*.json).
 *
 *   npm run data:check
 *   tsx tools/library.ts check public/data/goethe-a1.json [more files…]
 *       Validate the files, check data/libraries.json, and rewrite each file in the
 *       canonical format (one key per line, sorted by German word).
 *
 *   npm run data:conjugate -- "ab~fahren" --irr fahre,fährst,fährt
 *       Print a ready-to-paste "conjugation" array for a verb.
 *       "ab~fahren"  separable prefix      -> ich fahre ab
 *       "Rad_fahren" particle with a space -> ich fahre Rad
 *       --irr   ich,du,er forms when the singular is irregular
 *       --full  all six forms (or "sein" / "tun")
 *       --refl  yes | opt   reflexive (sich freuen / (sich) anziehen)
 *       --imp   impersonal (es regnet)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';

import type { LibraryFile, LibraryMeta, Row, Word } from '../src/types';
import { WORD_TYPES } from '../src/types';

const KEY_ORDER = [
  'id', 'type', 'article', 'prefix', 'de', 'en', 'plural', 'number', 'feminine',
  'table', 'conjugation', 'perfekt', 'comparison', 'opposites', 'note',
] as const satisfies readonly (keyof Word)[];

const PERSONS = ['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie/Sie'];
const REFLEXIVE = ['mich', 'dich', 'sich', 'uns', 'euch', 'sich'];
const FULL_SHORTCUTS: Record<string, string[]> = {
  sein: ['bin', 'bist', 'ist', 'sind', 'seid', 'sind'],
  tun: ['tue', 'tust', 'tut', 'tun', 'tut', 'tun'],
};

/* ---------- conjugation ---------- */

/** Present tense of a regular verb: [ich, du, er, wir, ihr, sie]. */
export function regularPresent(inf: string): string[] {
  if (inf.endsWith('eln')) {
    const stem = inf.slice(0, -1);
    return [stem.slice(0, -2) + 'le', stem + 'st', stem + 't', inf, stem + 't', inf];
  }
  if (inf.endsWith('ern')) {
    const stem = inf.slice(0, -1);
    return [stem + 'e', stem + 'st', stem + 't', inf, stem + 't', inf];
  }
  if (!inf.endsWith('en')) throw new Error(`cannot conjugate "${inf}" regularly; use --full`);
  const stem = inf.slice(0, -2);
  if (/[td]$/.test(stem) || /[^aeiouäöülrmnh][mn]$/.test(stem)) {
    return [stem + 'e', stem + 'est', stem + 'et', inf, stem + 'et', inf];
  }
  const du = stem + (/[sßzx]$/.test(stem) ? 't' : 'st');
  return [stem + 'e', du, stem + 't', inf, stem + 't', inf];
}

interface ConjugateOptions {
  irr?: string;
  full?: string;
  refl?: 'yes' | 'opt';
  imp?: boolean;
}

export function conjugate(spec: string, opts: ConjugateOptions = {}): { display: string; rows: Row[] } {
  let particle = '';
  let joiner = '';
  let base = spec;
  for (const [marker, sep] of [['~', ''], ['_', ' ']] as const) {
    const i = spec.indexOf(marker);
    if (i >= 0) {
      particle = spec.slice(0, i);
      base = spec.slice(i + 1);
      joiner = sep;
    }
  }
  const display = particle + joiner + base;

  if (opts.imp) {
    return { display, rows: [['es', [regularPresent(base)[2], particle].filter(Boolean).join(' ')]] };
  }

  let forms: string[];
  if (opts.full) forms = FULL_SHORTCUTS[opts.full] ?? opts.full.split(',');
  else if (opts.irr) forms = [...opts.irr.split(','), ...regularPresent(base).slice(3)];
  else forms = regularPresent(base);
  if (forms.length !== 6) throw new Error(`expected 6 verb forms, got ${forms.join(', ')}`);

  const rows = forms.map((form, i): Row => {
    const parts = [form];
    if (opts.refl === 'yes') parts.push(REFLEXIVE[i]!);
    else if (opts.refl === 'opt') parts.push(`(${REFLEXIVE[i]})`);
    if (particle) parts.push(particle);
    return [PERSONS[i]!, parts.join(' ')];
  });
  return { display, rows };
}

/* ---------- validation & formatting ---------- */

const isRow = (r: unknown): r is Row => Array.isArray(r) && r.length === 2 && r.every((c) => typeof c === 'string');

export function validate(data: Partial<LibraryFile>): string[] {
  if (!Array.isArray(data.words)) return ['top level needs a "words" array'];
  const errors: string[] = [];
  const seen = new Set<string>();
  const known = new Set<string>(KEY_ORDER);

  data.words.forEach((w, i) => {
    const where = `word #${i + 1} (${w.id || w.de})`;
    for (const key of ['id', 'type', 'de', 'en'] as const) if (!w[key]) errors.push(`${where}: missing "${key}"`);
    if (seen.has(w.id)) errors.push(`${where}: duplicate id`);
    seen.add(w.id);
    if (!(WORD_TYPES as readonly string[]).includes(w.type)) errors.push(`${where}: unknown type "${w.type}"`);
    const unknown = Object.keys(w).filter((k) => !known.has(k));
    if (unknown.length) errors.push(`${where}: unknown keys ${unknown.join(', ')}`);
    if (w.type === 'noun' && !(w.plural || w.number)) errors.push(`${where}: noun needs "plural" or "number"`);
    if (w.type === 'verb') {
      if (!w.conjugation?.length) errors.push(`${where}: verb needs "conjugation"`);
      if (!w.perfekt) errors.push(`${where}: verb needs "perfekt"`);
    }
    if (w.conjugation && !w.conjugation.every(isRow)) errors.push(`${where}: conjugation rows must be [person, form]`);
    if (w.table && !(w.table.title && w.table.rows.every(isRow))) {
      errors.push(`${where}: table needs a title and rows of [label, value]`);
    }
    if (w.comparison && w.comparison.length !== 2) errors.push(`${where}: comparison needs [comparative, superlative]`);
    for (const o of w.opposites ?? []) if (!o.de) errors.push(`${where}: opposite without "de"`);
  });
  return errors;
}

const sortKey = (w: Word) =>
  w.de.toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');

/** Single-line JSON with a space after every comma and colon. */
function compact(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(compact).join(', ')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${compact(x)}`).join(', ')}}`;
  }
  return JSON.stringify(v);
}

/** Readable, diff-friendly JSON: one key per line, values kept compact. */
export function format(data: LibraryFile): string {
  const out = ['{'];
  for (const key of ['id', 'name', 'description'] as const) {
    if (data[key] !== undefined) out.push(`  "${key}": ${JSON.stringify(data[key])},`);
  }
  out.push('  "words": [');
  const words = [...data.words].sort((a, b) => {
    const ka = sortKey(a);
    const kb = sortKey(b);
    return ka < kb ? -1 : ka > kb ? 1 : a.type < b.type ? -1 : a.type > b.type ? 1 : 0;
  });
  words.forEach((w, i) => {
    const keys = KEY_ORDER.filter((k) => w[k] !== undefined);
    out.push('    {');
    keys.forEach((k, j) => out.push(`      "${k}": ${compact(w[k])}${j < keys.length - 1 ? ',' : ''}`));
    out.push(`    }${i < words.length - 1 ? ',' : ''}`);
  });
  out.push('  ]', '}');
  return out.join('\n') + '\n';
}

function checkLibraryList(dataDir: string): string[] {
  const listPath = join(dataDir, 'libraries.json');
  if (!existsSync(listPath)) return [];
  const libs = JSON.parse(readFileSync(listPath, 'utf8')) as LibraryMeta[];
  const errors: string[] = [];
  for (const lib of libs) {
    const files = lib.files ?? (lib.file ? [lib.file] : []);
    if (!files.length) errors.push(`libraries.json: "${lib.id}" has no "file" or "files"`);
    for (const f of files) {
      // paths in libraries.json are relative to the site root (public/)
      if (!existsSync(join(dataDir, '..', f))) errors.push(`libraries.json: "${lib.id}" points to missing ${f}`);
    }
  }
  return errors;
}

/* ---------- CLI ---------- */

function cmdCheck(files: string[]): void {
  if (!files.length) throw new Error('usage: library.ts check <file.json> [more files…]');
  let failed = false;
  for (const file of files) {
    const data = JSON.parse(readFileSync(file, 'utf8')) as LibraryFile;
    const errors = validate(data);
    if (errors.length) {
      failed = true;
      console.error(`${file}:\n  ${errors.join('\n  ')}`);
      continue;
    }
    writeFileSync(file, format(data));
    const counts = new Map<string, number>();
    for (const w of data.words) counts.set(w.type, (counts.get(w.type) ?? 0) + 1);
    const summary = [...counts].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t}: ${n}`).join(', ');
    console.log(`${file}: ${data.words.length} words OK\n  ${summary}`);
  }
  const listErrors = checkLibraryList(dirname(files[0]!));
  if (listErrors.length) {
    failed = true;
    console.error(listErrors.join('\n'));
  }
  if (failed) process.exit(1);
}

function cmdConjugate(args: string[]): void {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { irr: { type: 'string' }, full: { type: 'string' }, refl: { type: 'string' }, imp: { type: 'boolean' } },
  });
  const verb = positionals[0];
  if (!verb) throw new Error('usage: library.ts conjugate <verb> [--irr …] [--full …] [--refl yes|opt] [--imp]');
  if (values.refl && values.refl !== 'yes' && values.refl !== 'opt') throw new Error('--refl must be yes or opt');
  const { display, rows } = conjugate(verb, {
    irr: values.irr,
    full: values.full,
    refl: values.refl as ConjugateOptions['refl'],
    imp: values.imp,
  });
  console.log(`"de": ${JSON.stringify(display)},`);
  console.log(`"conjugation": ${compact(rows)},`);
}

const [command, ...rest] = process.argv.slice(2);
try {
  if (command === 'check') cmdCheck(rest);
  else if (command === 'conjugate') cmdConjugate(rest);
  else throw new Error('usage: library.ts check <files…> | conjugate <verb> [options]');
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
