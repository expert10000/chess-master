# Security

- Use only an official Stockfish executable or one you compiled yourself.
- The renderer runs with `nodeIntegration: false` and `contextIsolation: true`.
- The preload bridge does not expose filesystem or shell access.
- Engine requests are validated and analysis time is capped.
- The app does not require an account and does not upload games.

Report vulnerabilities privately before publishing exploit details.
