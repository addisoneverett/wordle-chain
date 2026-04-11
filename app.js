import { ANSWERS } from "./words.js";
import {
  WORD_CHAINS,
  chainHasOnlyCuratedPhrasePairs,
  chainHasOnlyEasyCuratedPhrasePairs,
} from "./wordChains.js";
import {
  collectGraphVocabulary,
  getPhraseAdjacency,
  growPhrasePathRelaxed,
  buildEndlessSeedChain,
} from "./phraseGraph.js";

const MAX_GUESSES = 5;
const MIN_WORD_LEN = 3;
const MAX_WORD_LEN = 8;
const DIFFICULTY = {
  easy: { chainLen: 5, minLen: 3, maxLen: 5, hints: 5 },
  medium: { chainLen: 5, minLen: 3, maxLen: 6, hints: 3 },
  hard: { chainLen: 5, minLen: 3, maxLen: 8, hints: 1 },
};

/** Endless / Frenzy: hints and max guess rows per target word. */
const ENDLESS_MODE_CONFIG = {
  easy: { hints: 5, maxGuessesPerWord: 5 },
  medium: { hints: 5, maxGuessesPerWord: 5 },
  hard: { hints: 1, maxGuessesPerWord: 1 },
};

/** Frenzy: seconds per word before the run ends (same rules as Endless otherwise). */
const FRENZY_SECONDS_PER_WORD = {
  easy: 60,
  medium: 30,
  hard: 10,
};

const LEADERBOARD_KEY = "wordleChainEndlessLeaderboard";

/** @type {readonly ("easy"|"medium"|"hard")[]} */
const DIFFICULTY_CYCLE = ["easy", "medium", "hard"];

/** @typedef {"empty"|"active"|"green"|"yellow"|"gray"} TileState */

const historyEl = document.getElementById("history");
const chainDividerEl = document.getElementById("chainDivider");
const difficultyToggleEl = document.getElementById("difficultyToggle");
const difficultyWrapEl = document.getElementById("difficultyWrap");
const headerTitleEl = document.getElementById("headerTitle");
const gridEl = document.getElementById("grid");
const statusTextEl = document.getElementById("statusText");
const keyboardSectionEl = document.getElementById("keyboardSection");
const mobileAnswerFlashEl = document.getElementById("mobileAnswerFlash");
const celebrationSectionEl = document.getElementById("celebrationSection");
const starRatingEl = document.getElementById("starRating");
const ratingMetaEl = document.getElementById("ratingMeta");
const chainPlayAgainBtn = document.getElementById("chainPlayAgainBtn");
const confettiLayerEl = document.getElementById("confettiLayer");
const toastEl = document.getElementById("toast");
const hintBtn = document.getElementById("hintBtn");
const hintCountEl = document.getElementById("hintCount");
const answerBtn = document.getElementById("answerBtn");
const newGameBtn = document.getElementById("newGameBtn");
const gameFormatWrap = document.getElementById("gameFormatWrap");
const gameFormatBtn = document.getElementById("gameFormatBtn");
const gameFormatMenu = document.getElementById("gameFormatMenu");
const frenzyTimerEl = document.getElementById("frenzyTimer");
const endlessSolvedPreviewEl = document.getElementById("endlessSolvedPreview");
const endlessProgressEl = document.getElementById("endlessProgress");
const endlessCounterValueEl = document.getElementById("endlessCounterValue");
const endlessCounterChipsEl = document.getElementById("endlessCounterChips");

const howToOverlay = document.getElementById("howToOverlay");
const howToDismissBtn = document.getElementById("howToDismissBtn");
const modalOverlay = document.getElementById("modalOverlay");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const playAgainBtn = document.getElementById("playAgainBtn");
const closeModalBtn = document.getElementById("closeModalBtn");

const HOW_TO_STORAGE_KEY = "wordleChainHowToDismissed";

