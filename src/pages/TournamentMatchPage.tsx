import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

interface Tournament {
  id: string;
  name: string;
  status: string;
  current_round: number;
  started_at: string;
  finished_at: string;
}

interface TournamentMatch {
  id: string;
  tournament_id: string;
  round: number;
  match_number: number;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  status: string;
  room_id: string | null;
  created_at: string;
  player1_score?: number;
  player2_score?: number;
}

interface Participant {
  id: string;
  user_id: string;
  is_bot: boolean;
  eliminated_at: string | null;
  seed: number;
  profiles?: {
    username: string;
    avatar_url: string;
  };
}

const TournamentMatchPage: React.FC = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentMatch, setCurrentMatch] = useState<TournamentMatch | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const startAutoMatch = async (match: TournamentMatch) => {
    if (!user) return;

    try {
      console.log('🚀 Otomatik maç başlatılıyor:', match.id);

      navigate(`/game?tournament=${tournamentId}&match=${match.id}&type=timed`, {
        state: {
          gameMode: 'tournament',
          tournamentMatch: match,
          gameType: 'timed',
          participants: participants.filter(p => 
            p.user_id === match.player1_id || p.user_id === match.player2_id
          )
        }
      });

    } catch (error) {
      console.error('Otomatik maç başlatma hatası:', error);
    }
  };

  const loadTournamentData = async () => {
    if (!tournamentId || !user) return;

    try {
      console.log('📊 Turnuva verileri yükleniyor:', tournamentId);
      
      // Tüm katılımcıları çek
      const { data: allParticipants, error: partsError } = await supabase
        .from('tournament_participants')
        .select(`
          *,
          profiles:user_id (
            username,
            avatar_url
          )
        `)
        .eq('tournament_id', tournamentId);

      if (partsError) {
        console.error('❌ Katılımcı yükleme hatası:', partsError);
      } else {
        console.log('👥 Tüm katılımcılar:', allParticipants);
        setParticipants(allParticipants || []);
      }

      // Turnuva bilgilerini çek
      const { data: tournamentData, error: tourError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tourError) {
        console.error('❌ Turnuva yükleme hatası:', tourError);
      } else {
        setTournament(tournamentData);
      }

      // Maçları çek
      const { data: matchesData, error: matchesError } = await supabase
        .from('tournament_matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('round', { ascending: true })
        .order('match_number', { ascending: true });

      if (matchesError) {
        console.error('❌ Maç yükleme hatası:', matchesError);
      } else if (matchesData) {
        setMatches(matchesData);
        
        // Kullanıcının mevcut maçını bul
        const userMatch = matchesData.find(match => 
          (match.player1_id === user.id || match.player2_id === user.id) && 
          match.status === 'pending'
        );
        setCurrentMatch(userMatch || null);
        
        console.log('🥊 Maçlar yüklendi:', matchesData.length);
      }

    } catch (error) {
      console.error('❌ Turnuva veri yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const simulateBotMatch = async (match: TournamentMatch) => {
    // Bot maçlarını simüle et
    const winner = Math.random() > 0.5 ? match.player1_id : match.player2_id;
    
    await supabase
      .from('tournament_matches')
      .update({
        status: 'completed',
        winner_id: winner
      })
      .eq('id', match.id);

    // Kaybedeni ele
    const loserId = winner === match.player1_id ? match.player2_id : match.player1_id;
    if (loserId) {
      await supabase
        .from('tournament_participants')
        .update({ eliminated_at: new Date().toISOString() })
        .eq('tournament_id', tournamentId)
        .eq('user_id', loserId);
    }
  };

  const getPlayerName = (playerId: string | null): string => {
    if (!playerId) return 'Bot';
    
    const participant = participants.find(p => p.user_id === playerId);
    
    if (participant) {
      if (participant.is_bot) {
        return `Bot ${participant.seed || '?'}`;
      }
      return participant.profiles?.username || 'Bilinmeyen Oyuncu';
    }
    
    if (playerId === user?.id) {
      return user.user_metadata?.name || user.email?.split('@')[0] || 'Ben';
    }
    
    return 'Bilinmeyen Oyuncu';
  };

  const getRoundName = (round: number): string => {
    switch (round) {
      case 1: return 'Çeyrek Final';
      case 2: return 'Yarı Final';
      case 3: return 'Final';
      default: return `Tur ${round}`;
    }
  };

  const renderBracket = () => {
    const round1Matches = matches.filter(m => m.round === 1);
    const round2Matches = matches.filter(m => m.round === 2);
    const round3Matches = matches.filter(m => m.round === 3);

    return (
      <div className="space-y-8">
        {/* Round 1 - Çeyrek Final */}
        {round1Matches.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">{getRoundName(1)}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {round1Matches.map((match) => (
                <Card key={match.id} className={`p-4 ${match.winner_id ? 'border-green-200 bg-green-50' : ''}`}>
                  <div className="space-y-2">
                    <div className={`flex items-center justify-between p-2 rounded ${
                      match.winner_id === match.player1_id ? 'bg-green-100 border border-green-300' : 'bg-gray-100'
                    }`}>
                      <span className="font-medium">{getPlayerName(match.player1_id)}</span>
                      {match.player1_score !== undefined && match.player1_score !== null && (
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-bold">
                          {match.player1_score}
                        </span>
                      )}
                    </div>
                    
                    <div className="text-center text-sm text-muted-foreground">vs</div>
                    
                    <div className={`flex items-center justify-between p-2 rounded ${
                      match.winner_id === match.player2_id ? 'bg-green-100 border border-green-300' : 'bg-gray-100'
                    }`}>
                      <span className="font-medium">{getPlayerName(match.player2_id)}</span>
                      {match.player2_score !== undefined && match.player2_score !== null && (
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-bold">
                          {match.player2_score}
                        </span>
                      )}
                    </div>
                    
                    <div className="text-center mt-2">
                      {match.status === 'active' && (
                        <Badge variant="default" className="animate-pulse">Devam Ediyor</Badge>
                      )}
                      {match.status === 'completed' && (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          ✅ Tamamlandı
                        </Badge>
                      )}
                      {match.status === 'pending' && (
                        <Badge variant="outline">Bekliyor</Badge>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Round 2 - Yarı Final */}
        {round2Matches.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">{getRoundName(2)}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md mx-auto">
              {round2Matches.map((match) => (
                <Card key={match.id} className={`p-4 ${match.winner_id ? 'border-green-200 bg-green-50' : ''}`}>
                  <div className="space-y-2">
                    <div className={`flex items-center justify-between p-2 rounded ${
                      match.winner_id === match.player1_id ? 'bg-green-100 border border-green-300' : 'bg-gray-100'
                    }`}>
                      <span className="font-medium">{getPlayerName(match.player1_id)}</span>
                      {match.player1_score !== undefined && match.player1_score !== null && (
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-bold">
                          {match.player1_score}
                        </span>
                      )}
                    </div>
                    
                    <div className="text-center text-sm text-muted-foreground">vs</div>
                    
                    <div className={`flex items-center justify-between p-2 rounded ${
                      match.winner_id === match.player2_id ? 'bg-green-100 border border-green-300' : 'bg-gray-100'
                    }`}>
                      <span className="font-medium">{getPlayerName(match.player2_id)}</span>
                      {match.player2_score !== undefined && match.player2_score !== null && (
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-bold">
                          {match.player2_score}
                        </span>
                      )}
                    </div>
                    
                    <div className="text-center mt-2">
                      {match.status === 'active' && <Badge variant="default" className="animate-pulse">Devam Ediyor</Badge>}
                      {match.status === 'completed' && <Badge variant="secondary" className="bg-green-100 text-green-800">✅ Tamamlandı</Badge>}
                      {match.status === 'pending' && <Badge variant="outline">Bekliyor</Badge>}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Round 3 - Final */}
        {round3Matches.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">{getRoundName(3)}</h3>
            <div className="max-w-sm mx-auto">
              {round3Matches.map((match) => (
                <Card key={match.id} className={`p-4 ${match.winner_id ? 'border-yellow-200 bg-yellow-50' : ''}`}>
                  <div className="space-y-2">
                    <div className={`flex items-center justify-between p-2 rounded ${
                      match.winner_id === match.player1_id ? 'bg-yellow-100 border border-yellow-300' : 'bg-gray-100'
                    }`}>
                      <span className="font-medium">{getPlayerName(match.player1_id)}</span>
                      {match.player1_score !== undefined && match.player1_score !== null && (
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-bold">
                          {match.player1_score}
                        </span>
                      )}
                    </div>
                    
                    <div className="text-center text-sm text-muted-foreground">vs</div>
                    
                    <div className={`flex items-center justify-between p-2 rounded ${
                      match.winner_id === match.player2_id ? 'bg-yellow-100 border border-yellow-300' : 'bg-gray-100'
                    }`}>
                      <span className="font-medium">{getPlayerName(match.player2_id)}</span>
                      {match.player2_score !== undefined && match.player2_score !== null && (
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-bold">
                          {match.player2_score}
                        </span>
                      )}
                    </div>
                    
                    <div className="text-center mt-2">
                      {match.status === 'active' && <Badge variant="default" className="animate-pulse">Devam Ediyor</Badge>}
                      {match.status === 'completed' && <Badge variant="secondary" className="bg-green-100 text-green-800">✅ Tamamlandı</Badge>}
                      {match.status === 'pending' && <Badge variant="outline">Bekliyor</Badge>}
                    </div>
                    
                    {match.winner_id && (
                      <div className="text-center mt-2">
                        <Badge variant="default" className="bg-yellow-500 text-white">
                          🏆 Kazanan: {getPlayerName(match.winner_id)}
                        </Badge>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 10 saniye geri sayım ve otomatik başlatma
  useEffect(() => {
    if (!currentMatch || !user) return;

    // Sadece kullanıcının maçı varsa countdown başlat
    const isUserMatch = currentMatch.player1_id === user.id || currentMatch.player2_id === user.id;
    if (!isUserMatch) return;

    console.log('⏰ 10 saniye countdown başlıyor...');
    setCountdown(10);

    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownInterval);
          // Otomatik maç başlat
          startAutoMatch(currentMatch);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(countdownInterval);
    };
  }, [currentMatch, user]);

  // Real-time updates
  useEffect(() => {
    if (!tournamentId) return;

    const channel = supabase
      .channel(`tournament-${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tournament_matches',
          filter: `tournament_id=eq.${tournamentId}`
        },
        () => {
          loadTournamentData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  useEffect(() => {
    loadTournamentData();
  }, [tournamentId, user]);

  // Auto-simulate bot matches
  useEffect(() => {
    const checkBotMatches = async () => {
      const botMatches = matches.filter(match => 
        match.status === 'pending' && 
        (!match.player1_id || !match.player2_id || 
         participants.find(p => p.user_id === match.player1_id)?.is_bot ||
         participants.find(p => p.user_id === match.player2_id)?.is_bot)
      );

      for (const match of botMatches) {
        // Sadece iki oyuncu da bot ise veya biri eksikse simüle et
        const player1IsBot = !match.player1_id || participants.find(p => p.user_id === match.player1_id)?.is_bot;
        const player2IsBot = !match.player2_id || participants.find(p => p.user_id === match.player2_id)?.is_bot;
        
        if (player1IsBot && player2IsBot) {
          await simulateBotMatch(match);
        }
      }
    };

    if (matches.length > 0 && participants.length > 0) {
      checkBotMatches();
    }
  }, [matches, participants, tournamentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4">Turnuva veriler yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardContent className="p-6">
            <p>Turnuva bulunamadı</p>
            <Button onClick={() => navigate('/tournaments')} className="mt-4">
              Turnuva Listesine Dön
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6">
        <Button 
          variant="outline" 
          onClick={() => navigate('/tournaments')}
          className="mb-4"
        >
          ← Turnuva Listesine Dön
        </Button>
        
        <Card>
          <CardHeader>
            <CardTitle>{tournament.name}</CardTitle>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span>Durum: {tournament.status === 'active' ? 'Aktif' : tournament.status === 'finished' ? 'Tamamlandı' : 'Bekliyor'}</span>
              <span>Tur: {getRoundName(tournament.current_round)}</span>
              <span>Katılımcı: {participants.length}</span>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Normal maç bilgileri */}
      {countdown && currentMatch && (
        <Card className="mb-6 border-primary">
          <CardHeader>
            <CardTitle className="text-primary">Sıradaki Maçınız</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p>{getPlayerName(currentMatch.player1_id)} vs {getPlayerName(currentMatch.player2_id)}</p>
                <p className="text-sm text-muted-foreground">{getRoundName(currentMatch.round)}, Maç {currentMatch.match_number}</p>
                <p className="text-sm text-orange-600 mt-2">{countdown} saniye içinde otomatik başlatılacak...</p>
              </div>
              <div className="text-4xl font-bold text-primary">
                {countdown}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!countdown && currentMatch && (
        <Card className="mb-6 border-primary">
          <CardHeader>
            <CardTitle className="text-primary">Sıradaki Maçınız</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p>{getPlayerName(currentMatch.player1_id)} vs {getPlayerName(currentMatch.player2_id)}</p>
                <p className="text-sm text-muted-foreground">{getRoundName(currentMatch.round)}, Maç {currentMatch.match_number}</p>
                <p className="text-sm text-orange-600 mt-2">Maçınız başlatılıyor...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Turnuva Eşleşmeleri</CardTitle>
        </CardHeader>
        <CardContent>
          {renderBracket()}
        </CardContent>
      </Card>
    </div>
  );
};

export default TournamentMatchPage;