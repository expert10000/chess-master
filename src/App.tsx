import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Move, type Square } from 'chess.js';
import { ChessBoard } from './components/ChessBoard';
import { CoachPanel } from './components/CoachPanel';
import { MoveList, type PlyRecord } from './components/MoveList';
import { PromotionDialog } from './components/PromotionDialog';
import { TrainingPanel } from './components/TrainingPanel';
import {
  answerCoachQuestion,
  answerComparedMove,
  answerPositionQuestion,
  createMoveReview,
  formatEvaluation,
  parseCoachPrompt,
  resolveMoveInput,
  type CoachAnswer,
  type ConversationAnswer,
  type CoachQuestion,
  type MoveReview,
} from './lib/chessCoach';
import { engineApi } from './lib/engineApi';
import { ollamaApi } from './lib/ollamaApi';
import { buildOllamaCoachPrompt, OLLAMA_COACH_SYSTEM_PROMPT } from './lib/ollamaPrompt';
import {
  isAcceptedTrainingMove,
  isTrainingIssue,
  scoreTrainingAttempt,
  type TrainingAttempt,
  type TrainingExercise,
  type TrainingSource,
} from './lib/training';
import type { AnalyseResult, EngineStatus, EngineStrength } from './types/engine';
import type { OllamaStatus } from './types/ollama';

interface Difficulty {
  id: string;
  label: string;
  description: string;
  movetimeMs: number;
  strength: EngineStrength;
}

type AppMode = 'play' | 'training';

type GamePhase =
  | 'engine-missing'
  | 'player-turn'
  | 'engine-thinking'
  | 'promotion'
  | 'reviewing'
  | 'game-over';

const difficulties: Difficulty[] = [
  { id: 'beginner', label: 'Beginner', description: 'Approx. 1350', movetimeMs: 220, strength: { limit: true, elo: 1350 } },
  { id: 'club', label: 'Club', description: 'Approx. 1700', movetimeMs: 400, strength: { limit: true, elo: 1700 } },
  { id: 'expert', label: 'Expert', description: 'Approx. 2100', movetimeMs: 700, strength: { limit: true, elo: 2100 } },
  { id: 'master', label: 'Master', description: 'Approx. 2400', movetimeMs: 950, strength: { limit: true, elo: 2400 } },
  { id: 'maximum', label: 'Maximum', description: 'Unrestricted', movetimeMs: 1300, strength: { limit: false } },
];

function moveToUci(move: Move): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

interface EngineMoveAnimation {
  from: Square;
  to: Square;
  durationMs: number;
}

interface LineMeta {
  id: number;
  name: string;
  originPly: number | null;
}

interface LineSnapshot extends LineMeta {
  records: PlyRecord[];
}

interface ChatTurn {
  id: number;
  question: string;
  answer: ConversationAnswer | null;
  error: string | null;
}

function gameMessage(game: Chess): string {
  if (game.isCheckmate()) return `${game.turn() === 'w' ? 'Black' : 'White'} wins by checkmate`;
  if (game.isStalemate()) return 'Draw by stalemate';
  if (game.isThreefoldRepetition()) return 'Draw by repetition';
  if (game.isInsufficientMaterial()) return 'Draw by insufficient material';
  if (game.isDraw()) return 'Draw';
  return `${game.turn() === 'w' ? 'White' : 'Black'} to move${game.isCheck() ? ' — check' : ''}`;
}

function replayRecords(records: PlyRecord[]): Chess {
  const rebuilt = new Chess();
  for (const record of records) {
    rebuilt.move({
      from: record.uci.slice(0, 2),
      to: record.uci.slice(2, 4),
      promotion: record.uci[4] ?? 'q',
    });
  }
  return rebuilt;
}

function isMistakeReview(review: MoveReview | undefined): boolean {
  return review?.verdict === 'Inaccuracy' || review?.verdict === 'Mistake' || review?.verdict === 'Blunder';
}

