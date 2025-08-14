import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Crown, Trophy, Medal, User, Bot, CheckCircle } from 'lucide-react';

interface TournamentMatch {
  id: string;
  tournament_id: string;
  round: number;
  match_number: number;
  player1_id: string | null;
  player2_id: string | null;
  player1_score?: number; // Optional çünkü database'de olmayabilir
  player2_score?: number; // Optional çünkü database'de olmayabilir
  winner_id: string | null;
  status: string; // Database'den string gelir
  created_at: string;
  updated_at?: string; // Optional çünkü database'de olmayabilir
  room_id?: string; // Database'de varsa
}

interface TournamentParticipant {
  id: string;
  tournament_id: string;
  user_id: string | null;
  seed: number;
  is_bot: boolean;
  eliminated_at: string | null;
  profiles?: {
    username: string;
    avatar_url: string | null;
  };
}

interface TournamentBracketProps {
  matches: TournamentMatch[];
  participants: TournamentParticipant[];
  currentUserId?: string;
}

const TournamentBracket: React.FC<TournamentBracketProps> = ({
  matches,
  participants,
  currentUserId
}) => {
  // Katılımcı bilgilerini ID'ye göre organize et
  const participantMap = participants.reduce((acc, participant) => {
    if (participant.user_id) {
      acc[participant.user_id] = participant;
    }
    return acc;
  }, {} as Record<string, TournamentParticipant>);

  // Maçları tura göre organize et
  const matchesByRound = matches.reduce((acc, match) => {
    if (!acc[match.round]) {
      acc[match.round] = [];
    }
    acc[match.round].push(match);
    return acc;
  }, {} as Record<number, TournamentMatch[]>);

  // Katılımcı bilgilerini getir
  const getParticipantInfo = (userId: string | null) => {
    if (!userId) {
      return {
        name: 'TBD',
        avatar: null,
        isBot: false,
        isCurrentUser: false
      };
    }

    const participant = participantMap[userId];
    if (!participant) {
      return {
        name: 'Bilinmeyen',
        avatar: null,
        isBot: false,
        isCurrentUser: false
      };
    }

    return {
      name: participant.is_bot 
        ? `Bot ${participant.seed}` 
        : participant.profiles?.username || `Oyuncu ${participant.seed}`,
      avatar: participant.profiles?.avatar_url,
      isBot: participant.is_bot,
      isCurrentUser: userId === currentUserId
    };
  };

  // Maç kartı bileşeni
  const MatchCard = ({ match, roundName }: { match: TournamentMatch; roundName: string }) => {
    const player1 = getParticipantInfo(match.player1_id);
    const player2 = getParticipantInfo(match.player2_id);
    const isCompleted = match.status === 'completed';
    const isActive = match.status === 'active';
    const isPending = match.status === 'pending';

    return (
      <Card className={`w-full transition-all duration-300 ${
        isActive ? 'border-primary bg-primary/5 shadow-lg' : 
        isCompleted ? 'border-green-500 bg-green-50' : 'border-muted'
      }`}>
        <CardContent className="p-3">
          <div className="space-y-2">
            <div className="text-center">
              <Badge variant={isActive ? 'default' : isCompleted ? 'secondary' : 'outline'} className="text-xs">
                {roundName} - Maç {match.match_number}
              </Badge>
            </div>
            
            {/* Oyuncu 1 */}
            <div className={`flex items-center justify-between p-2 rounded-lg transition-all ${
              match.winner_id === match.player1_id ? 'bg-green-100 border border-green-300' : 'bg-muted/50'
            }`}>
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                <Avatar className="w-6 h-6">
                  <AvatarImage src={player1.avatar || undefined} />
                  <AvatarFallback>
                    {player1.isBot ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
                  </AvatarFallback>
                </Avatar>
                <span className={`text-sm font-medium truncate ${
                  player1.isCurrentUser ? 'text-primary font-bold' : ''
                }`}>
                  {player1.name}
                  {player1.isCurrentUser && ' (Sen)'}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                {isCompleted && (
                  <span className="text-sm font-bold">{match.player1_score || 0}</span>
                )}
                {match.winner_id === match.player1_id && (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                )}
              </div>
            </div>

            {/* VS Divider */}
            <div className="text-center">
              <span className="text-xs text-muted-foreground font-bold">VS</span>
            </div>

            {/* Oyuncu 2 */}
            <div className={`flex items-center justify-between p-2 rounded-lg transition-all ${
              match.winner_id === match.player2_id ? 'bg-green-100 border border-green-300' : 'bg-muted/50'
            }`}>
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                <Avatar className="w-6 h-6">
                  <AvatarImage src={player2.avatar || undefined} />
                  <AvatarFallback>
                    {player2.isBot ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
                  </AvatarFallback>
                </Avatar>
                <span className={`text-sm font-medium truncate ${
                  player2.isCurrentUser ? 'text-primary font-bold' : ''
                }`}>
                  {player2.name}
                  {player2.isCurrentUser && ' (Sen)'}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                {isCompleted && (
                  <span className="text-sm font-bold">{match.player2_score || 0}</span>
                )}
                {match.winner_id === match.player2_id && (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                )}
              </div>
            </div>

            {/* Durum */}
            <div className="text-center">
              {isActive && (
                <Badge variant="default" className="text-xs animate-pulse">
                  🎮 Aktif
                </Badge>
              )}
              {isCompleted && (
                <Badge variant="secondary" className="text-xs">
                  ✅ Tamamlandı
                </Badge>
              )}
              {isPending && (
                <Badge variant="outline" className="text-xs">
                  ⏳ Bekliyor
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Tur isimlerini belirle
  const getRoundName = (round: number) => {
    switch (round) {
      case 1: return 'Çeyrek Final';
      case 2: return 'Yarı Final';
      case 3: return 'Final';
      default: return `${round}. Tur`;
    }
  };

  // Tur ikonlarını belirle
  const getRoundIcon = (round: number) => {
    switch (round) {
      case 1: return Medal;
      case 2: return Trophy;
      case 3: return Crown;
      default: return Trophy;
    }
  };

  const rounds = Object.keys(matchesByRound).map(Number).sort();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold flex items-center justify-center space-x-2">
          <Trophy className="w-6 h-6 text-yellow-500" />
          <span>Turnuva Ağacı</span>
        </h2>
        <p className="text-muted-foreground mt-1">8 kişilik eleme usulü turnuva</p>
      </div>

      {/* Responsive Bracket Layout */}
      <div className="space-y-8">
        {rounds.map((round) => {
          const roundMatches = matchesByRound[round] || [];
          const RoundIcon = getRoundIcon(round);
          
          return (
            <div key={round} className="space-y-4">
              {/* Tur Başlığı */}
              <div className="text-center">
                <div className="flex items-center justify-center space-x-2 mb-3">
                  <RoundIcon className={`w-5 h-5 ${
                    round === 3 ? 'text-yellow-500' : 
                    round === 2 ? 'text-gray-500' : 'text-amber-700'
                  }`} />
                  <h3 className="text-lg font-bold">{getRoundName(round)}</h3>
                </div>
                <div className="w-24 h-1 bg-gradient-to-r from-primary/20 via-primary to-primary/20 rounded-full mx-auto" />
              </div>

              {/* Maçlar */}
              <div className={`grid gap-4 ${
                round === 1 ? 'grid-cols-1 md:grid-cols-2' : 
                round === 2 ? 'grid-cols-1 max-w-md mx-auto' : 
                'grid-cols-1 max-w-sm mx-auto'
              }`}>
                {roundMatches
                  .sort((a, b) => a.match_number - b.match_number)
                  .map((match) => (
                    <div key={match.id} className="relative">
                      <MatchCard match={match} roundName={getRoundName(round)} />
                      
                      {/* Connection Lines for larger screens */}
                      {round < 3 && (
                        <div className="hidden md:block absolute top-1/2 -right-8 w-8 h-0.5 bg-primary/30" />
                      )}
                    </div>
                  ))
                }
              </div>

              {/* Progression Arrow */}
              {round < rounds.length && (
                <div className="flex justify-center">
                  <div className="w-0.5 h-8 bg-gradient-to-b from-primary to-primary/30" />
                  <div className="absolute w-2 h-2 bg-primary rounded-full transform translate-y-6" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Turnuva İstatistikleri */}
      <Card className="mt-8">
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">
                {matches.filter(m => m.status === 'completed').length}
              </div>
              <div className="text-xs text-muted-foreground">Tamamlanan</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-500">
                {matches.filter(m => m.status === 'active').length}
              </div>
              <div className="text-xs text-muted-foreground">Aktif</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-500">
                {matches.filter(m => m.status === 'pending').length}
              </div>
              <div className="text-xs text-muted-foreground">Bekleyen</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TournamentBracket;