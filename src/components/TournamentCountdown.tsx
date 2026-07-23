import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import Lottie from "lottie-react";

interface TournamentCountdownProps {
  timeLeft: number;
  realPlayerCount: number;
  isCreator: boolean;
  isBotTournament?: boolean;
}

export const TournamentCountdown: React.FC<TournamentCountdownProps> = ({
  timeLeft,
  realPlayerCount,
  isCreator,
  isBotTournament = false,
}) => {
  const [baslamakUzereAnim, setBaslamakUzereAnim] = useState<any>(null);

  useEffect(() => {
    fetch("/turnuvaBaslamakUzere.json")
      .then((r) => r.json())
      .then(setBaslamakUzereAnim)
      .catch(console.error);
  }, []);
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusMessage = () => {
    if (realPlayerCount < 2) {
      return {
        text: isBotTournament ? null : "Oyuncular bekleniyor",
        color: isBotTournament ? "text-blue-400" : "text-red-400",
        emoji: isBotTournament ? "⏳" : "⚠️",
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
      text: null,
      color: "text-blue-400",
      emoji: "⏳",
    };
  };

  const status = getStatusMessage();

  return (
    <Card className="bg-white/10 backdrop-blur-md border-white/20">
      <CardContent className="p-6 text-center">
        {baslamakUzereAnim ? (
          <Lottie animationData={baslamakUzereAnim} loop autoplay style={{ width: 96, height: 96, margin: '0 auto -32px', transform: 'translateY(-20px)' }} />
        ) : (
          <div className="w-12 h-12 mx-auto mb-4" />
        )}
        <h2 className="text-2xl font-bold text-white mb-2">Turnuva Başlıyor!</h2>

        <div className="text-4xl font-bold text-yellow-400 mb-4">{formatTime(timeLeft)}</div>

        <div className="space-y-3">
          {status.text && (
            <p className={`text-sm font-medium ${status.color}`}>
              {status.emoji} {status.text}
            </p>
          )}

          {!isCreator && <p className="text-blue-300 text-sm">Turnuvanın başlaması bekleniyor...</p>}

          {isCreator && !isBotTournament && realPlayerCount < 2 && (
            <p className="text-red-300 text-sm">⏱️ Süre bittiğinde turnuva iptal edilecek</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
