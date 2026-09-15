import { Camera } from "@capacitor/camera";
import { CameraResultType, CameraSource } from "@capacitor/camera";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera as CameraIcon, Image, Gamepad2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { GameAvatarsDialog } from "./GameAvatarsDialog";

interface AvatarOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCameraSelect: () => void;
  onGallerySelect: () => void;
  onGameAvatarsSelect: (avatarPath: string) => void;
  onDelete: () => void;
}

export const AvatarOptionsDialog = ({
  open,
  onOpenChange,
  onCameraSelect,
  onGallerySelect,
  onGameAvatarsSelect,
  onDelete,
}: AvatarOptionsDialogProps) => {
  const [showGameAvatars, setShowGameAvatars] = useState(false);

  const handleGameAvatarsClick = () => {
    onOpenChange(false);
    setShowGameAvatars(true);
  };

  const handleGameAvatarSelect = (avatarPath: string) => {
    onGameAvatarsSelect(avatarPath);
  };

  const options = [
    {
      icon: CameraIcon,
      label: "Kamerayı Kullan",
      sub: "Fotoğraf çek",
      dotColor: "bg-blue-400",
      iconBg: "bg-blue-500/20 text-blue-300",
      onClick: onCameraSelect,
      danger: false,
    },
    {
      icon: Image,
      label: "Galeriden Seç",
      sub: "Cihazdan resim seç",
      dotColor: "bg-emerald-400",
      iconBg: "bg-emerald-500/20 text-emerald-300",
      onClick: onGallerySelect,
      danger: false,
    },
    {
      icon: Gamepad2,
      label: "Oyun Avatarları",
      sub: "Hazır avatarlardan seç",
      dotColor: "bg-purple-400",
      iconBg: "bg-purple-500/20 text-purple-300",
      onClick: handleGameAvatarsClick,
      danger: false,
    },
    {
      icon: Trash2,
      label: "Avatarı Sil",
      sub: "Varsayılan avatara dön",
      dotColor: "bg-red-400",
      iconBg: "bg-red-500/20 text-red-300",
      onClick: onDelete,
      danger: true,
    },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="
  left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm
  rounded-3xl border-0 p-0 shadow-2xl
  bg-[#16213e]
  ring-1 ring-white/10
"
        >
          {/* Başlık */}
          <div className="px-5 pt-6 pb-4 border-b border-white/5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-5 bg-indigo-400 rounded-full" />
              <h2 className="text-sm font-black text-white uppercase tracking-widest">Avatar Değiştir</h2>
            </div>
            <p className="text-[11px] text-slate-400 ml-3">Avatar resmini nasıl değiştirmek istersiniz?</p>
          </div>

          {/* Seçenekler */}
          <div className="px-4 py-4 flex flex-col gap-2.5">
            {options.map((opt) => {
              const Icon = opt.icon;
              return (
                <div
                  key={opt.label}
                  onClick={opt.onClick}
                  className={`
                    flex items-center gap-3 cursor-pointer select-none
                    rounded-2xl px-3 py-3
                    ring-1 transition-colors duration-150 active:scale-95
                    shadow-[0_2px_12px_rgba(0,0,0,0.3)]
                    ${
                      opt.danger
                        ? "bg-red-500/10 ring-red-500/20 hover:bg-red-500/15"
                        : "bg-white/8 ring-white/10 hover:bg-white/12 hover:ring-white/20"
                    }
                  `}
                >
                  {/* Sol renkli dot */}
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${opt.dotColor}`} />

                  {/* Yazı */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${opt.danger ? "text-red-300" : "text-white/95"}`}>
                      {opt.label}
                    </p>
                    <p className="text-[11px] text-slate-400">{opt.sub}</p>
                  </div>

                  {/* İkon */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${opt.iconBg}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Alt boşluk */}
          <div className="h-2" />
        </DialogContent>
      </Dialog>

      <GameAvatarsDialog open={showGameAvatars} onOpenChange={setShowGameAvatars} onSelect={handleGameAvatarSelect} />
    </>
  );
};
