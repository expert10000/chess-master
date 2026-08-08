import { describe, expect, it } from 'vitest';
import { buildOllamaCoachPrompt, OLLAMA_COACH_SYSTEM_PROMPT } from '../src/lib/ollamaPrompt';

const deterministic = {
  title: 'Why Nf3?',
  text: 'Stockfish prefers Nf3 because it preserves the best evaluated outcome.',
  bullets: ['Nf3 develops the knight from its home square.', 'The principal line begins Nf3 Nf6.'],
  lineSan: ['Nf3', 'Nf6'],
  confidenceNote: 'Grounded in Stockfish 18 at depth 18.',
};

describe('Ollama coach grounding prompt', () => {
  it('includes the user question and verified engine evidence', () => {
    const prompt = buildOllamaCoachPrompt({
      question: 'Why is Nf3 good?',
      fen: 'test-fen',
      deterministic,
    });
    expect(prompt).toContain('Why is Nf3 good?');
    expect(prompt).toContain('Nf3 Nf6');
    expect(prompt).toContain('Stockfish 18');
    expect(prompt).toContain('Use only the evidence above');
  });

  it('explicitly forbids invented chess facts', () => {
    expect(OLLAMA_COACH_SYSTEM_PROMPT).toContain('Never invent a move');
    expect(OLLAMA_COACH_SYSTEM_PROMPT).toContain('Do not change numeric evaluations');
  });
});
