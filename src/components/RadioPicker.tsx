import { useRadio } from "@/contexts/RadioContext";
import { Loader2 } from "lucide-react";
import { useSounds } from "@/hooks/useSounds";
import radyoPenceresi from "@/assets/radyoPenceresi.png";

interface RadioPickerProps {
  open: boolean;
  onClose: () => void;
}

export function RadioPicker({ open, onClose }: RadioPickerProps) {
  const { stations, currentStation, isPlaying, isLoading, play, stop } = useRadio();
  const { playSound } = useSounds();

  if (!open) return null;

  // PNG içindeki beyaz liste alanı ve buton koordinatları (704x1408)
  const LIST = { left: "18.9%", right: "17.2%", top: "30.1%", bottom: "22.1%" };
  const rows = stations.slice(0, 8);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[380px] animate-in fade-in zoom-in-95 duration-300"
        style={{ containerType: "inline-size" }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={radyoPenceresi}
          alt="Radyo"
          className="w-full h-auto select-none pointer-events-none"
          draggable={false}
        />

        {/* Kanal satırları: görünmez hit-zone'lar */}
        <div className="absolute" style={LIST}>
          {rows.map((s, i) => {
            const active = currentStation?.id === s.id;
            const loading = active && isLoading;
            const playing = active && isPlaying;
            return (
              <button
                key={s.id}
                type="button"
                aria-label={s.name}
                onClick={() => {
                  playSound("buttonClick");
                  if (playing) stop();
                  else play(s);
                }}
                className="absolute left-0 right-0 bg-transparent active:scale-[0.98] transition-transform"
                style={{
                  top: `${(i * 100) / rows.length}%`,
                  height: `${100 / rows.length}%`,
                  touchAction: "manipulation",
                }}
              >
                {active && (
                  <span className="absolute inset-y-[6%] inset-x-[1%] rounded-[2cqw] bg-amber-400/25 pointer-events-none" />
                )}
                {loading && (
                  <span className="absolute inset-y-0 left-[6%] flex items-center">
                    <Loader2 className="w-[6cqw] h-[6cqw] text-[#1b3a5c] animate-spin" />
                  </span>
                )}
                {playing && (
                  <span className="absolute inset-y-0 right-[5%] flex items-center gap-[1cqw]">
                    <span className="w-[1.2cqw] h-[3cqw] bg-green-600 rounded-full animate-pulse" />
                    <span className="w-[1.2cqw] h-[4.5cqw] bg-green-600 rounded-full animate-pulse" />
                    <span className="w-[1.2cqw] h-[2.5cqw] bg-green-600 rounded-full animate-pulse" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Radyoyu Kapat */}
        <button
          type="button"
          aria-label="Radyoyu Kapat"
          onClick={() => {
            playSound("buttonClick");
            stop();
            onClose();
          }}
          className="absolute bg-transparent active:scale-95 transition-transform"
          style={{ left: "23.4%", width: "54%", top: "80.5%", height: "5.4%", touchAction: "manipulation" }}
        />
      </div>
    </div>
  );
}
