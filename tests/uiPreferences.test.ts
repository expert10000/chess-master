import { describe, expect, it } from 'vitest';
import {
  UI_FONT_SIZE_OPTIONS,
  loadUiFontSize,
  serializeUiFontSize,
  loadUiReviewLayout,
  serializeUiReviewLayout,
  loadUiPlayPace,
  serializeUiPlayPace,
} from '../src/lib/uiPreferences';

describe('v1.0.1 UI text-size preference', () => {
  it('supports exactly Small, Regular and Large', () => {
    expect(UI_FONT_SIZE_OPTIONS.map((option) => option.id)).toEqual(['small', 'regular', 'large']);
  });

  it('defaults unknown or missing values to Regular', () => {
    expect(loadUiFontSize(null)).toBe('regular');
    expect(loadUiFontSize('huge')).toBe('regular');
  });

  it('round-trips supported values', () => {
    expect(loadUiFontSize(serializeUiFontSize('small'))).toBe('small');
    expect(loadUiFontSize(serializeUiFontSize('regular'))).toBe('regular');
    expect(loadUiFontSize(serializeUiFontSize('large'))).toBe('large');
  });

  it('loads and round-trips review layout preferences', () => {
    const value = {
      preset: 'details' as const,
      boardPinned: false,
      compactHeaders: true,
      autoFocusBoard: false,
    };
    expect(loadUiReviewLayout(serializeUiReviewLayout(value))).toEqual(value);
  });

  it('falls back to balanced pinned compact review layout for invalid data', () => {
    expect(loadUiReviewLayout('{bad')).toMatchObject({
      preset: 'balanced',
      boardPinned: true,
      compactHeaders: true,
      autoFocusBoard: true,
    });
  });

  it('supports persistent Coach, Fast, and Very fast play pace', () => {
    expect(loadUiPlayPace(null)).toBe('coach');
    expect(loadUiPlayPace('unknown')).toBe('coach');
    expect(loadUiPlayPace(serializeUiPlayPace('fast'))).toBe('fast');
    expect(loadUiPlayPace(serializeUiPlayPace('very-fast'))).toBe('very-fast');
    expect(loadUiPlayPace(serializeUiPlayPace('coach'))).toBe('coach');
  });


});
