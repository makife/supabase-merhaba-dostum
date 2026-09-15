import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Trophy, Globe, Lock, Check, X } from "lucide-react";
import { useSounds } from "@/hooks/useSounds";

interface CreateTournamentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  onCreate: (opts: { name: string; avatarUrl: string | null; isPrivate: boolean }) => void;
}

const AVATAR_OPTIONS: string[] = Array.from({ length: 42 }, (_, i) => `/turnuvaGorsel/tur${i + 1}.svg`);

const CreateTournamentDialog = ({ open, onOpenChange, loading, onCreate }: CreateTournamentDialogProps) => {
  const { playSound } = useSounds();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string>(AVATAR_OPTIONS[0]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);

  const handleSubmit = () => {
    if (loading) return;
    playSound("buttonClick");
    onCreate({ name: name.trim(), avatarUrl: avatar, isPrivate });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100%-2rem)] max-w-sm rounded-3xl border-0 p-0 shadow-2xl bg-[#16213e] ring-1 ring-white/10"
      >
        <div className="px-5 pt-6 pb-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-amber-400 rounded-full" />
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Yeni Turnuva</h2>
          </div>
          <p className="text-[11px] text-slate-400 ml-3 mt-1">Turnuvanı kişiselleştir ve oluştur.</p>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Avatar */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2 block">
              Turnuva Avatarı
            </label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-white/5 ring-1 ring-white/10 overflow-hidden flex items-center justify-center flex-shrink-0">
                {avatar ? (
                  <img src={avatar} alt="" className="w-12 h-12 object-contain" />
                ) : (
                  <Trophy className="w-7 h-7 text-amber-400" />
                )}
              </div>
              <button
                onClick={() => { playSound("buttonClick"); setAvatarPickerOpen(true); }}
                className="flex-1 h-12 rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20 hover:bg-amber-500/15 active:scale-95 transition-all text-sm font-semibold text-amber-300"
              >
                Avatar Seç
              </button>
            </div>
          </div>

          {/* İsim */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2 block">
              Turnuva İsmi
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 32))}
              placeholder="Örn: Hafta Sonu Kupası"
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 rounded-xl h-11"
            />
          </div>

          {/* Mod */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2 block">
              Turnuva Modu
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { playSound("buttonClick"); setIsPrivate(false); }}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl ring-1 transition-all active:scale-95 ${
                  !isPrivate
                    ? "bg-emerald-500/15 ring-emerald-500/30 text-emerald-300"
                    : "bg-white/4 ring-white/10 text-slate-400"
                }`}
              >
                <Globe className="w-5 h-5" />
                <span className="text-xs font-bold">Genel</span>
                <span className="text-[10px] opacity-70">Herkese açık</span>
              </button>
              <button
                onClick={() => { playSound("buttonClick"); setIsPrivate(true); }}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl ring-1 transition-all active:scale-95 ${
                  isPrivate
                    ? "bg-indigo-500/15 ring-indigo-500/30 text-indigo-300"
                    : "bg-white/4 ring-white/10 text-slate-400"
                }`}
              >
                <Lock className="w-5 h-5" />
                <span className="text-xs font-bold">Özel</span>
                <span className="text-[10px] opacity-70">Davetle</span>
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 pb-4">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full h-12 rounded-2xl bg-amber-500/15 ring-1 ring-amber-500/30 hover:bg-amber-500/20 active:scale-95 transition-all text-sm font-bold text-amber-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Trophy className="w-4 h-4" />
            {loading ? "Oluşturuluyor..." : "Turnuvayı Oluştur"}
          </button>
        </div>

        {/* Avatar Picker */}
        {avatarPickerOpen && (
          <div className="absolute inset-0 z-10 bg-[#16213e] rounded-3xl flex flex-col">
            <div className="px-5 pt-6 pb-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-amber-400 rounded-full" />
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Avatar Seç</h2>
              </div>
              <button
                onClick={() => { playSound("buttonClick"); setAvatarPickerOpen(false); }}
                className="w-8 h-8 rounded-xl bg-white/8 ring-1 ring-white/10 flex items-center justify-center active:scale-90 transition-transform"
              >
                <X className="w-4 h-4 text-white/70" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="grid grid-cols-4 gap-2">
                {AVATAR_OPTIONS.map((src) => {
                  const selected = avatar === src;
                  return (
                    <button
                      key={src}
                      onClick={() => {
                        playSound("buttonClick");
                        setAvatar(src);
                        setAvatarPickerOpen(false);
                      }}
                      className={`relative aspect-square rounded-2xl bg-white/5 ring-1 transition-all active:scale-95 flex items-center justify-center ${
                        selected ? "ring-amber-400 bg-amber-500/15" : "ring-white/10 hover:bg-white/10"
                      }`}
                    >
                      <img src={src} alt="" className="w-12 h-12 object-contain" />
                      {selected && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center">
                          <Check className="w-3 h-3 text-[#16213e]" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreateTournamentDialog;
