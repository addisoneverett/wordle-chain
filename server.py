from __future__ import annotations

import json
import os
import posixpath
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


ROOT = Path(__file__).resolve().parent
DICT_PATH = Path("/usr/share/dict/words")


def _is_real_word(word: str) -> bool:
    w = word.strip().lower()
    if len(w) != 5 or not w.isalpha():
        return False
    if not DICT_PATH.exists():
        return False

    # /usr/share/dict/words is large; scan linearly.
    # For local use this is acceptable, and we also cache in the browser.
    target = w.encode("utf-8")
    with DICT_PATH.open("rb") as f:
        for line in f:
            if line.strip().lower() == target:
                return True
    return False


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        # Serve strictly from project root.
        path = urlparse(path).path
        path = posixpath.normpath(path)
        parts = [p for p in path.split("/") if p and p not in (".", "..")]
        return str(ROOT.joinpath(*parts))

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/validate":
            qs = parse_qs(parsed.query)
            word = (qs.get("word") or [""])[0]
            ok = _is_real_word(word)
            payload = {"word": word, "valid": bool(ok), "source": "macos_dict" if DICT_PATH.exists() else "none"}
            data = json.dumps(payload).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        return super().do_GET()


def main() -> None:
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    httpd = ThreadingHTTPServer((host, port), Handler)
    print(f"Serving on http://{host}:{port}")
    print("Word validation endpoint: /api/validate?word=crane")
    httpd.serve_forever()


if __name__ == "__main__":
    main()

