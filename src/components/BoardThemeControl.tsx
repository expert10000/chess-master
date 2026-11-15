import { UI_BOARD_THEME_OPTIONS, type UiBoardTheme } from '../lib/uiPreferences';

interface BoardThemeControlProps {
  value: UiBoardTheme;
  onChange(value: UiBoardTheme): void;
}

export function BoardThemeControl({ value, onChange }: BoardThemeControlProps) {
  return (
    <div className="ui-theme-control" aria-label="Board theme">
      <span>Board</span>
      <div>
        {UI_BOARD_THEME_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={value === option.id ? 'active' : ''}
            aria-pressed={value === option.id}
            title={`${option.label} checkerboard`}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
