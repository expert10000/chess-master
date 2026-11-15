import type { UiReviewLayoutPreferences, UiReviewPreset } from '../lib/uiPreferences';

interface ReviewLayoutControlProps {
  value: UiReviewLayoutPreferences;
  onChange(value: UiReviewLayoutPreferences): void;
  onFocusSelected(): void;
  disabled?: boolean;
}

const PRESETS: Array<{ id: UiReviewPreset; label: string; title: string }> = [
  { id: 'board', label: 'Board', title: 'Give more width and height to the board' },
  { id: 'balanced', label: 'Balanced', title: 'Balanced board and review panels' },
  { id: 'details', label: 'Details', title: 'Give more width to review details' },
];

export function ReviewLayoutControl({
  value,
  onChange,
  onFocusSelected,
  disabled = false,
}: ReviewLayoutControlProps) {
  const patch = (next: Partial<UiReviewLayoutPreferences>) => onChange({ ...value, ...next });

  return (
    <div className="review-layout-control">
      <div className="review-layout-presets" aria-label="Review layout preset">
        <span>Review layout</span>
        <div>
          {PRESETS.map((preset) => (
            <button
              type="button"
              key={preset.id}
              className={value.preset === preset.id ? 'active' : ''}
              aria-pressed={value.preset === preset.id}
              title={preset.title}
              disabled={disabled}
              onClick={() => patch({ preset: preset.id })}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="review-layout-toggles">
        <button
          type="button"
          className={value.boardPinned ? 'active' : ''}
          aria-pressed={value.boardPinned}
          disabled={disabled}
          onClick={() => patch({ boardPinned: !value.boardPinned })}
        >
          {value.boardPinned ? 'Board pinned' : 'Pin board'}
        </button>
        <button
          type="button"
          className={value.compactHeaders ? 'active' : ''}
          aria-pressed={value.compactHeaders}
          disabled={disabled}
          onClick={() => patch({ compactHeaders: !value.compactHeaders })}
        >
          {value.compactHeaders ? 'Compact headers' : 'Full headers'}
        </button>
        <button
          type="button"
          className={value.autoFocusBoard ? 'active' : ''}
          aria-pressed={value.autoFocusBoard}
          disabled={disabled}
          onClick={() => patch({ autoFocusBoard: !value.autoFocusBoard })}
        >
          {value.autoFocusBoard ? 'Follow selection' : 'Follow off'}
        </button>
        <button type="button" disabled={disabled} onClick={onFocusSelected}>Focus selected</button>
      </div>
    </div>
  );
}
