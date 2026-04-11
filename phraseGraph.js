import {
  ALL_PHRASE_CHAINS,
  phrasePairKey,
  getCuratedPhrasePairSet,
  getEasyCuratedPhrasePairSet,
} from "./wordChains.js";

const MIN_WORD_LEN = 3;

/** Mirrors app.js DIFFICULTY per-word limits for Endless / Frenzy walks. */
const WORD_LEN_BOUNDS = {
  easy: { minLen: 3, maxLen: 5 },
  medium: { minLen: 3, maxLen: 6 },
  hard: { minLen: 3, maxLen: 8 },
};

/** @param {string} w @param {string} difficulty */
function wordMatchesDifficultyBounds(w, difficulty) {
  const b = WORD_LEN_BOUNDS[/** @type {keyof typeof WORD_LEN_BOUNDS} */ (difficulty)] || WORD_LEN_BOUNDS.medium;
  const L = w.length;
  return L >= b.minLen && L <= b.maxLen;
}

/** @param {string[]} words @param {string} difficulty */
function filterByDifficultyLength(words, difficulty) {
  return words.filter((w) => wordMatchesDifficultyBounds(w, difficulty));
}

/** @param {string} a @param {string} b */
export function pairKey(a, b) {
  return phrasePairKey(a, b);
}

/**
 * Among length-valid successors, prefer vetted phrase steps from {@link WORD_CHAINS}.
 * Easy: only pairs from easy-length (3–5) chains, then uncached neighbors if needed.
 */
function preferCuratedPhraseNeighbors(cur, nexts, difficulty) {
  if (nexts.length === 0) return nexts;
  if (difficulty === "easy") {
    const easyPairs = getEasyCuratedPhrasePairSet();
    const veryCommon = nexts.filter((n) => easyPairs.has(phrasePairKey(cur, n)));
    // Prefer very common pairs only; allow other 3–5 neighbors if the easy subgraph has no exit.
    return veryCommon.length > 0 ? veryCommon : nexts;
  }
  const curated = getCuratedPhrasePairSet();
  const preferred = nexts.filter((n) => curated.has(phrasePairKey(cur, n)));
  return preferred.length > 0 ? preferred : nexts;
}

/**
 * Directed adjacency: word -> list of words that can follow in a common phrase.
 * @returns {Map<string, string[]>}
 */
export function buildAdjacency(chains = ALL_PHRASE_CHAINS) {
  /** @type {Map<string, string[]>} */
  const m = new Map();
  for (const chain of chains) {
    const words = chain.map((w) => String(w).toLowerCase().trim());
    for (let i = 0; i < words.length - 1; i++) {
      const a = words[i];
      const b = words[i + 1];
      if (a.length < MIN_WORD_LEN || b.length < MIN_WORD_LEN) continue;
      if (!m.has(a)) m.set(a, []);
      const list = m.get(a);
      if (!list.includes(b)) list.push(b);
    }
  }
  return m;
}

/** All words that appear in the phrase graph (for dictionary seeding). */
export function collectGraphVocabulary(chains = ALL_PHRASE_CHAINS) {
  const s = new Set();
  for (const chain of chains) {
    for (const w of chain) {
      const lw = String(w).toLowerCase().trim();
      if (lw.length >= MIN_WORD_LEN) s.add(lw);
    }
  }
  return s;
}

let _adj = null;

export function getPhraseAdjacency() {
  if (!_adj) _adj = buildAdjacency();
  return _adj;
}

function pickNextStep(candidates, difficulty) {
  if (candidates.length === 0) return null;
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  if (difficulty === "easy") {
    shuffled.sort((a, b) => a.length - b.length || a.localeCompare(b));
    const k = Math.min(4, shuffled.length);
    return shuffled[Math.floor(Math.random() * k)];
  }
  if (difficulty === "hard") {
    shuffled.sort((a, b) => b.length - a.length || a.localeCompare(b));
    const k = Math.min(4, shuffled.length);
    return shuffled[Math.floor(Math.random() * k)];
  }
  return shuffled[Math.floor(Math.random() * shuffled.length)];
}

