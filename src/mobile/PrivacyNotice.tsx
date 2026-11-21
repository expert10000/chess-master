export function PrivacyNotice() {
  return <>
    <p>Stockfish Coach is an independent chess training app, unaffiliated with the Stockfish or Lichess projects. It does not require an account. The bundled chess engine runs on your device.</p>
    <h3>Data on your device</h3>
    <p>Games, imported PGN files, saved lines, puzzle progress, downloaded puzzles, and preferences are stored locally in the app. We do not operate a server that receives these records. They remain until you clear the app data or uninstall it. If Android backup is enabled, your device may include app data in your Google account backup; you can manage that in Android settings.</p>
    <h3>Optional network and sharing</h3>
    <p>When you tap “Get new puzzle,” the app requests a puzzle directly from Lichess. Lichess may receive technical request data, such as your IP address, under its <a href="https://lichess.org/privacy" target="_blank" rel="noreferrer">privacy policy</a>. The app sends no game history or puzzle progress with that request. Export PGN shares a game only with the app or destination you choose in Android’s share sheet. Import PGN reads the file you select and stores that game locally.</p>
    <h3>Contact and sources</h3>
    <p>For privacy questions, email <a href="mailto:dareks.inf@gmail.com">dareks.inf@gmail.com</a>. Stockfish is open source under GPLv3; the app bundles Stockfish.js 19.0.1. <a href="https://github.com/nmrugg/stockfish.js/releases/tag/v19.0.1" target="_blank" rel="noreferrer">Engine source and license</a>. The included Lichess puzzles are CC0.</p>
  </>;
}
