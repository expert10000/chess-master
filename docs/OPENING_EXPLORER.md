# v0.9.0 — Opening Recognition + Local Opening Explorer

Stockfish Coach now includes an offline curated ECO opening book.

## Recognition

For games that begin from the standard initial position the app follows the played UCI move sequence and identifies the deepest recognized opening family/variation in the bundled book.

Coverage includes major branches of the Italian Game, Ruy Lopez, Scotch, Sicilian, French, Caro-Kann, Queen's Gambit, Slav/Semi-Slav, King's Indian, Nimzo-Indian, Queen's Indian, Grünfeld, English, Réti, Catalan, Dutch, Benoni, Benko, Trompowsky, and several other common systems.

Custom-FEN analysis remains supported but is intentionally not assigned an ECO opening.

## “Theory ended here”

The app computes the longest prefix of the game that is present in its bundled local book. If the next played move is not represented, it marks that exact ply as:

**Theory ended here · local book**

This wording is intentional: the app does not claim that real-world chess theory ended. It only reports the boundary of the bundled offline dataset.

## Common alternatives

At every book node, descendant lines contribute weighted next moves. The explorer shows up to six alternatives with a **local share**.

Local share is not a live master-database statistic. It is the relative weight of that move inside the curated bundled book.

Each alternative has **▶ Study**, which opens the existing read-only PV study player using the local book continuation.

## Train deviation

When a played move leaves the local book:

1. click **Train deviation**;
2. the exact pre-deviation position is copied into Training mode;
3. the top local-book move becomes the first hint/answer;
4. all displayed local-book alternatives count as accepted opening answers;
5. Stockfish still evaluates the attempted move and supplies the tactical/positional review.

This combines repertoire knowledge with engine verification rather than treating book membership as proof that a move is objectively best.
