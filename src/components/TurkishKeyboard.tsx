

const ROWS = [
  ["E", "R", "T", "Y", "U", "I", "O", "P", "Ğ", "Ü"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ş", "İ"],
  ["Z", "C", "V", "B", "N", "M", "Ö", "Ç"],
];

interface Props {
  onKeyPress: (letter: string) => void;
  onBackspace: () => void;
  onSubmit: () => void;
  disabled?: boolean;
  highlightLetter?: string;
}

export const TurkishKeyboard = ({ onKeyPress, onBackspace, onSubmit, disabled, highlightLetter }: Props) => {
  return (
    <div className="w-full px-1 py-2 space-y-1.5">
      {ROWS.map((row, ri) => (
        <div key={ri} className="flex justify-center gap-[3px]">
          {ri === 2 && (
            <button
              onClick={onSubmit}
              disabled={disabled}
              className="h-10 px-3 rounded-lg bg-emerald-600 text-white active:scale-90 transition-transform disabled:opacity-30 shrink-0"
            >
              <img src="/icons/gonder-gorsel.svg" alt="Gönder" className="w-5 h-5" />
            </button>
          )}
          {row.map((letter) => {
            const isHighlighted = highlightLetter === letter;
            return (
              <button
                key={letter}
                onClick={() => onKeyPress(letter)}
                disabled={disabled}
                className={`h-10 min-w-[28px] flex-1 max-w-[36px] rounded-lg text-[13px] font-bold active:scale-90 transition-all disabled:opacity-30
                  ${isHighlighted
                    ? "bg-amber-500 text-white shadow-md shadow-amber-500/40"
                    : "bg-white/10 text-white border border-white/10 hover:bg-white/20"
                  }`}
              >
                {letter}
              </button>
            );
          })}
          {ri === 2 && (
            <button
              onClick={onBackspace}
              disabled={disabled}
              className="h-10 px-3 rounded-lg bg-white/10 border border-white/10 text-white active:scale-90 transition-transform disabled:opacity-30 shrink-0"
            >
              <img src="/icons/silgi-gorsel.svg" alt="Sil" className="w-5 h-5" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
};
