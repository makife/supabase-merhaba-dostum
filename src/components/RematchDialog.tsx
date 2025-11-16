import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, User } from "lucide-react";

interface RematchDialogProps {
  open: boolean;
  onAccept: () => void;
  onReject: () => void;
  senderName: string;
  senderAvatar?: string | null;
}

export const RematchDialog = ({
  open,
  onAccept,
  onReject,
  senderName,
  senderAvatar,
}: RematchDialogProps) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAccept = async () => {
    setIsProcessing(true);
    try {
      await onAccept();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await onReject();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <Trophy className="h-6 w-6 text-primary animate-pulse" />
            Yeniden Maç İsteği
          </DialogTitle>
          <DialogDescription className="pt-4">
            <div className="flex items-center gap-3 mb-4">
              <Avatar className="h-12 w-12 border-2 border-primary">
                <AvatarImage src={senderAvatar || undefined} />
                <AvatarFallback>
                  <User className="h-6 w-6" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-semibold text-foreground text-base">
                  {senderName}
                </p>
                <p className="text-sm text-muted-foreground">
                  yeniden maç istiyor!
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Aynı rakibinle yeniden karşılaşmak ister misiniz?
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={isProcessing}
            className="flex-1"
          >
            Reddet
          </Button>
          <Button
            onClick={handleAccept}
            disabled={isProcessing}
            className="flex-1 bg-primary hover:bg-primary/90"
          >
            {isProcessing ? "Yükleniyor..." : "Kabul Et"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
