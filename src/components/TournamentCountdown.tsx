import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Bot } from "lucide-react";
import Lottie from "lottie-react";

interface TournamentCountdownProps {
  timeLeft: number;
  realPlayerCount: number;
  totalParticipants: number;
  isCreator: boolean;
}

export const TournamentCountdown: React.FC<TournamentCountdownProps> = ({
  timeLeft,
  realPlayerCount,
  totalParticipants,
  isCreator,
}) => {
  const [basliyorAnim, setBasliyorAnim] = useState<any>(null);

  useEffect(() => {
    fetch("/turnuvaBasliyor.json")
      .then((r) => r.json())
      .then(setBasliyorAnim)
      .catch(console.error);
  }, []);
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getBotCount = () => totalParticipants - realPlayerCount;

  const getStatusMessage = () => {
    if (realPlayerCount < 2) {
      return {
        text: "En az 2 oyuncu gerekli",
        color: "text-red-400",
        emoji: "⚠️",
      };
    }

    if (realPlayerCount >= 8) {
      return {
        text: "TAM KADRO! 8 oyunculu turnuva",
        color: "text-yellow-400",
        emoji: "🔥",
      };
    }

    if (realPlayerCount >= 4) {
      return {
        text: "Yeterli oyuncu var, harika bir turnuva olacak!",
        color: "text-green-400",
        emoji: "✅",
      };
    }

    return {
      text: `Turnuva başlayacak! ${8 - realPlayerCount} eksik slotlar botlarla doldurulacak`,
      color: "text-blue-400",
      emoji: "🤖",
    };
  };

  const status = getStatusMessage();

  return (
    <Card className="mb-6 bg-white/10 backdrop-blur-md border-white/20">
      <CardContent className="p-6 text-center">
        {basliyorAnim ? (
          <Lottie animationData={basliyorAnim} loop autoplay style={{ width: 48, height: 48, margin: '0 auto 16px' }} />
        ) : (
          <div className="w-12 h-12 mx-auto mb-4" />
        )}
        <h2 className="text-2xl font-bold text-white mb-2">Turnuva Başlıyor!</h2>

        <div className="text-4xl font-bold text-yellow-400 mb-4">{formatTime(timeLeft)}</div>

        <div className="space-y-3">
          <div className="flex items-center justify-center space-x-6">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-green-400" />
              <span className="text-green-400 font-bold">{realPlayerCount} Oyuncu</span>
            </div>

            {getBotCount() > 0 && (
              <div className="flex items-center space-x-2">
                <Bot className="w-5 h-5 text-gray-400" />
                <span className="text-gray-400">{getBotCount()} Bot</span>
              </div>
            )}
          </div>

          <p className={`text-sm font-medium ${status.color}`}>
            {status.emoji} {status.text}
          </p>

          {!isCreator && <p className="text-blue-300 text-sm">Turnuvanın başlaması bekleniyor...</p>}

          {isCreator && realPlayerCount < 2 && (
            <p className="text-red-300 text-sm">⏱️ Süre bittiğinde turnuva iptal edilecek</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