/**
 * Append one word to `path` using `adj` without reusing directed pairs in `usedPairs`.
 * Mutates `path` and `usedPairs`. Returns true if a word was added.
 */
export function appendOnePhraseStep(adj, path, usedPairs, difficulty) {
  if (path.length === 0) return false;
  const cur = path[path.length - 1];
  const raw = adj.get(cur) || [];
  const nexts = filterByDifficultyLength(
    raw.filter((n) => !usedPairs.has(phrasePairKey(cur, n))),
    difficulty,
  );
  const pool = preferCuratedPhraseNeighbors(cur, nexts, difficulty);
  const next = pickNextStep(pool, difficulty);
  if (!next) return false;
  usedPairs.add(phrasePairKey(cur, next));
  path.push(next);
  return true;
}

/**
 * Grow `path` until it has at least `minLength` words (or graph blocks further steps).
 */
export function growPhrasePath(adj, path, usedPairs, minLength, difficulty) {
  let guard = 0;
  while (path.length < minLength && guard < 500) {
    guard += 1;
    if (!appendOnePhraseStep(adj, path, usedPairs, difficulty)) break;
  }
}

/**
 * Append one word without a global "used pairs" set: only avoid immediate A→B→A
 * backtracking when other neighbors exist. Lets endless mode walk arbitrarily
 * far on a finite phrase graph by reusing phrase links.
 */
export function appendOnePhraseStepRelaxed(adj, path, difficulty) {
  if (path.length === 0) return false;
  const cur = path[path.length - 1];
  const prev = path.length >= 2 ? path[path.length - 2] : null;
  const raw = filterByDifficultyLength(adj.get(cur) || [], difficulty);
  let nexts = prev != null ? raw.filter((n) => n !== prev) : raw;
  if (nexts.length === 0) nexts = raw;
  const pool = preferCuratedPhraseNeighbors(cur, nexts, difficulty);
  const next = pickNextStep(pool, difficulty);
  if (!next) return false;
  path.push(next);
  return true;
}

/**
 * Extend `path` to at least `minLength` words using {@link appendOnePhraseStepRelaxed}.
 */
export function growPhrasePathRelaxed(adj, path, minLength, difficulty) {
  const need = Math.max(0, minLength - path.length);
  let guard = 0;
  const maxGuard = need + 500;
  while (path.length < minLength && guard < maxGuard) {
    guard += 1;
    if (!appendOnePhraseStepRelaxed(adj, path, difficulty)) break;
  }
}

/** Grow with relaxed steps until no neighbor can be appended (or maxSteps). */
export function growPhrasePathRelaxedUntilBlocked(adj, path, difficulty, maxSteps = 8000) {
  let guard = 0;
  while (guard < maxSteps) {
    guard += 1;
    if (!appendOnePhraseStepRelaxed(adj, path, difficulty)) break;
  }
}

const ENDLESS_SEED_MIN_WORDS = 30;

/**
 * Build a path of at least `max(30, minWords)` words for endless mode using relaxed
 * phrase steps, retrying from high–out-degree starters when needed.
 * @param {Map<string, string[]>} adj
 * @param {number} [minWords]
 * @param {string} [difficulty]
 * @returns {string[]}
 */