function isLocalDevHost() {
  const h = location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

const kbRow1 = document.getElementById("kbRow1");
const kbRow2 = document.getElementById("kbRow2");
const kbRow3 = document.getElementById("kbRow3");

/** @type {string} */
let answer = "";
let currentWordLen = 5;
/** @type {string[]} */
let guesses = Array.from({ length: MAX_GUESSES }, () => "");
/** @type {TileState[][]} */
let marks = Array.from({ length: MAX_GUESSES }, () => Array.from({ length: currentWordLen }, () => "empty"));
/** @type {string[]} */
let solvedWords = [];
/** @type {string[]} */
let currentChain = [];
let row = 0;
let col = 0;
let isOver = false;
let chainComplete = false;
let currentMode = "medium";
let hintsLeft = DIFFICULTY.medium.hints;
let hintsUsed = 0;
let guessesUsedTotal = 0;
/** @type {"standard"|"endless"|"frenzy"} */
let gameFormat = "standard";

let frenzyTimerId = 0;
let frenzyDeadlineMs = 0;
/** First word of a Frenzy run: countdown starts only after the player types (or uses a hint). */
let frenzyDeferTimerUntilKeypress = false;

/** @type {string[]} */
let endlessHiddenChain = [];
let endlessWordIndex = 1;
let endlessEffectiveMaxGuesses = MAX_GUESSES;
let endlessRunScore = 0;
let endlessRunStreak = 0;
let endlessBestStreak = 0;
let endlessRunHints = 0;
let endlessRunWrongWords = 0;

const ENDLESS_LOOKAHEAD = 24;

/** @type {Map<string, HTMLButtonElement>} */
const keyButtons = new Map();
/** @type {Set<string>} */
let validWords = new Set(ANSWERS.map((w) => w.toLowerCase()));
/** @type {Map<number, string[]>} */
let wordsByLength = new Map();
let dictionaryReady = false;

function seedGraphWordsIntoDictionary() {
  for (const w of collectGraphVocabulary()) {
    validWords.add(w);
  }
}

/** Accept guess if it is in the dictionary or a common plural of a dictionary word (e.g. grounds → ground). */
function isAcceptedGuessWord(w) {
  if (!w || w.length < MIN_WORD_LEN || w.length > MAX_WORD_LEN) return false;
  if (validWords.has(w)) return true;

  if (w.length >= MIN_WORD_LEN + 3 && w.endsWith("ies")) {
    const ySingular = `${w.slice(0, -3)}y`;
    if (validWords.has(ySingular)) return true;
  }
  if (w.length >= MIN_WORD_LEN + 2 && w.endsWith("es")) {
    const stemEs = w.slice(0, -2);
    if (validWords.has(stemEs)) return true;
  }
  if (w.length >= MIN_WORD_LEN + 1 && w.endsWith("s") && !w.endsWith("ss")) {
    const stemS = w.slice(0, -1);
    if (validWords.has(stemS)) return true;
  }
  return false;
}

function pickAnswer() {
  return currentChain[solvedWords.length];
}

function getModeConfig() {
  return DIFFICULTY[currentMode] || DIFFICULTY.medium;
}

function syncDifficultyToggleUi() {
  if (!difficultyToggleEl) return;
  if (!DIFFICULTY_CYCLE.includes(/** @type {"easy"|"medium"|"hard"} */ (currentMode))) {
    currentMode = "medium";
  }
  const labels = { easy: "EASY", medium: "MEDIUM", hard: "HARD" };
  difficultyToggleEl.textContent = labels[currentMode];
  difficultyToggleEl.dataset.mode = currentMode;
  difficultyToggleEl.setAttribute("aria-label", `Difficulty: ${currentMode}`);
}

function isEndlessLike() {
  return gameFormat === "endless" || gameFormat === "frenzy";
}

function closeGameFormatMenu() {
  if (!gameFormatMenu || !gameFormatBtn) return;
  gameFormatMenu.classList.add("hiddenSection");
  gameFormatMenu.setAttribute("aria-hidden", "true");
  gameFormatBtn.setAttribute("aria-expanded", "false");
}

function clearFrenzyTimer() {
  if (frenzyTimerId) {
    window.clearInterval(frenzyTimerId);
    frenzyTimerId = 0;
  }
  frenzyDeadlineMs = 0;
  if (frenzyTimerEl) {
    frenzyTimerEl.textContent = "";
    frenzyTimerEl.classList.add("hiddenSection");
  }
}

function updateFrenzyTimerDisplay() {
  if (!frenzyTimerEl) return;
  if (gameFormat !== "frenzy" || isOver || !dictionaryReady) {
    frenzyTimerEl.textContent = "";
    frenzyTimerEl.classList.add("hiddenSection");
    return;
  }
  frenzyTimerEl.classList.remove("hiddenSection");
  if (frenzyDeferTimerUntilKeypress && endlessWordIndex === 1) {
    const sec = FRENZY_SECONDS_PER_WORD[currentMode] ?? FRENZY_SECONDS_PER_WORD.medium;
    frenzyTimerEl.textContent = `${sec}s`;
    return;
  }
  if (frenzyDeadlineMs <= 0 && !frenzyTimerId) {
    frenzyTimerEl.textContent = "";
    frenzyTimerEl.classList.add("hiddenSection");
    return;
  }
  const leftSec = Math.max(0, (frenzyDeadlineMs - Date.now()) / 1000);
  frenzyTimerEl.textContent = `${Math.ceil(leftSec)}s`;
}

function maybeStartDeferredFrenzyTimer() {
  if (gameFormat !== "frenzy" || isOver || !dictionaryReady) return;
  if (!frenzyDeferTimerUntilKeypress) return;
  if (endlessWordIndex !== 1) return;
  if ((guesses[row] || "").length < 1) return;
  frenzyDeferTimerUntilKeypress = false;
  startFrenzyTimer();
}

function startFrenzyTimer() {
  clearFrenzyTimer();
  if (gameFormat !== "frenzy" || isOver || !dictionaryReady) return;
  const sec = FRENZY_SECONDS_PER_WORD[currentMode] ?? FRENZY_SECONDS_PER_WORD.medium;
  frenzyDeadlineMs = Date.now() + sec * 1000;
  updateFrenzyTimerDisplay();
  frenzyTimerId = window.setInterval(() => {
    if (isOver || gameFormat !== "frenzy") {
      clearFrenzyTimer();
      return;
    }
    updateFrenzyTimerDisplay();
    if (Date.now() >= frenzyDeadlineMs) {
      clearFrenzyTimer();
      endlessRunWrongWords += 1;
      endEndlessRunFailure();
    }
  }, 200);
}

function updateHintButton() {
  if (hintCountEl) hintCountEl.textContent = String(hintsLeft);
  if (hintBtn) {
    const label = `Hint, ${hintsLeft} remaining`;
    hintBtn.setAttribute("aria-label", label);
    hintBtn.title = `${hintsLeft} hint${hintsLeft === 1 ? "" : "s"} left`;
  }
}

function pickChain() {
  const cfg = getModeConfig();
  const matchesDifficulty = (/** @type {string[]} */ chain) => {
    if (chain.length !== cfg.chainLen) return false;
    return chain.every((w) => w.length >= cfg.minLen && w.length <= cfg.maxLen);
  };
  const curatedPairsOnly = (/** @type {string[]} */ chain) => {
    const lower = chain.map((w) => w.toLowerCase());
    return currentMode === "easy"
      ? chainHasOnlyEasyCuratedPhrasePairs(lower)
      : chainHasOnlyCuratedPhrasePairs(lower);
  };

  const candidates = WORD_CHAINS.filter((chain) => matchesDifficulty(chain) && curatedPairsOnly(chain));
  const sameLenCurated = WORD_CHAINS.filter(
    (chain) => chain.length === cfg.chainLen && curatedPairsOnly(chain),
  );
  const pool = candidates.length > 0 ? candidates : sameLenCurated.length > 0 ? sameLenCurated : WORD_CHAINS;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx].map((w) => w.toLowerCase());
}

