import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Move, type Square } from 'chess.js';
import { ChessBoard } from './components/ChessBoard';
import { CoachPanel } from './components/CoachPanel';
import { MoveList, type PlyRecord } from './components/MoveList';
import { PromotionDialog } from './components/PromotionDialog';
import { TrainingPanel } from './components/TrainingPanel';
import { ImportGameDialog } from './components/ImportGameDialog';
import { GameReviewSummary } from './components/GameReviewSummary';
import { EvaluationTimeline } from './components/EvaluationTimeline';
import { OpeningExplorerPanel } from './components/OpeningExplorerPanel';
import { OpeningMemoryPanel } from './components/OpeningMemoryPanel';
import { WeaknessProfilePanel } from './components/WeaknessProfilePanel';
import { SpacedRepetitionPanel } from './components/SpacedRepetitionPanel';
import { TrainingAnalyticsPanel } from './components/TrainingAnalyticsPanel';
import { DailyStudyPlannerPanel } from './components/DailyStudyPlannerPanel';
import { DailySessionReportPanel } from './components/DailySessionReportPanel';
import { WeeklyCoachPanel } from './components/WeeklyCoachPanel';
import { GoalBasedTrainingPanel } from './components/GoalBasedTrainingPanel';
import { PersonalCoachDashboard } from './components/PersonalCoachDashboard';
import { DataManagementPanel } from './components/DataManagementPanel';
import { UiTextSizeControl } from './components/UiTextSizeControl';
import { ReviewProgressPanel } from './components/ReviewProgressPanel';
import {
  buildAnalysisBoardIdeas,
  buildReviewBoardIdeas,
  buildSquareControlOverlay,
  explainBoardIdea,
  explainBoardSquare,
  type BoardArrow,
  type BoardIdeaExplanation,
  type BoardIdeaTarget,
  type InspectionOverlayMode,
} from './lib/boardIdeas';
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
import { parseFen, parsePgn } from './lib/gameImport';
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
import {
  PV_SPEEDS,
  clampPvIndex,
  pvAnimationDuration,
  pvStepGap,
  replayPvPosition,
  sanitizePvLine,
  type PvSpeed,
} from './lib/pvStudy';
import type { MoveComparisonFocus } from './lib/moveComparison';
import {
  recognizeOpening,
  type OpeningAlternative,
  type OpeningRecognition,
} from './lib/openingBook';
import {
  WEAKNESS_STORAGE_KEY,
  loadWeaknessMemory,
  recordOpeningDeviationWeakness,
  recordReviewedMoveWeakness,
  serializeWeaknessMemory,
  weakestCategory,
  weaknessTrainingExamples,
  type WeaknessCategoryId,
  type WeaknessMemory,
} from './lib/weaknessProfile';
import {
  REPERTOIRE_STORAGE_KEY,
  loadRepertoireMemory,
  recordOpeningDeviation,
  recordRepertoirePractice,
  removeRepertoireChoice,
  repertoireChoiceForFen,
  saveRepertoireChoice,
  serializeRepertoireMemory,
  updateOpeningDeviationReview,
  type OpeningDeviationMemory,
  type RepertoireMemory,
} from './lib/repertoireMemory';
import {
  buildAdaptiveDailyStudyPlan,
  type DailyStudyDuration,
} from './lib/dailyStudyPlanner';
import {
  DAILY_SESSION_REPORT_STORAGE_KEY,
  appendDailySessionAttempt,
  beginDailyStudySession,
  buildDailySessionReport,
  dailySessionAttemptedCount,
  latestDailySessionReport,
  loadDailySessionReportMemory,
  saveDailySessionReport,
  serializeDailySessionReportMemory,
  type ActiveDailyStudySession,
  type DailySessionReportMemory,
} from './lib/dailySessionReport';
import {
  GOAL_PLAN_STORAGE_KEY,
  completeActiveGoal,
  createGoalPlan,
  emptyGoalPlanMemory,
  goalPriorityProfile,
  loadGoalPlanMemory,
  pauseActiveGoal,
  resumeGoal,
  serializeGoalPlanMemory,
  type GoalPlanCreateInput,
  type GoalPlanMemory,
} from './lib/goalPlans';
import {
  WEEKLY_COACH_STORAGE_KEY,
  activeWeeklyPriorityProfile,
  buildLiveWeeklyCoachReport,
  emptyWeeklyCoachMemory,
  loadWeeklyCoachMemory,
  serializeWeeklyCoachMemory,
  syncWeeklyCoachMemory,
  type WeeklyCoachMemory,
} from './lib/weeklyCoach';
import {
  TRAINING_ANALYTICS_STORAGE_KEY,
  loadTrainingAnalyticsMemory,
  recordTrainingAnalyticsEvent,
  serializeTrainingAnalyticsMemory,
  type TrainingAnalyticsMemory,
} from './lib/trainingAnalytics';
import {
  SPACED_REPETITION_STORAGE_KEY,
  dueSpacedItems,
  loadSpacedRepetitionMemory,
  recordSpacedAttempt,
  serializeSpacedRepetitionMemory,
  spacedItemToTrainingExercise,
  syncSpacedRepetitionMemory,
  type SpacedRepetitionMemory,
} from './lib/spacedRepetition';
import {
  backupFileName,
  createCoachBackup,
  inspectCoachBackup,
  restoreCoachBackup,
  serializeCoachBackup,
} from './lib/dataBackup';
import {
  UI_FONT_SIZE_STORAGE_KEY,
  loadUiFontSize,
  serializeUiFontSize,
  type UiFontSize,
} from './lib/uiPreferences';
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

interface PrincipalVariationPreview {
  label: string;
  startFen: string;
  line: string[];
  index: number;
  total: number;
  playing: boolean;
  speed: PvSpeed;
}

interface LineMeta {
  id: number;
  name: string;
  originPly: number | null;
}

interface LineSnapshot extends LineMeta {
  records: PlyRecord[];
  startFen: string;
}

interface ChatTurn {
  id: number;
  question: string;
  answer: ConversationAnswer | null;
  error: string | null;
}

const DEFAULT_START_FEN = new Chess().fen();

function gameMessage(game: Chess): string {
  if (game.isCheckmate()) return `${game.turn() === 'w' ? 'Black' : 'White'} wins by checkmate`;
  if (game.isStalemate()) return 'Draw by stalemate';
  if (game.isThreefoldRepetition()) return 'Draw by repetition';
  if (game.isInsufficientMaterial()) return 'Draw by insufficient material';
  if (game.isDraw()) return 'Draw';
  return `${game.turn() === 'w' ? 'White' : 'Black'} to move${game.isCheck() ? ' — check' : ''}`;
}