export function buildEndlessSeedChain(adj, minWords = ENDLESS_SEED_MIN_WORDS, difficulty = "medium") {
  const target = Math.max(ENDLESS_SEED_MIN_WORDS, minWords);

  const longStrict = generateLongChain({ minLen: target, maxLen: target + 16, difficulty });
  if (longStrict.length >= target) return longStrict;

  const starts = [...adj.keys()].filter(
    (k) => wordMatchesDifficultyBounds(k, difficulty) && (adj.get(k) || []).length > 0,
  );
  if (starts.length === 0) {
    return filterByDifficultyLength(["brain", "storm", "drain", "pipe", "dream", "job"], difficulty);
  }

  /** One relaxed walk stops at the first dead end; that often ends well before `target`.
   *  Many random walks until blocked, keeping the longest, reliably reaches 30+ steps on this graph. */
  let best = [];
  const maxWalkSteps = 15000;
  const randomBatch = 10000;

  const consider = (path) => {
    if (path.length > best.length) best = path;
  };

  for (let t = 0; t < randomBatch; t++) {
    const path = [starts[Math.floor(Math.random() * starts.length)]];
    growPhrasePathRelaxedUntilBlocked(adj, path, difficulty, maxWalkSteps);
    consider(path);
    if (best.length >= target) return best;
  }

  for (const start of starts) {
    const path = [start];
    growPhrasePathRelaxedUntilBlocked(adj, path, difficulty, maxWalkSteps);
    consider(path);
    if (best.length >= target) return best;
  }

  if (best.length < target) {
    for (let t = 0; t < randomBatch; t++) {
      const path = [starts[Math.floor(Math.random() * starts.length)]];
      growPhrasePathRelaxedUntilBlocked(adj, path, difficulty, maxWalkSteps);
      consider(path);
      if (best.length >= target) break;
    }
  }

  growPhrasePathRelaxed(adj, best, target, difficulty);
  if (best.length >= target) return best;

  const seed = generateLongChain({ minLen: 8, maxLen: 18, difficulty });
  const merged = seed.length >= 2 ? [...seed] : ["brain", "storm", "drain", "pipe", "dream", "job"];
  growPhrasePathRelaxedUntilBlocked(adj, merged, difficulty, maxWalkSteps);
  growPhrasePathRelaxed(adj, merged, target, difficulty);
  consider(merged);
  if (best.length >= 2) return best;
  return filterByDifficultyLength(["brain", "storm", "drain", "pipe", "dream", "job"], difficulty);
}

/**
 * Random walk without reusing the same directed phrase edge twice.
 * @param {string[][]} [chains]
 * @param {{ minLen?: number; maxLen?: number; difficulty?: string }} opts
 * @returns {string[]}
 */
export function generateLongChain(opts = {}, chains = ALL_PHRASE_CHAINS) {
  const adj = buildAdjacency(chains);
  const minLen = Math.max(8, opts.minLen ?? 10);
  const maxLen = Math.max(minLen, opts.maxLen ?? 24);
  const target = minLen + Math.floor(Math.random() * (maxLen - minLen + 1));
  const difficulty = opts.difficulty || "medium";

  const starts = [...adj.keys()].filter(
    (k) => wordMatchesDifficultyBounds(k, difficulty) && (adj.get(k) || []).length > 0,
  );
  if (starts.length === 0) {
    return filterByDifficultyLength(["brain", "storm", "drain", "pipe", "dream", "job"], difficulty);
  }

  for (let attempt = 0; attempt < 400; attempt++) {
    const path = [starts[Math.floor(Math.random() * starts.length)]];
    const usedPairs = new Set();
    while (path.length < target) {
      if (!appendOnePhraseStep(adj, path, usedPairs, difficulty)) break;
    }
    if (path.length >= minLen) return path;
  }

  let best = [];
  for (const ch of chains) {
    const words = ch.map((w) => w.toLowerCase()).filter((w) => w.length >= MIN_WORD_LEN);
    if (words.length > best.length) best = words;
  }
  let fallback = best.length >= 2 ? best : ["brain", "storm", "drain", "pipe", "dream", "job"];
  fallback = filterByDifficultyLength(fallback, difficulty);
  if (fallback.length < 2) {
    fallback = filterByDifficultyLength(["brain", "storm", "drain", "pipe", "dream", "job"], difficulty);
  }
  const grown = [...fallback];
  growPhrasePathRelaxed(adj, grown, minLen, difficulty);
  return grown.length >= minLen ? grown : fallback;
}