function normalizeKey(key) {
  if (key === "Enter") return "ENTER";
  if (key === "Backspace") return "BACKSPACE";
  if (/^[a-zA-Z]$/.test(key)) return key.toUpperCase();
  return null;
}

function showToast(message, ms = 900) {
  toastEl.textContent = message;
  toastEl.dataset.show = "true";
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => {
    toastEl.dataset.show = "false";
  }, ms);
}
showToast._t = 0;
let mobileFlashTimer = 0;

async function loadDictionary() {
  try {
    const res = await fetch("./words3to8.txt", { cache: "no-store" });
    if (!res.ok) throw new Error("bad status");
    const text = await res.text();
    const words = text
      .split(/\r?\n/)
      .map((w) => w.trim().toLowerCase())
      .filter((w) => /^[a-z]{3,8}$/.test(w));
    validWords = new Set(words);
    wordsByLength = new Map();
    for (let len = MIN_WORD_LEN; len <= MAX_WORD_LEN; len++) wordsByLength.set(len, []);
    for (const w of words) {
      const pool = wordsByLength.get(w.length);
      if (pool) pool.push(w);
    }
    for (const chain of WORD_CHAINS) {
      for (const w of chain) validWords.add(w.toLowerCase());
    }
    seedGraphWordsIntoDictionary();
    dictionaryReady = true;
    if (!isEndlessLike() && solvedWords.length === 0 && row === 0 && guesses[0] === "") {
      prepareNextRound();
    }
    if (
      isEndlessLike() &&
      endlessHiddenChain.length > 0 &&
      guessesUsedTotal === 0 &&
      row === 0 &&
      guesses[0] === ""
    ) {
      prepareEndlessWordRound();
    }
  } catch {
    validWords = new Set(ANSWERS.map((w) => w.toLowerCase()));
    wordsByLength = new Map();
    for (let len = MIN_WORD_LEN; len <= MAX_WORD_LEN; len++) wordsByLength.set(len, []);
    for (const w of ANSWERS.map((x) => x.toLowerCase())) {
      if (w.length >= MIN_WORD_LEN && w.length <= MAX_WORD_LEN) {
        wordsByLength.get(w.length).push(w);
      }
    }
    for (const chain of WORD_CHAINS) {
      for (const w of chain) validWords.add(w.toLowerCase());
    }
    seedGraphWordsIntoDictionary();
    dictionaryReady = true;
    if (!isEndlessLike() && solvedWords.length === 0 && row === 0 && guesses[0] === "") {
      prepareNextRound();
    }
    if (
      isEndlessLike() &&
      endlessHiddenChain.length > 0 &&
      guessesUsedTotal === 0 &&
      row === 0 &&
      guesses[0] === ""
    ) {
      prepareEndlessWordRound();
    }
  }
}

