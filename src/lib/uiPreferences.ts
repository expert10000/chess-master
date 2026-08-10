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
