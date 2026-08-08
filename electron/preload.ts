import { contextBridge, ipcRenderer } from 'electron';
import type {
  AnalyseRequest,
  AnalyseResult,
  EngineStatus,
} from './stockfish/StockfishService.js';
import type { OllamaGenerateRequest, OllamaGenerateResult, OllamaStatus } from './ollama/OllamaService.js';

contextBridge.exposeInMainWorld('chessTrainer', {
  getEngineStatus: (): Promise<EngineStatus> => ipcRenderer.invoke('engine:status'),
  selectEngine: (): Promise<EngineStatus> => ipcRenderer.invoke('engine:select'),
  analyse: (request: AnalyseRequest): Promise<AnalyseResult> =>
    ipcRenderer.invoke('engine:analyse', request),
  cancelAnalysis: (): Promise<void> => ipcRenderer.invoke('engine:cancel'),
  getOllamaStatus: (): Promise<OllamaStatus> => ipcRenderer.invoke('ollama:status'),
  ollamaGenerate: (request: OllamaGenerateRequest): Promise<OllamaGenerateResult> =>
    ipcRenderer.invoke('ollama:generate', request),
});
