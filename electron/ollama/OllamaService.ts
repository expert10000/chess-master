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

interface OllamaTagsResponse {
  models?: Array<{ name?: string; model?: string }>;
}

interface OllamaChatResponse {
  model?: string;
  message?: { content?: string };
  total_duration?: number;
}

const DEFAULT_BASE_URL = 'http://127.0.0.1:11434';

function withTimeout(timeoutMs: number): { signal: AbortSignal; dispose(): void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    dispose: () => clearTimeout(timer),
  };
}

export class OllamaService {
  readonly baseUrl = DEFAULT_BASE_URL;

  async getStatus(): Promise<OllamaStatus> {
    const timeout = withTimeout(2500);
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: timeout.signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`Ollama returned HTTP ${response.status}.`);
      }
      const data = await response.json() as OllamaTagsResponse;
      const models = (data.models ?? [])
        .map((entry) => entry.name ?? entry.model ?? '')
        .filter((name): name is string => Boolean(name))
        .sort((a, b) => a.localeCompare(b));
      return { available: true, baseUrl: this.baseUrl, models, error: null };
    } catch (error) {
      const message = error instanceof Error
        ? (error.name === 'AbortError' ? 'Ollama did not respond in time.' : error.message)
        : String(error);
      return { available: false, baseUrl: this.baseUrl, models: [], error: message };
    } finally {
      timeout.dispose();
    }
  }

  async generate(request: OllamaGenerateRequest): Promise<OllamaGenerateResult> {
    const timeout = withTimeout(60_000);
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        signal: timeout.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          stream: false,
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.prompt },
          ],
          options: {
            temperature: 0.15,
            top_p: 0.85,
          },
        }),
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Ollama returned HTTP ${response.status}${body ? `: ${body.slice(0, 240)}` : ''}`);
      }
      const data = await response.json() as OllamaChatResponse;
      const text = data.message?.content?.trim() ?? '';
      if (!text) throw new Error('Ollama returned an empty response.');
      return {
        model: data.model || request.model,
        text,
        totalDurationMs: typeof data.total_duration === 'number' ? Math.round(data.total_duration / 1_000_000) : null,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Ollama generation timed out after 60 seconds.');
      }
      throw error;
    } finally {
      timeout.dispose();
    }
  }
}
