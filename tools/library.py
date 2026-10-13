#!/usr/bin/env python3
"""Helpers for editing word library JSON files (data/*.json).

  python3 tools/library.py check data/goethe-a1.json
      Validate the file and rewrite it in the canonical format
      (one key per line, sorted by German word).

  python3 tools/library.py conjugate "ab~fahren" --irr fahre,fährst,fährt
      Print a ready-to-paste "conjugation" array for a verb.
      "ab~fahren"  separable prefix      -> ich fahre ab
      "Rad_fahren" particle with a space -> ich fahre Rad
      --irr   ich,du,er forms when the singular is irregular
      --full  all six forms (or "sein" / "tun")
      --refl  yes | opt   reflexive (sich freuen / (sich) anziehen)
      --imp   impersonal (es regnet)
"""
import argparse
import json
import re
import sys

TYPES = {"noun", "verb", "adjective", "adverb", "preposition", "conjunction",
         "question word", "pronoun", "phrase", "number"}
KEY_ORDER = ["id", "type", "article", "prefix", "de", "en", "plural", "number", "feminine",
             "conjugation", "perfekt", "comparison", "opposites", "note"]
PERSONS = ["ich", "du", "er/sie/es", "wir", "ihr", "sie/Sie"]
REFLEXIVE = ["mich", "dich", "sich", "uns", "euch", "sich"]
FULL_SHORTCUTS = {
    "sein": ["bin", "bist", "ist", "sind", "seid", "sind"],
    "tun": ["tue", "tust", "tut", "tun", "tut", "tun"],
}


# ---------- conjugation ----------

def regular_present(inf):
    """Present tense of a regular verb: [ich, du, er, wir, ihr, sie]."""
    if inf.endswith("eln"):
        stem = inf[:-1]
        return [stem[:-2] + "le", stem + "st", stem + "t", inf, stem + "t", inf]
    if inf.endswith("ern"):
        stem = inf[:-1]
        return [stem + "e", stem + "st", stem + "t", inf, stem + "t", inf]
    if not inf.endswith("en"):
        raise ValueError(f"cannot conjugate '{inf}' regularly; use --full")
    stem = inf[:-2]
    if stem.endswith(("t", "d")) or re.search(r"[^aeiouäöülrmnh][mn]$", stem):
        return [stem + "e", stem + "est", stem + "et", inf, stem + "et", inf]
    du = stem + ("t" if stem.endswith(("s", "ß", "z", "x")) else "st")
    return [stem + "e", du, stem + "t", inf, stem + "t", inf]


def conjugate(spec, irr=None, full=None, refl=None, imp=False):
    particle, sep, base = "", "", spec
    for marker, joiner in (("~", ""), ("_", " ")):
        if marker in spec:
            particle, base = spec.split(marker, 1)
            sep = joiner
    display = particle + sep + base

    if imp:
        return display, [["es", " ".join(filter(None, [regular_present(base)[2], particle]))]]
    if full:
        forms = FULL_SHORTCUTS.get(full) or full.split(",")
    elif irr:
        forms = irr.split(",") + regular_present(base)[3:]
    else:
        forms = regular_present(base)
    if len(forms) != 6:
        raise ValueError(f"expected 6 verb forms, got {forms}")

    rows = []
    for i, form in enumerate(forms):
        parts = [form]
        if refl == "yes":
            parts.append(REFLEXIVE[i])
        elif refl == "opt":
            parts.append(f"({REFLEXIVE[i]})")
        if particle:
            parts.append(particle)
        rows.append([PERSONS[i], " ".join(parts)])
    return display, rows


# ---------- validation & formatting ----------

def validate(data):
    errors = []
    if not isinstance(data.get("words"), list):
        return ["top level needs a \"words\" array"]
    seen = set()
    for i, w in enumerate(data["words"]):
        where = f"word #{i + 1} ({w.get('id') or w.get('de')})"
        for key in ("id", "type", "de", "en"):
            if not w.get(key):
                errors.append(f"{where}: missing \"{key}\"")
        if w.get("id") in seen:
            errors.append(f"{where}: duplicate id")
        seen.add(w.get("id"))
        if w.get("type") not in TYPES:
            errors.append(f"{where}: unknown type {w.get('type')!r}")
        unknown = set(w) - set(KEY_ORDER)
        if unknown:
            errors.append(f"{where}: unknown keys {sorted(unknown)}")
        if w.get("type") == "noun" and not (w.get("plural") or w.get("number")):
            errors.append(f"{where}: noun needs \"plural\" or \"number\"")
        if w.get("type") == "verb":
            if not w.get("conjugation"):
                errors.append(f"{where}: verb needs \"conjugation\"")
            if not w.get("perfekt"):
                errors.append(f"{where}: verb needs \"perfekt\"")
        for o in w.get("opposites", []):
            if not o.get("de"):
                errors.append(f"{where}: opposite without \"de\"")
    return errors


def sort_key(word):
    return (word["de"].lower().replace("ä", "a").replace("ö", "o").replace("ü", "u").replace("ß", "ss"),
            word["type"])


def dump(data):
    """Readable, diff-friendly JSON: one key per line, values kept compact."""
    compact = lambda v: json.dumps(v, ensure_ascii=False, separators=(", ", ": "))
    out = ["{"]
    for key in ("id", "name", "description"):
        if key in data:
            out.append(f'  "{key}": {compact(data[key])},')
    out.append('  "words": [')
    words = sorted(data["words"], key=sort_key)
    for i, w in enumerate(words):
        keys = [k for k in KEY_ORDER if k in w]
        out.append("    {")
        out += [f'      "{k}": {compact(w[k])}{"," if j < len(keys) - 1 else ""}' for j, k in enumerate(keys)]
        out.append("    }" + ("," if i < len(words) - 1 else ""))
    out += ["  ]", "}"]
    return "\n".join(out) + "\n"


def cmd_check(args):
    with open(args.file, encoding="utf-8") as f:
        data = json.load(f)
    errors = validate(data)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        sys.exit(1)
    with open(args.file, "w", encoding="utf-8") as f:
        f.write(dump(data))
    counts = {}
    for w in data["words"]:
        counts[w["type"]] = counts.get(w["type"], 0) + 1
    print(f"{args.file}: {len(data['words'])} words OK")
    print(", ".join(f"{t}: {n}" for t, n in sorted(counts.items(), key=lambda kv: -kv[1])))


def cmd_conjugate(args):
    display, rows = conjugate(args.verb, args.irr, args.full, args.refl, args.imp)
    print(f'"de": {json.dumps(display, ensure_ascii=False)},')
    print(f'"conjugation": {json.dumps(rows, ensure_ascii=False, separators=(", ", ": "))},')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("check", help="validate and format a library file")
    c.add_argument("file")
    c.set_defaults(func=cmd_check)
    v = sub.add_parser("conjugate", help="print a conjugation table for a verb")
    v.add_argument("verb")
    v.add_argument("--irr")
    v.add_argument("--full")
    v.add_argument("--refl", choices=["yes", "opt"])
    v.add_argument("--imp", action="store_true")
    v.set_defaults(func=cmd_conjugate)
    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
