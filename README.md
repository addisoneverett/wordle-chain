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
- Each round picks a word length from 3 up to 12 letters (chain vocabulary can include longer words than the bulk dictionary).
- The board shows only that many squares per row for the current round.
- Difficulty mode controls hint count; every mode uses a **5-word** chain with the same word-length band.

## Difficulty modes
- `Easy`: 5-word chains, 3–12 letter words, 5 hints
- `Medium`: 5-word chains, 3–12 letter words, 3 hints
- `Hard`: 5-word chains, 3–12 letter words, 1 hint

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

