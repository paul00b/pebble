// Word dictionaries + solvable-syllable pools for Bomb Party.
// Word lists are loaded via CommonJS require (their package main is a .json
// array), which sidesteps ESM JSON import assertions. Everything is normalized
// to plain a–z (accents stripped) so players don't have to type diacritics.

import { createRequire } from "node:module";
import type { Language } from "../../../shared/src/games.js";
import { extraWords } from "./extra-words.js";

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
  /** counts[substring] = number of distinct words containing it (≤ ~18k keys). */
  counts: Map<string, number>;
  /** Eligible-syllable pools, lazily built + cached per rarity threshold. */
  pools: Map<number, string[]>;
}

const cache = new Map<Language, Lang>();

/** Hard floor on the syllable pool - never let a custom threshold starve it. */
const MIN_POOL = 60;

function build(language: Language): Lang {
  const source: string[] =
    language === "fr"
      ? require("an-array-of-french-words")
      : require("an-array-of-english-words");

  const words = new Set<string>();
  const counts = new Map<string, number>();

  const ingest = (raw: string) => {
    const w = normalize(raw);
    if (w.length < 3) return;
    if (words.has(w)) return; // already counted - don't double-bump syllables
    words.add(w);

    // Syllables of 2 or 3 letters - the game shows a mix of both lengths.
    const seen = new Set<string>();
    for (let len = 2; len <= 3; len++) {
      for (let i = 0; i + len <= w.length; i++) seen.add(w.slice(i, i + len));
    }
    for (const s of seen) counts.set(s, (counts.get(s) ?? 0) + 1);
  };

  for (const raw of source) ingest(raw);
  // Hand-curated extras (modern/loanwords) the base list misses.
  for (const raw of extraWords(language)) ingest(raw);

  return { words, counts, pools: new Map() };
}

function get(language: Language): Lang {
  let lang = cache.get(language);
  if (!lang) {
    const t0 = Date.now();
    lang = build(language);
    cache.set(language, lang);
    console.log(
      `  📖 dictionary[${language}] ready: ${lang.words.size} words, ` +
        `${lang.counts.size} syllables (${Date.now() - t0}ms)`
    );
  }
  return lang;
}

/** The syllable pool at a given rarity threshold (built once, then cached). A
 *  threshold yielding too few syllables is relaxed so a round always has fuel. */
function pool(language: Language, minWords: number): string[] {
  const lang = get(language);
  const cached = lang.pools.get(minWords);
  if (cached) return cached;

  let threshold = minWords;
  let prompts: string[] = [];
  while (threshold > 1) {
    prompts = [];
    for (const [s, c] of lang.counts) if (c >= threshold) prompts.push(s);
    if (prompts.length >= MIN_POOL) break;
    threshold = Math.floor(threshold / 2); // too rare - loosen and retry
  }
  lang.pools.set(minWords, prompts);
  return prompts;
}

/** Warm a language's dictionary ahead of time (called at boot). */
export function preload(language: Language): void {
  get(language);
}

/** Random solvable syllable at the given rarity (lower minWords = rarer/harder). */
export function randomPrompt(language: Language, minWords = 500): string {
  const prompts = pool(language, minWords);
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
