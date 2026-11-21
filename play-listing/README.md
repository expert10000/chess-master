# Play Chess — Google Play listing draft

This folder contains copy and graphics for the **paid** Android app. It is a draft for Play Console entry, not evidence that a release is legally or technically approved.

## Create app

| Field | Value |
| --- | --- |
| App name | Play Chess |
| Package | `com.expert10000.stockfishcoach` |
| Default language | English |
| Type and category | Game → Board |
| Price model | Paid upfront; no ads, subscription, or in-app purchase |
| US launch price | US$4.99; review PLN and other local prices in Console |
| Support email | `dareks.inf@gmail.com` |
| Privacy policy | `https://expert10000.github.io/chess-master/privacy.html` |

## Short description

Play offline chess, solve puzzles, and understand every move

## Full description

Play a game, inspect a position, and learn the reason behind a move with Play Chess.

Choose an opponent level around 1800, 2000, or 2100 Elo, or play at maximum strength. Move pieces by tap or drag, review the move history, and return to any position on the board. The Elo levels are approximate.

Ask for a hint when you need one. Quick, Explain, and Deep modes give you different amounts of analysis, with the suggested move visible on the board. The coach explains supported ideas and shows the engine line when available.

Practice tactics with hundreds of included puzzles across difficulty levels and themes. Your progress is saved on your device. You can optionally request new puzzles from Lichess when you have an internet connection; saved puzzles remain available offline.

Import a PGN game to replay it move by move or start playing from a chosen move. Export your own games as PGN to review them on a desktop or share them with a chess partner.

The chess engine and included puzzles work offline. No account, advertising, subscription, or in-app purchase is required. Game records and preferences are stored on your device.

Play Chess is an independent app powered by the open-source Stockfish engine. It is not affiliated with or endorsed by the Stockfish or Lichess projects.

## Graphics to upload

| Play Console field | File | Alt text |
| --- | --- | --- |
| App icon | `icon-512.png` | Mint chess rook on a dark teal chessboard background. |
| Feature graphic | `feature-graphic-1024x500.png` | Chess rook and the words “Understand your next move” on a teal chessboard background. |
| Phone screenshot 1 | `01-play.png` | Chess board with desktop-style pieces and an offline engine opponent. |
| Phone screenshot 2 | `02-hint.png` | Stockfish hint recommends Bb5 and explains its attack on a knight. |
| Phone screenshot 3 | `03-puzzles.png` | Chess puzzle board with hint, retry, solution, and next controls. |
| Phone screenshot 4 | `04-moves.png` | Move history with PGN import, export, and privacy controls. |

The screenshots are captured from the actual mobile app using a phone-size viewport and saved at 1080 × 1920 RGB. No promotional text was placed over the app UI. The icon and feature graphic are original vector-style artwork rendered by `scripts/generate-play-listing-art.py`.

## Console declarations to review

- **Ads:** No; there is no advertising SDK or ad placement in the app.
- **App access:** No login or account is required. Reviewers can use the app immediately.
- **Data safety:** Games, PGN imports, puzzle progress, downloaded puzzles, and preferences are local app data. A user-requested fresh puzzle makes a direct HTTPS request to Lichess, which may receive the device IP address. A user-requested PGN export sends a file to the destination chosen in Android's share sheet. Android backup is enabled. Complete the form against the final signed bundle and privacy policy; do not infer a “no data collected/shared” answer solely from local storage.
- **Target audience and content rating:** The app is a chess game without chat, gambling, or violent content. Select the truthful target age range and complete the Play Console questionnaire; do not claim an IARC result before it is issued.
- **Financial data:** The app has no payment code. Google Play handles the upfront app purchase. The account owner must configure merchant, payout, and tax details privately in Console.

## Paid testing

Internal testers can install a paid app without purchasing it. Closed testers ordinarily must purchase it; paid-app promo codes may help after a promotion is available. A newly created personal developer account generally needs at least 12 closed testers opted in continuously for 14 days before requesting production access. Do not switch this package to Free during testing: once offered free, Google does not allow changing the same app back to Paid.

## Release gate

PR #3's 19/19 CI result uses synthetic source and APK fixtures. The older 371-file qualified source ZIP and verification report are unavailable here. This newer release branch needs a fresh source qualification tied to its own commit, source-delivery review, GPL review, signed AAB acceptance, and Play-installed test. Do not claim approval based on this listing pack or the local prototype AAB.