function scoreGuess(guessLower, answerLower) {
  const len = answerLower.length;
  /** @type {TileState[]} */
  const out = Array.from({ length: len }, () => "gray");

  /** @type {Record<string, number>} */
  const remaining = {};
  for (let i = 0; i < len; i++) {
    const a = answerLower[i];
    remaining[a] = (remaining[a] ?? 0) + 1;
  }

  for (let i = 0; i < len; i++) {
    if (guessLower[i] === answerLower[i]) {
      out[i] = "green";
      remaining[guessLower[i]] -= 1;
    }
  }

  for (let i = 0; i < len; i++) {
    if (out[i] === "green") continue;
    const g = guessLower[i];
    if ((remaining[g] ?? 0) > 0) {
      out[i] = "yellow";
      remaining[g] -= 1;
    } else {
      out[i] = "gray";
    }
  }

  return out;
}

function statePriority(state) {
  if (state === "purple") return 4;
  if (state === "green") return 3;
  if (state === "yellow") return 2;
  if (state === "gray") return 1;
  return 0;
}

function setKeyState(letterUpper, newState) {
  const btn = keyButtons.get(letterUpper);
  if (!btn) return;
  const cur = btn.dataset.state || "";
  if (statePriority(newState) >= statePriority(cur)) {
    btn.dataset.state = newState;
  }
}

function openModal(title, body) {
  modalTitle.textContent = title;
  modalBody.textContent = body;
  modalOverlay.classList.remove("hidden");
  modalOverlay.setAttribute("aria-hidden", "false");
}

function closeModal() {
  modalOverlay.classList.add("hidden");
  modalOverlay.setAttribute("aria-hidden", "true");
}

function isHowToOpen() {
  return howToOverlay && !howToOverlay.classList.contains("hidden");
}

