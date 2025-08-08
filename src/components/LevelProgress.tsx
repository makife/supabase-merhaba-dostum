import React, { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Crown, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface LevelProgressProps {
  className?: string;
}

export const LevelProgress = ({ className = "" }: LevelProgressProps) => {
  const { user } = useAuth();
  const [levelData, setLevelData] = useState({
    level: 1,
    experience: 0,
    nextLevelExp: 1000,
    totalScore: 0
  });

  // Calculate level from total score
  const calculateLevel = (totalScore: number) => {
    const baseExp = 1000;
    let level = 1;
    let expForCurrentLevel = 0;
    let expForNextLevel = baseExp;

    while (totalScore >= expForNextLevel) {
      expForCurrentLevel = expForNextLevel;
      level++;
      expForNextLevel = baseExp * Math.pow(1.5, level - 1); // Exponential scaling
    }

    const experience = totalScore - expForCurrentLevel;
    const nextLevelExp = expForNextLevel - expForCurrentLevel;

    return { level, experience, nextLevelExp, totalScore };
  };

  useEffect(() => {
    const fetchLevelData = async () => {
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('total_score')
        .eq('id', user.id)
        .single();

      if (data) {
        const calculatedLevel = calculateLevel(data.total_score || 0);
        setLevelData(calculatedLevel);
      }
    };

    fetchLevelData();
  }, [user]);

  // Listen for real-time updates to total_score
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('level-progress-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          if (payload.new.total_score !== undefined) {
            const calculatedLevel = calculateLevel(payload.new.total_score);
            setLevelData(calculatedLevel);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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