import type { OllamaGenerateRequest, OllamaGenerateResult, OllamaStatus } from '../types/ollama';

function requireBridge() {
  if (!window.chessTrainer) {
    throw new Error('Electron preload bridge is unavailable. Start the app through Electron.');
  }
  return window.chessTrainer;
}

export const ollamaApi = {
  status(): Promise<OllamaStatus> {
    return requireBridge().getOllamaStatus();
  },
  generate(request: OllamaGenerateRequest): Promise<OllamaGenerateResult> {
    return requireBridge().ollamaGenerate(request);
  },
};