function dismissHowTo() {
  if (!howToOverlay) return;
  howToOverlay.classList.add("hidden");
  howToOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("howToOpen");
  if (isLocalDevHost()) return;
  try {
    localStorage.setItem(HOW_TO_STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

function maybeShowHowTo() {
  if (!howToOverlay) return;
  if (!isLocalDevHost()) {
    try {
      if (localStorage.getItem(HOW_TO_STORAGE_KEY) === "1") return;
    } catch {
      /* show */
    }
  }
  howToOverlay.classList.remove("hidden");
  howToOverlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("howToOpen");
  requestAnimationFrame(() => {
    howToDismissBtn?.focus();
  });
}

function buildSolvedRow(word) {
  const rowEl = document.createElement("div");
  rowEl.className = "row";
  rowEl.style.gridTemplateColumns = `repeat(${word.length}, var(--tileSize))`;
  for (let c = 0; c < word.length; c++) {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.dataset.state = "purple";
    tile.textContent = word[c].toUpperCase();
    rowEl.appendChild(tile);
  }
  return rowEl;
}

function renderHistory() {
  if (isEndlessLike()) {
    historyEl.innerHTML = "";
    chainDividerEl.dataset.show = endlessRunScore > 0 && !isOver ? "true" : "false";
    return;
  }
  historyEl.innerHTML = "";
  for (let i = 0; i < solvedWords.length; i++) {
    historyEl.appendChild(buildSolvedRow(solvedWords[i]));
    if (i < solvedWords.length - 1) {
      const connector = document.createElement("div");
      connector.className = "chainConnector";
      connector.setAttribute("aria-hidden", "true");
      historyEl.appendChild(connector);
    }
  }
  chainDividerEl.dataset.show = solvedWords.length > 0 && !chainComplete ? "true" : "false";
}

function renderEndlessProgress() {
  if (!endlessProgressEl || !endlessSolvedPreviewEl || !endlessCounterValueEl || !endlessCounterChipsEl) return;
  if (!isEndlessLike() || endlessHiddenChain.length === 0) {
    endlessProgressEl.classList.add("hiddenSection");
    endlessSolvedPreviewEl.classList.add("hiddenSection");
    endlessSolvedPreviewEl.innerHTML = "";
    endlessCounterChipsEl.innerHTML = "";
    return;
  }
  endlessProgressEl.classList.remove("hiddenSection");
  endlessSolvedPreviewEl.classList.remove("hiddenSection");
  endlessSolvedPreviewEl.innerHTML = "";
  /** Hard Endless/Frenzy: show the phrase anchor before any guess on the first target word. */
  const showHardChainStarter =
    currentMode === "hard" &&
    endlessWordIndex === 1 &&
    endlessHiddenChain.length >= 2 &&
    !isOver &&
    !(marks[0]?.some((m) => m !== "empty"));
  if (showHardChainStarter) {
    endlessSolvedPreviewEl.appendChild(buildSolvedRow(endlessHiddenChain[0]));
  } else if (endlessRunScore > 0 && endlessWordIndex >= 1 && endlessHiddenChain.length >= endlessWordIndex) {
    endlessSolvedPreviewEl.appendChild(buildSolvedRow(endlessHiddenChain[endlessWordIndex - 1]));
  }
  endlessCounterValueEl.textContent = String(endlessRunScore);
  endlessCounterChipsEl.innerHTML = "";
  const cap = 48;
  const n = Math.min(endlessRunScore, cap);
  for (let i = 0; i < n; i++) {
    const chip = document.createElement("span");
    chip.className = "endlessProgress__chip";
    endlessCounterChipsEl.appendChild(chip);
  }
  if (endlessRunScore > cap) {
    const more = document.createElement("span");
    more.className = "endlessProgress__more";
    more.textContent = `+${endlessRunScore - cap}`;
    endlessCounterChipsEl.appendChild(more);
  }
}


function buildGrid(wordLen, numRows = MAX_GUESSES) {
  gridEl.innerHTML = "";
  for (let r = 0; r < numRows; r++) {
    const rowEl = document.createElement("div");
    rowEl.className = "row";
    rowEl.dataset.row = String(r);
    rowEl.style.gridTemplateColumns = `repeat(${wordLen}, var(--tileSize))`;
    for (let c = 0; c < wordLen; c++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.dataset.row = String(r);
      tile.dataset.col = String(c);
      tile.dataset.state = "empty";
      tile.setAttribute("aria-label", `Row ${r + 1} column ${c + 1}`);
      rowEl.appendChild(tile);
    }
    gridEl.appendChild(rowEl);
  }
}

function buildKeyboard() {
  const rows = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"],
  ];
  const rowEls = [kbRow1, kbRow2, kbRow3];
  keyButtons.clear();

  for (let i = 0; i < rows.length; i++) {
    rowEls[i].innerHTML = "";
    for (const key of rows[i]) {
      const btn = document.createElement("button");
      btn.className = "key";
      btn.type = "button";
      btn.textContent = key === "BACKSPACE" ? "⌫" : key;
      btn.dataset.key = key;
      if (key === "ENTER" || key === "BACKSPACE") btn.dataset.wide = "true";
      btn.setAttribute("aria-label", key);
      btn.addEventListener("click", () => handleInput(key));
      rowEls[i].appendChild(btn);
      if (/^[A-Z]$/.test(key)) keyButtons.set(key, btn);
    }
  }
}

function getTile(r, c) {
  return /** @type {HTMLElement|null} */ (gridEl.querySelector(`.tile[data-row="${r}"][data-col="${c}"]`));
}

function maxGuessRows() {
  return isEndlessLike() ? endlessEffectiveMaxGuesses : MAX_GUESSES;
}

function render() {
  const maxR = maxGuessRows();
  for (let r = 0; r < maxR; r++) {
    const g = guesses[r] || "";
    for (let c = 0; c < currentWordLen; c++) {
      const tile = getTile(r, c);
      if (!tile) continue;
      tile.textContent = g[c] ? g[c].toUpperCase() : "";
      let state = marks[r]?.[c] ?? "empty";
      if (!isOver && r === row && state === "empty") {
        state = g[c] ? "active" : "empty";
      }
      tile.dataset.state = state;
    }
  }

  if (isEndlessLike()) {
    statusTextEl.textContent = `Best streak ${endlessBestStreak}`;
    renderEndlessProgress();
    renderHistory();
    updateHintButton();
    updateFrenzyTimerDisplay();
    return;
  }

  renderEndlessProgress();

  const targetWins = currentChain.length;
  const winsLeft = targetWins - solvedWords.length;
  if (winsLeft <= 0) {
    statusTextEl.textContent = "Chain complete";
  } else {
    statusTextEl.textContent = "";
  }
  updateHintButton();
}

function prepareNextRound() {
  clearFrenzyTimer();
  answer = pickAnswer();
  currentWordLen = answer.length;
  guesses = Array.from({ length: MAX_GUESSES }, () => "");
  marks = Array.from({ length: MAX_GUESSES }, () => Array.from({ length: currentWordLen }, () => "empty"));
  row = 0;
  col = 0;
  isOver = false;
  chainComplete = false;
  gridEl.classList.remove("hiddenSection");
  statusTextEl.classList.remove("hiddenSection");
  keyboardSectionEl.classList.remove("hiddenSection");
  for (const btn of keyButtons.values()) {
    delete btn.dataset.state;
  }
  buildGrid(currentWordLen, MAX_GUESSES);
  renderHistory();
  render();
}

function ensureEndlessChainContinues() {
  const adj = getPhraseAdjacency();
  const minLen = Math.max(
    endlessHiddenChain.length,
    endlessWordIndex + 1 + ENDLESS_LOOKAHEAD,
  );
  growPhrasePathRelaxed(adj, endlessHiddenChain, minLen, currentMode);
}

function prepareEndlessWordRound() {
  clearFrenzyTimer();
  frenzyDeferTimerUntilKeypress = false;
  ensureEndlessChainContinues();
  if (endlessHiddenChain.length < 2) {
    const adj = getPhraseAdjacency();
    growPhrasePathRelaxed(adj, endlessHiddenChain, 2, currentMode);
  }
  if (endlessWordIndex >= endlessHiddenChain.length) {
    isOver = true;
    endlessWordIndex = endlessHiddenChain.length;
    renderEndlessProgress();
    saveEndlessLeaderboardEntry();
    const tip = endlessHiddenChain[endlessHiddenChain.length - 1]?.toUpperCase() ?? "";
    openModal(
      "Run complete",
      `No phrase links lead out from “${tip}” (dead end in the graph).\n\nWords solved this run: ${endlessRunScore}. Best streak: ${endlessBestStreak}.`,
    );
    return;
  }
  answer = endlessHiddenChain[endlessWordIndex];
  currentWordLen = answer.length;
  const cfg = ENDLESS_MODE_CONFIG[currentMode] || ENDLESS_MODE_CONFIG.medium;
  endlessEffectiveMaxGuesses = cfg.maxGuessesPerWord;
  guesses = Array.from({ length: endlessEffectiveMaxGuesses }, () => "");
  marks = Array.from({ length: endlessEffectiveMaxGuesses }, () =>
    Array.from({ length: currentWordLen }, () => "empty"),
  );
  row = 0;
  col = 0;
  isOver = false;
  chainComplete = false;
  gridEl.classList.remove("hiddenSection");
  statusTextEl.classList.remove("hiddenSection");
  keyboardSectionEl.classList.remove("hiddenSection");
  for (const btn of keyButtons.values()) {
    delete btn.dataset.state;
  }
  buildGrid(currentWordLen, endlessEffectiveMaxGuesses);
  renderEndlessProgress();
  renderHistory();
  render();
  if (gameFormat === "frenzy" && dictionaryReady) {
    if (endlessWordIndex === 1) {
      frenzyDeferTimerUntilKeypress = true;
      updateFrenzyTimerDisplay();
    } else {
      frenzyDeferTimerUntilKeypress = false;
      startFrenzyTimer();
    }
  }
}

function initEndlessGame() {
  const cfg = ENDLESS_MODE_CONFIG[currentMode] || ENDLESS_MODE_CONFIG.medium;
  hintsLeft = cfg.hints;
  hintsUsed = 0;
  guessesUsedTotal = 0;
  endlessRunScore = 0;
  endlessRunStreak = 0;
  endlessBestStreak = 0;
  endlessRunHints = 0;
  endlessRunWrongWords = 0;
  solvedWords = [];
  currentChain = [];
  endlessWordIndex = 1;
  const endlessMinBuffer = Math.max(30, endlessWordIndex + 1 + ENDLESS_LOOKAHEAD, 32);
  // phraseGraph enforces per-mode word lengths (3–5 / 3–6 / 3–8) on hidden chains, not only pickNextStep bias.
  endlessHiddenChain = buildEndlessSeedChain(
    getPhraseAdjacency(),
    endlessMinBuffer,
    currentMode,
  );
  prepareEndlessWordRound();
  syncEndlessToolbar();
}

function saveEndlessLeaderboardEntry() {
  try {
    const entry = {
      score: endlessRunScore,
      bestStreak: endlessBestStreak,
      hints: endlessRunHints,
      wrongWords: endlessRunWrongWords,
      chainLen: endlessHiddenChain.length,
      mode: currentMode,
      at: Date.now(),
    };
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.unshift(entry);
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(list.slice(0, 40)));
  } catch {
    /* ignore */
  }
}

function endEndlessRunFailure() {
  clearFrenzyTimer();
  frenzyDeferTimerUntilKeypress = false;
  isOver = true;
  endlessRunStreak = 0;
  saveEndlessLeaderboardEntry();
  const msg = `The answer was ${answer.toUpperCase()}.\n\nRun score: ${endlessRunScore}. Best streak: ${endlessBestStreak}. Hints used: ${endlessRunHints}. Failed words: ${endlessRunWrongWords}.`;
  openModal("Run over", msg);
}

function computeStarResult() {
  const cfg = getModeConfig();
  const maxGuesses = cfg.chainLen * MAX_GUESSES;
  const maxHints = Math.max(1, cfg.hints);
  const guessRatio = Math.min(1, guessesUsedTotal / maxGuesses);
  const hintRatio = Math.min(1, hintsUsed / maxHints);

  const modeWeights = {
    easy: { guessW: 0.6, hintW: 0.4, bonus: 0.0 },
    medium: { guessW: 0.65, hintW: 0.35, bonus: 0.1 },
    hard: { guessW: 0.7, hintW: 0.3, bonus: 0.25 },
  };
  const w = modeWeights[currentMode] || modeWeights.medium;
  const penalty = guessRatio * w.guessW + hintRatio * w.hintW;
  const starsFloat = Math.max(1, Math.min(5, 5 - penalty * 4.5 + w.bonus));
  const stars = Math.max(1, Math.min(5, Math.round(starsFloat)));
  return { stars, starsFloat };
}

function renderStarRating() {
  const { stars, starsFloat } = computeStarResult();
  starRatingEl.innerHTML = "";
  for (let i = 0; i < 5; i++) {
    const star = document.createElement("span");
    star.className = "star";
    star.textContent = "★";
    if (i < stars) {
      star.dataset.on = "true";
      star.style.animationDelay = `${i * 120}ms`;
    } else {
      star.dataset.on = "false";
    }
    starRatingEl.appendChild(star);
  }
  ratingMetaEl.textContent = `${stars}/5 stars (${starsFloat.toFixed(1)}) - guesses: ${guessesUsedTotal}, hints used: ${hintsUsed}`;
}

function updateFormatUi() {
  if (!gameFormatBtn) return;
  const labels = { standard: "STANDARD", endless: "ENDLESS", frenzy: "FRENZY" };
  gameFormatBtn.textContent = labels[gameFormat] || "STANDARD";
  gameFormatBtn.dataset.active = gameFormat !== "standard" ? "true" : "false";
  document.body.dataset.gameMode = gameFormat;
}

function syncEndlessToolbar() {
  if (difficultyWrapEl) {
    difficultyWrapEl.hidden = false;
  }
  if (hintBtn) {
    hintBtn.style.display = "";
  }
}

function finishChain() {
  isOver = true;
  chainComplete = true;
  gridEl.classList.add("hiddenSection");
  statusTextEl.classList.add("hiddenSection");
  keyboardSectionEl.classList.add("hiddenSection");
  celebrationSectionEl.classList.remove("hiddenSection");
  renderStarRating();
  renderHistory();
  launchConfetti();
}

function launchConfetti() {
  confettiLayerEl.innerHTML = "";
  const colors = ["#7c4dff", "#b59f3b", "#538d4e", "#7dd3fc", "#fca5a5", "#f9a8d4"];
  const count = 100;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    piece.className = "confettiPiece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = `${Math.random() * 500}ms`;
    piece.style.transform = `translateY(0) rotate(${Math.random() * 360}deg)`;
    confettiLayerEl.appendChild(piece);
  }
  window.setTimeout(() => {
    confettiLayerEl.innerHTML = "";
  }, 2200);
}

