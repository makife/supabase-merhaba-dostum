import { TournamentParticipant, TournamentMatch } from '@/types/tournament';

export const formatTournamentTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const calculateTimeRemaining = (expiresAt: string): number => {
  const expiry = new Date(expiresAt).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((expiry - now) / 1000));
};

export const getRealPlayerCount = (participants: TournamentParticipant[]): number => {
  return participants.filter(p => !p.is_bot).length;
};

export const getBotCount = (participants: TournamentParticipant[]): number => {
  return participants.filter(p => p.is_bot).length;
};

export const isUserInTournament = (participants: TournamentParticipant[], userId: string): boolean => {
  return participants.some(p => p.user_id === userId && !p.is_bot);
};

export const getTournamentStatusMessage = (realPlayerCount: number) => {
  if (realPlayerCount < 2) {
    return {
      text: "En az 2 gerçek oyuncu gerekli",
      color: "text-red-400",
      emoji: "⚠️"
    };
  }
  
  if (realPlayerCount >= 8) {
    return {
      text: "TAM KADRO! 8 gerçek oyunculu turnuva",
      color: "text-yellow-400", 
      emoji: "🔥"
    };
  }
  
  if (realPlayerCount >= 4) {
    return {
      text: "Yeterli oyuncu var, harika bir turnuva olacak!",
      color: "text-green-400",
      emoji: "✅"
    };
  }
  
  return {
    text: `${8 - realPlayerCount} eksik oyuncu botlarla doldurulacak`,
    color: "text-gray-300",
    emoji: "🤖"
  };
};

export const organizeMatchesByRound = (matches: TournamentMatch[]) => {
  const rounds: { [key: number]: TournamentMatch[] } = {};
  
  matches.forEach(match => {
    if (!rounds[match.round]) {
      rounds[match.round] = [];
    }
    rounds[match.round].push(match);
  });
  
  // Sort matches within each round
  Object.keys(rounds).forEach(round => {
    rounds[parseInt(round)].sort((a, b) => a.match_number - b.match_number);
  });
  
  return rounds;
};

export const getRoundName = (round: number): string => {
  switch (round) {
    case 1: return 'Çeyrek Final';
    case 2: return 'Yarı Final';
    case 3: return 'Final';
    default: return `${round}. Tur`;
  }
};

export const getMatchStatus = (match: TournamentMatch): string => {
  switch (match.status) {
    case 'pending': return 'Bekliyor';
    case 'in_progress': return 'Oynanıyor';
    case 'completed': return 'Tamamlandı';
    default: return 'Bilinmiyor';
  }
};

export const generateBotName = (index: number): string => {
  const botNames = [
    'Şimşek Bot', 'Zeka Bot', 'Hızlı Bot', 'Güçlü Bot',
    'Akıllı Bot', 'Süper Bot', 'Mega Bot', 'Ultra Bot'
  ];
  return botNames[index % botNames.length] || `Bot ${index + 1}`;
};