// Word dictionaries + solvable-syllable pools for Bomb Party.
// Word lists are loaded via CommonJS require (their package main is a .json
// array), which sidesteps ESM JSON import assertions. Everything is normalized
// to plain a–z (accents stripped) so players don't have to type diacritics.

import { createRequire } from "node:module";
import type { Language } from "../../../shared/src/games.js";

const require = createRequire(import.meta.url);

/** Lowercase, strip accents, keep only a–z. */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
}

interface Lang {
  words: Set<string>;
  /** Syllables (2–3 letters) that appear in enough words to be solvable. */
  prompts: string[];
}

const cache = new Map<Language, Lang>();

/** A syllable must appear in at least this many distinct words to be used. */
const MIN_WORDS_PER_PROMPT = 400;

function build(language: Language): Lang {
  const source: string[] =
    language === "fr"
      ? require("an-array-of-french-words")
      : require("an-array-of-english-words");

  const words = new Set<string>();
  // counts[substring] = number of distinct words containing it (≤ ~18k keys).
  const counts = new Map<string, number>();

  for (const raw of source) {
    const w = normalize(raw);
    if (w.length < 3) continue;
    words.add(w);

    const seen = new Set<string>();
    for (let len = 2; len <= 3; len++) {
      for (let i = 0; i + len <= w.length; i++) seen.add(w.slice(i, i + len));
    }
    for (const s of seen) counts.set(s, (counts.get(s) ?? 0) + 1);
  }

  const prompts: string[] = [];
  for (const [s, c] of counts) if (c >= MIN_WORDS_PER_PROMPT) prompts.push(s);

  return { words, prompts };
}

function get(language: Language): Lang {
  let lang = cache.get(language);
  if (!lang) {
    const t0 = Date.now();
    lang = build(language);
    cache.set(language, lang);
    console.log(
      `  📖 dictionary[${language}] ready: ${lang.words.size} words, ` +
        `${lang.prompts.length} prompts (${Date.now() - t0}ms)`
    );
  }
  return lang;
}

/** Warm a language's dictionary ahead of time (called at boot). */
export function preload(language: Language): void {
  get(language);
}

/** Random solvable syllable for the given language. */
export function randomPrompt(language: Language): string {
  const { prompts } = get(language);
  return prompts[Math.floor(Math.random() * prompts.length)].toUpperCase();
}

/** Is `word` a real word that contains `prompt`? (both compared normalized) */
export function isValidWord(
  language: Language,
  word: string,
  prompt: string
): boolean {
  const w = normalize(word);
  const p = normalize(prompt);
  return w.length >= 2 && w.includes(p) && get(language).words.has(w);
}
