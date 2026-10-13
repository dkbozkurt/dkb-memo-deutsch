import type { Library, LibraryFile, LibraryMeta, Word } from './types';
import { fetchJSON } from './util';

/** Data files live in public/data and are fetched on demand, relative to the deployed base path. */
const dataUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`;

const cache = new Map<string, Library>();

export function fetchLibraryList(): Promise<LibraryMeta[]> {
  return fetchJSON<LibraryMeta[]>(dataUrl('data/libraries.json'));
}

/** Load a library. Several files are merged in order; the first occurrence of a word id wins. */
export async function fetchLibrary(meta: LibraryMeta): Promise<Library> {
  const cached = cache.get(meta.id);
  if (cached) return cached;

  const files = meta.files ?? (meta.file ? [meta.file] : []);
  const parts = await Promise.all(files.map((f) => fetchJSON<LibraryFile>(dataUrl(f))));
  const byId = new Map<string, Word>();
  for (const part of parts) for (const word of part.words) if (!byId.has(word.id)) byId.set(word.id, word);

  const words = [...byId.values()];
  if (parts.length > 1) words.sort((a, b) => a.de.localeCompare(b.de, 'de', { sensitivity: 'base' }));

  const lib: Library = { id: meta.id, name: meta.name, words };
  cache.set(meta.id, lib);
  return lib;
}