function commitGuessEndless() {
  const guessLower = guesses[row].toLowerCase();
  if (guessLower.length < currentWordLen) {
    showToast("Not enough letters");
    return;
  }
  if (!new RegExp(`^[a-z]{${currentWordLen}}$`).test(guessLower)) {
    showToast(`Use ${currentWordLen} letters (A-Z)`);
    return;
  }
  if (!dictionaryReady) {
    showToast("Loading dictionary...", 1200);
    return;
  }
  if (!isAcceptedGuessWord(guessLower)) {
    showToast("Not a real word");
    return;
  }

  guessesUsedTotal += 1;

  const scored = scoreGuess(guessLower, answer);
  marks[row] = scored;
  for (let i = 0; i < currentWordLen; i++) {
    setKeyState(guessLower[i].toUpperCase(), scored[i]);
  }

  render();

  if (guessLower === answer) {
    clearFrenzyTimer();
    endlessRunScore += 1;
    endlessRunStreak += 1;
    if (endlessRunStreak > endlessBestStreak) endlessBestStreak = endlessRunStreak;
    showToast("Correct!", 650);
    endlessWordIndex += 1;
    window.setTimeout(() => prepareEndlessWordRound(), 450);
    return;
  }

  row += 1;
  if (row >= endlessEffectiveMaxGuesses) {
    endlessRunWrongWords += 1;
    endEndlessRunFailure();
    return;
  }

  col = 0;
  render();
}