function replayRecords(records: PlyRecord[], startFen: string = DEFAULT_START_FEN): Chess {
  const rebuilt = new Chess(startFen);
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
  const pvGameRef = useRef(new Chess());
  const pvPlaybackRef = useRef(0);
  const nextRecordId = useRef(1);
  const sessionRef = useRef(1);
  const analysisRequestRef = useRef(0);
  const nextLineId = useRef(2);
  const nextVariationNumber = useRef(1);
  const nextChatId = useRef(1);
  const observedOpeningDeviationsRef = useRef(new Set<string>());
  const observedWeaknessReviewsRef = useRef(new Set<string>());
  const weaknessGameSessionRef = useRef(1);
  const [revision, setRevision] = useState(0);
  const [trainingRevision, setTrainingRevision] = useState(0);
  const [pvRevision, setPvRevision] = useState(0);
  const [pvPreview, setPvPreview] = useState<PrincipalVariationPreview | null>(null);
  const [pvLastMove, setPvLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [showBoardIdeas, setShowBoardIdeas] = useState(true);
  const [ideaInspection, setIdeaInspection] = useState(false);
  const [boardIdeaExplanation, setBoardIdeaExplanation] = useState<BoardIdeaExplanation | null>(null);
  const [inspectedSquare, setInspectedSquare] = useState<Square | null>(null);
  const [inspectionOverlayMode, setInspectionOverlayMode] = useState<InspectionOverlayMode>('all');
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
  const [openingTrainingExercise, setOpeningTrainingExercise] = useState<TrainingExercise | null>(null);
  const [weaknessTrainingExercises, setWeaknessTrainingExercises] = useState<TrainingExercise[]>([]);
  const [weaknessMemory, setWeaknessMemory] = useState<WeaknessMemory>(() => {
    if (typeof window === 'undefined') return loadWeaknessMemory(null);
    return loadWeaknessMemory(window.localStorage.getItem(WEAKNESS_STORAGE_KEY));
  });
  const [spacedMemory, setSpacedMemory] = useState<SpacedRepetitionMemory>(() => {
    if (typeof window === 'undefined') return loadSpacedRepetitionMemory(null);
    return loadSpacedRepetitionMemory(window.localStorage.getItem(SPACED_REPETITION_STORAGE_KEY));
  });
  const [trainingAnalytics, setTrainingAnalytics] = useState<TrainingAnalyticsMemory>(() => {
    if (typeof window === 'undefined') return loadTrainingAnalyticsMemory(null);
    return loadTrainingAnalyticsMemory(window.localStorage.getItem(TRAINING_ANALYTICS_STORAGE_KEY));
  });
  const [spacedTrainingExercises, setSpacedTrainingExercises] = useState<TrainingExercise[]>([]);
  const [dailyTrainingExercises, setDailyTrainingExercises] = useState<TrainingExercise[]>([]);
  const [dailyStudyDuration, setDailyStudyDuration] = useState<DailyStudyDuration>(20);
  const [activeDailySession, setActiveDailySession] = useState<ActiveDailyStudySession | null>(null);
  const [dailySessionReports, setDailySessionReports] = useState<DailySessionReportMemory>(() => {
    if (typeof window === 'undefined') return loadDailySessionReportMemory(null);
    return loadDailySessionReportMemory(window.localStorage.getItem(DAILY_SESSION_REPORT_STORAGE_KEY));
  });
  const [weeklyCoachMemory, setWeeklyCoachMemory] = useState<WeeklyCoachMemory>(() => {
    if (typeof window === 'undefined') return emptyWeeklyCoachMemory();
    return loadWeeklyCoachMemory(window.localStorage.getItem(WEEKLY_COACH_STORAGE_KEY));
  });
  const [goalPlanMemory, setGoalPlanMemory] = useState<GoalPlanMemory>(() => {
    if (typeof window === 'undefined') return emptyGoalPlanMemory();
    return loadGoalPlanMemory(window.localStorage.getItem(GOAL_PLAN_STORAGE_KEY));
  });
  const [schedulerNow, setSchedulerNow] = useState(() => Date.now());
  const [lastBackupAt, setLastBackupAt] = useState<number | null>(null);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [repertoireMemory, setRepertoireMemory] = useState<RepertoireMemory>(() => {
    if (typeof window === 'undefined') return { version: 1, choices: {}, deviations: {} };
    return loadRepertoireMemory(window.localStorage.getItem(REPERTOIRE_STORAGE_KEY));
  });
  const [records, setRecords] = useState<PlyRecord[]>([]);
  const [currentStartFen, setCurrentStartFen] = useState(DEFAULT_START_FEN);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
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
  const [uiFontSize, setUiFontSize] = useState<UiFontSize>(() => {
    if (typeof window === 'undefined') return 'regular';
    return loadUiFontSize(window.localStorage.getItem(UI_FONT_SIZE_STORAGE_KEY));
  });
  const [review, setReview] = useState<MoveReview | null>(null);
  const [activeReviewId, setActiveReviewId] = useState<number | null>(null);
  const [moveComparisonFocus, setMoveComparisonFocus] = useState<MoveComparisonFocus>('both');
  const [coachLoading, setCoachLoading] = useState(false);
  const [batchReviewing, setBatchReviewing] = useState(false);
  const [batchReviewProgress, setBatchReviewProgress] = useState<{ current: number; total: number; san: string } | null>(null);
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
  const analysisBusy = phase === 'engine-thinking' || phase === 'reviewing' || batchReviewing || trainerLoading || chatLoading || trainingLoading || Boolean(pvPreview);
  const trainingExercises = useMemo<TrainingExercise[]>(() => {
    if (trainingSource === 'opening') return openingTrainingExercise ? [openingTrainingExercise] : [];
    if (trainingSource === 'weakness') return weaknessTrainingExercises;
    if (trainingSource === 'due') return spacedTrainingExercises;
    if (trainingSource === 'daily') return dailyTrainingExercises;

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
        kind: 'review' as const,
      }];
    });
  }, [records, humanColor, trainingSource, currentLine.id, openingTrainingExercise, weaknessTrainingExercises, spacedTrainingExercises, dailyTrainingExercises]);
  const trainingExerciseIndex = trainingExercises.length ? Math.min(trainingIndex, trainingExercises.length - 1) : 0;
  const trainingExercise = trainingExercises[trainingExerciseIndex] ?? null;
  const trainingMistakeCount = records.filter((record) => record.color === humanColor && isTrainingIssue(record.review) && record.review?.bestMoveUci).length;
  const trainingReviewedCount = records.filter((record) => record.color === humanColor && record.review?.bestMoveUci).length;
  const trainingOpeningCount = openingTrainingExercise ? 1 : 0;
  const trainingWeaknessCount = weaknessTrainingExercises.length;
  const spacedDueItems = useMemo(
    () => dueSpacedItems(spacedMemory, schedulerNow, 20),
    [spacedMemory, schedulerNow],
  );
  const trainingDueCount = spacedDueItems.length;
  const liveWeeklyCoachReport = useMemo(
    () => buildLiveWeeklyCoachReport(trainingAnalytics, schedulerNow),
    [trainingAnalytics, schedulerNow],
  );
  const activeWeeklyPriorities = useMemo(
    () => activeWeeklyPriorityProfile(weeklyCoachMemory, schedulerNow),
    [weeklyCoachMemory, schedulerNow],
  );
  const activeGoalPriorities = useMemo(
    () => goalPriorityProfile(goalPlanMemory, weaknessMemory),
    [goalPlanMemory, weaknessMemory],
  );
  const goalOpeningOptions = useMemo(
    () => [...new Set([
      ...trainingAnalytics.events.map((event) => event.openingName).filter((value): value is string => Boolean(value)),
      ...Object.values(repertoireMemory.choices).map((choice) => choice.variation
        ? `${choice.openingName} · ${choice.variation}`
        : choice.openingName),
    ])].sort(),
    [trainingAnalytics, repertoireMemory],
  );
  const goalWeaknessOptions = useMemo(
    () => [...new Set([
      ...trainingAnalytics.events.map((event) => event.weaknessLabel).filter((value): value is string => Boolean(value)),
      ...Object.values(weaknessMemory.categories)
        .filter((category) => category.occurrences > 0)
        .map((category) => category.examples[0]?.weaknessLabel)
        .filter((value): value is string => Boolean(value)),
    ])].sort(),
    [trainingAnalytics, weaknessMemory],
  );
  const dailyStudyPlan = useMemo(
    () => buildAdaptiveDailyStudyPlan({
      durationMinutes: dailyStudyDuration,
      now: schedulerNow,
      spacedMemory,
      weaknessMemory,
      records,
      humanColor,
      weeklyPriorityMultipliers: activeWeeklyPriorities.multipliers,
      weeklyPriorityReasons: activeWeeklyPriorities.reasons,
      goalPriorityMultipliers: activeGoalPriorities.multipliers,
      goalPriorityReasons: activeGoalPriorities.reasons,
    }),
    [dailyStudyDuration, schedulerNow, spacedMemory, weaknessMemory, records, humanColor, activeWeeklyPriorities, activeGoalPriorities],
  );
  const trainingDailyCount = dailyTrainingExercises.length || dailyStudyPlan.items.length;
  const dailyAttemptedCount = dailySessionAttemptedCount(activeDailySession);
  const latestDailyReport = latestDailySessionReport(dailySessionReports);
  const trainingScore = Object.values(trainingBestScores).reduce((sum, value) => sum + value, 0);
  const isHistoryView = historyCursor !== null;
  const visiblePly = historyCursor ?? records.length;
  const openingRecognition = useMemo<OpeningRecognition | null>(() => {
    if (currentStartFen !== DEFAULT_START_FEN) return null;
    return recognizeOpening(records.slice(0, visiblePly).map((record) => record.uci));
  }, [records, visiblePly, currentStartFen]);
  const currentRepertoireChoice = useMemo(
    () => openingRecognition ? repertoireChoiceForFen(repertoireMemory, openingRecognition.explorerFen) : null,
    [repertoireMemory, openingRecognition],
  );
  const openingDeviationReview = useMemo(() => {
    const deviation = openingRecognition?.deviation;
    if (!deviation) return undefined;
    return records[deviation.ply - 1]?.review;
  }, [openingRecognition, records]);
  const openingGuideArrows = useMemo<BoardArrow[]>(() => {
    if (!showBoardIdeas || !openingRecognition?.withinBook) return [];

    const arrows: BoardArrow[] = [];
    const topBookMove = openingRecognition.alternatives[0];
    if (topBookMove) {
      arrows.push({
        id: `opening-book-${openingRecognition.matchedPly}-${topBookMove.uci}`,
        from: topBookMove.uci.slice(0, 2) as Square,
        to: topBookMove.uci.slice(2, 4) as Square,
        kind: 'book',
        label: `Local book · ${topBookMove.san}`,
        detail: `${topBookMove.san} is the highest-weight continuation in the bundled local opening book at this position (${topBookMove.localShare}% local share). This is book guidance, not a Stockfish score.`,
        offset: 0.9,
      });
    }

    if (currentRepertoireChoice) {
      arrows.push({
        id: `opening-repertoire-${openingRecognition.matchedPly}-${currentRepertoireChoice.moveUci}`,
        from: currentRepertoireChoice.moveUci.slice(0, 2) as Square,
        to: currentRepertoireChoice.moveUci.slice(2, 4) as Square,
        kind: 'repertoire',
        label: `My repertoire · ${currentRepertoireChoice.moveSan}`,
        detail: `${currentRepertoireChoice.moveSan} is your saved repertoire move for this exact opening position. It may agree with or differ from Stockfish and the bundled book.`,
        offset: -0.9,
      });
    }

    return arrows;
  }, [showBoardIdeas, openingRecognition, currentRepertoireChoice]);
  const game = useMemo(
    () => historyCursor === null ? gameRef.current : replayRecords(records.slice(0, historyCursor), currentStartFen),
    [historyCursor, records, revision, currentStartFen],
  );
  const displayGame = pvPreview ? pvGameRef.current : game;
  const boardIdeas = useMemo(() => {
    if (!showBoardIdeas || pvPreview) return { arrows: [], highlights: [] };
    if (review) return buildReviewBoardIdeas(review);
    return buildAnalysisBoardIdeas(currentAnalysis, currentAnalysisFen ?? game.fen());
  }, [showBoardIdeas, pvPreview, review, currentAnalysis, currentAnalysisFen, game, revision, pvRevision]);
  const inspectionOverlay = useMemo(() => {
    if (!ideaInspection || !inspectedSquare || pvPreview) return null;
    return buildSquareControlOverlay(game.fen(), inspectedSquare, inspectionOverlayMode);
  }, [ideaInspection, inspectedSquare, inspectionOverlayMode, pvPreview, game, revision, historyCursor, records]);
  const comparisonBoardArrows = useMemo(() => {
    if (!review || moveComparisonFocus === 'both') return boardIdeas.arrows;
    if (moveComparisonFocus === 'best') {
      return boardIdeas.arrows.filter((arrow) => arrow.id === 'review-best');
    }
    return boardIdeas.arrows.filter((arrow) => arrow.id === 'review-played');
  }, [boardIdeas.arrows, review, moveComparisonFocus]);
  const displayBoardArrows = useMemo(
    () => [...comparisonBoardArrows, ...openingGuideArrows, ...(inspectionOverlay?.arrows ?? [])],
    [comparisonBoardArrows, openingGuideArrows, inspectionOverlay],
  );
  const displayBoardHighlights = useMemo(
    () => review && moveComparisonFocus !== 'both' ? [] : boardIdeas.highlights,
    [review, moveComparisonFocus, boardIdeas.highlights],
  );

  useEffect(() => {
    setMoveComparisonFocus('both');
  }, [activeReviewId]);

  function inspectBoardIdea(target: BoardIdeaTarget): void {
    const explanation = explainBoardIdea(target);
    setBoardIdeaExplanation(explanation);
    setStatusText(`Board idea · ${explanation.title}`);
  }

  function inspectBoardSquare(square: Square): void {
    const explanation = explainBoardSquare(game.fen(), square);
    setInspectedSquare(square);
    setInspectionOverlayMode('all');
    setBoardIdeaExplanation(explanation);
    setStatusText(`Board inspection · ${explanation.title}`);
  }

  function toggleIdeaInspection(): void {
    setIdeaInspection((current) => {
      const next = !current;
      if (!next) {
        setBoardIdeaExplanation(null);
        setInspectedSquare(null);
        setInspectionOverlayMode('all');
      }
      setSelected(null);
      setStatusText(next ? 'Board inspection · click any square, piece, highlight, or arrow' : gameMessage(gameRef.current));
      return next;
    });
  }

  useEffect(() => {
    window.localStorage.setItem(REPERTOIRE_STORAGE_KEY, serializeRepertoireMemory(repertoireMemory));
  }, [repertoireMemory]);

  useEffect(() => {
    window.localStorage.setItem(UI_FONT_SIZE_STORAGE_KEY, serializeUiFontSize(uiFontSize));
  }, [uiFontSize]);

  useEffect(() => {
    window.localStorage.setItem(WEAKNESS_STORAGE_KEY, serializeWeaknessMemory(weaknessMemory));
  }, [weaknessMemory]);

  useEffect(() => {
    const now = Date.now();
    setSpacedMemory((current) => syncSpacedRepetitionMemory(
      current,
      repertoireMemory,
      weaknessMemory,
      now,
    ));
    setSchedulerNow(now);
  }, [repertoireMemory, weaknessMemory]);

  useEffect(() => {
    window.localStorage.setItem(SPACED_REPETITION_STORAGE_KEY, serializeSpacedRepetitionMemory(spacedMemory));
  }, [spacedMemory]);

  useEffect(() => {
    window.localStorage.setItem(TRAINING_ANALYTICS_STORAGE_KEY, serializeTrainingAnalyticsMemory(trainingAnalytics));
  }, [trainingAnalytics]);

  useEffect(() => {
    window.localStorage.setItem(DAILY_SESSION_REPORT_STORAGE_KEY, serializeDailySessionReportMemory(dailySessionReports));
  }, [dailySessionReports]);

  useEffect(() => {
    setWeeklyCoachMemory((current) => syncWeeklyCoachMemory(current, trainingAnalytics, schedulerNow));
  }, [trainingAnalytics, schedulerNow]);

  useEffect(() => {
    window.localStorage.setItem(WEEKLY_COACH_STORAGE_KEY, serializeWeeklyCoachMemory(weeklyCoachMemory));
  }, [weeklyCoachMemory]);

  useEffect(() => {
    window.localStorage.setItem(GOAL_PLAN_STORAGE_KEY, serializeGoalPlanMemory(goalPlanMemory));
  }, [goalPlanMemory]);

  useEffect(() => {
    const timer = window.setInterval(() => setSchedulerNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const unseen = records.filter((record) => {
      if (record.color !== humanColor || !record.review) return false;
      const token = `${weaknessGameSessionRef.current}:${record.id}:${record.beforeFen}:${record.uci}`;
      return !observedWeaknessReviewsRef.current.has(token);
    });
    if (!unseen.length) return;

    setWeaknessMemory((current) => {
      let next = current;
      for (const record of unseen) {
        const token = `${weaknessGameSessionRef.current}:${record.id}:${record.beforeFen}:${record.uci}`;
        if (observedWeaknessReviewsRef.current.has(token) || !record.review) continue;
        observedWeaknessReviewsRef.current.add(token);
        next = recordReviewedMoveWeakness(next, {
          observationId: token,
          ply: record.ply,
          san: record.san,
          review: record.review,
        });
      }
      return next;
    });
  }, [records, humanColor]);

  useEffect(() => {
    if (historyCursor !== null || !openingRecognition?.deviation) return;
    const deviation = openingRecognition.deviation;
    const token = `${currentLine.id}:${deviation.ply}:${deviation.uci}`;
    if (observedOpeningDeviationsRef.current.has(token)) return;
    observedOpeningDeviationsRef.current.add(token);
    const reviewAtDeviation = records[deviation.ply - 1]?.review;
    setRepertoireMemory((current) => recordOpeningDeviation(
      current,
      openingRecognition,
      reviewAtDeviation,
    ));
    setWeaknessMemory((current) => recordOpeningDeviationWeakness(
      current,
      openingRecognition,
      reviewAtDeviation,
      `opening:${weaknessGameSessionRef.current}:${currentLine.id}:${deviation.ply}:${deviation.uci}`,
    ));
  }, [historyCursor, openingRecognition?.deviation?.ply, openingRecognition?.deviation?.uci, currentLine.id]);

  useEffect(() => {
    if (!openingRecognition?.deviation || !openingDeviationReview) return;
    setRepertoireMemory((current) => updateOpeningDeviationReview(
      current,
      openingRecognition,
      openingDeviationReview,
    ));
  }, [openingRecognition?.deviation?.uci, openingDeviationReview?.verdict, openingDeviationReview?.centipawnLoss]);

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
    const trainingSide = trainingGameRef.current.turn();
    setOrientation(trainingExercise.kind === 'opening' || trainingExercise.kind === 'weakness'
      ? (trainingSide === 'w' ? 'white' : 'black')
      : (humanColor === 'w' ? 'white' : 'black'));
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
  const displayLastMove = pvPreview ? pvLastMove : lastMove;

  const liveGame = gameRef.current;
  const humanTurn = liveGame.turn() === humanColor;
  const boardDisabled = Boolean(pvPreview) || isHistoryView || batchReviewing || phase !== 'player-turn' || !humanTurn || liveGame.isGameOver() || !engineStatus?.configured;
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

  function applyPrincipalVariationPosition(preview: PrincipalVariationPreview, requestedIndex: number): number {
    const target = clampPvIndex(requestedIndex, preview.total);
    const replayed = replayPvPosition(preview.startFen, preview.line, target);

    try {
      pvGameRef.current = new Chess(replayed.fen);
    } catch {
      return preview.index;
    }

    setPvLastMove(replayed.lastMove);
    setEngineMoveAnimation(null);
    setPvRevision((value) => value + 1);
    return replayed.index;
  }

  function stopPrincipalVariationPreview(): void {
    pvPlaybackRef.current += 1;
    setPvPreview(null);
    setPvLastMove(null);
    setEngineMoveAnimation(null);
    setPvRevision((value) => value + 1);
  }

  function setPrincipalVariationIndex(requestedIndex: number): void {
    if (!pvPreview) return;
    const index = applyPrincipalVariationPosition(pvPreview, requestedIndex);
    setPvPreview({ ...pvPreview, index, playing: false });
  }

  function stepPrincipalVariation(delta: number): void {
    if (!pvPreview) return;
    setPrincipalVariationIndex(pvPreview.index + delta);
  }

  function jumpPrincipalVariation(position: 'start' | 'end'): void {
    if (!pvPreview) return;
    setPrincipalVariationIndex(position === 'start' ? 0 : pvPreview.total);
  }

  function restartPrincipalVariation(): void {
    if (!pvPreview) return;
    setPrincipalVariationIndex(0);
  }

  function togglePrincipalVariationPlayback(): void {
    if (!pvPreview) return;

    if (pvPreview.playing) {
      setEngineMoveAnimation(null);
      setPvPreview({ ...pvPreview, playing: false });
      return;
    }

    if (pvPreview.index >= pvPreview.total) {
      const index = applyPrincipalVariationPosition(pvPreview, 0);
      setPvPreview({ ...pvPreview, index, playing: true });
      return;
    }

    setPvPreview({ ...pvPreview, playing: true });
  }

  function setPrincipalVariationSpeed(speed: PvSpeed): void {
    if (!PV_SPEEDS.includes(speed)) return;
    setPvPreview((current) => current ? { ...current, speed } : current);
  }

  async function playPrincipalVariation(fen: string, line: string[], label: string): Promise<void> {
    const legalLine = sanitizePvLine(line, 24);
    if (!legalLine.length) return;

    setIdeaInspection(false);
    setBoardIdeaExplanation(null);
    setInspectedSquare(null);
    const playback = pvPlaybackRef.current + 1;
    pvPlaybackRef.current = playback;
    await cancelEngineWork();
    if (playback !== pvPlaybackRef.current) return;

    try {
      pvGameRef.current = new Chess(fen);
    } catch {
      setCoachError('Could not open the principal-variation starting position.');
      return;
    }

    setSelected(null);
    setPvLastMove(null);
    setEngineMoveAnimation(null);
    setPvPreview({
      label,
      startFen: fen,
      line: legalLine,
      index: 0,
      total: legalLine.length,
      playing: true,
      speed: 1,
    });
    setPvRevision((value) => value + 1);
  }


  useEffect(() => {
    if (!pvPreview?.playing) return;

    if (pvPreview.index >= pvPreview.total) {
      setPvPreview((current) => current ? { ...current, playing: false } : current);
      setEngineMoveAnimation(null);
      return;
    }

    const uci = pvPreview.line[pvPreview.index];
    if (!uci) {
      setPvPreview((current) => current ? { ...current, playing: false } : current);
      return;
    }

    const from = uci.slice(0, 2) as Square;
    const to = uci.slice(2, 4) as Square;
    const durationMs = pvAnimationDuration(pvPreview.speed);
    const gapMs = pvStepGap(pvPreview.speed);

    setEngineMoveAnimation({ from, to, durationMs });

    const timer = window.setTimeout(() => {
      setEngineMoveAnimation(null);
      const nextIndex = applyPrincipalVariationPosition(pvPreview, pvPreview.index + 1);
      setPvPreview((current) => {
        if (!current?.playing) return current;
        if (
          current.startFen !== pvPreview.startFen
          || current.label !== pvPreview.label
          || current.index !== pvPreview.index
        ) {
          return current;
        }

        return {
          ...current,
          index: nextIndex,
          playing: nextIndex < current.total,
        };
      });
    }, durationMs + gapMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [pvPreview]);

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
      const acceptedByOpeningBook = trainingExercise.kind === 'opening'
        && Boolean(trainingExercise.expectedMoves?.includes(uci));
      const accepted = isAcceptedTrainingMove(moveReview, trainingExercise, uci);
      const points = scoreTrainingAttempt(moveReview, trainingHintLevel, acceptedByOpeningBook);
      const attempt: TrainingAttempt = {
        uci,
        san: move.san,
        review: moveReview,
        accepted,
        points,
        hintLevel: trainingHintLevel,
      };
      setTrainingAttempt(attempt);
      const attemptTimestamp = Date.now();
      setTrainingAnalytics((current) => recordTrainingAnalyticsEvent(current, {
        source: trainingSource,
        exercise: trainingExercise,
        attempt,
        timestamp: attemptTimestamp,
      }));
      if (trainingSource === 'daily' && trainingExercise.dailySource) {
        setActiveDailySession((current) => current
          ? appendDailySessionAttempt(current, trainingExercise, attempt, attemptTimestamp)
          : current);
      }
      if (trainingExercise.repertoirePositionKey) {
        setRepertoireMemory((current) => recordRepertoirePractice(
          current,
          trainingExercise.repertoirePositionKey!,
          accepted,
        ));
      }
      if (trainingExercise.spacedItemId) {
        const now = Date.now();
        setSpacedMemory((current) => recordSpacedAttempt(
          current,
          trainingExercise.spacedItemId!,
          {
            accepted,
            hintLevel: trainingHintLevel,
            points,
          },
          now,
        ));
        setSchedulerNow(now);
      }
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

  function saveOpeningAlternativeToRepertoire(alternative: OpeningAlternative): void {
    if (!openingRecognition) return;
    setRepertoireMemory((current) => saveRepertoireChoice(current, {
      fen: openingRecognition.explorerFen,
      eco: openingRecognition.eco,
      openingName: openingRecognition.name,
      variation: openingRecognition.variation,
      moveUci: alternative.uci,
      moveSan: alternative.san,
      source: 'book',
    }));
    setStatusText(`Repertoire saved · ${alternative.san}`);
  }

  function saveTopOpeningMoveToRepertoire(): void {
    const top = openingRecognition?.alternatives[0];
    if (top) saveOpeningAlternativeToRepertoire(top);
  }

  function keepPlayedOpeningMoveInRepertoire(): void {
    const recognition = openingRecognition;
    const deviation = recognition?.deviation;
    if (!recognition || !deviation) return;

    setRepertoireMemory((current) => saveRepertoireChoice(current, {
      fen: deviation.beforeFen,
      eco: recognition.eco,
      openingName: recognition.name,
      variation: recognition.variation,
      moveUci: deviation.uci,
      moveSan: deviation.san,
      source: 'personal',
    }));
    setStatusText(`Personal repertoire saved · ${deviation.san}`);
  }

  function forgetCurrentRepertoireMove(): void {
    if (!openingRecognition) return;
    setRepertoireMemory((current) => removeRepertoireChoice(current, openingRecognition.explorerFen));
    setStatusText('Repertoire move removed');
  }

  function buildRepertoireTrainingExercise(): TrainingExercise | null {
    if (!openingRecognition || !currentRepertoireChoice) return null;
    const choice = currentRepertoireChoice;

    return {
      key: `repertoire:${choice.positionKey}:${choice.moveUci}`,
      recordId: openingRecognition.matchedPly + 1,
      ply: openingRecognition.matchedPly + 1,
      beforeFen: choice.fen,
      originalMoveSan: 'Repertoire recall',
      originalVerdict: 'Good',
      originalLoss: 0,
      bestMoveUci: choice.moveUci,
      bestMoveSan: choice.moveSan,
      kind: 'opening',
      openingName: choice.variation
        ? `${choice.openingName} · ${choice.variation}`
        : choice.openingName,
      expectedMoves: [choice.moveUci],
      expectedMoveSans: [choice.moveSan],
      repertoirePositionKey: choice.positionKey,
    };
  }

  async function trainCurrentRepertoireMove(): Promise<void> {
    const exercise = buildRepertoireTrainingExercise();
    if (!exercise) return;
    setOpeningTrainingExercise(exercise);
    setTrainingSource('opening');
    setTrainingIndex(0);
    setTrainingAttempt(null);
    setTrainingHintLevel(0);
    await switchAppMode('training');
  }

  function buildStoredDeviationTrainingExercise(entry: OpeningDeviationMemory): TrainingExercise | null {
    const top = entry.alternatives[0];
    if (!top) return null;

    return {
      key: `opening-memory:${entry.key}`,
      recordId: entry.ply,
      ply: entry.ply,
      beforeFen: entry.beforeFen,
      originalMoveSan: entry.moveSan,
      originalVerdict: entry.lastVerdict ?? 'Good',
      originalLoss: entry.lastLossCp ?? 0,
      bestMoveUci: top.uci,
      bestMoveSan: top.san,
      kind: 'opening',
      openingName: entry.variation
        ? `${entry.openingName} · ${entry.variation}`
        : entry.openingName,
      expectedMoves: entry.alternatives.map((alternative) => alternative.uci),
      expectedMoveSans: entry.alternatives.map((alternative) => alternative.san),
    };
  }

  async function trainRememberedOpeningDeviation(entry: OpeningDeviationMemory): Promise<void> {
    const exercise = buildStoredDeviationTrainingExercise(entry);
    if (!exercise) return;
    setOpeningTrainingExercise(exercise);
    setTrainingSource('opening');
    setTrainingIndex(0);
    setTrainingAttempt(null);
    setTrainingHintLevel(0);
    await switchAppMode('training');
  }

  function buildOpeningTrainingExercise(recognition: OpeningRecognition): TrainingExercise | null {
    const deviation = recognition.deviation;
    const top = recognition.alternatives[0];
    if (!deviation || !top) return null;

    const record = records[deviation.ply - 1];
    const openingName = recognition.variation
      ? `${recognition.name} · ${recognition.variation}`
      : recognition.name;

    return {
      key: `opening:${currentLine.id}:${deviation.ply}:${deviation.uci}`,
      recordId: record?.id ?? deviation.ply,
      ply: deviation.ply,
      beforeFen: deviation.beforeFen,
      originalMoveSan: deviation.san,
      originalVerdict: record?.review?.verdict ?? 'Good',
      originalLoss: record?.review?.centipawnLoss ?? 0,
      bestMoveUci: top.uci,
      bestMoveSan: top.san,
      review: record?.review,
      kind: 'opening',
      openingName,
      expectedMoves: recognition.alternatives.map((alternative) => alternative.uci),
      expectedMoveSans: recognition.alternatives.map((alternative) => alternative.san),
    };
  }

  async function trainOpeningDeviation(): Promise<void> {
    if (!openingRecognition?.deviation || openingRecognition.alternatives.length === 0) return;
    const exercise = buildOpeningTrainingExercise(openingRecognition);
    if (!exercise) return;

    setOpeningTrainingExercise(exercise);
    setTrainingSource('opening');
    setTrainingIndex(0);
    setTrainingAttempt(null);
    setTrainingHintLevel(0);
    setTrainingSelected(null);
    setTrainingPromotion(null);
    await switchAppMode('training');
  }

  function studyOpeningAlternative(alternative: OpeningAlternative): void {
    if (!openingRecognition) return;
    void playPrincipalVariation(
      openingRecognition.explorerFen,
      alternative.continuationUci,
      `${alternative.targetEco} · ${alternative.targetName}${alternative.targetVariation ? ` · ${alternative.targetVariation}` : ''}`,
    );
  }

  function buildWeaknessTrainingSet(category: WeaknessCategoryId): TrainingExercise[] {
    return weaknessTrainingExamples(weaknessMemory, category, 12).map((example, index) => ({
      key: `weakness:${category}:${example.id}:${index}`,
      recordId: index + 1,
      ply: example.ply,
      beforeFen: example.beforeFen,
      originalMoveSan: example.originalMoveSan,
      originalVerdict: example.originalVerdict,
      originalLoss: example.originalLoss,
      bestMoveUci: example.bestMoveUci,
      bestMoveSan: example.bestMoveSan,
      kind: example.kind,
      openingName: example.openingName,
      expectedMoves: example.expectedMoves,
      expectedMoveSans: example.expectedMoveSans,
      weaknessLabel: example.weaknessLabel,
    }));
  }

  async function trainWeaknessCategory(category: WeaknessCategoryId): Promise<void> {
    const exercises = buildWeaknessTrainingSet(category);
    if (!exercises.length) return;

    setWeaknessTrainingExercises(exercises);
    setTrainingSource('weakness');
    setTrainingIndex(0);
    setTrainingAttempt(null);
    setTrainingHintLevel(0);
    setTrainingSelected(null);
    setTrainingPromotion(null);
    await switchAppMode('training');
  }

  async function trainWeakestArea(): Promise<void> {
    const weakest = weakestCategory(weaknessMemory);
    if (!weakest) return;
    await trainWeaknessCategory(weakest.id);
  }

  function createLongTermGoal(input: GoalPlanCreateInput): void {
    const now = Date.now();
    setGoalPlanMemory((current) => createGoalPlan(
      current,
      input,
      trainingAnalytics,
      spacedMemory,
      now,
    ));
    setSchedulerNow(now);
    setStatusText(`Goal plan created · ${input.durationWeeks} weeks`);
  }

  function completeLongTermGoal(): void {
    setGoalPlanMemory((current) => completeActiveGoal(current, Date.now()));
    setStatusText('Goal plan completed and archived');
  }

  function pauseLongTermGoal(): void {
    setGoalPlanMemory((current) => pauseActiveGoal(current, Date.now()));
    setStatusText('Goal plan paused');
  }

  function resumeLongTermGoal(goalId: string): void {
    setGoalPlanMemory((current) => resumeGoal(current, goalId, Date.now()));
    setStatusText('Goal plan resumed');
  }

  function buildDailyTrainingSet(): TrainingExercise[] {
    return buildAdaptiveDailyStudyPlan({
      durationMinutes: dailyStudyDuration,
      now: Date.now(),
      spacedMemory,
      weaknessMemory,
      records,
      humanColor,
      weeklyPriorityMultipliers: activeWeeklyPriorities.multipliers,
      weeklyPriorityReasons: activeWeeklyPriorities.reasons,
      goalPriorityMultipliers: activeGoalPriorities.multipliers,
      goalPriorityReasons: activeGoalPriorities.reasons,
    }).items.map((item) => item.exercise);
  }

  async function startDailyStudy(): Promise<void> {
    const now = Date.now();
    const plan = buildAdaptiveDailyStudyPlan({
      durationMinutes: dailyStudyDuration,
      now,
      spacedMemory,
      weaknessMemory,
      records,
      humanColor,
      weeklyPriorityMultipliers: activeWeeklyPriorities.multipliers,
      weeklyPriorityReasons: activeWeeklyPriorities.reasons,
      goalPriorityMultipliers: activeGoalPriorities.multipliers,
      goalPriorityReasons: activeGoalPriorities.reasons,
    });
    const exercises = plan.items.map((item) => item.exercise);
    if (!exercises.length) {
      setSchedulerNow(now);
      setStatusText('Daily study · no material available yet');
      return;
    }

    setDailyTrainingExercises(exercises);
    setActiveDailySession(beginDailyStudySession(plan, spacedMemory, now));
    setTrainingSource('daily');
    setTrainingIndex(0);
    setTrainingAttempt(null);
    setTrainingHintLevel(0);
    setTrainingSelected(null);
    setTrainingPromotion(null);
    setTrainingAttempts(0);
    setTrainingSolvedKeys([]);
    setTrainingBestScores({});
    await switchAppMode('training');
  }

  function finishDailyStudySession(): void {
    if (!activeDailySession || activeDailySession.attempts.length === 0) return;
    const now = Date.now();
    const report = buildDailySessionReport(activeDailySession, spacedMemory, now);
    setDailySessionReports((current) => saveDailySessionReport(current, report));
    setActiveDailySession(null);
    setSchedulerNow(now);
    setStatusText(`Daily study complete · ${report.solvedPositions}/${report.attemptedPositions} attempted positions solved`);
  }

  function buildDueTrainingSet(): TrainingExercise[] {
    return dueSpacedItems(spacedMemory, Date.now(), 20)
      .map((item, index) => spacedItemToTrainingExercise(item, index));
  }

  async function trainDueReviews(): Promise<void> {
    const exercises = buildDueTrainingSet();
    if (!exercises.length) {
      setSchedulerNow(Date.now());
      setStatusText('Spaced repetition · nothing due right now');
      return;
    }

    setSpacedTrainingExercises(exercises);
    setTrainingSource('due');
    setTrainingIndex(0);
    setTrainingAttempt(null);
    setTrainingHintLevel(0);
    setTrainingSelected(null);
    setTrainingPromotion(null);
    await switchAppMode('training');
  }

  function changeTrainingSource(source: TrainingSource): void {
    if (source === 'due') setSpacedTrainingExercises(buildDueTrainingSet());
    if (source === 'daily') {
      const now = Date.now();
      const plan = buildAdaptiveDailyStudyPlan({
        durationMinutes: dailyStudyDuration,
        now,
        spacedMemory,
        weaknessMemory,
        records,
        humanColor,
        weeklyPriorityMultipliers: activeWeeklyPriorities.multipliers,
        weeklyPriorityReasons: activeWeeklyPriorities.reasons,
        goalPriorityMultipliers: activeGoalPriorities.multipliers,
        goalPriorityReasons: activeGoalPriorities.reasons,
      });
      setDailyTrainingExercises(plan.items.map((item) => item.exercise));
      setActiveDailySession(beginDailyStudySession(plan, spacedMemory, now));
    } else if (trainingSource === 'daily') {
      setActiveDailySession(null);
    }
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
    setIdeaInspection(false);
    setBoardIdeaExplanation(null);
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
    stopPrincipalVariationPreview();
    const session = beginNewSession();
    nextAnalysisRequest();
    await cancelEngineWork();
    if (!isCurrentSession(session)) return;

    gameRef.current = new Chess();
    observedOpeningDeviationsRef.current.clear();
    observedWeaknessReviewsRef.current.clear();
    weaknessGameSessionRef.current += 1;
    setCurrentStartFen(DEFAULT_START_FEN);
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
    setOpeningTrainingExercise(null);
    setWeaknessTrainingExercises([]);
    setSpacedTrainingExercises([]);
    setDailyTrainingExercises([]);
    setActiveDailySession(null);
    setCurrentLine({ id: 1, name: 'Main line', originPly: null });
    setInactiveLines([]);
    setHistoryCursor(null);
    setSelected(null);
    setIdeaInspection(false);
    setBoardIdeaExplanation(null);
    setEngineMoveAnimation(null);
    setReview(null);
    setActiveReviewId(null);
    setCurrentAnalysis(null);
    setCurrentAnalysisFen(null);
    setCoachLoading(false);
    setBatchReviewing(false);
    setBatchReviewProgress(null);
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
    stopPrincipalVariationPreview();
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
    gameRef.current = replayRecords(remaining, currentStartFen);
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
    setBoardIdeaExplanation(null);
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

  function goToFirstMistake(): void {
    const ply = mistakePlies()[0] ?? null;
    if (ply !== null) void navigateHistory(ply);
  }

  function jumpToCoachSection(id: string): void {
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function exportCoachData(): void {
    const now = Date.now();
    const backup = createCoachBackup(window.localStorage, '1.0.1', now);
    const blob = new Blob([serializeCoachBackup(backup)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = backupFileName(now);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setLastBackupAt(now);
    setBackupStatus(`Backup exported · ${Object.keys(backup.entries).length} local data sections.`);
  }

  async function importCoachData(file: File): Promise<void> {
    try {
      const inspection = inspectCoachBackup(await file.text());
      if (!inspection.valid || !inspection.backup) {
        setBackupStatus(inspection.error ?? 'Backup could not be read.');
        return;
      }

      const exported = new Date(inspection.backup.exportedAt).toLocaleString();
      const confirmed = window.confirm(
        `Restore Stockfish Coach backup from ${exported} (app ${inspection.backup.appVersion})?\n\n`
        + `This replaces the backed-up local coach data and reloads the app.`
      );
      if (!confirmed) {
        setBackupStatus('Import cancelled.');
        return;
      }

      const restored = restoreCoachBackup(window.localStorage, inspection.backup, true);
      setBackupStatus(`Restored ${restored.length} data sections. Reloading…`);
      window.setTimeout(() => window.location.reload(), 120);
    } catch (error: unknown) {
      setBackupStatus(`Import failed · ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function scrollReviewSection(id: string): void {
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  async function reviewRecordBatch(list: PlyRecord[], label = 'Review complete'): Promise<void> {
    if (!engineStatus?.configured || phase === 'promotion' || list.length === 0) return;
    const session = sessionRef.current;
    setBatchReviewing(true);
    setBatchReviewProgress({ current: 0, total: list.length, san: '' });
    setHistoryCursor(null);
    setSelected(null);
    setPromotion(null);
    try {
      for (let index = 0; index < list.length; index += 1) {
        if (!isCurrentSession(session)) return;
        const record = list[index];
        setBatchReviewProgress({ current: index + 1, total: list.length, san: record.san });
        setStatusText(`Reviewing ${index + 1}/${list.length}: ${record.san}`);
        const request = nextAnalysisRequest();
        await runMoveReview(record, session, humanColor, request, Boolean(record.review));
      }
      if (isCurrentSession(session)) {
        setStatusText(`${label} · ${list.length} moves analyzed`);
        scrollReviewSection('game-review-dashboard');
      }
    } finally {
      setBatchReviewing(false);
      setBatchReviewProgress(null);
      if (isCurrentSession(session)) setPhase(gameRef.current.isGameOver() ? 'game-over' : (engineStatus?.configured ? 'player-turn' : 'engine-missing'));
    }
  }

  async function reviewAllUnreviewedMoves(forceAll = false): Promise<void> {
    if (!engineStatus?.configured || analysisBusy || phase === 'promotion' || records.length === 0) return;

    const pending = forceAll ? records : records.filter((record) => !record.review);
    if (pending.length === 0) {
      setStatusText('All moves already reviewed');
      return;
    }

    await reviewRecordBatch(pending, 'Review complete');
  }

  async function importPgnGame(pgn: string, reviewAs: 'w' | 'b', analyze: boolean): Promise<void> {
    if (analysisBusy || phase === 'promotion') return;
    setImportBusy(true);
    try {
      const imported = parsePgn(pgn);
      if (imported.records.length === 0) throw new Error('The PGN contains no moves. Use FEN import for a standalone position.');

      const session = beginNewSession();
      nextAnalysisRequest();
      await cancelEngineWork();
      if (!isCurrentSession(session)) return;

      gameRef.current = imported.game;
      observedOpeningDeviationsRef.current.clear();
      observedWeaknessReviewsRef.current.clear();
      weaknessGameSessionRef.current += 1;
      setCurrentStartFen(imported.startFen);
      nextRecordId.current = imported.records.length + 1;
      nextLineId.current = 2;
      nextVariationNumber.current = 1;
      setRecords(imported.records);
      setCurrentLine({ id: 1, name: 'Imported game', originPly: null });
      setInactiveLines([]);
      setHistoryCursor(null);
      setHumanColor(reviewAs);
      setOrientation(reviewAs === 'w' ? 'white' : 'black');
      setSelected(null);
      setEngineMoveAnimation(null);
      setReview(null);
      setActiveReviewId(null);
      setCurrentAnalysis(null);
      setCurrentAnalysisFen(null);
      setCoachLoading(false);
      setBatchReviewing(false);
      setBatchReviewProgress(null);
      setCoachError(null);
      clearInteractiveCoachState();
      setChatTurns([]);
      setChatLoading(false);
      nextChatId.current = 1;
      setPromotion(null);
      setTrainingIndex(0);
      setTrainingAttempt(null);
      setTrainingHintLevel(0);
      setTrainingAttempts(0);
      setTrainingSolvedKeys([]);
      setTrainingBestScores({});
      setOpeningTrainingExercise(null);
      setWeaknessTrainingExercises([]);
      setSpacedTrainingExercises([]);
      setDailyTrainingExercises([]);
      setActiveDailySession(null);
      setAppMode('play');
      refresh();

      const white = imported.headers.White || 'White';
      const black = imported.headers.Black || 'Black';
      setStatusText(`Imported ${white} – ${black} · ${imported.records.length} plies`);
      setPhase(engineStatus?.configured ? (gameRef.current.isGameOver() ? 'game-over' : 'player-turn') : 'engine-missing');
      setImportDialogOpen(false);

      if (analyze && engineStatus?.configured) {
        await wait(20);
        await reviewRecordBatch(imported.records, 'Imported game review complete');
      }
    } finally {
      setImportBusy(false);
    }
  }

  async function importFenPosition(fen: string): Promise<void> {
    if (analysisBusy || phase === 'promotion') return;
    setImportBusy(true);
    try {
      const imported = parseFen(fen);
      const session = beginNewSession();
      nextAnalysisRequest();
      await cancelEngineWork();
      if (!isCurrentSession(session)) return;

      const startFen = imported.fen();
      gameRef.current = imported;
      observedOpeningDeviationsRef.current.clear();
      observedWeaknessReviewsRef.current.clear();
      weaknessGameSessionRef.current += 1;
      setCurrentStartFen(startFen);
      nextRecordId.current = 1;
      nextLineId.current = 2;
      nextVariationNumber.current = 1;
      setRecords([]);
      setCurrentLine({ id: 1, name: 'Imported FEN', originPly: null });
      setInactiveLines([]);
      setHistoryCursor(null);
      setHumanColor(imported.turn());
      setOrientation(imported.turn() === 'w' ? 'white' : 'black');
      setSelected(null);
      setEngineMoveAnimation(null);
      setReview(null);
      setActiveReviewId(null);
      setCurrentAnalysis(null);
      setCurrentAnalysisFen(null);
      setCoachLoading(false);
      setBatchReviewing(false);
      setBatchReviewProgress(null);
      setCoachError(null);
      clearInteractiveCoachState();
      setChatTurns([]);
      setPromotion(null);
      setTrainingIndex(0);
      setTrainingAttempt(null);
      setTrainingHintLevel(0);
      setTrainingAttempts(0);
      setTrainingSolvedKeys([]);
      setTrainingBestScores({});
      setOpeningTrainingExercise(null);
      setWeaknessTrainingExercises([]);
      setSpacedTrainingExercises([]);
      setDailyTrainingExercises([]);
      setActiveDailySession(null);
      setAppMode('play');
      refresh();
      setStatusText('FEN imported · ready to analyze or continue');
      setPhase(engineStatus?.configured ? (imported.isGameOver() ? 'game-over' : 'player-turn') : 'engine-missing');
      setImportDialogOpen(false);
    } finally {
      setImportBusy(false);
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

  async function copyFen(): Promise<void> {
    await navigator.clipboard.writeText(game.fen());
    setStatusText(isHistoryView ? 'Historical FEN copied to clipboard' : 'FEN copied to clipboard');
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
    setIdeaInspection(false);
    setBoardIdeaExplanation(null);
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
    gameRef.current = replayRecords(remaining, currentStartFen);
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
      startFen: currentStartFen,
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
    gameRef.current = replayRecords(remaining, currentStartFen);
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
      startFen: currentStartFen,
    };

    setInactiveLines((previous) => [
      ...previous.filter((line) => line.id !== target.id && line.id !== currentSnapshot.id),
      currentSnapshot,
    ]);
    setCurrentLine({ id: target.id, name: target.name, originPly: target.originPly });
    gameRef.current = replayRecords(target.records, target.startFen);
    setRecords(target.records);
    setCurrentStartFen(target.startFen);
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

  const boardStatusText = pvPreview
    ? `${pvPreview.index >= pvPreview.total ? 'PV complete' : pvPreview.playing ? 'Playing' : 'PV paused'} · ${pvPreview.label} · ${pvPreview.index}/${pvPreview.total}`
    : batchReviewing
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

  const boardStatusClass = pvPreview
    ? pvPreview.playing ? 'thinking' : 'history'
    : batchReviewing
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

      if (pvPreview) {
        if (event.key === ' ') {
          event.preventDefault();
          togglePrincipalVariationPlayback();
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          stepPrincipalVariation(-1);
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          stepPrincipalVariation(1);
        } else if (event.key === 'Home') {
          event.preventDefault();
          jumpPrincipalVariation('start');
        } else if (event.key === 'End') {
          event.preventDefault();
          jumpPrincipalVariation('end');
        } else if (event.key === 'Escape') {
          event.preventDefault();
          stopPrincipalVariationPreview();
        }
        return;
      }

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
  }, [records, historyCursor, phase, batchReviewing, engineStatus?.configured, appMode, pvPreview]);

  return (
    <main className="app-shell" data-font-size={uiFontSize}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">♞</div>
          <div>
            <h1>Stockfish Coach</h1>
            <p>Play locally. Review every move. Ask why.</p>
          </div>
        </div>
        <div className="topbar-right">
          <UiTextSizeControl value={uiFontSize} onChange={setUiFontSize} />
          <div className="topbar-status">
            <span className={`status-dot ${engineStatus?.configured ? 'online' : ''}`} />
            <div>
              <strong>{engineStatus?.engineName ?? (engineStatus?.configured ? 'Stockfish configured' : 'Engine missing')}</strong>
              <span>{statusText}</span>
            </div>
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

            {isHistoryView && !pvPreview && (
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

            {pvPreview && (
              <div className="pv-preview-banner">
                <div className="pv-preview-summary">
                  <span>Principal variation</span>
                  <strong>
                    {pvPreview.label} · {pvPreview.index}/{pvPreview.total}
                    {pvPreview.index >= pvPreview.total ? ' · complete' : pvPreview.playing ? ' · playing…' : ' · paused'}
                  </strong>
                  <small>Space play/pause · ←/→ step · Home/End jump · Esc exit</small>
                </div>
                <div className="pv-study-controls" aria-label="Principal variation study controls">
                  <div className="pv-transport-controls">
                    <button type="button" onClick={() => jumpPrincipalVariation('start')} disabled={pvPreview.index === 0} title="Go to start" aria-label="Go to start">|◀</button>
                    <button type="button" onClick={() => stepPrincipalVariation(-1)} disabled={pvPreview.index === 0} title="Previous move" aria-label="Previous move">◀</button>
                    <button type="button" className="pv-play-pause" onClick={togglePrincipalVariationPlayback} title={pvPreview.playing ? 'Pause' : 'Play'} aria-label={pvPreview.playing ? 'Pause principal variation' : 'Play principal variation'}>
                      {pvPreview.playing ? '⏸' : '▶'}
                    </button>
                    <button type="button" onClick={() => stepPrincipalVariation(1)} disabled={pvPreview.index >= pvPreview.total} title="Next move" aria-label="Next move">▶</button>
                    <button type="button" onClick={() => jumpPrincipalVariation('end')} disabled={pvPreview.index >= pvPreview.total} title="Go to end" aria-label="Go to end">▶|</button>
                  </div>
                  <div className="pv-secondary-controls">
                    <button type="button" onClick={restartPrincipalVariation} disabled={pvPreview.index === 0 && !pvPreview.playing}>Restart</button>
                    <div className="pv-speed-controls" aria-label="Playback speed">
                      {PV_SPEEDS.map((speed) => (
                        <button
                          key={speed}
                          type="button"
                          className={pvPreview.speed === speed ? 'active' : ''}
                          onClick={() => setPrincipalVariationSpeed(speed)}
                          aria-pressed={pvPreview.speed === speed}
                        >
                          {speed}×
                        </button>
                      ))}
                    </div>
                    <button type="button" className="pv-exit-button" onClick={stopPrincipalVariationPreview}>Return</button>
                  </div>
                </div>
              </div>
            )}

            {!pvPreview && (
              <div className="board-ideas-toolbar">
                <div>
                  <strong>Board inspector</strong>
                  {showBoardIdeas && (review || currentAnalysis || openingGuideArrows.length > 0) && (
                    <div className="board-legend-groups" aria-label="Board arrow legend">
                      {(review || currentAnalysis) && (
                        <span className="board-legend-group">
                          <b>Engine</b>
                          <span className="board-idea-legend"><i className="board-idea-swatch best" /> Stockfish best</span>
                          <span className="board-idea-legend"><i className="board-idea-swatch played" /> played issue</span>
                          <span className="board-idea-legend"><i className="board-idea-swatch tactical" /> tactical</span>
                        </span>
                      )}
                      {openingGuideArrows.length > 0 && (
                        <span className="board-legend-group">
                          <b>Opening</b>
                          <span className="board-idea-legend"><i className="board-idea-swatch book" /> local book</span>
                          {currentRepertoireChoice && (
                            <span className="board-idea-legend"><i className="board-idea-swatch repertoire" /> my repertoire</span>
                          )}
                        </span>
                      )}
                    </div>
                  )}
                  {ideaInspection && (
                    <span className="board-inspect-help">
                      {inspectionOverlay ? `${inspectionOverlay.target} · W${inspectionOverlay.whiteAttackers.length}/B${inspectionOverlay.blackAttackers.length}` : 'click any square or piece'}
                    </span>
                  )}
                </div>
                <div className="board-ideas-actions">
                  <button
                    type="button"
                    className={ideaInspection ? 'active' : ''}
                    onClick={toggleIdeaInspection}
                    disabled={phase === 'engine-thinking' || phase === 'promotion' || batchReviewing}
                  >
                    {ideaInspection ? 'Exit inspect' : 'Inspect board'}
                  </button>
                  {(review || currentAnalysis || Boolean(openingRecognition?.withinBook && (openingRecognition.alternatives.length || currentRepertoireChoice))) && (
                    <button type="button" onClick={() => {
                      setShowBoardIdeas((value) => {
                        const next = !value;
                        if (!next) setBoardIdeaExplanation((current) => current?.id.startsWith('square:') ? current : null);
                        return next;
                      });
                    }}>
                      {showBoardIdeas ? 'Hide ideas' : 'Show ideas'}
                    </button>
                  )}
                </div>
              </div>
            )}

            <ChessBoard
              game={displayGame}
              orientation={orientation}
              selected={pvPreview ? null : selected}
              legalTargets={pvPreview ? new Set<Square>() : legalTargets}
              lastMove={displayLastMove}
              disabled={boardDisabled || ideaInspection}
              engineThinking={engineThinking || Boolean(pvPreview?.playing)}
              engineMoveAnimation={engineMoveAnimation}
              arrows={displayBoardArrows}
              highlights={displayBoardHighlights}
              ideaInspection={ideaInspection}
              selectedIdeaId={boardIdeaExplanation?.id ?? null}
              onIdeaClick={inspectBoardIdea}
              onSquareInspect={inspectBoardSquare}
              onSquareClick={onSquareClick}
              onPieceDragStart={onPieceDragStart}
              onPieceDragCancel={onPieceDragCancel}
              onPieceDrop={onPieceDrop}
            />

            <div className="player-strip">
              <div className="avatar human">You</div>
              <div><strong>Student</strong><span>Playing {humanColor === 'w' ? 'White' : 'Black'}</span></div>
              <span className={`game-state ${boardStatusClass}`}>
                {(pvPreview?.playing || batchReviewing || phase === 'engine-thinking' || phase === 'reviewing') && <span className="mini-spinner" aria-hidden="true" />}
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
              <button type="button" onClick={() => setImportDialogOpen(true)} disabled={analysisBusy || phase === 'promotion'}>Import PGN / FEN</button>
              <button type="button" onClick={() => void copyPgn()} disabled={records.length === 0}>Copy PGN</button>
              <button type="button" onClick={() => void copyFen()}>Copy FEN</button>
              <button type="button" onClick={() => void chooseEngine()} disabled={analysisBusy || phase === 'promotion'}>Change engine</button>
            </div>

            {batchReviewProgress && (
              <ReviewProgressPanel
                current={batchReviewProgress.current}
                total={batchReviewProgress.total}
                san={batchReviewProgress.san}
              />
            )}

            <nav className="workflow-jump-nav" aria-label="Review workflow shortcuts">
              <button type="button" onClick={() => jumpToCoachSection('personal-coach-dashboard')}>Coach</button>
              <button type="button" onClick={() => jumpToCoachSection('game-review-dashboard')} disabled={records.length === 0}>Review</button>
              <button type="button" onClick={() => jumpToCoachSection('move-history-panel')}>History</button>
              <button type="button" onClick={() => jumpToCoachSection('coach-daily-study')}>Study</button>
            </nav>
          </section>

          <PersonalCoachDashboard
            weaknessMemory={weaknessMemory}
            repertoireMemory={repertoireMemory}
            spacedMemory={spacedMemory}
            analytics={trainingAnalytics}
            goalMemory={goalPlanMemory}
            weeklyReport={liveWeeklyCoachReport}
            dailyPlan={dailyStudyPlan}
            latestDailyReport={latestDailyReport}
            now={schedulerNow}
            disabled={analysisBusy || phase === 'promotion'}
            onStartDaily={() => void startDailyStudy()}
            onJump={jumpToCoachSection}
          />

          {records.length > 0 && (
            <>
              <GameReviewSummary
                records={records}
                humanColor={humanColor}
                reviewing={batchReviewing}
                onReviewAll={() => void reviewAllUnreviewedMoves(records.every((record) => Boolean(record.review)))}
                onGoToFirstIssue={goToFirstMistake}
                selectedRecord={historyCursor !== null && historyCursor > 0 ? visibleRecord : null}
                onOpenSelected={() => scrollReviewSection('selected-move-details')}
              />
              <EvaluationTimeline
                records={records}
                humanColor={humanColor}
                viewedPly={historyCursor}
                disabled={analysisBusy || phase === 'promotion'}
                onNavigate={(ply) => void navigateHistory(ply)}
                onReviewAll={() => void reviewAllUnreviewedMoves()}
              />
            </>
          )}

          <section className="panel history-panel" id="move-history-panel">
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

            {historyCursor !== null && historyCursor > 0 && visibleRecord && (
              <div className="history-selected-move">
                <div>
                  <span>Selected</span>
                  <strong>{Math.ceil(visibleRecord.ply / 2)}{visibleRecord.color === 'b' ? '…' : '.'}{visibleRecord.san}</strong>
                </div>
                {visibleRecord.review ? (
                  <>
                    <span className={`history-selected-verdict verdict-${visibleRecord.review.verdict.toLowerCase()}`}>
                      {visibleRecord.review.verdict}
                    </span>
                    <span>{visibleRecord.review.centipawnLoss} cp loss</span>
                    <span>best {visibleRecord.review.bestMoveSan ?? '—'}</span>
                    <button type="button" onClick={() => scrollReviewSection('selected-move-details')}>Details ↓</button>
                  </>
                ) : (
                  <span>Not reviewed yet</span>
                )}
              </div>
            )}

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

          <div id="selected-move-details" className="selected-move-details-anchor">
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
            onPlayLine={(fen, line, label) => void playPrincipalVariation(fen, line, label)}
            moveComparisonFocus={moveComparisonFocus}
            onMoveComparisonFocusChange={setMoveComparisonFocus}
            boardIdeaExplanation={boardIdeaExplanation}
            inspectionOverlay={inspectionOverlay}
            inspectionOverlayMode={inspectionOverlayMode}
            onInspectionOverlayModeChange={setInspectionOverlayMode}
            onClearBoardIdea={() => {
              setBoardIdeaExplanation(null);
              setInspectedSquare(null);
              setInspectionOverlayMode('all');
            }}
            onAskBoardIdea={(question) => void askConversationalCoach(question)}
          />
          </div>

          <OpeningExplorerPanel
            recognition={openingRecognition}
            disabled={analysisBusy || phase === 'promotion'}
            onStudyAlternative={studyOpeningAlternative}
            preferredMoveUci={currentRepertoireChoice?.moveUci ?? null}
            onSaveAlternative={saveOpeningAlternativeToRepertoire}
            onForgetPreferred={forgetCurrentRepertoireMove}
            onTrainDeviation={() => void trainOpeningDeviation()}
            onGoToTheoryEnd={(ply) => void navigateHistory(ply)}
          />

          <OpeningMemoryPanel
            recognition={openingRecognition}
            memory={repertoireMemory}
            deviationReview={openingDeviationReview}
            disabled={analysisBusy || phase === 'promotion'}
            onSaveTopBookMove={saveTopOpeningMoveToRepertoire}
            onKeepPlayedMove={keepPlayedOpeningMoveInRepertoire}
            onForgetCurrent={forgetCurrentRepertoireMove}
            onTrainCurrentRepertoire={() => void trainCurrentRepertoireMove()}
            onTrainCurrentDeviation={() => void trainOpeningDeviation()}
            onTrainRememberedDeviation={(entry) => void trainRememberedOpeningDeviation(entry)}
            onReviewDeviation={() => {
              const deviation = openingRecognition?.deviation;
              if (deviation) void navigateHistory(deviation.ply);
            }}
          />

          <WeaknessProfilePanel
            memory={weaknessMemory}
            disabled={analysisBusy || phase === 'promotion'}
            onTrainWeakest={() => void trainWeakestArea()}
            onTrainCategory={(category) => void trainWeaknessCategory(category)}
          />

          <SpacedRepetitionPanel
            memory={spacedMemory}
            now={schedulerNow}
            disabled={analysisBusy || phase === 'promotion'}
            onTrainDue={() => void trainDueReviews()}
          />

          <WeeklyCoachPanel
            report={liveWeeklyCoachReport}
            activePriorities={activeWeeklyPriorities}
          />

          <GoalBasedTrainingPanel
            memory={goalPlanMemory}
            analytics={trainingAnalytics}
            spacedMemory={spacedMemory}
            weaknessMemory={weaknessMemory}
            openingOptions={goalOpeningOptions}
            weaknessOptions={goalWeaknessOptions}
            now={schedulerNow}
            disabled={analysisBusy || phase === 'promotion'}
            onCreate={createLongTermGoal}
            onPause={pauseLongTermGoal}
            onComplete={completeLongTermGoal}
            onResume={resumeLongTermGoal}
          />

          <DailyStudyPlannerPanel
            plan={dailyStudyPlan}
            duration={dailyStudyDuration}
            disabled={analysisBusy || phase === 'promotion'}
            latestReport={latestDailyReport}
            onDurationChange={setDailyStudyDuration}
            onStart={() => void startDailyStudy()}
          />

          {latestDailyReport && <DailySessionReportPanel report={latestDailyReport} compact />}

          <TrainingAnalyticsPanel
            memory={trainingAnalytics}
            spacedMemory={spacedMemory}
            now={schedulerNow}
          />

          <DataManagementPanel
            lastBackupAt={lastBackupAt}
            status={backupStatus}
            disabled={analysisBusy || phase === 'promotion'}
            onExport={exportCoachData}
            onImport={(file) => void importCoachData(file)}
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
                    <option value="opening">Opening deviation — {trainingOpeningCount}</option>
                    <option value="weakness">Targeted weakness — {trainingWeaknessCount}</option>
                    <option value="due">Due review — {trainingDueCount}</option>
                    <option value="daily">Daily study — {trainingDailyCount}</option>
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
                openingCount={trainingOpeningCount}
                weaknessCount={trainingWeaknessCount}
                dueCount={trainingDueCount}
                dailyCount={trainingDailyCount}
                dailyAttemptedCount={dailyAttemptedCount}
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
                onFinishDaily={finishDailyStudySession}
              />

              {latestDailyReport && trainingSource === 'daily' && !activeDailySession && (
                <DailySessionReportPanel report={latestDailyReport} />
              )}

              <section className="panel training-help-panel">
                <span className="eyebrow">How it works</span>
                <h2>Your games become exercises</h2>
                <p>Training never changes the live game. Switch back to Play & Coach at any time and your board, history, saved variations and coaching remain exactly where you left them.</p>
                <p><strong>Best / Excellent</strong> counts as solved. Opening exercises also accept recognized book continuations. Daily Study automatically mixes due repertoire, weakest areas, recent mistakes, and a small amount of new material into a 15–30 minute session. Spaced cards still reschedule from the result.</p>
              </section>
            </aside>
          </>
        )}
      </div>

      {importDialogOpen && (
        <ImportGameDialog
          busy={importBusy}
          onClose={() => { if (!importBusy) setImportDialogOpen(false); }}
          onImportPgn={importPgnGame}
          onImportFen={importFenPosition}
        />
      )}

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
