interface PromotionDialogProps {
  color: 'w' | 'b';
  onSelect(piece: 'q' | 'r' | 'b' | 'n'): void;
  onCancel(): void;
}

const glyphs = {
  w: { q: '♕', r: '♖', b: '♗', n: '♘' },
  b: { q: '♛', r: '♜', b: '♝', n: '♞' },
};

export function PromotionDialog({ color, onSelect, onCancel }: PromotionDialogProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <div className="promotion-dialog" role="dialog" aria-modal="true" aria-label="Choose promotion piece" onMouseDown={(event) => event.stopPropagation()}>
        <h3>Promote pawn</h3>
        <div className="promotion-options">
          {(['q', 'r', 'b', 'n'] as const).map((piece) => (
            <button type="button" onClick={() => onSelect(piece)} key={piece}>
              {glyphs[color][piece]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