async function commitGuess() {
  if (isEndlessLike()) {
    commitGuessEndless();
    return;
  }

  const guessLower = guesses[row].toLowerCase();
  if (guessLower.length < currentWordLen) {
    showToast("Not enough letters");
    return;
  }
  if (!new RegExp(`^[a-z]{${currentWordLen}}$`).test(guessLower)) {
    showToast(`Use ${currentWordLen} letters (A-Z)`);
    return;
  }
  if (!dictionaryReady) {
    showToast("Loading dictionary...", 1200);
    return;
  }
  if (!isAcceptedGuessWord(guessLower)) {
    showToast("Not a real word");
    return;
  }

  guessesUsedTotal += 1;

  const scored = scoreGuess(guessLower, answer);
  marks[row] = scored;
  for (let i = 0; i < currentWordLen; i++) {
    setKeyState(guessLower[i].toUpperCase(), scored[i]);
  }

  render();

  if (guessLower === answer) {
    solvedWords.push(answer);
    renderHistory();
    if (solvedWords.length >= currentChain.length) {
      finishChain();
      return;
    }
    showToast("Correct! Next word...", 900);
    setTimeout(() => {
      prepareNextRound();
    }, 500);
    return;
  }

  row += 1;
  if (row >= MAX_GUESSES) {
    isOver = true;
    openModal("You lose", `The word was ${answer.toUpperCase()}. Chain reset.`);
    return;
  }

  col = 0;
  render();
}

