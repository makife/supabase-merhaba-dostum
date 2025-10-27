import { Camera } from '@capacitor/camera';
import { CameraResultType, CameraSource } from '@capacitor/camera';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera as CameraIcon, Image, Gamepad2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { GameAvatarsDialog } from './GameAvatarsDialog';

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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
          <DialogHeader className="p-6 pb-4 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Avatar Değiştir
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Avatar resmini nasıl değiştirmek istersiniz?
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-6 pt-4">
            {/* Kamera - Primary Gradient */}
            <button
              onClick={onCameraSelect}
              className="group relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-primary/90 to-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 flex flex-col items-center justify-center gap-3 min-h-[140px]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10 bg-white/20 rounded-full p-4 group-hover:scale-110 transition-transform duration-300">
                <CameraIcon className="w-8 h-8" />
              </div>
              <div className="relative z-10 text-center">
                <div className="font-bold text-lg mb-1">Kamerayı Kullan</div>
                <div className="text-xs opacity-90">Fotoğraf çek</div>
              </div>
            </button>

            {/* Galeri - Accent Gradient */}
            <button
              onClick={onGallerySelect}
              className="group relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-accent/90 to-accent text-accent-foreground shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 flex flex-col items-center justify-center gap-3 min-h-[140px]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10 bg-white/20 rounded-full p-4 group-hover:scale-110 transition-transform duration-300">
                <Image className="w-8 h-8" />
              </div>
              <div className="relative z-10 text-center">
                <div className="font-bold text-lg mb-1">Galeriden Seç</div>
                <div className="text-xs opacity-90">Cihazdan resim seç</div>
              </div>
            </button>

            {/* Oyun Avatarları - Success Gradient */}
            <button
              onClick={handleGameAvatarsClick}
              className="group relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 flex flex-col items-center justify-center gap-3 min-h-[140px]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10 bg-white/20 rounded-full p-4 group-hover:scale-110 transition-transform duration-300">
                <Gamepad2 className="w-8 h-8" />
              </div>
              <div className="relative z-10 text-center">
                <div className="font-bold text-lg mb-1">Oyun Avatarları</div>
                <div className="text-xs opacity-90">Hazır avatarlardan seç</div>
              </div>
            </button>

            {/* Sil - Destructive Gradient */}
            <button
              onClick={onDelete}
              className="group relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-destructive/90 to-destructive text-destructive-foreground shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 flex flex-col items-center justify-center gap-3 min-h-[140px]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10 bg-white/20 rounded-full p-4 group-hover:scale-110 transition-transform duration-300">
                <Trash2 className="w-8 h-8" />
              </div>
              <div className="relative z-10 text-center">
                <div className="font-bold text-lg mb-1">Avatarı Sil</div>
                <div className="text-xs opacity-90">Varsayılan avatara dön</div>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <GameAvatarsDialog
        open={showGameAvatars}
        onOpenChange={setShowGameAvatars}
        onSelect={handleGameAvatarSelect}
      />
    </>
  );
};
