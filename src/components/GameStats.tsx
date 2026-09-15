// OPTIMIZED: Separated GameStats component 
import React, { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Clock, Target, Trophy, User, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GameStatsProps {
  gameType: 'timed' | 'score';
  displayTime: number;
  targetScore: number;
  playerScore: number;
  opponentScore: number;
  playerName: string;
  opponentName: string;
  playerAvatar: string;
  opponentAvatar: string;
  isAIOpponent: boolean;
  gameStarted: boolean;
  gameEnded: boolean;
  winner: 'player' | 'opponent' | 'tie' | null;
  preparingOpponent?: 'preparing' | 'ready' | null;
  className?: string;
}

const GameStats = memo<GameStatsProps>(({
  gameType,
  displayTime,
  targetScore,
  playerScore,
  opponentScore,
  playerName,
  opponentName,
  playerAvatar,
  opponentAvatar,
  isAIOpponent,
  gameStarted,
  gameEnded,
  winner,
  preparingOpponent,
  className
}) => {
  
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(Math.abs(seconds) / 60);
    const secs = Math.abs(seconds) % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeColor = (time: number): string => {
    if (time <= 10) return 'text-red-500';
    if (time <= 30) return 'text-yellow-500';
    return 'text-foreground';
  };

  const getScoreProgress = (score: number): number => {
    return gameType === 'score' ? Math.min((score / targetScore) * 100, 100) : 0;
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Timer/Target Display */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-center gap-4">
            {gameType === 'timed' ? (
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                <span className={cn("text-2xl font-bold", getTimeColor(displayTime))}>
                  {formatTime(displayTime)}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                <span className="text-lg font-semibold">
                  Hedef: {targetScore} Puan
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Player Scores */}
      <div className="grid grid-cols-2 gap-4">
        {/* Player Card */}
        <Card className={cn("relative", winner === 'player' && gameEnded && "ring-2 ring-green-500")}>
          <CardContent className="p-4">
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={playerAvatar} />
                  <AvatarFallback>
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-sm truncate max-w-20">
                  {playerName || 'Sen'}
                </span>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {playerScore}
                </div>
                {gameType === 'score' && (
                  <Progress 
                    value={getScoreProgress(playerScore)} 
                    className="w-full h-2 mt-1" 
                  />
                )}
              </div>
              
              {winner === 'player' && gameEnded && (
                <Badge variant="default" className="text-xs">
                  <Trophy className="h-3 w-3 mr-1" />
                  Kazandı
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Opponent Card */}
        <Card className={cn("relative", winner === 'opponent' && gameEnded && "ring-2 ring-green-500")}>
          <CardContent className="p-4">
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={opponentAvatar} />
                  <AvatarFallback>
                    {isAIOpponent ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-sm truncate max-w-20">
                  {opponentName || (isAIOpponent ? 'AI' : 'Rakip')}
                </span>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {opponentScore}
                </div>
                {gameType === 'score' && (
                  <Progress 
                    value={getScoreProgress(opponentScore)} 
                    className="w-full h-2 mt-1" 
                  />
                )}
              </div>
              
              {winner === 'opponent' && gameEnded && (
                <Badge variant="default" className="text-xs">
                  <Trophy className="h-3 w-3 mr-1" />
                  Kazandı
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Game Status */}
      {!gameStarted && (
        <div className="text-center">
          <Badge variant="secondary">Oyun Başlıyor...</Badge>
        </div>
      )}
      
      {winner === 'tie' && gameEnded && (
        <div className="text-center">
          <Badge variant="outline" className="text-lg px-4 py-2">
            🤝 Berabere!
          </Badge>
        </div>
      )}
    </div>
  );
});

GameStats.displayName = "GameStats";

export default GameStats;