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
- You have 6 guesses to find the 5-letter word.

## Customize words
Edit `words.js`:
- `ANSWERS`: possible secret words
- Guesses are accepted as long as they are **5 letters (A–Z)**.

## Word validation
This clone rejects guesses that aren’t real English 5-letter words using a bundled local dictionary:
- `words5.txt` (generated from macOS `/usr/share/dict/words`)

No backend API is required.

