# Optional Ollama integration (v0.6.1)

Ollama is **not required** to play, analyze, review, or use the deterministic conversational coach. It is an optional local wording layer.

## Data flow

```text
Question
  -> chess.js / Stockfish
  -> deterministic verified answer + principal variation
  -> evidence packet
  -> optional Ollama at http://127.0.0.1:11434
  -> natural-language rewrite
```

Stockfish remains authoritative for move choice, evaluations and principal variations. Ollama is explicitly instructed not to create new chess claims.

## Setup

Install Ollama separately and start it. Pull at least one local chat/instruct model, for example:

```powershell
ollama pull qwen3:8b
```

Check connectivity from the project:

```powershell
npm run ollama:check
```

Then run the app:

```powershell
npm run dev
```

In the **Conversational coach** panel, click **Refresh**, select an installed model, and enable **Use Ollama**.

## CPU / GPU

A discrete GPU is not required. Ollama can run on CPU. GPU acceleration only changes response speed and the practical model sizes you can run comfortably.

## Failure behavior

Ollama is never on the critical chess path. If it is stopped, has no model, times out, or generation fails, the application returns the deterministic Stockfish-grounded explanation for that same question.

## Security boundary

- The renderer cannot submit arbitrary HTTP URLs.
- The Electron main process hard-codes the Ollama endpoint to `127.0.0.1:11434`.
- IPC validates model names and caps system/user prompt sizes.
- Ollama receives the position FEN and engine-derived explanation evidence only when **Use Ollama** is enabled.
- No cloud API key is needed.
