import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { SvgAsset } from "@/components/ui/svg-asset";

interface GameAvatarsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (avatarPath: string) => void;
}

export const GameAvatarsDialog = ({ open, onOpenChange, onSelect }: GameAvatarsDialogProps) => {
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);

  const allAvatars = Array.from({ length: 90 }, (_, i) => `/avatarlar/${i + 1}.svg`);

  const handleAvatarSelect = (avatarPath: string) => {
    setSelectedAvatar(avatarPath);
    onSelect(avatarPath);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Oyun Avatarları</DialogTitle>
          <DialogDescription>Bir avatar seçin</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          <div className="grid grid-cols-4 gap-3">
            {allAvatars.map((avatarPath, index) => (
              <button
                key={index}
                onClick={() => handleAvatarSelect(avatarPath)}
                className={cn(
                  "relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:scale-105",
                  selectedAvatar === avatarPath
                    ? "border-primary ring-2 ring-primary"
                    : "border-border hover:border-primary/50",
                )}
              >
                <SvgAsset
                  src={avatarPath}
                  alt={`Avatar ${index + 1}`}
                  className="h-full w-full rounded-lg bg-card"
                  backgroundSize="90%"
                />
              </button>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
