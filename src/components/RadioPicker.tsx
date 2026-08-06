import { useRadio } from "@/contexts/RadioContext";
import { Loader2, X } from "lucide-react";
import { useSounds } from "@/hooks/useSounds";
import { PressableZone } from "@/components/ui/pressable-zone";
import radyoPenceresi from "@/assets/radyoPenceresi.png";

interface RadioPickerProps {
  open: boolean;
  onClose: () => void;
}

export function RadioPicker({ open, onClose }: RadioPickerProps) {
  const { stations, currentStation, isPlaying, isLoading, play, stop } = useRadio();
  const { playSound } = useSounds();

  if (!open) return null;

  // PNG (704x1408) üzerinden piksel piksel ölçülmüş liste alanı
  // Beyaz liste: x 130-574, satır ayırıcıları y: 519.5 / 600.5 / 681.5 / 763.5 / 844.5 / 925.5 / 1007.5
  const LIST_LEFT = (130 / 704) * 100; // 18.466%
  const LIST_WIDTH = (444 / 704) * 100; // 63.068%
  const ROW_EDGES = [424, 519.5, 600.5, 681.5, 763.5, 844.5, 925.5, 1007.5, 1105];
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
        {/* Pencere dışı büyük kapatma butonu (radyo çalmaya devam eder) */}
        <PressableZone
          label="Kapat"
          onPress={onClose}
          className="rounded-full bg-black/60 border border-white/25 flex items-center justify-center"
          style={{ right: "-2%", top: "-9%", width: "13cqw", height: "13cqw" }}
        >
          <X className="w-[7cqw] h-[7cqw] text-white" strokeWidth={3} />
        </PressableZone>

        <img
          src={radyoPenceresi}
          alt="Radyo"
          className="w-full h-auto select-none pointer-events-none"
          draggable={false}
        />

        {/* Kanal satırları: görünmez hit-zone'lar */}
        <div className="absolute inset-0">
          {rows.map((s, i) => {
            const active = currentStation?.id === s.id;
            const loading = active && isLoading;
            const playing = active && isPlaying;
            const top = (ROW_EDGES[i] / 1408) * 100;
            const height = ((ROW_EDGES[i + 1] - ROW_EDGES[i]) / 1408) * 100;
            return (
              <PressableZone
                key={s.id}
                label={s.name}
                sound={false}
                onPress={() => {
                  playSound("buttonClick");
                  if (playing) stop();
                  else play(s);
                }}
                className="rounded-[2cqw]"
                style={{
                  left: `${LIST_LEFT}%`,
                  width: `${LIST_WIDTH}%`,
                  top: `${top}%`,
                  height: `${height}%`,
                }}
              >
                {active && (
                  <span className="absolute inset-0 rounded-[1.5cqw] bg-sky-500/25 pointer-events-none" />
                )}

                {loading && (
                  <span className="absolute inset-y-0 right-[5%] flex items-center">
                    <Loader2 className="w-[5cqw] h-[5cqw] text-[#1b3a5c] animate-spin" />
                  </span>
                )}
                {playing && !loading && (
                  <span className="absolute inset-y-0 right-[5%] flex items-center gap-[1cqw]">
                    <span className="w-[1.2cqw] h-[3cqw] bg-green-600 rounded-full animate-pulse" />
                    <span className="w-[1.2cqw] h-[4.5cqw] bg-green-600 rounded-full animate-pulse" />
                    <span className="w-[1.2cqw] h-[2.5cqw] bg-green-600 rounded-full animate-pulse" />
                  </span>
                )}
              </PressableZone>
            );
          })}
        </div>

        {/* Radyoyu Kapat */}
        <PressableZone
          label="Radyoyu Kapat"
          sound={false}
          onPress={() => {
            playSound("buttonClick");
            stop();
            onClose();
          }}
          className="rounded-[2cqw]"
          style={{ left: "23.4%", width: "54%", top: "80.5%", height: "5.4%" }}
        />
      </div>
    </div>
  );
}