export default function App() {
  const gameRef = useRef(new Chess());
  const trainingGameRef = useRef(new Chess());
  const nextRecordId = useRef(1);
  const sessionRef = useRef(1);
  const analysisRequestRef = useRef(0);
  const nextLineId = useRef(2);
  const nextVariationNumber = useRef(1);
  const nextChatId = useRef(1);
  const [revision, setRevision] = useState(0);
  const [trainingRevision, setTrainingRevision] = useState(0);
  const [appMode, setAppMode] = useState<AppMode>('play');
  const [trainingSource, setTrainingSource] = useState<TrainingSource>('mistakes');
  const [trainingIndex, setTrainingIndex] = useState(0);
  const [trainingSelected, setTrainingSelected] = useState<Square | null>(null);
  const [trainingAttempt, setTrainingAttempt] = useState<TrainingAttempt | null>(null);
  const [trainingHintLevel, setTrainingHintLevel] = useState(0);
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [trainingPromotion, setTrainingPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [trainingAttempts, setTrainingAttempts] = useState(0);
  const [trainingSolvedKeys, setTrainingSolvedKeys] = useState<string[]>([]);
  const [trainingBestScores, setTrainingBestScores] = useState<Record<string, number>>({});
  const [records, setRecords] = useState<PlyRecord[]>([]);
  const [currentLine, setCurrentLine] = useState<LineMeta>({ id: 1, name: 'Main line', originPly: null });
  const [inactiveLines, setInactiveLines] = useState<LineSnapshot[]>([]);
  const [historyCursor, setHistoryCursor] = useState<number | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [humanColor, setHumanColor] = useState<'w' | 'b'>('w');
  const [difficultyId, setDifficultyId] = useState('expert');
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const [phase, setPhase] = useState<GamePhase>('engine-missing');
  const [engineMoveAnimation, setEngineMoveAnimation] = useState<EngineMoveAnimation | null>(null);
  const [statusText, setStatusText] = useState('Ready');
  const [review, setReview] = useState<MoveReview | null>(null);
  const [activeReviewId, setActiveReviewId] = useState<number | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [batchReviewing, setBatchReviewing] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [coachAnswer, setCoachAnswer] = useState<CoachAnswer | null>(null);
  const [alternativeReview, setAlternativeReview] = useState<MoveReview | null>(null);
  const [trainerLoading, setTrainerLoading] = useState(false);
  const [trainerError, setTrainerError] = useState<string | null>(null);
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [ollamaEnabled, setOllamaEnabled] = useState(false);
  const [ollamaModel, setOllamaModel] = useState('');
  const [ollamaChecking, setOllamaChecking] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalyseResult | null>(null);
  const [currentAnalysisFen, setCurrentAnalysisFen] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);

  const difficulty = difficulties.find((item) => item.id === difficultyId) ?? difficulties[2];
  const engineThinking = phase === 'engine-thinking';
  const analysisBusy = phase === 'engine-thinking' || phase === 'reviewing' || batchReviewing || trainerLoading || chatLoading || trainingLoading;
  const trainingExercises = useMemo<TrainingExercise[]>(() => {
    return records.flatMap((record) => {
      const moveReview = record.review;
      if (record.color !== humanColor || !moveReview?.bestMoveUci || !moveReview.bestMoveSan) return [];
      if (trainingSource === 'mistakes' && !isTrainingIssue(moveReview)) return [];
      return [{
        key: `${currentLine.id}:${record.id}:${record.ply}`,
        recordId: record.id,
        ply: record.ply,
        beforeFen: record.beforeFen,
        originalMoveSan: record.san,
        originalVerdict: moveReview.verdict,
        originalLoss: moveReview.centipawnLoss,
        bestMoveUci: moveReview.bestMoveUci,
        bestMoveSan: moveReview.bestMoveSan,
        review: moveReview,
      }];
    });
  }, [records, humanColor, trainingSource, currentLine.id]);
  const trainingExerciseIndex = trainingExercises.length ? Math.min(trainingIndex, trainingExercises.length - 1) : 0;
  const trainingExercise = trainingExercises[trainingExerciseIndex] ?? null;
  const trainingMistakeCount = records.filter((record) => record.color === humanColor && isTrainingIssue(record.review) && record.review?.bestMoveUci).length;
  const trainingReviewedCount = records.filter((record) => record.color === humanColor && record.review?.bestMoveUci).length;
  const trainingScore = Object.values(trainingBestScores).reduce((sum, value) => sum + value, 0);
  const isHistoryView = historyCursor !== null;
  const visiblePly = historyCursor ?? records.length;
  const game = useMemo(
    () => historyCursor === null ? gameRef.current : replayRecords(records.slice(0, historyCursor)),
    [historyCursor, records, revision],
  );

  useEffect(() => {
    engineApi.status()
      .then((status) => {
        setEngineStatus(status);
        setPhase(status.configured ? 'player-turn' : 'engine-missing');
      })
      .catch((error: unknown) => {
        setCoachError(error instanceof Error ? error.message : String(error));
        setPhase('engine-missing');
      });
  }, []);

  async function refreshOllamaStatus(): Promise<void> {
    setOllamaChecking(true);
    try {
      const status = await ollamaApi.status();
      setOllamaStatus(status);
      const savedModel = window.localStorage.getItem('stockfish-coach.ollama-model') ?? '';
      const nextModel = savedModel && status.models.includes(savedModel)
        ? savedModel
        : status.models[0] ?? '';
      setOllamaModel((current) => current && status.models.includes(current) ? current : nextModel);

      const savedEnabled = window.localStorage.getItem('stockfish-coach.ollama-enabled') === 'true';
      if (!status.available || status.models.length === 0) setOllamaEnabled(false);
      else if (savedEnabled) setOllamaEnabled(true);
    } catch (error) {
      setOllamaStatus({
        available: false,
        baseUrl: 'http://127.0.0.1:11434',
        models: [],
        error: error instanceof Error ? error.message : String(error),
      });
      setOllamaEnabled(false);
    } finally {
      setOllamaChecking(false);
    }
  }

  useEffect(() => {
    void refreshOllamaStatus();
  }, []);

  useEffect(() => {
    window.localStorage.setItem('stockfish-coach.ollama-enabled', String(ollamaEnabled));
  }, [ollamaEnabled]);

  useEffect(() => {
    if (ollamaModel) window.localStorage.setItem('stockfish-coach.ollama-model', ollamaModel);
  }, [ollamaModel]);

  useEffect(() => {
    if (trainingIndex >= trainingExercises.length && trainingExercises.length > 0) {
      setTrainingIndex(trainingExercises.length - 1);
    }
  }, [trainingIndex, trainingExercises.length]);

  useEffect(() => {
    if (appMode !== 'training') return;
    if (!trainingExercise) {
      trainingGameRef.current = new Chess();
      setTrainingSelected(null);
      setTrainingAttempt(null);
      setTrainingHintLevel(0);
      setTrainingPromotion(null);
      setTrainingRevision((value) => value + 1);
      return;
    }

    trainingGameRef.current = new Chess(trainingExercise.beforeFen);
    setTrainingSelected(null);
    setTrainingAttempt(null);
    setTrainingHintLevel(0);
    setTrainingPromotion(null);
    setOrientation(humanColor === 'w' ? 'white' : 'black');
    setTrainingRevision((value) => value + 1);
    setStatusText(`Training ${trainingExerciseIndex + 1}/${trainingExercises.length}`);
  }, [appMode, trainingExercise?.key, trainingExerciseIndex, trainingExercises.length, humanColor]);

  const legalTargets = useMemo(() => {
    if (!selected) return new Set<Square>();
    const moves = gameRef.current.moves({ square: selected, verbose: true });
    return new Set(moves.map((move) => move.to as Square));
  }, [selected, revision]);

  const trainingLegalTargets = useMemo(() => {
    if (!trainingSelected || !trainingExercise) return new Set<Square>();
    const moves = trainingGameRef.current.moves({ square: trainingSelected, verbose: true });
    return new Set(moves.map((move) => move.to as Square));
  }, [trainingSelected, trainingRevision, trainingExercise?.key]);

  const visibleRecord = visiblePly > 0 ? records[visiblePly - 1] ?? null : null;
  const lastMove = visibleRecord
    ? {
        from: visibleRecord.uci.slice(0, 2) as Square,
        to: visibleRecord.uci.slice(2, 4) as Square,
      }
    : null;

  const liveGame = gameRef.current;
  const humanTurn = liveGame.turn() === humanColor;
  const boardDisabled = isHistoryView || batchReviewing || phase !== 'player-turn' || !humanTurn || liveGame.isGameOver() || !engineStatus?.configured;
  const trainingBoardDisabled = !trainingExercise || trainingLoading || Boolean(trainingAttempt) || Boolean(trainingPromotion) || !engineStatus?.configured;
  const trainingLastMove = trainingAttempt
    ? { from: trainingAttempt.uci.slice(0, 2) as Square, to: trainingAttempt.uci.slice(2, 4) as Square }
    : null;
  const hasHumanMove = records.some((record) => record.color === humanColor);

  function refresh(): void {
    setRevision((value) => value + 1);
  }

  function beginNewSession(): number {
    sessionRef.current += 1;
    return sessionRef.current;
  }

  function isCurrentSession(session: number): boolean {
    return session === sessionRef.current;
  }

  function nextAnalysisRequest(): number {
    analysisRequestRef.current += 1;
    return analysisRequestRef.current;
  }

  function isCurrentAnalysisRequest(request: number): boolean {
    return request === analysisRequestRef.current;
  }

  async function cancelEngineWork(): Promise<void> {
    try {
      await engineApi.cancel();
    } catch {
      // Cancellation is best-effort. Session/request guards still prevent stale results from mutating the board.
    }
  }

  function syncPhaseFromBoard(session: number, playerColor: 'w' | 'b' = humanColor): void {
    if (!isCurrentSession(session)) return;
    if (gameRef.current.isGameOver()) {
      setPhase('game-over');
      return;
    }
    setPhase(gameRef.current.turn() === playerColor ? 'player-turn' : 'engine-thinking');
  }

  function appendMove(beforeFen: string, move: Move): PlyRecord {
    const record: PlyRecord = {
      id: nextRecordId.current++,
      ply: gameRef.current.history().length,
      beforeFen,
      afterFen: gameRef.current.fen(),
      uci: moveToUci(move),
      san: move.san,
      color: move.color,
    };
    setRecords((previous) => [...previous, record]);
    refresh();
    return record;
  }

  function updateRecordReview(recordId: number, moveReview: MoveReview): void {
    setRecords((previous) => previous.map((record) =>
      record.id === recordId ? { ...record, review: moveReview } : record,
    ));
  }

  function clearInteractiveCoachState(): void {
    setCoachAnswer(null);
    setAlternativeReview(null);
    setTrainerLoading(false);
    setTrainerError(null);
  }

  function askCoach(question: CoachQuestion): void {
    if (!review) return;
    setTrainerError(null);
    setAlternativeReview(null);
    setCoachAnswer(answerCoachQuestion(review, question));
  }

  async function compareAlternativeMove(rawMove: string): Promise<void> {
    if (!review || activeReviewId === null || !engineStatus?.configured || trainerLoading) return;
    const record = records.find((candidate) => candidate.id === activeReviewId);
    if (!record) {
      setTrainerError('Select a reviewed move from history first.');
      return;
    }

    const resolved = resolveMoveInput(record.beforeFen, rawMove);
    if (!resolved) {
      setAlternativeReview(null);
      setTrainerError(`“${rawMove}” is not a legal SAN or UCI move in this position.`);
      return;
    }

    if (resolved.uci === record.uci) {
      setCoachAnswer(null);
      setTrainerError(null);
      setAlternativeReview(record.review ?? review);
      return;
    }

    const session = sessionRef.current;
    const request = nextAnalysisRequest();
    setTrainerLoading(true);
    setTrainerError(null);
    setCoachAnswer(null);
    setAlternativeReview(null);
    setPhase('reviewing');

    try {
      const best = await engineApi.analyse({
        fen: record.beforeFen,
        movetimeMs: 850,
        multiPv: 3,
        strength: { limit: false },
      });
      if (!isCurrentSession(session) || !isCurrentAnalysisRequest(request)) return;

      const alternative = await engineApi.analyse({
        fen: record.beforeFen,
        movetimeMs: 850,
        multiPv: 1,
        strength: { limit: false },
        searchMoves: [resolved.uci],
      });
      if (!isCurrentSession(session) || !isCurrentAnalysisRequest(request)) return;

      setAlternativeReview(createMoveReview({
        beforeFen: record.beforeFen,
        uci: resolved.uci,
        san: resolved.san,
        best,
        played: alternative,
      }));
      setStatusText(`Compared ${resolved.san} with Stockfish’s best move`);
    } catch (error) {
      if (!isCurrentSession(session) || !isCurrentAnalysisRequest(request)) return;
      setTrainerError(error instanceof Error ? error.message : String(error));
    } finally {
      if (isCurrentSession(session) && isCurrentAnalysisRequest(request)) {
        setTrainerLoading(false);
        syncPhaseFromBoard(session, humanColor);
      }
    }
  }

  async function maybePolishCoachAnswer(
    question: string,
    fen: string,
    deterministic: ConversationAnswer,
  ): Promise<ConversationAnswer> {
    if (!ollamaEnabled || !ollamaStatus?.available || !ollamaModel) return deterministic;

    try {
      const result = await ollamaApi.generate({
        model: ollamaModel,
        system: OLLAMA_COACH_SYSTEM_PROMPT,
        prompt: buildOllamaCoachPrompt({ question, fen, deterministic }),
      });
      setOllamaStatus((current) => current ? { ...current, available: true, error: null } : current);
      const duration = result.totalDurationMs !== null ? ` in ${(result.totalDurationMs / 1000).toFixed(1)} s` : '';
      return {
        ...deterministic,
        text: result.text,
        confidenceNote: `${deterministic.confidenceNote} Natural-language wording refined locally by Ollama (${result.model})${duration}; Stockfish and deterministic board facts remain authoritative.`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setOllamaStatus((current) => current ? { ...current, error: message } : current);
      return {
        ...deterministic,
        confidenceNote: `${deterministic.confidenceNote} Ollama could not refine this answer, so deterministic wording was used.`,
      };
    }
  }

  function addChatTurn(question: string): number {
    const id = nextChatId.current++;
    setChatTurns((previous) => [...previous, { id, question, answer: null, error: null }].slice(-12));
    return id;
  }

  function finishChatTurn(id: number, answer: ConversationAnswer | null, error: string | null = null): void {
    setChatTurns((previous) => previous.map((turn) => turn.id === id ? { ...turn, answer, error } : turn));
  }

  async function askConversationalCoach(rawQuestion: string): Promise<void> {
    const question = rawQuestion.trim();
    if (!question || !engineStatus?.configured || chatLoading || batchReviewing || phase === 'promotion' || phase === 'engine-thinking') return;

    const turnId = addChatTurn(question);
    const selectedRecord = activeReviewId !== null
      ? records.find((candidate) => candidate.id === activeReviewId) ?? null
      : null;

    // Move-comparison questions about a selected historical move are interpreted in
    // the position before that move. General strategy questions use the board currently visible.
    const moveContextFen = selectedRecord?.beforeFen ?? game.fen();
    let prompt = parseCoachPrompt(moveContextFen, question);
    const session = sessionRef.current;
    const request = nextAnalysisRequest();

    setChatLoading(true);
    setTrainerError(null);
    setPhase('reviewing');

    try {
      if (prompt.intent === 'why-current-move' && review) {
        const base = { ...answerCoachQuestion(review, 'why-move'), confidenceNote: 'This explanation is tied to the stored Stockfish move review.' };
        const answer = await maybePolishCoachAnswer(question, moveContextFen, base);
        if (!isCurrentSession(session) || !isCurrentAnalysisRequest(request)) return;
        finishChatTurn(turnId, answer);
        return;
      }

      if (prompt.intent === 'why-best-move' && review && selectedRecord) {
        const base = { ...answerCoachQuestion(review, 'why-best'), confidenceNote: 'This compares the played move with the Stockfish best line stored for the selected move.' };
        const answer = await maybePolishCoachAnswer(question, selectedRecord.beforeFen, base);
        if (!isCurrentSession(session) || !isCurrentAnalysisRequest(request)) return;
        finishChatTurn(turnId, answer);
        return;
      }

      if (prompt.intent === 'compare-move' && prompt.move) {
        const compareFen = selectedRecord?.beforeFen ?? game.fen();
        // Reparse against the exact comparison position if the first pass used a different context.
        prompt = parseCoachPrompt(compareFen, question);
        if (!prompt.move) throw new Error('I found a move reference, but it is not legal in the position being discussed.');

        const best = await engineApi.analyse({
          fen: compareFen,
          movetimeMs: 900,
          multiPv: 3,
          strength: { limit: false },
        });
        if (!isCurrentSession(session) || !isCurrentAnalysisRequest(request)) return;

        const candidate = await engineApi.analyse({
          fen: compareFen,
          movetimeMs: 900,
          multiPv: 1,
          strength: { limit: false },
          searchMoves: [prompt.move.uci],
        });
        if (!isCurrentSession(session) || !isCurrentAnalysisRequest(request)) return;

        const moveReview = createMoveReview({
          beforeFen: compareFen,
          uci: prompt.move.uci,
          san: prompt.move.san,
          best,
          played: candidate,
        });
        const answer = await maybePolishCoachAnswer(question, compareFen, answerComparedMove(moveReview));
        if (!isCurrentSession(session) || !isCurrentAnalysisRequest(request)) return;
        finishChatTurn(turnId, answer);
        setStatusText(`Coach compared ${prompt.move.san}${ollamaEnabled ? ' · Ollama wording' : ''}`);
        return;
      }

      const positionFen = game.fen();
      const positionPrompt = parseCoachPrompt(positionFen, question);
      const result = currentAnalysis && currentAnalysisFen === positionFen
        ? currentAnalysis
        : await engineApi.analyse({
            fen: positionFen,
            movetimeMs: 1000,
            multiPv: 3,
            strength: { limit: false },
          });
      if (!isCurrentSession(session) || !isCurrentAnalysisRequest(request)) return;

      const baseAnswer = answerPositionQuestion(positionFen, result, positionPrompt);
      const answer = await maybePolishCoachAnswer(question, positionFen, baseAnswer);
      if (!isCurrentSession(session) || !isCurrentAnalysisRequest(request)) return;
      finishChatTurn(turnId, answer);
      setStatusText(ollamaEnabled ? 'Coach answered from Stockfish + local Ollama wording' : 'Conversational coach answered from Stockfish analysis');
    } catch (error) {
      if (!isCurrentSession(session) || !isCurrentAnalysisRequest(request)) return;
      const message = error instanceof Error ? error.message : String(error);
      finishChatTurn(turnId, null, message);
    } finally {
      if (isCurrentSession(session) && isCurrentAnalysisRequest(request)) {
        setChatLoading(false);
        syncPhaseFromBoard(session, humanColor);
      }
    }
  }

  async function chooseEngine(): Promise<void> {
    if (analysisBusy) return;
    try {
      setStatusText('Opening engine selector…');
      const status = await engineApi.select();
      setEngineStatus(status);
      setStatusText(status.configured ? 'Stockfish connected' : 'No engine selected');
      setCoachError(status.error);
      if (!status.configured) {
        setPhase('engine-missing');
        return;
      }

      const session = sessionRef.current;
      if (!gameRef.current.isGameOver() && gameRef.current.turn() !== humanColor) {
        await makeEngineMove(session, humanColor);
      } else {
        syncPhaseFromBoard(session, humanColor);
      }
    } catch (error) {
      setCoachError(error instanceof Error ? error.message : String(error));
      setStatusText('Engine selection failed');
      setPhase(engineStatus?.configured ? 'player-turn' : 'engine-missing');
    }
  }

  async function runMoveReview(
    record: PlyRecord,
    session: number = sessionRef.current,
    playerColor: 'w' | 'b' = humanColor,
    request: number = nextAnalysisRequest(),
    force = false,
  ): Promise<void> {
    if (!isCurrentSession(session) || !isCurrentAnalysisRequest(request)) return;
    clearInteractiveCoachState();

    if (record.review && !force) {
      setReview(record.review);
      setActiveReviewId(record.id);
      setCoachLoading(false);
      setCoachError(null);
      setCurrentAnalysis(null);
      setCurrentAnalysisFen(null);
      syncPhaseFromBoard(session, playerColor);
      return;
    }

    setPhase('reviewing');
    setCoachLoading(true);
    setCoachError(null);
    setActiveReviewId(record.id);
    setCurrentAnalysis(null);
    setCurrentAnalysisFen(null);

    try {
      const best = await engineApi.analyse({
        fen: record.beforeFen,
        movetimeMs: 700,
        multiPv: 3,
        strength: { limit: false },
      });
      if (!isCurrentSession(session) || !isCurrentAnalysisRequest(request)) return;

      const played = await engineApi.analyse({
        fen: record.beforeFen,
        movetimeMs: 700,
        multiPv: 1,
        strength: { limit: false },
        searchMoves: [record.uci],
      });
      if (!isCurrentSession(session) || !isCurrentAnalysisRequest(request)) return;

      const moveReview = createMoveReview({
        beforeFen: record.beforeFen,
        uci: record.uci,
        san: record.san,
        best,
        played,
      });
      setReview(moveReview);
      updateRecordReview(record.id, moveReview);
    } catch (error) {
      if (!isCurrentSession(session) || !isCurrentAnalysisRequest(request)) return;
      setCoachError(error instanceof Error ? error.message : String(error));
    } finally {
      if (isCurrentSession(session) && isCurrentAnalysisRequest(request)) {
        setCoachLoading(false);
        syncPhaseFromBoard(session, playerColor);
      }
    }
  }

  async function makeEngineMove(
    session: number = sessionRef.current,
    playerColor: 'w' | 'b' = humanColor,
  ): Promise<PlyRecord | null> {
    if (!isCurrentSession(session) || gameRef.current.isGameOver()) return null;

    setPhase('engine-thinking');
    setStatusText(`${difficulty.label} Stockfish is thinking…`);

    try {
      const beforeFen = gameRef.current.fen();
      const result = await engineApi.analyse({
        fen: beforeFen,
        movetimeMs: difficulty.movetimeMs,
        multiPv: 1,
        strength: difficulty.strength,
      });
      if (!isCurrentSession(session) || !result.bestMove) return null;

      const from = result.bestMove.slice(0, 2) as Square;
      const to = result.bestMove.slice(2, 4) as Square;
      const movingPiece = gameRef.current.get(from);

      if (movingPiece) {
        const durationMs = 220;
        setEngineMoveAnimation({ from, to, durationMs });
        await wait(durationMs + 30);
        if (!isCurrentSession(session)) return null;
      }

      const move = gameRef.current.move({
        from,
        to,
        promotion: result.bestMove[4] ?? 'q',
      });
      if (!isCurrentSession(session)) return null;

      const record = appendMove(beforeFen, move);
      setEngineMoveAnimation(null);
      setStatusText(gameMessage(gameRef.current));
      syncPhaseFromBoard(session, playerColor);
      return record;
    } catch (error) {
      if (!isCurrentSession(session)) return null;
      throw error;
    } finally {
      if (isCurrentSession(session)) setEngineMoveAnimation(null);
    }
  }

  async function performHumanMove(
    from: Square,
    to: Square,
    promotionPiece: 'q' | 'r' | 'b' | 'n' = 'q',
  ): Promise<void> {
    if (
      (phase !== 'player-turn' && phase !== 'promotion')
      || !engineStatus?.configured
      || gameRef.current.turn() !== humanColor
    ) return;

    const session = sessionRef.current;
    const playerColor = humanColor;
    setHistoryCursor(null);
    const beforeFen = gameRef.current.fen();
    let move: Move;
    try {
      move = gameRef.current.move({ from, to, promotion: promotionPiece });
    } catch {
      setSelected(null);
      if (phase === 'promotion') setPhase('player-turn');
      return;
    }

    const humanRecord = appendMove(beforeFen, move);
    setSelected(null);
    setPromotion(null);
    setReview(null);
    setCurrentAnalysis(null);
    setCurrentAnalysisFen(null);
    setCoachError(null);
    clearInteractiveCoachState();

    try {
      setStatusText(gameMessage(gameRef.current));
      if (!gameRef.current.isGameOver()) {
        await makeEngineMove(session, playerColor);
        if (!isCurrentSession(session)) return;
      }
      await runMoveReview(humanRecord, session, playerColor);
      if (isCurrentSession(session)) setStatusText(gameMessage(gameRef.current));
    } catch (error) {
      if (!isCurrentSession(session)) return;
      const message = error instanceof Error ? error.message : String(error);
      setCoachError(message);
      setStatusText('Engine error');
      syncPhaseFromBoard(session, playerColor);
    }
  }

  function requestHumanMove(from: Square, to: Square): boolean {
    if (boardDisabled) return false;

    const candidates = gameRef.current
      .moves({ square: from, verbose: true })
      .filter((move) => move.to === to);

    if (!candidates.length) return false;

    if (candidates.some((move) => Boolean(move.promotion))) {
      setPromotion({ from, to });
      setPhase('promotion');
      return true;
    }

    void performHumanMove(from, to);
    return true;
  }

  function onSquareClick(square: Square): void {
    if (boardDisabled) return;
    const piece = gameRef.current.get(square);

    if (!selected) {
      if (piece?.color === humanColor && piece.color === gameRef.current.turn()) setSelected(square);
      return;
    }

    if (square === selected) {
      setSelected(null);
      return;
    }

    if (piece?.color === humanColor) {
      setSelected(square);
      return;
    }

    if (!requestHumanMove(selected, square)) setSelected(null);
  }

  function onPieceDragStart(square: Square): void {
    if (boardDisabled) return;
    const piece = gameRef.current.get(square);
    if (piece?.color === humanColor && piece.color === gameRef.current.turn()) setSelected(square);
  }

  function onPieceDragCancel(): void {
    if (!promotion) setSelected(null);
  }

  function onPieceDrop(from: Square, to: Square): boolean {
    if (!requestHumanMove(from, to)) {
      setSelected(null);
      return false;
    }
    return true;
  }

  function resetTrainingBoard(preserveHints = false): void {
    if (!trainingExercise) return;
    trainingGameRef.current = new Chess(trainingExercise.beforeFen);
    setTrainingSelected(null);
    setTrainingAttempt(null);
    setTrainingPromotion(null);
    if (!preserveHints) setTrainingHintLevel(0);
    setTrainingRevision((value) => value + 1);
  }

  async function evaluateTrainingMove(
    from: Square,
    to: Square,
    promotionPiece: 'q' | 'r' | 'b' | 'n' = 'q',
  ): Promise<void> {
    if (!trainingExercise || trainingLoading || trainingAttempt || !engineStatus?.configured) return;

    const beforeFen = trainingExercise.beforeFen;
    let move: Move;
    try {
      move = trainingGameRef.current.move({ from, to, promotion: promotionPiece });
    } catch {
      setTrainingSelected(null);
      return;
    }

    const uci = moveToUci(move);
    setTrainingSelected(null);
    setTrainingPromotion(null);
    setTrainingRevision((value) => value + 1);
    setTrainingLoading(true);
    setStatusText(`Checking ${move.san}…`);

    const session = sessionRef.current;
    const request = nextAnalysisRequest();
    try {
      const best = await engineApi.analyse({
        fen: beforeFen,
        movetimeMs: 900,
        multiPv: 3,
        strength: { limit: false },
      });
      if (!isCurrentSession(session) || !isCurrentAnalysisRequest(request) || appMode !== 'training') return;

      const candidate = await engineApi.analyse({
        fen: beforeFen,
        movetimeMs: 900,
        multiPv: 1,
        strength: { limit: false },
        searchMoves: [uci],
      });
      if (!isCurrentSession(session) || !isCurrentAnalysisRequest(request) || appMode !== 'training') return;

      const moveReview = createMoveReview({
        beforeFen,
        uci,
        san: move.san,
        best,
        played: candidate,
      });
      const accepted = isAcceptedTrainingMove(moveReview);
      const points = scoreTrainingAttempt(moveReview, trainingHintLevel);
      const attempt: TrainingAttempt = {
        uci,
        san: move.san,
        review: moveReview,
        accepted,
        points,
        hintLevel: trainingHintLevel,
      };
      setTrainingAttempt(attempt);
      setTrainingAttempts((value) => value + 1);
      setTrainingBestScores((previous) => ({
        ...previous,
        [trainingExercise.key]: Math.max(previous[trainingExercise.key] ?? 0, points),
      }));
      if (accepted) {
        setTrainingSolvedKeys((previous) => previous.includes(trainingExercise.key) ? previous : [...previous, trainingExercise.key]);
      }
      setStatusText(accepted ? `${move.san} — ${moveReview.verdict}` : `${move.san} — ${moveReview.verdict}; try again or inspect the explanation`);
    } catch (error) {
      if (!isCurrentSession(session) || !isCurrentAnalysisRequest(request)) return;
      setCoachError(error instanceof Error ? error.message : String(error));
      setStatusText('Training analysis failed');
      trainingGameRef.current = new Chess(trainingExercise.beforeFen);
      setTrainingRevision((value) => value + 1);
    } finally {
      if (isCurrentSession(session) && isCurrentAnalysisRequest(request)) setTrainingLoading(false);
    }
  }

  function requestTrainingMove(from: Square, to: Square): boolean {
    if (!trainingExercise || trainingLoading || trainingAttempt || !engineStatus?.configured) return false;
    const candidates = trainingGameRef.current
      .moves({ square: from, verbose: true })
      .filter((move) => move.to === to);
    if (!candidates.length) return false;

    if (candidates.some((move) => Boolean(move.promotion))) {
      setTrainingPromotion({ from, to });
      return true;
    }

    void evaluateTrainingMove(from, to);
    return true;
  }

  function onTrainingSquareClick(square: Square): void {
    if (!trainingExercise || trainingLoading || trainingAttempt) return;
    const piece = trainingGameRef.current.get(square);
    const sideToMove = trainingGameRef.current.turn();

    if (!trainingSelected) {
      if (piece?.color === sideToMove) setTrainingSelected(square);
      return;
    }
    if (square === trainingSelected) {
      setTrainingSelected(null);
      return;
    }
    if (piece?.color === sideToMove) {
      setTrainingSelected(square);
      return;
    }
    if (!requestTrainingMove(trainingSelected, square)) setTrainingSelected(null);
  }

  function onTrainingDragStart(square: Square): void {
    if (trainingLoading || trainingAttempt) return;
    const piece = trainingGameRef.current.get(square);
    if (piece?.color === trainingGameRef.current.turn()) setTrainingSelected(square);
  }

  function onTrainingDragCancel(): void {
    if (!trainingPromotion) setTrainingSelected(null);
  }

  function onTrainingDrop(from: Square, to: Square): boolean {
    if (!requestTrainingMove(from, to)) {
      setTrainingSelected(null);
      return false;
    }
    return true;
  }

  function changeTrainingSource(source: TrainingSource): void {
    setTrainingSource(source);
    setTrainingIndex(0);
    setTrainingAttempt(null);
    setTrainingHintLevel(0);
    setTrainingSelected(null);
    setTrainingPromotion(null);
  }

  function moveTrainingExercise(delta: number): void {
    if (trainingExercises.length < 2 || trainingLoading) return;
    const next = (trainingExerciseIndex + delta + trainingExercises.length) % trainingExercises.length;
    setTrainingIndex(next);
  }

  function revealTrainingHint(): void {
    setTrainingHintLevel((value) => Math.min(3, value + 1));
  }

  function showTrainingAnswer(): void {
    setTrainingHintLevel(4);
  }

  async function switchAppMode(mode: AppMode): Promise<void> {
    if (mode === appMode || analysisBusy || phase === 'promotion' || trainingPromotion) return;
    const session = beginNewSession();
    nextAnalysisRequest();
    await cancelEngineWork();
    if (!isCurrentSession(session)) return;

    setSelected(null);
    setTrainingSelected(null);
    setTrainingPromotion(null);
    setAppMode(mode);
    if (mode === 'training') {
      setHistoryCursor(null);
      setStatusText(trainingExercises.length ? 'Training mode' : 'Training mode · review moves to create exercises');
      if (phase === 'engine-thinking' || phase === 'reviewing') syncPhaseFromBoard(session, humanColor);
    } else {
      setOrientation(humanColor === 'w' ? 'white' : 'black');
      setStatusText(gameMessage(gameRef.current));
      syncPhaseFromBoard(session, humanColor);
    }
  }

  async function startNewGame(color: 'w' | 'b' = humanColor): Promise<void> {
    const session = beginNewSession();
    nextAnalysisRequest();
    await cancelEngineWork();
    if (!isCurrentSession(session)) return;

    gameRef.current = new Chess();
    nextRecordId.current = 1;
    nextLineId.current = 2;
    nextVariationNumber.current = 1;
    setRecords([]);
    setTrainingIndex(0);
    setTrainingAttempt(null);
    setTrainingHintLevel(0);
    setTrainingAttempts(0);
    setTrainingSolvedKeys([]);
    setTrainingBestScores({});
    setCurrentLine({ id: 1, name: 'Main line', originPly: null });
    setInactiveLines([]);
    setHistoryCursor(null);
    setSelected(null);
    setEngineMoveAnimation(null);
    setReview(null);
    setActiveReviewId(null);
    setCurrentAnalysis(null);
    setCurrentAnalysisFen(null);
    setCoachLoading(false);
    setBatchReviewing(false);
    setCoachError(null);
    clearInteractiveCoachState();
    setChatTurns([]);
    setChatLoading(false);
    nextChatId.current = 1;
    setPromotion(null);
    setHumanColor(color);
    setOrientation(color === 'w' ? 'white' : 'black');
    refresh();
    setStatusText('New game');

    if (!engineStatus?.configured) {
      setPhase('engine-missing');
      return;
    }

    if (color === 'b') {
      try {
        await makeEngineMove(session, color);
      } catch (error) {
        if (!isCurrentSession(session)) return;
        setCoachError(error instanceof Error ? error.message : String(error));
        setStatusText('Engine error');
        syncPhaseFromBoard(session, color);
      }
    } else {
      setPhase('player-turn');
    }
  }

  function undoTurn(): void {
    let lastHumanIndex = -1;
    for (let index = records.length - 1; index >= 0; index -= 1) {
      if (records[index].color === humanColor) {
        lastHumanIndex = index;
        break;
      }
    }
    if (lastHumanIndex < 0) return;

    beginNewSession();
    nextAnalysisRequest();
    void cancelEngineWork();

    const remaining = records.slice(0, lastHumanIndex);
    gameRef.current = replayRecords(remaining);
    setRecords(remaining);
    setHistoryCursor(null);
    nextRecordId.current = (remaining[remaining.length - 1]?.id ?? 0) + 1;
    setSelected(null);
    setEngineMoveAnimation(null);
    setReview(null);
    setActiveReviewId(null);
    setCurrentAnalysis(null);
    setCurrentAnalysisFen(null);
    setCoachLoading(false);
    setCoachError(null);
    clearInteractiveCoachState();
    setPromotion(null);
    setStatusText('Last turn undone');
    setPhase(engineStatus?.configured ? 'player-turn' : 'engine-missing');
    refresh();
  }

  async function navigateHistory(targetPly: number | null): Promise<void> {
    if (phase === 'engine-thinking' || phase === 'promotion' || records.length === 0) return;

    const normalized = targetPly === null
      ? null
      : Math.max(0, Math.min(targetPly, records.length));
    const request = nextAnalysisRequest();

    setHistoryCursor(normalized);
    setSelected(null);
    setPromotion(null);
    setEngineMoveAnimation(null);
    setReview(null);
    setActiveReviewId(null);
    setCurrentAnalysis(null);
    setCurrentAnalysisFen(null);
    setCoachLoading(false);
    setCoachError(null);
    clearInteractiveCoachState();

    if (normalized === null) setStatusText('Returned to live position');
    else if (normalized === 0) setStatusText('Viewing starting position');
    else {
      const record = records[normalized - 1];
      if (record) setStatusText(`Viewing move ${normalized} of ${records.length}: ${record.san}`);
    }

    await cancelEngineWork();
    if (!isCurrentAnalysisRequest(request)) return;

    const session = sessionRef.current;
    if (normalized === null || normalized === 0) {
      syncPhaseFromBoard(session, humanColor);
      return;
    }

    const record = records[normalized - 1];
    if (!record) return;

    if (record.review) {
      setReview(record.review);
      setActiveReviewId(record.id);
      syncPhaseFromBoard(session, humanColor);
    } else if (engineStatus?.configured) {
      await runMoveReview(record, session, humanColor, request);
    } else {
      syncPhaseFromBoard(session, humanColor);
    }
  }

  function navigateHistoryBy(delta: number): void {
    if (records.length === 0) return;
    const current = historyCursor ?? records.length;
    const target = current + delta;
    if (target > records.length) void navigateHistory(null);
    else void navigateHistory(Math.max(0, target));
  }

  function mistakePlies(): number[] {
    return records.filter((record) => isMistakeReview(record.review)).map((record) => record.ply);
  }

  function previousMistakePly(): number | null {
    const current = historyCursor ?? records.length + 1;
    const candidates = mistakePlies().filter((ply) => ply < current);
    return candidates.length ? candidates[candidates.length - 1] : null;
  }

  function nextMistakePly(): number | null {
    const current = historyCursor ?? 0;
    const candidate = mistakePlies().find((ply) => ply > current);
    return candidate ?? null;
  }

  function goToPreviousMistake(): void {
    const ply = previousMistakePly();
    if (ply !== null) void navigateHistory(ply);
  }

  function goToNextMistake(): void {
    const ply = nextMistakePly();
    if (ply !== null) void navigateHistory(ply);
  }

  async function reviewAllUnreviewedMoves(): Promise<void> {
    if (!engineStatus?.configured || analysisBusy || phase === 'promotion' || records.length === 0) return;

    const pending = records.filter((record) => !record.review);
    if (pending.length === 0) {
      setStatusText('All moves already reviewed');
      return;
    }

    const session = sessionRef.current;
    setBatchReviewing(true);
    setHistoryCursor(null);
    setSelected(null);
    setPromotion(null);

    try {
      for (let index = 0; index < pending.length; index += 1) {
        if (!isCurrentSession(session)) return;
        const record = pending[index];
        setStatusText(`Reviewing ${index + 1}/${pending.length}: ${record.san}`);
        const request = nextAnalysisRequest();
        await runMoveReview(record, session, humanColor, request);
      }
      if (isCurrentSession(session)) setStatusText(`Review complete · ${pending.length} moves analyzed`);
    } finally {
      setBatchReviewing(false);
      if (isCurrentSession(session)) syncPhaseFromBoard(session, humanColor);
    }
  }

  async function analyseCurrentPosition(): Promise<void> {
    if (!engineStatus?.configured || analysisBusy || phase === 'promotion') return;
    const session = sessionRef.current;
    const request = nextAnalysisRequest();
    const fen = game.fen();
    setPhase('reviewing');
    setCoachLoading(true);
    setReview(null);
    setActiveReviewId(null);
    setCurrentAnalysis(null);
    setCurrentAnalysisFen(fen);
    setCoachError(null);
    try {
      const result = await engineApi.analyse({
        fen,
        movetimeMs: 1100,
        multiPv: 3,
        strength: { limit: false },
      });
      if (!isCurrentSession(session) || !isCurrentAnalysisRequest(request)) return;
      setCurrentAnalysis(result);
      setStatusText(isHistoryView ? `Historical position ${visiblePly}/${records.length} analyzed` : 'Position analyzed');
    } catch (error) {
      if (!isCurrentSession(session) || !isCurrentAnalysisRequest(request)) return;
      setCoachError(error instanceof Error ? error.message : String(error));
    } finally {
      if (isCurrentSession(session) && isCurrentAnalysisRequest(request)) {
        setCoachLoading(false);
        syncPhaseFromBoard(session, humanColor);
      }
    }
  }

  async function copyPgn(): Promise<void> {
    await navigator.clipboard.writeText(gameRef.current.pgn());
    setStatusText('PGN copied to clipboard');
  }

  async function resumePlayableLine(session: number, label: string): Promise<void> {
    if (!isCurrentSession(session)) return;

    if (!engineStatus?.configured) {
      setStatusText(label);
      setPhase('engine-missing');
      return;
    }

    if (gameRef.current.isGameOver()) {
      setStatusText(gameMessage(gameRef.current));
      setPhase('game-over');
      return;
    }

    try {
      if (gameRef.current.turn() !== humanColor) {
        setStatusText(label);
        await makeEngineMove(session, humanColor);
        if (!isCurrentSession(session)) return;
      }
      setStatusText(gameMessage(gameRef.current));
      syncPhaseFromBoard(session, humanColor);
    } catch (error) {
      if (!isCurrentSession(session)) return;
      setCoachError(error instanceof Error ? error.message : String(error));
      setStatusText('Engine error');
      syncPhaseFromBoard(session, humanColor);
    }
  }

  function resetTransientReviewState(): void {
    setHistoryCursor(null);
    setSelected(null);
    setEngineMoveAnimation(null);
    setReview(null);
    setActiveReviewId(null);
    setCurrentAnalysis(null);
    setCurrentAnalysisFen(null);
    setCoachLoading(false);
    setCoachError(null);
    clearInteractiveCoachState();
    setPromotion(null);
  }

  async function playFromHistory(): Promise<void> {
    if (historyCursor === null) return;

    const session = beginNewSession();
    nextAnalysisRequest();
    await cancelEngineWork();
    if (!isCurrentSession(session)) return;

    const branchPly = Math.max(0, Math.min(historyCursor, records.length));
    const remaining = records.slice(0, branchPly);
    gameRef.current = replayRecords(remaining);
    setRecords(remaining);
    nextRecordId.current = (remaining[remaining.length - 1]?.id ?? 0) + 1;
    resetTransientReviewState();
    refresh();

    await resumePlayableLine(
      session,
      branchPly === 0
        ? `Continuing ${currentLine.name} from the starting position`
        : `Continuing ${currentLine.name} from ply ${branchPly}`,
    );
  }

  async function createVariationFromHistory(): Promise<void> {
    if (historyCursor === null) return;

    const session = beginNewSession();
    nextAnalysisRequest();
    await cancelEngineWork();
    if (!isCurrentSession(session)) return;

    const branchPly = Math.max(0, Math.min(historyCursor, records.length));
    const sourceSnapshot: LineSnapshot = {
      ...currentLine,
      records: [...records],
    };
    const variationNumber = nextVariationNumber.current++;
    const newLine: LineMeta = {
      id: nextLineId.current++,
      name: `Variation ${variationNumber}`,
      originPly: branchPly,
    };
    const remaining = records.slice(0, branchPly);

    setInactiveLines((previous) => [
      ...previous.filter((line) => line.id !== sourceSnapshot.id),
      sourceSnapshot,
    ]);
    setCurrentLine(newLine);
    gameRef.current = replayRecords(remaining);
    setRecords(remaining);
    nextRecordId.current = (remaining[remaining.length - 1]?.id ?? 0) + 1;
    resetTransientReviewState();
    refresh();

    await resumePlayableLine(
      session,
      branchPly === 0
        ? `${newLine.name} created from the starting position`
        : `${newLine.name} created from ply ${branchPly}`,
    );
  }

  async function switchToLine(lineId: number): Promise<void> {
    const target = inactiveLines.find((line) => line.id === lineId);
    if (!target || analysisBusy || phase === 'promotion') return;

    const session = beginNewSession();
    nextAnalysisRequest();
    await cancelEngineWork();
    if (!isCurrentSession(session)) return;

    const currentSnapshot: LineSnapshot = {
      ...currentLine,
      records: [...records],
    };

    setInactiveLines((previous) => [
      ...previous.filter((line) => line.id !== target.id && line.id !== currentSnapshot.id),
      currentSnapshot,
    ]);
    setCurrentLine({ id: target.id, name: target.name, originPly: target.originPly });
    gameRef.current = replayRecords(target.records);
    setRecords(target.records);
    nextRecordId.current = (target.records[target.records.length - 1]?.id ?? 0) + 1;
    resetTransientReviewState();
    refresh();

    await resumePlayableLine(session, `Switched to ${target.name}`);
  }

  function cancelPromotion(): void {

    setPromotion(null);
    setSelected(null);
    if (engineStatus?.configured) setPhase('player-turn');
    else setPhase('engine-missing');
  }

  const currentEvaluation = currentAnalysis?.lines[0]
    ? formatEvaluation(currentAnalysis.lines[0])
    : '—';

  const reviewedCount = records.filter((record) => record.review).length;
  const mistakeCount = records.filter((record) => isMistakeReview(record.review)).length;
  const previousMistake = previousMistakePly();
  const nextMistake = nextMistakePly();

  const historyLabel = historyCursor === 0
    ? `${currentLine.name} · Start · 0/${records.length}`
    : historyCursor !== null
      ? `${currentLine.name} · ${historyCursor}/${records.length}${visibleRecord ? ` · ${visibleRecord.san}` : ''}`
      : `${currentLine.name} · Live · ${records.length}/${records.length}`;

  const boardStatusText = batchReviewing
    ? 'Reviewing all moves…'
    : isHistoryView
    ? phase === 'reviewing'
      ? `Analyzing history · ${historyLabel}`
      : `History · ${historyLabel}`
    : phase === 'engine-thinking'
      ? `${difficulty.label} Stockfish thinking…`
      : phase === 'reviewing'
        ? 'Reviewing your move…'
        : phase === 'promotion'
          ? 'Choose a promotion piece'
          : gameMessage(game);

  const boardStatusClass = batchReviewing
    ? 'thinking'
    : isHistoryView
    ? 'history'
    : phase === 'engine-thinking' || phase === 'reviewing'
      ? 'thinking'
      : game.isCheckmate()
        ? 'checkmate'
        : game.isCheck()
          ? 'check'
          : game.isGameOver()
            ? 'game-over'
            : humanTurn
              ? 'your-turn'
              : '';

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (appMode !== 'play') return;
      if (records.length === 0 || batchReviewing || phase === 'engine-thinking' || phase === 'promotion') return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        navigateHistoryBy(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        navigateHistoryBy(1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        void navigateHistory(0);
      } else if (event.key === '[') {
        event.preventDefault();
        goToPreviousMistake();
      } else if (event.key === ']') {
        event.preventDefault();
        goToNextMistake();
      } else if (event.key === 'End' || event.key === 'Escape') {
        if (historyCursor !== null) {
          event.preventDefault();
          void navigateHistory(null);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [records, historyCursor, phase, batchReviewing, engineStatus?.configured, appMode]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">♞</div>
          <div>
            <h1>Stockfish Coach</h1>
            <p>Play locally. Review every move. Ask why.</p>
          </div>
        </div>
        <div className="topbar-status">
          <span className={`status-dot ${engineStatus?.configured ? 'online' : ''}`} />
          <div>
            <strong>{engineStatus?.engineName ?? (engineStatus?.configured ? 'Stockfish configured' : 'Engine missing')}</strong>
            <span>{statusText}</span>
          </div>
        </div>
      </header>

      {!engineStatus?.configured && (
        <section className="engine-banner">
          <div>
            <strong>Choose your local Stockfish executable</strong>
            <span>The app does not upload positions or require an online chess service.</span>
          </div>
          <button type="button" className="primary-button" onClick={() => void chooseEngine()}>
            Choose Stockfish.exe
          </button>
        </section>
      )}

      <nav className="mode-switch panel" aria-label="Application mode">
        <button
          type="button"
          className={appMode === 'play' ? 'active' : ''}
          disabled={analysisBusy || phase === 'promotion' || Boolean(trainingPromotion)}
          onClick={() => void switchAppMode('play')}
        >
          <strong>Play & Coach</strong>
          <span>Game, history, variations and explanations</span>
        </button>
        <button
          type="button"
          className={appMode === 'training' ? 'active' : ''}
          disabled={analysisBusy || phase === 'promotion' || Boolean(trainingPromotion)}
          onClick={() => void switchAppMode('training')}
        >
          <strong>Training</strong>
          <span>Find stronger moves from your reviewed games</span>
        </button>
      </nav>

      <div className={`workspace ${appMode === 'training' ? 'training-workspace' : ''}`}>
        {appMode === 'play' ? (
          <>
        <section className="board-column">
          <div className="game-toolbar panel">
            <label>
              Opponent
              <select
                value={difficultyId}
                disabled={analysisBusy || phase === 'promotion'}
                onChange={(event) => setDifficultyId(event.target.value)}
              >
                {difficulties.map((item) => (
                  <option value={item.id} key={item.id}>{item.label} — {item.description}</option>
                ))}
              </select>
            </label>

            <div className="segmented-control" aria-label="Choose side">
              <button
                type="button"
                className={humanColor === 'w' ? 'active' : ''}
                onClick={() => void startNewGame('w')}
              >White</button>
              <button
                type="button"
                className={humanColor === 'b' ? 'active' : ''}
                onClick={() => void startNewGame('b')}
              >Black</button>
            </div>

            <button type="button" onClick={() => void startNewGame()}>New game</button>
            <button type="button" onClick={undoTurn} disabled={!hasHumanMove}>Undo turn</button>
            <button type="button" onClick={() => setOrientation((value) => value === 'white' ? 'black' : 'white')}>Flip</button>
          </div>

          <div className="board-frame">
            <div className="player-strip opponent-strip">
              <div className="avatar">SF</div>
              <div><strong>Stockfish</strong><span>{difficulty.label} · {difficulty.description}</span></div>
            </div>

            {isHistoryView && (
              <div className="history-mode-banner">
                <div>
                  <span>History mode</span>
                  <strong>{historyLabel}</strong>
                </div>
                <div className="history-mode-actions">
                  <button type="button" className="history-variation-button" onClick={() => void createVariationFromHistory()}>Create variation</button>
                  <button type="button" className="history-play-button" onClick={() => void playFromHistory()}>Play from here</button>
                  <button type="button" onClick={() => void navigateHistory(null)}>Return to live</button>
                </div>
              </div>
            )}

            <ChessBoard
              game={game}
              orientation={orientation}
              selected={selected}
              legalTargets={legalTargets}
              lastMove={lastMove}
              disabled={boardDisabled}
              engineThinking={engineThinking}
              engineMoveAnimation={engineMoveAnimation}
              onSquareClick={onSquareClick}
              onPieceDragStart={onPieceDragStart}
              onPieceDragCancel={onPieceDragCancel}
              onPieceDrop={onPieceDrop}
            />

            <div className="player-strip">
              <div className="avatar human">You</div>
              <div><strong>Student</strong><span>Playing {humanColor === 'w' ? 'White' : 'Black'}</span></div>
              <span className={`game-state ${boardStatusClass}`}>
                {(batchReviewing || phase === 'engine-thinking' || phase === 'reviewing') && <span className="mini-spinner" aria-hidden="true" />}
                {boardStatusText}
              </span>
            </div>
          </div>
        </section>

        <aside className="side-column">
          <section className="panel action-panel">
            <div className="panel-heading compact">
              <div>
                <span className="eyebrow">Analysis</span>
                <h2>Position tools</h2>
              </div>
              <div className="evaluation-badge">{currentEvaluation}</div>
            </div>
            <div className="button-grid">
              <button
                type="button"
                className="primary-button"
                onClick={() => void analyseCurrentPosition()}
                disabled={analysisBusy || phase === 'promotion' || !engineStatus?.configured}
              >
                Analyze position
              </button>
              <button
                type="button"
                onClick={() => void reviewAllUnreviewedMoves()}
                disabled={analysisBusy || phase === 'promotion' || !engineStatus?.configured || records.length === 0}
              >
                {batchReviewing ? 'Reviewing…' : 'Review all moves'}
              </button>
              <button type="button" onClick={() => void copyPgn()} disabled={records.length === 0}>Copy PGN</button>
              <button type="button" onClick={() => void chooseEngine()} disabled={analysisBusy || phase === 'promotion'}>Change engine</button>
            </div>
          </section>

          <section className="panel history-panel">
            <div className="panel-heading compact">
              <div>
                <span className="eyebrow">Game</span>
                <h2>Move history</h2>
              </div>
              <span className="move-count">{records.length} plies</span>
            </div>

            <div className="line-manager">
              <div className="current-line-card">
                <div>
                  <span>Current line</span>
                  <strong>{currentLine.name}</strong>
                </div>
                <small>{currentLine.originPly === null ? 'Original game' : `Branched at ply ${currentLine.originPly}`}</small>
              </div>
              {inactiveLines.length > 0 && (
                <div className="saved-line-list" aria-label="Saved game lines">
                  {inactiveLines
                    .slice()
                    .sort((a, b) => a.id - b.id)
                    .map((line) => (
                      <button
                        type="button"
                        key={line.id}
                        onClick={() => void switchToLine(line.id)}
                        disabled={analysisBusy || phase === 'promotion'}
                        title={`Switch to ${line.name}`}
                      >
                        <span>{line.name}</span>
                        <small>{line.records.length} plies</small>
                      </button>
                    ))}
                </div>
              )}
            </div>

            <div className="review-progress">
              <span>{reviewedCount}/{records.length} reviewed</span>
              <strong>{mistakeCount} {mistakeCount === 1 ? 'issue' : 'issues'}</strong>
            </div>

            <MoveList
              records={records}
              activeId={activeReviewId}
              viewedPly={historyCursor}
              disabled={analysisBusy || phase === 'promotion'}
              onNavigate={(ply) => void navigateHistory(ply)}
              onPreviousMistake={goToPreviousMistake}
              onNextMistake={goToNextMistake}
              previousMistakeAvailable={previousMistake !== null}
              nextMistakeAvailable={nextMistake !== null}
            />
          </section>

          <CoachPanel
            review={review}
            loading={coachLoading}
            error={coachError}
            currentAnalysis={currentAnalysis}
            currentFen={currentAnalysisFen ?? game.fen()}
            coachAnswer={coachAnswer}
            alternativeReview={alternativeReview}
            trainerLoading={trainerLoading}
            trainerError={trainerError}
            onAsk={askCoach}
            onCompareAlternative={(move) => void compareAlternativeMove(move)}
            chatTurns={chatTurns}
            chatLoading={chatLoading}
            onChatSubmit={(question) => void askConversationalCoach(question)}
            ollamaStatus={ollamaStatus}
            ollamaEnabled={ollamaEnabled}
            ollamaModel={ollamaModel}
            ollamaChecking={ollamaChecking}
            onOllamaToggle={(enabled) => setOllamaEnabled(enabled && Boolean(ollamaStatus?.available && ollamaModel))}
            onOllamaModelChange={setOllamaModel}
            onRefreshOllama={() => void refreshOllamaStatus()}
          />
        </aside>
          </>
        ) : (
          <>
            <section className="board-column">
              <div className="game-toolbar training-toolbar panel">
                <label>
                  Source
                  <select
                    value={trainingSource}
                    disabled={trainingLoading}
                    onChange={(event) => changeTrainingSource(event.target.value as TrainingSource)}
                  >
                    <option value="mistakes">My mistakes — {trainingMistakeCount}</option>
                    <option value="reviewed">All reviewed — {trainingReviewedCount}</option>
                  </select>
                </label>
                <button type="button" onClick={() => moveTrainingExercise(-1)} disabled={trainingLoading || trainingExercises.length < 2}>‹ Previous</button>
                <button type="button" onClick={() => resetTrainingBoard(true)} disabled={trainingLoading || !trainingExercise}>Retry</button>
                <button type="button" onClick={() => moveTrainingExercise(1)} disabled={trainingLoading || trainingExercises.length < 2}>Next ›</button>
                <button type="button" onClick={() => setOrientation((value) => value === 'white' ? 'black' : 'white')}>Flip</button>
              </div>

              <div className="board-frame">
                <div className="player-strip opponent-strip training-strip">
                  <div className="avatar">T</div>
                  <div>
                    <strong>Training position</strong>
                    <span>{trainingExercise ? `Exercise ${trainingExerciseIndex + 1} of ${trainingExercises.length}` : 'No exercise selected'}</span>
                  </div>
                </div>

                <ChessBoard
                  game={trainingGameRef.current}
                  orientation={orientation}
                  selected={trainingSelected}
                  legalTargets={trainingLegalTargets}
                  lastMove={trainingLastMove}
                  disabled={trainingBoardDisabled}
                  engineThinking={trainingLoading}
                  engineMoveAnimation={null}
                  onSquareClick={onTrainingSquareClick}
                  onPieceDragStart={onTrainingDragStart}
                  onPieceDragCancel={onTrainingDragCancel}
                  onPieceDrop={onTrainingDrop}
                />

                <div className="player-strip">
                  <div className="avatar human">You</div>
                  <div>
                    <strong>Find the best move</strong>
                    <span>{trainingExercise ? `${trainingGameRef.current.turn() === 'w' ? 'White' : 'Black'} to move` : 'Review a game to create exercises'}</span>
                  </div>
                  <span className={`game-state ${trainingLoading ? 'thinking' : trainingAttempt?.accepted ? 'your-turn' : trainingAttempt ? 'check' : ''}`}>
                    {trainingLoading && <span className="mini-spinner" aria-hidden="true" />}
                    {trainingLoading
                      ? 'Stockfish checking…'
                      : trainingAttempt
                        ? `${trainingAttempt.review.verdict} · ${trainingAttempt.points} pts`
                        : trainingExercise
                          ? 'Your move'
                          : 'No positions'}
                  </span>
                </div>
              </div>
            </section>

            <aside className="side-column training-side-column">
              <TrainingPanel
                source={trainingSource}
                mistakeCount={trainingMistakeCount}
                reviewedCount={trainingReviewedCount}
                exercise={trainingExercise}
                exerciseIndex={trainingExerciseIndex}
                exerciseCount={trainingExercises.length}
                hintLevel={trainingHintLevel}
                attempt={trainingAttempt}
                loading={trainingLoading}
                sessionAttempts={trainingAttempts}
                sessionSolved={trainingSolvedKeys.length}
                sessionScore={trainingScore}
                onSourceChange={changeTrainingSource}
                onHint={revealTrainingHint}
                onShowAnswer={showTrainingAnswer}
                onRetry={() => resetTrainingBoard(true)}
                onPrevious={() => moveTrainingExercise(-1)}
                onNext={() => moveTrainingExercise(1)}
              />

              <section className="panel training-help-panel">
                <span className="eyebrow">How it works</span>
                <h2>Your games become exercises</h2>
                <p>Training never changes the live game. Switch back to Play & Coach at any time and your board, history, saved variations and coaching remain exactly where you left them.</p>
                <p><strong>Best / Excellent</strong> counts as solved. Hints reduce the score, while Retry lets you calculate the same position again.</p>
              </section>
            </aside>
          </>
        )}
      </div>

      {promotion && appMode === 'play' && (
        <PromotionDialog
          color={humanColor}
          onCancel={cancelPromotion}
          onSelect={(piece) => void performHumanMove(promotion.from, promotion.to, piece)}
        />
      )}

      {trainingPromotion && appMode === 'training' && (
        <PromotionDialog
          color={trainingGameRef.current.turn()}
          onCancel={() => { setTrainingPromotion(null); setTrainingSelected(null); }}
          onSelect={(piece) => void evaluateTrainingMove(trainingPromotion.from, trainingPromotion.to, piece)}
        />
      )}
    </main>
  );
}
