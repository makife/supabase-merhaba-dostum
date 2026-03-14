import { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getRankTier } from '@/utils/rankSystem';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import robotAvatar from '@/assets/robot-avatar.png';

// Level calculation (same formula everywhere)
function calcLevelFromScore(totalScore: number): number {
  let level = 1;
  let totalExpNeeded = 0;
  let currentLevelExp = 1000;
  while (totalScore >= totalExpNeeded + currentLevelExp) {
    totalExpNeeded += currentLevelExp;
    level++;
    currentLevelExp = level * 1000;
  }
  return level;
}

interface PlayerInfo {
  username: string;
  avatar_url: string | null;
  rank_points: number;
  total_score: number;
}

interface VsIntroScreenProps {
  roomId: string;
  isAI: boolean;
  onComplete: () => void;
}

type AnimPhase = 'enter' | 'hold' | 'exit' | 'done';

const VsIntroScreen = ({ roomId, isAI, onComplete }: VsIntroScreenProps) => {
  const { user } = useAuth();
  const { profile } = useUser();
  const [opponent, setOpponent] = useState<PlayerInfo | null>(null);
  const onCompleteRef = useRef(onComplete);

  const [myInfo, setMyInfo] = useState<PlayerInfo>({
    username: profile?.username || 'Sen',
    avatar_url: profile?.avatar_url || null,
    rank_points: 0,
    total_score: profile?.total_score || 0,
  });

  // Fetch own rank_points from profiles table
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('profiles')
      .select('rank_points, total_score, username, avatar_url')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setMyInfo({
            username: data.username || 'Sen',
            avatar_url: data.avatar_url,
            rank_points: data.rank_points || 0,
            total_score: data.total_score || 0,
          });
        }
      });
  }, [user?.id]);

  // Fetch opponent info
  useEffect(() => {
    if (isAI) {
      setOpponent({
        username: 'Yapay Zeka',
        avatar_url: robotAvatar,
        rank_points: Math.floor(Math.random() * 2000),
        total_score: Math.floor(Math.random() * 10000),
      });
      return;
    }

    const fetchOpponent = async () => {
      try {
        const { data: participants } = await supabase
          .from('game_participants')
          .select('user_id, is_bot')
          .eq('room_id', roomId);

        if (!participants) return;

        const opponentParticipant = participants.find(
          (p) => p.user_id !== user?.id && !p.is_bot
        );

        if (opponentParticipant?.user_id) {
          const { data: opProfile } = await supabase
            .from('profiles')
            .select('username, avatar_url, rank_points, total_score')
            .eq('id', opponentParticipant.user_id)
            .single();

          if (opProfile) {
            setOpponent({
              username: opProfile.username || 'Rakip',
              avatar_url: opProfile.avatar_url,
              rank_points: opProfile.rank_points || 0,
              total_score: opProfile.total_score || 0,
            });
          }
        }
      } catch (err) {
        console.error('VS intro opponent fetch error:', err);
      }
    };

    fetchOpponent();
  }, [roomId, isAI, user?.id]);

  // Animation sequence: enter(0.3s) -> hold(1s) -> exit(0.3s) -> done
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    timers.push(setTimeout(() => setPhase('hold'), 300));
    timers.push(setTimeout(() => setPhase('exit'), 1300));
    timers.push(setTimeout(() => {
      setPhase('done');
      onComplete();
    }, 1600));
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  const getTransformTop = () => {
    switch (phase) {
      case 'enter': return 'translate-x-full';
      case 'hold': return 'translate-x-0';
      case 'exit': return '-translate-x-full';
      case 'done': return '-translate-x-full';
    }
  };

  const getTransformBottom = () => {
    switch (phase) {
      case 'enter': return '-translate-x-full';
      case 'hold': return 'translate-x-0';
      case 'exit': return 'translate-x-full';
      case 'done': return 'translate-x-full';
    }
  };

  const myRank = getRankTier(myInfo.rank_points);
  const myLevel = calcLevelFromScore(myInfo.total_score);
  const opRank = opponent ? getRankTier(opponent.rank_points) : null;
  const opLevel = opponent ? calcLevelFromScore(opponent.total_score) : null;

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col bg-background overflow-hidden">
      {/* Top half - current player (slides from right) */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden border-b-2 border-primary/30">
        {/* Diagonal decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
        
        <div
          className={`flex flex-col items-center gap-3 transition-transform duration-300 ease-out ${getTransformTop()}`}
        >
          <PlayerCard
            username={myInfo.username}
            avatarUrl={myInfo.avatar_url}
            rankImage={myRank.image}
            rankName={myRank.name}
            level={myLevel}
          />
        </div>
      </div>

      {/* VS text in the middle */}
      <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
        <div className={`text-5xl font-black text-primary drop-shadow-lg transition-all duration-300 ${
          phase === 'hold' ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
        }`}>
          VS
        </div>
      </div>

      {/* Bottom half - opponent (slides from left) */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tl from-destructive/10 to-transparent" />
        
        <div
          className={`flex flex-col items-center gap-3 transition-transform duration-300 ease-out ${getTransformBottom()}`}
        >
          {opponent ? (
            <PlayerCard
              username={opponent.username}
              avatarUrl={opponent.avatar_url}
              rankImage={opRank!.image}
              rankName={opRank!.name}
              level={opLevel!}
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-muted animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
};

interface PlayerCardProps {
  username: string;
  avatarUrl: string | null;
  rankImage: string;
  rankName: string;
  level: number;
}

const PlayerCard = ({ username, avatarUrl, rankImage, rankName, level }: PlayerCardProps) => (
  <div className="flex flex-col items-center gap-2">
    <Avatar className="w-20 h-20 border-3 border-primary/50 shadow-lg">
      <AvatarImage src={avatarUrl || undefined} />
      <AvatarFallback className="text-2xl font-bold bg-muted">
        {username.charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>

    <img src={rankImage} alt={rankName} className="w-10 h-10 object-contain" />

    <div className="text-center">
      <p className="text-lg font-bold text-foreground">{username}</p>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{rankName}</span>
        <span>•</span>
        <span>Seviye {level}</span>
      </div>
    </div>
  </div>
);

export default VsIntroScreen;
