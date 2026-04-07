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
- Each round picks a word length from 3 to 8 letters.
- The board shows only that many squares per row for the current round.

## Customize words
Edit `words.js`:
- `ANSWERS`: possible secret words
- Guesses must match the current round length (3-8 letters, A-Z).

## Word validation
This clone rejects guesses that aren’t real English words using a bundled local dictionary:
- `words3to8.txt` (generated from macOS `/usr/share/dict/words`, lengths 3-8)

No backend API is required.

