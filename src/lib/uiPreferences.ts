export const UI_FONT_SIZE_STORAGE_KEY = 'stockfish-coach.ui-font-size.v1';

export type UiFontSize = 'small' | 'regular' | 'large';

export const UI_FONT_SIZE_OPTIONS: Array<{ id: UiFontSize; label: string; scale: number }> = [
  { id: 'small', label: 'Small', scale: 0.90 },
  { id: 'regular', label: 'Regular', scale: 1.00 },
  { id: 'large', label: 'Large', scale: 1.12 },
];

export function loadUiFontSize(raw: string | null | undefined): UiFontSize {
  return raw === 'small' || raw === 'large' || raw === 'regular' ? raw : 'regular';
}

export function serializeUiFontSize(value: UiFontSize): string {
  return value;
}


export const UI_BOARD_THEME_STORAGE_KEY = 'stockfish-coach.ui-board-theme.v1';

export type UiBoardTheme = 'current' | 'brown' | 'green';

export const UI_BOARD_THEME_OPTIONS: Array<{ id: UiBoardTheme; label: string }> = [
  { id: 'current', label: 'Current' },
  { id: 'brown', label: 'Brown' },
  { id: 'green', label: 'Green' },
];

export function loadUiBoardTheme(raw: string | null | undefined): UiBoardTheme {
  return raw === 'brown' || raw === 'green' || raw === 'current' ? raw : 'current';
}

export function serializeUiBoardTheme(value: UiBoardTheme): string {
  return value;
}


export const UI_REVIEW_LAYOUT_STORAGE_KEY = 'stockfish-coach.ui-review-layout.v1';

export type UiReviewPreset = 'board' | 'balanced' | 'details';

export interface UiReviewLayoutPreferences {
  preset: UiReviewPreset;
  boardPinned: boolean;
  compactHeaders: boolean;
  autoFocusBoard: boolean;
}

export const DEFAULT_UI_REVIEW_LAYOUT: UiReviewLayoutPreferences = {
  preset: 'balanced',
  boardPinned: true,
  compactHeaders: true,
  autoFocusBoard: true,
};

export function loadUiReviewLayout(raw: string | null | undefined): UiReviewLayoutPreferences {
  if (!raw) return { ...DEFAULT_UI_REVIEW_LAYOUT };
  try {
    const parsed = JSON.parse(raw) as Partial<UiReviewLayoutPreferences>;
    const preset: UiReviewPreset = parsed.preset === 'board' || parsed.preset === 'details' || parsed.preset === 'balanced'
      ? parsed.preset
      : DEFAULT_UI_REVIEW_LAYOUT.preset;
    return {
      preset,
      boardPinned: typeof parsed.boardPinned === 'boolean' ? parsed.boardPinned : DEFAULT_UI_REVIEW_LAYOUT.boardPinned,
      compactHeaders: typeof parsed.compactHeaders === 'boolean' ? parsed.compactHeaders : DEFAULT_UI_REVIEW_LAYOUT.compactHeaders,
      autoFocusBoard: typeof parsed.autoFocusBoard === 'boolean' ? parsed.autoFocusBoard : DEFAULT_UI_REVIEW_LAYOUT.autoFocusBoard,
    };
  } catch {
    return { ...DEFAULT_UI_REVIEW_LAYOUT };
  }
}

export function serializeUiReviewLayout(value: UiReviewLayoutPreferences): string {
  return JSON.stringify(value);
}


export const UI_PLAY_PACE_STORAGE_KEY = 'stockfish-coach.play-pace.v1';

export type UiPlayPace = 'coach' | 'fast' | 'very-fast';

export const UI_PLAY_PACE_OPTIONS: Array<{ id: UiPlayPace; label: string; description: string }> = [
  { id: 'coach', label: 'Coach', description: 'Normal think time + automatic move review' },
  { id: 'fast', label: 'Fast', description: 'Quick, strength-aware calculation + defer review until requested' },
  { id: 'very-fast', label: 'Very fast', description: 'Shortest strength-aware calculation + minimal move transition' },
];

export function loadUiPlayPace(raw: string | null | undefined): UiPlayPace {
  return raw === 'fast' || raw === 'very-fast' || raw === 'coach' ? raw : 'coach';
}

export function serializeUiPlayPace(value: UiPlayPace): string {
  return value;
}
