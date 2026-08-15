import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "lucide-react";
import { PressableZone } from "@/components/ui/pressable-zone";
import yenidenMacKarti from "@/assets/yenidenMacKarti.png";

interface RematchDialogProps {
  open: boolean;
  onAccept: () => void;
  onReject: () => void;
  senderName: string;
  senderAvatar?: string | null;
  hasEnoughCredits?: boolean;
  isAdBusy?: boolean;
}

export const RematchDialog = ({
  open,
  onAccept,
  onReject,
  senderName,
  senderAvatar,
  hasEnoughCredits = true,
  isAdBusy = false,
}: RematchDialogProps) => {
  const [isProcessing, setIsProcessing] = useState(false);

  if (!open) return null;

  const handleAccept = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await onAccept();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await onReject();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-[380px] animate-in fade-in zoom-in-95 duration-300"
        style={{ containerType: "inline-size" }}
      >
        <img
          src={yenidenMacKarti}
          alt="Yeniden maç isteği"
          className="w-full h-auto select-none pointer-events-none"
        />

        {/* Avatar - dairenin tam içi (yenidenMacKarti.png piksel piksel ölçüldü: 688x1000) */}
        <div
          className="absolute overflow-hidden rounded-full"
          style={{ left: "12.65%", top: "31.5%", width: "23.98%", height: "16.2%" }}
        >
          <Avatar className="w-full h-full rounded-full">
            <AvatarImage src={senderAvatar || undefined} className="object-cover" />
            <AvatarFallback className="bg-amber-200 text-amber-900">
              <User className="w-1/2 h-1/2" />
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Rumuz - input field içi */}
        <div
          className="absolute flex items-center justify-center px-[1cqw]"
          style={{ left: "43.46%", top: "35.8%", width: "44.91%", height: "7.9%" }}
        >
          <span
            className="w-full text-center font-extrabold truncate leading-none"
            style={{
              fontSize: "4.6cqw",
              color: "#16a34a",
              textShadow: "0 1px 0 rgba(255,255,255,0.6)",
            }}
          >
            {senderName}
          </span>
        </div>

        {/* REDDET */}
        <PressableZone
          label="Reddet"
          onPress={handleReject}
          disabled={isProcessing}
          style={{ left: "9.45%", top: "70.1%", width: "38.81%", height: "12%" }}
          haptic="medium"
        />

        {/* KABUL ET */}
        <PressableZone
          label="Kabul Et"
          onPress={handleAccept}
          disabled={isProcessing || !hasEnoughCredits || isAdBusy}
          style={{ left: "52.04%", top: "71.6%", width: "38.52%", height: "10.5%" }}
          haptic="medium"
        />

        {!hasEnoughCredits && (
          <div
            className="absolute left-[10%] w-[80%] text-center font-bold text-red-700"
            style={{ top: "83%", fontSize: "3.6cqw" }}
          >
            ⚠️ Yeterli hakkınız bulunmuyor
          </div>
        )}
      </div>
    </div>
  );
};
