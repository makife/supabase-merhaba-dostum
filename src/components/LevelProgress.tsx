
import React, { useMemo } from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Crown, Zap } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';

interface LevelProgressProps {
  className?: string;
}

export const LevelProgress = ({ className = "" }: LevelProgressProps) => {
  const { profile } = useUser();

  // Calculate level from total score - memoized for performance
  const levelData = useMemo(() => {
    const totalScore = profile?.total_score || 0;
    
    // Her seviye, seviye numarası × 1000 XP gerektirir
    // Seviye 1→2: 1000, Seviye 2→3: 2000, Seviye 3→4: 3000 ...
    let level = 1;
    let totalExpNeeded = 0;
    let currentLevelExp = 1000; // Seviye 1 için 1000 XP

    while (totalScore >= totalExpNeeded + currentLevelExp) {
      totalExpNeeded += currentLevelExp;
      level++;
      currentLevelExp = level * 1000; // Sonraki seviye = seviye × 1000
    }

    const experience = totalScore - totalExpNeeded;
    const nextLevelExp = currentLevelExp;

    return { level, experience, nextLevelExp, totalScore };
  }, [profile?.total_score]);

  // Calculate level-based exp multiplier
  const getLevelMultiplier = (level: number) => {
    return 1 + (level - 1) * 0.1;
  };

  const progressPercentage = (levelData.experience / levelData.nextLevelExp) * 100;

  return (
    <Card className={`light-gradient border-0 ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Crown className="w-4 h-4 text-yellow-600" />
            <span className="font-bold text-gray-700">Seviye {levelData.level}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-gray-600 font-medium">
              {levelData.experience}/{levelData.nextLevelExp} EXP
            </span>
          </div>
        </div>
        
        <div className="relative">
          <Progress 
            value={progressPercentage} 
            className="h-3 bg-white/60"
          />
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-yellow-400/20 to-orange-400/20" />
        </div>
        
        <div className="flex justify-between items-center mt-2">
          <Badge variant="outline" className="text-xs bg-white/40 text-gray-700 border-white/60">
            Toplam: {levelData.totalScore} puan
          </Badge>
          <span className="text-xs text-gray-600">
            %{Math.round(progressPercentage)} tamamlandı
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