function handleInput(key) {
  if (isHowToOpen()) return;
  if (isOver) return;

  if (key === "ENTER") {
    commitGuess();
    return;
  }

  if (key === "BACKSPACE") {
    if (col === 0 && guesses[row].length === 0) return;
    guesses[row] = guesses[row].slice(0, -1);
    col = guesses[row].length;
    render();
    return;
  }

  if (/^[A-Z]$/.test(key)) {
    if (col >= currentWordLen) return;
    guesses[row] = (guesses[row] + key).slice(0, currentWordLen);
    col = guesses[row].length;
    render();
    maybeStartDeferredFrenzyTimer();
  }
}

function resetChain() {
  clearFrenzyTimer();
  frenzyDeferTimerUntilKeypress = false;
  closeModal();
  confettiLayerEl.innerHTML = "";
  celebrationSectionEl.classList.add("hiddenSection");
  starRatingEl.innerHTML = "";
  ratingMetaEl.textContent = "";

  if (isEndlessLike()) {
    initEndlessGame();
  } else {
    hintsLeft = getModeConfig().hints;
    hintsUsed = 0;
    guessesUsedTotal = 0;
    solvedWords = [];
    currentChain = pickChain();
    prepareNextRound();
  }

  updateFormatUi();
  syncEndlessToolbar();
  syncDifficultyToggleUi();
}

buildKeyboard();
resetChain();
loadDictionary();
maybeShowHowTo();

newGameBtn.addEventListener("click", () => {
  resetChain();
});

gameFormatBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  if (!gameFormatMenu) return;
  const menuHidden = gameFormatMenu.classList.contains("hiddenSection");
  if (menuHidden) {
    gameFormatMenu.classList.remove("hiddenSection");
    gameFormatMenu.setAttribute("aria-hidden", "false");
    gameFormatBtn.setAttribute("aria-expanded", "true");
  } else {
    closeGameFormatMenu();
  }
});

gameFormatMenu?.addEventListener("click", (e) => {
  const t = /** @type {HTMLElement|null} */ (e.target?.closest?.("[data-format]"));
  if (!t || !t.dataset.format) return;
  e.stopPropagation();
  const fmt = /** @type {"standard"|"endless"|"frenzy"} */ (t.dataset.format);
  if (fmt === gameFormat) {
    closeGameFormatMenu();
    return;
  }
  gameFormat = fmt;
  resetChain();
  closeGameFormatMenu();
});

document.addEventListener("click", (e) => {
  if (gameFormatWrap && !gameFormatWrap.contains(/** @type {Node} */ (e.target))) {
    closeGameFormatMenu();
  }
});

chainPlayAgainBtn.addEventListener("click", resetChain);
playAgainBtn.addEventListener("click", resetChain);
closeModalBtn.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

howToDismissBtn?.addEventListener("click", dismissHowTo);
howToOverlay?.addEventListener("click", (e) => {
  if (e.target === howToOverlay) dismissHowTo();
});

window.addEventListener("keydown", (e) => {
  if (isHowToOpen()) {
    if (e.key === "Escape") {
      e.preventDefault();
      dismissHowTo();
    }
    return;
  }
  if (e.key === "Escape" && gameFormatMenu && !gameFormatMenu.classList.contains("hiddenSection")) {
    e.preventDefault();
    closeGameFormatMenu();
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = normalizeKey(e.key);
  if (!k) return;
  e.preventDefault();
  handleInput(k);
});

function handleHintClick() {
  if (chainComplete) return;
  if (isOver) return;
  if (hintsLeft <= 0) {
    showToast("No hints left");
    return;
  }
  if (col >= currentWordLen) {
    showToast("Row is full");
    return;
  }
  const nextLetter = answer[col].toUpperCase();
  guesses[row] = (guesses[row] + nextLetter).slice(0, currentWordLen);
  col = guesses[row].length;
  hintsLeft -= 1;
  hintsUsed += 1;
  if (isEndlessLike()) {
    endlessRunHints += 1;
  }
  render();
  maybeStartDeferredFrenzyTimer();
}

hintBtn.addEventListener("click", handleHintClick);

answerBtn.addEventListener("click", () => {
  if (chainComplete) return;
  if (isOver) return;
  showToast(`Answer: ${answer.toUpperCase()}`, 1600);
});

difficultyToggleEl?.addEventListener("click", () => {
  const i = DIFFICULTY_CYCLE.indexOf(/** @type {"easy"|"medium"|"hard"} */ (currentMode));
  const idx = i >= 0 ? i : 1;
  currentMode = DIFFICULTY_CYCLE[(idx + 1) % DIFFICULTY_CYCLE.length];
  syncDifficultyToggleUi();
  resetChain();
});

headerTitleEl.addEventListener("click", () => {
  if (!window.matchMedia("(max-width: 768px)").matches) return;
  if (chainComplete || isOver) return;
  mobileAnswerFlashEl.textContent = `Answer: ${answer.toUpperCase()}`;
  mobileAnswerFlashEl.dataset.show = "true";
  window.clearTimeout(mobileFlashTimer);
  mobileFlashTimer = window.setTimeout(() => {
    mobileAnswerFlashEl.dataset.show = "false";
  }, 900);
});
