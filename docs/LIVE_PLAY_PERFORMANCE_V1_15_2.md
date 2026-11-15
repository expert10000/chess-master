# v1.15.2 — Live Play Render Performance

## Problem addressed

Fast or Very fast Stockfish search limits solve only engine thinking. The live Play screen was still mounting every detailed coaching panel, so a board click could re-render game history, analytics, training plans, curriculum, imports, and backups.

## Change

During live play, only the board controls and compact Today’s home remain mounted by default. The detailed coach workspace is opened explicitly with **Open workspace**. Existing Coach, Review, History, Games, and Study shortcuts automatically open it before scrolling to their target.

## Expected result

Normal board clicks and controls are no longer coupled to the heavyweight coaching workspace. Stockfish is still protected by the existing Fast/Very-fast end-to-end timeout and legal fallback path.
