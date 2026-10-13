# Memo Deutsch

A simple flash card game for learning German vocabulary. It comes with two libraries:

- **Goethe A1** (1,195 words): the official Goethe-Zertifikat A1 exam word lists, plus the core (bold) words of Goethe's own A1 course and the pronouns and articles with their case tables.
- **Goethe A1 – Extended** (2,188 words): everything in Goethe A1 plus every other word from Goethe's *Deutsch Online A1* course glossary, covering A1.1 + A1.2.

- **Tap** the card to flip it between German and English.
- **Swipe right** if you knew the word and **left** if you didn't. You can also use the ✓ / ✗ buttons or the arrow keys.
- The **ⓘ** button in the card's top-left corner shows more about the word:
  - Verbs: present-tense conjugation for every subject (ich, du, er/sie/es …) and the Perfekt
  - Nouns: the plural form and the feminine form
  - Adjectives: the comparative and superlative
  - Opposites (e.g. *groß ↔ klein*)
  - Pronouns and articles: their case forms
- The counter at the top shows `card / total`. Below it, the red chip (left) counts the words you missed and the green chip (right) the words you knew, matching the swipe directions. Tap a chip to see those words, then practise them again.
- **Settings** (top right): choose the library, pick which language is shown first, turn shuffle on or off, and filter by word type.
- Progress is saved in the browser, separately for each library.

Keyboard: `Space` flip · `→` knew it · `←` missed · `I` info · `Z` undo.

## Development

Built with [TypeScript](https://www.typescriptlang.org/) and [Vite](https://vite.dev/). Requires Node.js 22.12 or newer.

```bash
npm install
```

```bash
npm run dev
```

Then open <http://localhost:5180>.

| Command | What it does |
| --- | --- |
| `npm run dev` | dev server with hot reload |
| `npm run build` | type-check, then build the site into `dist/` |
| `npm run preview` | serve the built `dist/` locally |
| `npm run typecheck` | type-check the app and the tools only |
| `npm run data:check` | validate and re-format the word library files |
| `npm run data:conjugate -- <verb>` | print a verb conjugation table (see below) |

## Deploy to GitHub Pages

Deployment is automated by `.github/workflows/deploy.yml`. Every push to `main` validates the word data, type-checks, builds, and publishes `dist/`.

To enable it once, go to the repository's **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**. The build uses relative paths, so it works under `https://<user>.github.io/<repo>/`.

## Project structure

```
index.html                      app shell (Vite entry)
src/
  main.ts                       game flow: rounds, rendering, lists, settings, keyboard
  card.ts                       card rendering, flip, swipe gestures, fly-out animation
  info.ts                       the ⓘ word-info popup
  confirm.ts                    in-app confirmation dialog
  state.ts                      game state and saved progress
  library.ts                    loading and merging word libraries
  words.ts                      word labels and card markup helpers
  dom.ts, storage.ts, util.ts   small helpers
  types.ts                      shared types (Word, Library, Settings …)
  styles.css                    styles (light/dark, responsive)
public/
  data/libraries.json           list of available word libraries
  data/goethe-a1.json           Goethe A1 library (edit this directly)
  data/goethe-a1-extended.json  extra words used only by the Extended library
  icon.svg
tools/library.ts                validate/format libraries, generate verb tables
```

Word data is served from `public/data` and loaded on demand, so a library is only downloaded when you pick it.

## Adding or editing words

The library files in `public/data/` are plain JSON and are the source of truth. Each word looks like this:

```json
{
  "id": "abfahren-v",
  "type": "verb",
  "de": "abfahren",
  "en": "to depart, to leave",
  "conjugation": [["ich", "fahre ab"], ["du", "fährst ab"], ["er/sie/es", "fährt ab"], ["wir", "fahren ab"], ["ihr", "fahrt ab"], ["sie/Sie", "fahren ab"]],
  "perfekt": "ist abgefahren",
  "opposites": [{"de": "ankommen", "en": "to arrive"}]
}
```

| Field | Used for |
| --- | --- |
| `id`, `type`, `de`, `en` | required. `type` is one of noun, verb, adjective, adverb, preposition, conjunction, question word, pronoun, phrase, number |
| `article` | nouns: `der` / `die` / `das` / `der/die` |
| `plural` or `number` | nouns: the plural form, or `"singular only"` / `"plural only"` |
| `feminine` | nouns: e.g. `"die Ärztin"` |
| `prefix` | verbs: `"sich"` or `"(sich)"` for reflexive verbs |
| `conjugation`, `perfekt` | verbs: present tense table and Perfekt |
| `comparison` | adjectives: `["älter", "am ältesten"]` |
| `table` | any type: a small two-column table, e.g. `{"title": "Cases", "rows": [["Nominativ", "ich"], ["Akkusativ", "mich"]]}` |
| `opposites` | any type: `[{"de": "neu", "en": "new"}]` |
| `note` | any type: a short usage note |

After editing, validate and re-format the files:

```bash
npm run data:check
```

To generate a verb table instead of typing it, run `conjugate`. Mark separable prefixes with `~` and give irregular singular forms with `--irr`:

```bash
npm run data:conjugate -- "ab~fahren" --irr fahre,fährst,fährt
```

Other options: `--full` for all six forms (or `sein` / `tun`), `--refl yes|opt` for reflexive verbs, `--imp` for impersonal verbs like *regnen*.

## Adding a new library

1. Create `public/data/<id>.json` with `id`, `name`, `description` and a `words` array, in the format above.
2. Add it to the `data:check` script in `package.json`.
3. Add an entry to `public/data/libraries.json` (paths are relative to `public/`):

   ```json
   { "id": "goethe-a2", "name": "Goethe A2", "description": "…", "file": "data/goethe-a2.json" }
   ```

The library then shows up in the Settings menu. A library can also combine several files with `"files": ["data/a.json", "data/b.json"]`. That's how **Goethe A1 – Extended** reuses `goethe-a1.json` and only adds `goethe-a1-extended.json` on top.

## Word list source

The words come from the official Goethe-Institut A1 word lists: [Goethe-Zertifikat A1: Start Deutsch 1](https://www.goethe.de/pro/relaunch/prf/ca/A1_SD1_Wortliste_02.pdf) and [Goethe-Zertifikat A1: Fit in Deutsch 1](https://www.goethe.de/pro/relaunch/prf/sw/Goethe-Zertifikat_A1_Fit1_Wortliste.pdf). Both lists' thematic groups are included (numbers, days, months, colours, family, professions …). The extra core words and the Extended library follow Goethe's [Deutsch Online A1 course glossary](https://lernen.goethe.de/deutschonline/A1/PDF/EN/A1_deutschonline_course_vocabulary_1-18.pdf). The English translations, conjugation tables, comparisons and opposites were written for this project.

## License

[MIT](LICENSE)
