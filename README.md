# Wordle Clone (local web app)

## Run locally
From Terminal:

```bash
cd ~/Desktop/wordle-web
python3 -m http.server 8000
```

Then open:
- `http://localhost:8000`

## How to play
- Type letters on your keyboard (or click the on-screen keys).
- Press **Enter** to submit.
- Press **Backspace** to delete.
- You have 5 guesses each round.
- Each round picks a word length from **3 up to 8** letters (matches `words3to8.txt` and chain caps).
- The board shows only that many squares per row for the current round.
- Every mode uses a **5-word** chain; difficulty sets **per-word** length limits and hint count.

## Difficulty modes
- `Easy`: 5-word chains, **3–5** letter words, 5 hints
- `Medium`: 5-word chains, **3–6** letter words, 3 hints
- `Hard`: 5-word chains, **3–8** letter words, 1 hint

Default difficulty is **Medium** (including on first load).

## Game formats
Use the header control (click the current mode name) to switch **Standard**, **Endless**, or **Frenzy**:
- **Standard**: solve a fixed five-word chain.
- **Endless** / **Frenzy**: guess successive words in a long hidden chain (same rules and hints as Endless).
- **Frenzy**: like Endless, with a per-word countdown (Easy **30s**, Medium **20s**, Hard **10s**). On the **first word** of a run, the countdown starts only after you type or use a hint. If time runs out, the run ends like a failed guess.

## Customize words
Edit `words.js`:
- `ANSWERS`: possible secret words
- Guesses must match the current round length (letters A–Z; length follows the answer word).

Word-chain rounds are defined in:
- `wordChains.js` (5-word standard chains plus extended / endless backbone phrases; adjacent words form common phrases)

## Word validation
This clone rejects guesses that aren’t real English words using a bundled local dictionary:
- `words3to8.txt` (generated from macOS `/usr/share/dict/words`, lengths 3-8)

All words from `wordChains.js` are automatically added to valid guesses.

No backend API is required.

