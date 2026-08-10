import { UI_FONT_SIZE_OPTIONS, type UiFontSize } from '../lib/uiPreferences';

interface UiTextSizeControlProps {
  value: UiFontSize;
  onChange(value: UiFontSize): void;
}

export function UiTextSizeControl({ value, onChange }: UiTextSizeControlProps) {
  return (
    <div className="ui-text-size-control" aria-label="Text size">
      <span>Text</span>
      <div>
        {UI_FONT_SIZE_OPTIONS.map((option) => (
          <button
            type="button"
            key={option.id}
            className={value === option.id ? 'active' : ''}
            aria-pressed={value === option.id}
            title={`${option.label} interface text`}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
