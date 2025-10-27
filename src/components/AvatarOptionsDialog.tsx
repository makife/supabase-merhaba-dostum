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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Avatar Değiştir</DialogTitle>
            <DialogDescription>
              Avatar resmini nasıl değiştirmek istersiniz?
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <Button
              onClick={onCameraSelect}
              className="w-full justify-start gap-3 h-14"
              variant="outline"
            >
              <CameraIcon className="w-5 h-5" />
              <div className="text-left">
                <div className="font-semibold">Kamerayı Kullan</div>
                <div className="text-xs text-muted-foreground">Fotoğraf çek</div>
              </div>
            </Button>

            <Button
              onClick={onGallerySelect}
              className="w-full justify-start gap-3 h-14"
              variant="outline"
            >
              <Image className="w-5 h-5" />
              <div className="text-left">
                <div className="font-semibold">Galeriden Seç</div>
                <div className="text-xs text-muted-foreground">Cihazdan resim seç</div>
              </div>
            </Button>

            <Button
              onClick={handleGameAvatarsClick}
              className="w-full justify-start gap-3 h-14"
              variant="outline"
            >
              <Gamepad2 className="w-5 h-5" />
              <div className="text-left">
                <div className="font-semibold">Oyun Avatarları</div>
                <div className="text-xs text-muted-foreground">Hazır avatarlardan seç</div>
              </div>
            </Button>

            <Button
              onClick={onDelete}
              className="w-full justify-start gap-3 h-14"
              variant="outline"
            >
              <Trash2 className="w-5 h-5 text-destructive" />
              <div className="text-left">
                <div className="font-semibold text-destructive">Avatarı Sil</div>
                <div className="text-xs text-muted-foreground">Varsayılan avatara dön</div>
              </div>
            </Button>
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
