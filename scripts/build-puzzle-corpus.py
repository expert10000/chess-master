"""Build the small offline puzzle pack from the pinned Lichess-derived sample.

Run: python scripts/build-puzzle-corpus.py
"""

import csv
import io
import json
import urllib.request
from pathlib import Path

COMMIT = "58d2617d24217f595b5bf2d37ca6328e2e6ca370"
BASE = f"https://raw.githubusercontent.com/imec-ailabs/Automatic-Prompt-Optimization-with-Chess/{COMMIT}/data"
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "data" / "puzzles.json"


def rows(name):
    with urllib.request.urlopen(f"{BASE}/{name}", timeout=30) as response:
        return list(csv.DictReader(io.StringIO(response.read().decode("utf-8-sig"))))


def main():
    puzzles = []
    seen = set()
    for row in rows("puzzle_train.csv") + rows("puzzle_test.csv"):
        moves = row["Moves"].split()
        if (
            row["PuzzleId"] in seen
            or int(row["Popularity"]) < 70
            or int(row["NbPlays"]) < 100
            or any(len(move) != 4 for move in moves)
        ):
            continue
        seen.add(row["PuzzleId"])
        puzzles.append({
            "id": row["PuzzleId"],
            "fen": row["FEN"],
            "moves": moves,
            "rating": int(row["Rating"]),
            "themes": row["Themes"].split(),
        })
    puzzles.sort(key=lambda puzzle: (puzzle["rating"], puzzle["id"]))
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(puzzles, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Wrote {len(puzzles)} puzzles to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
