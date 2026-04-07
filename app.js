import { ANSWERS } from "./words.js";

const WORD_LEN = 5;
const MAX_GUESSES = 5;
const TARGET_WINS = 3;

/** @typedef {"empty"|"active"|"green"|"yellow"|"gray"} TileState */

const historyEl = document.getElementById("history");
const chainDividerEl = document.getElementById("chainDivider");
const gridEl = document.getElementById("grid");
const statusTextEl = document.getElementById("statusText");
const keyboardSectionEl = document.getElementById("keyboardSection");
const toastEl = document.getElementById("toast");
const hintBtn = document.getElementById("hintBtn");
const newGameBtn = document.getElementById("newGameBtn");

const modalOverlay = document.getElementById("modalOverlay");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const playAgainBtn = document.getElementById("playAgainBtn");
const closeModalBtn = document.getElementById("closeModalBtn");

const kbRow1 = document.getElementById("kbRow1");
const kbRow2 = document.getElementById("kbRow2");
const kbRow3 = document.getElementById("kbRow3");

/** @type {string} */
let answer = "";
/** @type {string[]} */
let guesses = Array.from({ length: MAX_GUESSES }, () => "");
/** @type {TileState[][]} */
let marks = Array.from({ length: MAX_GUESSES }, () => Array.from({ length: WORD_LEN }, () => "empty"));
/** @type {string[]} */
let solvedWords = [];
let row = 0;
let col = 0;
let isOver = false;
let chainComplete = false;

/** @type {Map<string, HTMLButtonElement>} */
const keyButtons = new Map();
/** @type {Set<string>} */
let validWords = new Set(ANSWERS);
let dictionaryReady = false;

function pickAnswer() {
  const idx = Math.floor(Math.random() * ANSWERS.length);
  return ANSWERS[idx];
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

async function loadDictionary() {
  try {
    const res = await fetch("./words5.txt", { cache: "no-store" });
    if (!res.ok) throw new Error("bad status");
    const text = await res.text();
    const words = text
      .split(/\r?\n/)
      .map((w) => w.trim().toLowerCase())
      .filter((w) => /^[a-z]{5}$/.test(w));
    validWords = new Set(words);
    dictionaryReady = true;
  } catch {
    // Keep minimal fallback so game remains playable.
    validWords = new Set(ANSWERS);
    dictionaryReady = true;
  }
}

/**
 * Standard Wordle scoring with duplicate-letter handling.
 * Two pass:
 *  - greens first
 *  - then yellows based on remaining letter counts
 * @param {string} guessLower
 * @param {string} answerLower
 * @returns {TileState[]}
 */
function scoreGuess(guessLower, answerLower) {
  /** @type {TileState[]} */
  const out = Array.from({ length: WORD_LEN }, () => "gray");

  /** @type {Record<string, number>} */
  const remaining = {};
  for (let i = 0; i < WORD_LEN; i++) {
    const a = answerLower[i];
    remaining[a] = (remaining[a] ?? 0) + 1;
  }

  // Pass 1: greens
  for (let i = 0; i < WORD_LEN; i++) {
    if (guessLower[i] === answerLower[i]) {
      out[i] = "green";
      remaining[guessLower[i]] -= 1;
    }
  }

  // Pass 2: yellows
  for (let i = 0; i < WORD_LEN; i++) {
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
  // Higher number wins.
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

function buildSolvedRow(word) {
  const rowEl = document.createElement("div");
  rowEl.className = "row";
  for (let c = 0; c < WORD_LEN; c++) {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.dataset.state = "purple";
    tile.textContent = word[c].toUpperCase();
    rowEl.appendChild(tile);
  }
  return rowEl;
}

function renderHistory() {
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
  chainDividerEl.dataset.show = "false";
}

function buildGrid() {
  gridEl.innerHTML = "";
  for (let r = 0; r < MAX_GUESSES; r++) {
    const rowEl = document.createElement("div");
    rowEl.className = "row";
    rowEl.dataset.row = String(r);
    for (let c = 0; c < WORD_LEN; c++) {
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

function render() {
  for (let r = 0; r < MAX_GUESSES; r++) {
    const g = guesses[r];
    for (let c = 0; c < WORD_LEN; c++) {
      const tile = getTile(r, c);
      if (!tile) continue;
      tile.textContent = g[c] ? g[c].toUpperCase() : "";
      let state = marks[r][c];
      if (!isOver && r === row && state === "empty") {
        state = g[c] ? "active" : "empty";
      }
      tile.dataset.state = state;
    }
  }

  const winsLeft = TARGET_WINS - solvedWords.length;
  const guessesLeft = MAX_GUESSES - row;
  if (winsLeft <= 0) {
    statusTextEl.textContent = "Chain complete";
  } else {
    statusTextEl.textContent = `Round ${solvedWords.length + 1}/${TARGET_WINS} - Guesses left: ${guessesLeft}`;
  }
}

function prepareNextRound() {
  answer = pickAnswer();
  guesses = Array.from({ length: MAX_GUESSES }, () => "");
  marks = Array.from({ length: MAX_GUESSES }, () => Array.from({ length: WORD_LEN }, () => "empty"));
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
  renderHistory();
  render();
}

function finishChain() {
  isOver = true;
  chainComplete = true;
  gridEl.classList.add("hiddenSection");
  statusTextEl.classList.add("hiddenSection");
  keyboardSectionEl.classList.add("hiddenSection");
  renderHistory();
  openModal("Chain complete", `You solved all ${TARGET_WINS} words.`);
}

async function commitGuess() {
  const guessLower = guesses[row].toLowerCase();
  if (guessLower.length !== WORD_LEN) {
    showToast("Not enough letters");
    return;
  }
  if (!/^[a-z]{5}$/.test(guessLower)) {
    showToast("Use 5 letters (A–Z)");
    return;
  }
  if (!dictionaryReady) {
    showToast("Loading dictionary...", 1200);
    return;
  }
  const isValid = validWords.has(guessLower);
  if (!isValid) {
    showToast("Not a real word");
    return;
  }

  const scored = scoreGuess(guessLower, answer);
  marks[row] = scored;
  for (let i = 0; i < WORD_LEN; i++) {
    setKeyState(guessLower[i].toUpperCase(), scored[i]);
  }

  render();

  if (guessLower === answer) {
    solvedWords.push(answer);
    renderHistory();
    if (solvedWords.length >= TARGET_WINS) {
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
    if (col >= WORD_LEN) return;
    guesses[row] = (guesses[row] + key).slice(0, WORD_LEN);
    col = guesses[row].length;
    render();
  }
}

function resetChain() {
  solvedWords = [];
  closeModal();
  prepareNextRound();
}

// Init
buildGrid();
buildKeyboard();
resetChain();
loadDictionary();

newGameBtn.addEventListener("click", resetChain);
playAgainBtn.addEventListener("click", resetChain);
closeModalBtn.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

window.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = normalizeKey(e.key);
  if (!k) return;
  e.preventDefault();
  handleInput(k);
});

hintBtn.addEventListener("click", () => {
  if (chainComplete) return;
  showToast(`Hint: ${answer.toUpperCase()}`, 1600);
});
