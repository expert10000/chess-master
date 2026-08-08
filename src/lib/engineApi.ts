import type { AnalyseRequest, AnalyseResult, EngineStatus } from '../types/engine';

function requireBridge() {
  if (!window.chessTrainer) {
    throw new Error('Electron preload bridge is unavailable. Start the app through Electron.');
  }
  return window.chessTrainer;
}

export const engineApi = {
  status(): Promise<EngineStatus> {
    return requireBridge().getEngineStatus();
  },
  select(): Promise<EngineStatus> {
    return requireBridge().selectEngine();
  },
  analyse(request: AnalyseRequest): Promise<AnalyseResult> {
    return requireBridge().analyse(request);
  },
  cancel(): Promise<void> {
    return requireBridge().cancelAnalysis();
  },
};
