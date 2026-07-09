import { useRadio } from "@/contexts/RadioContext";
import { X, Play, Pause, Loader2, Radio as RadioIcon } from "lucide-react";
import { useSounds } from "@/hooks/useSounds";

interface RadioPickerProps {
  open: boolean;
  onClose: () => void;
}

export function RadioPicker({ open, onClose }: RadioPickerProps) {
  const { stations, currentStation, isPlaying, isLoading, play, stop } = useRadio();
  const { playSound } = useSounds();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-[#1e2d45] border border-white/10 shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <RadioIcon className="w-5 h-5 text-amber-400" />
            <h3 className="text-white font-bold text-lg">Radyo</h3>
          </div>
          <button
            onClick={() => { playSound("buttonClick"); onClose(); }}
            className="p-1.5 rounded-full hover:bg-white/10 active:opacity-70"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <p className="text-white/60 text-xs mb-3">
          Türkçe internet radyo kanalları. Bu uygulama radyoların resmi public url adreslerini kullanır. Uygulama arka plana geçince durur. 
        </p>

        <div className="max-h-[55vh] overflow-y-auto flex flex-col gap-2 pr-1">
          {stations.map((s) => {
            const active = currentStation?.id === s.id;
            const loading = active && isLoading;
            const playing = active && isPlaying;
            return (
              <button
                key={s.id}
                onClick={() => {
                  playSound("buttonClick");
                  if (playing) stop();
                  else play(s);
                }}
                className={`flex items-center justify-between w-full px-4 py-3 rounded-xl border transition ${
                  active
                    ? "bg-amber-500/20 border-amber-400/50"
                    : "bg-white/5 border-white/10 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center min-w-0">
                  <span className="text-white font-medium text-sm truncate">{s.name}</span>
                </div>
                <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  {loading ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  ) : playing ? (
                    <Pause className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Play className="w-4 h-4 text-white" />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {currentStation && isPlaying && (
          <button
            onClick={() => { playSound("buttonClick"); stop(); }}
            className="mt-4 w-full py-2.5 rounded-xl bg-red-500/90 text-white font-semibold text-sm active:opacity-80"
          >
            Radyoyu Durdur
          </button>
        )}
      </div>
    </div>
  );
}
