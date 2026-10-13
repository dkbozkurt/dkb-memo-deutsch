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

## Run locally

It's a static site with no build step. Browsers block `fetch()` for files opened directly from disk, so serve the folder:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Deploy to GitHub Pages

Push to GitHub, then go to **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, and select `main` / `(root)`. All paths are relative, so the site works under `https://<user>.github.io/<repo>/`.

## Project structure

```
index.html              app shell
css/styles.css          styles (light/dark, responsive)
js/app.js               game logic
data/libraries.json     list of available word libraries
data/goethe-a1.json     Goethe A1 library (edit this directly)
data/goethe-a1-extended.json   extra words used only by the Extended library
tools/library.py        validate/format a library, generate verb tables
```

## Adding or editing words

The library files in `data/` are plain JSON and are the source of truth. Each word looks like this:

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

After editing, validate and re-format the file:

```bash
python3 tools/library.py check data/goethe-a1.json
```

To generate a verb table instead of typing it, run `conjugate`. Mark separable prefixes with `~` and give irregular singular forms with `--irr`:

```bash
python3 tools/library.py conjugate "ab~fahren" --irr fahre,fährst,fährt
```

## Adding a new library

1. Create `data/<id>.json` with `id`, `name`, `description` and a `words` array, in the format above.
2. Add an entry to `data/libraries.json`:

   ```json
   { "id": "goethe-a2", "name": "Goethe A2", "description": "…", "file": "data/goethe-a2.json" }
   ```

The library then shows up in the Settings menu. A library can also combine several files with `"files": ["data/a.json", "data/b.json"]`. That's how **Goethe A1 – Extended** reuses `goethe-a1.json` and only adds `goethe-a1-extended.json` on top.

## Word list source

The words come from the official Goethe-Institut A1 word lists: [Goethe-Zertifikat A1: Start Deutsch 1](https://www.goethe.de/pro/relaunch/prf/ca/A1_SD1_Wortliste_02.pdf) and [Goethe-Zertifikat A1: Fit in Deutsch 1](https://www.goethe.de/pro/relaunch/prf/sw/Goethe-Zertifikat_A1_Fit1_Wortliste.pdf). Both lists' thematic groups are included (numbers, days, months, colours, family, professions …). The extra core words and the Extended library follow Goethe's [Deutsch Online A1 course glossary](https://lernen.goethe.de/deutschonline/A1/PDF/EN/A1_deutschonline_course_vocabulary_1-18.pdf). The English translations, conjugation tables, comparisons and opposites were written for this project.

## License

[MIT](LICENSE)
