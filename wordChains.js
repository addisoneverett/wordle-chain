import { ENDLESS_BACKBONE_CHAINS } from "./endlessBackboneChains.js";

// Each adjacent pair should form a common phrase. Standard chains are 5 words (DIFFICULTY.chainLen).
// Easy: 3–5 letters/word; Medium: 3–6; Hard: 3–8. pickChain() filters by active difficulty.
// Easy mode uses only rows where every word is 3–5 letters for Standard + easy-curated phrase pairs in the graph.
export const WORD_CHAINS = [
  // Easy (15)
  ["apple", "core", "dump", "truck", "stop"],
  ["game", "over", "time", "card", "slot"],
  ["snow", "ball", "park", "side", "walk"],
  ["fire", "side", "road", "kill", "shot"],
  ["book", "worm", "hole", "card", "game"],
  ["rain", "drop", "kick", "back", "fire"],
  ["bed", "bug", "bite", "back", "yard"],
  ["hand", "bag", "pipe", "line", "cord"],
  ["eye", "drop", "kick", "drum", "roll"],
  ["top", "dog", "leg", "room", "key"],
  ["sun", "burn", "rate", "card", "game"],
  ["hot", "dog", "leg", "pull", "back"],
  ["car", "pool", "side", "walk", "path"],
  ["cup", "cake", "walk", "away", "game"],
  ["ear", "drum", "roll", "call", "back"],
  // Medium (15)
  ["coffee", "shop", "front", "door", "bell"],
  ["water", "slide", "rule", "book", "shelf"],
  ["music", "video", "game", "night", "shift"],
  ["clock", "tower", "block", "party", "line"],
  ["heart", "rate", "card", "trick", "shot"],
  ["brain", "storm", "drain", "pipe", "dream"],
  ["phone", "call", "sign", "board", "game"],
  ["price", "tag", "line", "drive", "shaft"],
  ["team", "spirit", "level", "cross", "road"],
  ["stone", "wall", "clock", "tower", "block"],
  ["house", "plant", "food", "chain", "store"],
  ["road", "block", "party", "trick", "shot"],
  ["night", "shift", "work", "bench", "mark"],
  ["floor", "plan", "ahead", "start", "line"],
  ["front", "door", "frame", "work", "bench"],
  // Hard (15)
  ["snapshot", "capture", "release", "schedule", "conflict"],
  ["fresh", "update", "release", "schedule", "conflict"],
  ["keyboard", "shortcut", "learning", "platform", "service"],
  ["compound", "interest", "payment", "deadline", "pressure"],
  ["shoulder", "padding", "document", "workflow", "platform"],
  ["anchor", "point", "release", "schedule", "conflict"],
  ["climbing", "wall", "street", "fighting", "chance"],
  ["straight", "forward", "planning", "document", "sharing"],
  ["schedule", "conflict", "resolve", "address", "forward"],
  ["pressure", "release", "schedule", "conflict", "interest"],
  ["workflow", "platform", "service", "contract", "deadline"],
  ["green", "light", "rail", "road", "trip"],
  ["fracture", "healing", "process", "document", "workflow"],
  ["contract", "deadline", "pressure", "release", "schedule"],
  ["tracking", "software", "platform", "service", "contract"],
];

/** Extra phrase overlap for the graph (empty: backbone + standard chains supply the graph). */
export const EXTENDED_PHRASE_CHAINS = [];

/** All chains used to construct the phrase adjacency graph. */
export const ALL_PHRASE_CHAINS = [...WORD_CHAINS, ...EXTENDED_PHRASE_CHAINS, ...ENDLESS_BACKBONE_CHAINS];

const MIN_PAIR_WORD_LEN = 3;

/** Stable key for a directed phrase step a → b (lowercase). */
export function phrasePairKey(a, b) {
  return `${String(a).toLowerCase().trim()}\n${String(b).toLowerCase().trim()}`;
}

let _curatedPhrasePairSet = null;

/** Directed edges from {@link WORD_CHAINS} only — vetted “common phrase” pairs for Standard + graph walks. */
export function getCuratedPhrasePairSet() {
  if (_curatedPhrasePairSet) return _curatedPhrasePairSet;
  /** @type {Set<string>} */
  const s = new Set();
  for (const chain of WORD_CHAINS) {
    const words = chain.map((w) => String(w).toLowerCase().trim());
    for (let i = 0; i < words.length - 1; i++) {
      const x = words[i];
      const y = words[i + 1];
      if (x.length < MIN_PAIR_WORD_LEN || y.length < MIN_PAIR_WORD_LEN) continue;
      s.add(phrasePairKey(x, y));
    }
  }
  _curatedPhrasePairSet = s;
  return _curatedPhrasePairSet;
}

/**
 * True iff every consecutive pair appears in {@link WORD_CHAINS} (curated collocations).
 * @param {string[]} wordsLower Already lowercased words.
 */
export function chainHasOnlyCuratedPhrasePairs(wordsLower) {
  const curated = getCuratedPhrasePairSet();
  for (let i = 0; i < wordsLower.length - 1; i++) {
    if (!curated.has(phrasePairKey(wordsLower[i], wordsLower[i + 1]))) return false;
  }
  return true;
}

/** Matches Standard / phrase-graph “easy” per-word bounds (3–5 letters). */
const EASY_WORD_MIN = 3;
const EASY_WORD_MAX = 5;

function chainIsEasyWordLengthRow(chain) {
  return chain.every((w) => {
    const L = String(w).trim().length;
    return L >= EASY_WORD_MIN && L <= EASY_WORD_MAX;
  });
}

let _easyCuratedPhrasePairSet = null;

/**
 * Directed edges from {@link WORD_CHAINS} rows where every word is 3–5 letters
 * (the easy Standard pool) — very common short-phrase collocations only.
 */
export function getEasyCuratedPhrasePairSet() {
  if (_easyCuratedPhrasePairSet) return _easyCuratedPhrasePairSet;
  /** @type {Set<string>} */
  const s = new Set();
  for (const chain of WORD_CHAINS) {
    if (!chainIsEasyWordLengthRow(chain)) continue;
    const words = chain.map((w) => String(w).toLowerCase().trim());
    for (let i = 0; i < words.length - 1; i++) {
      const x = words[i];
      const y = words[i + 1];
      if (x.length < MIN_PAIR_WORD_LEN || y.length < MIN_PAIR_WORD_LEN) continue;
      s.add(phrasePairKey(x, y));
    }
  }
  _easyCuratedPhrasePairSet = s;
  return _easyCuratedPhrasePairSet;
}

/**
 * True iff every consecutive pair appears in an easy-length-only curated chain.
 * @param {string[]} wordsLower Already lowercased words.
 */
export function chainHasOnlyEasyCuratedPhrasePairs(wordsLower) {
  const easy = getEasyCuratedPhrasePairSet();
  for (let i = 0; i < wordsLower.length - 1; i++) {
    if (!easy.has(phrasePairKey(wordsLower[i], wordsLower[i + 1]))) return false;
  }
  return true;
}
