import type { AnalyseRequest, AnalyseResult, EngineStatus } from './engine';
import type { OllamaGenerateRequest, OllamaGenerateResult, OllamaStatus } from './ollama';

declare global {
  interface Window {
    chessTrainer: {
      getEngineStatus(): Promise<EngineStatus>;
      selectEngine(): Promise<EngineStatus>;
      analyse(request: AnalyseRequest): Promise<AnalyseResult>;
      cancelAnalysis(): Promise<void>;
      getOllamaStatus(): Promise<OllamaStatus>;
      ollamaGenerate(request: OllamaGenerateRequest): Promise<OllamaGenerateResult>;
    };
  }
}

export {};
