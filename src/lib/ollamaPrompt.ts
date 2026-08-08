import type { ConversationAnswer } from './chessCoach';

export interface OllamaCoachEvidence {
  question: string;
  fen: string;
  deterministic: ConversationAnswer;
}

export const OLLAMA_COACH_SYSTEM_PROMPT = `You are the wording layer of a chess trainer.
The chess calculations and factual evidence are supplied by Stockfish and deterministic board analysis.
Never invent a move, evaluation, tactical motif, positional concept, material count, check, mate, or continuation that is not present in the evidence.
Do not change numeric evaluations or principal variations.
If the evidence is insufficient for the user's exact question, say that clearly instead of guessing.
Explain in concise, natural teaching language suitable for a chess student.
Return plain prose only: one short paragraph, normally 2-5 sentences. Do not use markdown headings or bullet lists.`;

export function buildOllamaCoachPrompt(input: OllamaCoachEvidence): string {
  const answer = input.deterministic;
  return [
    `USER QUESTION:\n${input.question}`,
    `POSITION FEN:\n${input.fen}`,
    `VERIFIED BASE ANSWER:\n${answer.title}: ${answer.text}`,
    answer.bullets.length ? `VERIFIED FACTS:\n- ${answer.bullets.join('\n- ')}` : 'VERIFIED FACTS:\n(none supplied)',
    answer.concepts?.length ? `VERIFIED CHESS CONCEPTS:\n- ${answer.concepts.map((concept) => `${concept.label}: ${concept.detail} [${concept.confidence}]`).join('\n- ')}` : 'VERIFIED CHESS CONCEPTS:\n(none detected)',
    answer.lineSan.length ? `VERIFIED PRINCIPAL LINE (SAN):\n${answer.lineSan.join(' ')}` : 'VERIFIED PRINCIPAL LINE (SAN):\n(none supplied)',
    `GROUNDING NOTE:\n${answer.confidenceNote}`,
    'TASK:\nRewrite the verified answer so it responds directly and naturally to the user. Use only the evidence above.',
  ].join('\n\n');
}
