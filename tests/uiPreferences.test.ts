import { describe, expect, it } from 'vitest';
import {
  UI_FONT_SIZE_OPTIONS,
  loadUiFontSize,
  serializeUiFontSize,
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
});
