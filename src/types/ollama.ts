export interface OllamaStatus {
  available: boolean;
  baseUrl: string;
  models: string[];
  error: string | null;
}

export interface OllamaGenerateRequest {
  model: string;
  system: string;
  prompt: string;
}

export interface OllamaGenerateResult {
  model: string;
  text: string;
  totalDurationMs: number | null;
}
