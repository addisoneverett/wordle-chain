import { ENDLESS_BACKBONE_CHAINS } from "./endlessBackboneChains.js";

// Each adjacent pair should form a common phrase. Standard chains are 5 words (DIFFICULTY.chainLen).
// Easy: 3–5 letters/word; Medium: 3–6; Hard: 3–8. pickChain() filters by active difficulty.
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
