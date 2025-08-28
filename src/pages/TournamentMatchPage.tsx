import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
}

interface Participant {
  id: string;
  user_id: string;
  is_bot: boolean;
  eliminated_at: string | null;
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
  const [loading, setLoading] = useState(true);

  const loadTournamentData = async () => {
    if (!tournamentId || !user) return;

    try {
      // Load tournament info
      const { data: tournamentData } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tournamentData) {
        setTournament(tournamentData);
      }

      // Load matches
      const { data: matchesData } = await supabase
        .from('tournament_matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('round', { ascending: true })
        .order('match_number', { ascending: true });

      if (matchesData) {
        setMatches(matchesData);
        
        // Find user's current match
        const userMatch = matchesData.find(match => 
          (match.player1_id === user.id || match.player2_id === user.id) && 
          match.status === 'pending'
        );
        setCurrentMatch(userMatch || null);
      }

      // Load participants
      const { data: participantsData } = await supabase
        .from('tournament_participants')
        .select(`
          *,
          profiles:user_id (
            username,
            avatar_url
          )
        `)
        .eq('tournament_id', tournamentId);

      if (participantsData) {
        setParticipants(participantsData);
      }

    } catch (error) {
      console.error('Error loading tournament data:', error);
      toast({
        title: 'Hata',
        description: 'Turnuva verileri yüklenirken hata oluştu',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const startMatch = async (match: TournamentMatch) => {
    if (!user) return;

    try {
      // Create game room for the match
      const { data: gameRoom, error: roomError } = await supabase
        .from('game_rooms')
        .insert({
          host_id: user.id,
          game_mode: 'tournament',
          status: 'active',
          time_limit: 120,
          max_score: 500,
          player1_id: match.player1_id,
          player2_id: match.player2_id,
          current_grid: []
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // Update match with room_id and active status
      const { error: matchError } = await supabase
        .from('tournament_matches')
        .update({
          room_id: gameRoom.id,
          status: 'active'
        })
        .eq('id', match.id);

      if (matchError) throw matchError;

      // Navigate to game page
      navigate(`/game?room=${gameRoom.id}&tournament=${tournamentId}&match=${match.id}`);

    } catch (error) {
      console.error('Error starting match:', error);
      toast({
        title: 'Hata',
        description: 'Maç başlatılırken hata oluştu',
        variant: 'destructive'
      });
    }
  };

  const simulateBotMatch = async (match: TournamentMatch) => {
    // Simulate bot vs bot match
    const winner = Math.random() > 0.5 ? match.player1_id : match.player2_id;
    
    await supabase
      .from('tournament_matches')
      .update({
        status: 'completed',
        winner_id: winner
      })
      .eq('id', match.id);

    // Eliminate the loser
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
    return participant?.profiles?.username || 'Bilinmeyen Oyuncu';
  };

  const renderBracket = () => {
    const round1Matches = matches.filter(m => m.round === 1);
    const round2Matches = matches.filter(m => m.round === 2);
    const round3Matches = matches.filter(m => m.round === 3);

    return (
      <div className="space-y-8">
        {/* Round 1 - Quarterfinals */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Çeyrek Final</h3>
          <div className="grid grid-cols-2 gap-4">
            {round1Matches.map((match, index) => (
              <Card key={match.id} className="p-4">
                <div className="space-y-2">
                  <div className={`p-2 rounded ${match.winner_id === match.player1_id ? 'bg-green-100' : ''}`}>
                    {getPlayerName(match.player1_id)}
                  </div>
                  <div className="text-center text-sm text-muted-foreground">vs</div>
                  <div className={`p-2 rounded ${match.winner_id === match.player2_id ? 'bg-green-100' : ''}`}>
                    {getPlayerName(match.player2_id)}
                  </div>
                  <div className="text-center">
                    {match.status === 'pending' && (match.player1_id === user?.id || match.player2_id === user?.id) && (
                      <Button onClick={() => startMatch(match)} className="w-full">
                        Maçı Başlat
                      </Button>
                    )}
                    {match.status === 'active' && (
                      <div className="text-orange-600 font-medium">Devam Ediyor</div>
                    )}
                    {match.status === 'completed' && (
                      <div className="text-green-600 font-medium">Tamamlandı</div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Round 2 - Semifinals */}
        {round2Matches.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Yarı Final</h3>
            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
              {round2Matches.map((match) => (
                <Card key={match.id} className="p-4">
                  <div className="space-y-2">
                    <div className={`p-2 rounded ${match.winner_id === match.player1_id ? 'bg-green-100' : ''}`}>
                      {getPlayerName(match.player1_id)}
                    </div>
                    <div className="text-center text-sm text-muted-foreground">vs</div>
                    <div className={`p-2 rounded ${match.winner_id === match.player2_id ? 'bg-green-100' : ''}`}>
                      {getPlayerName(match.player2_id)}
                    </div>
                    <div className="text-center">
                      {match.status === 'pending' && (match.player1_id === user?.id || match.player2_id === user?.id) && (
                        <Button onClick={() => startMatch(match)} className="w-full">
                          Maçı Başlat
                        </Button>
                      )}
                      {match.status === 'active' && (
                        <div className="text-orange-600 font-medium">Devam Ediyor</div>
                      )}
                      {match.status === 'completed' && (
                        <div className="text-green-600 font-medium">Tamamlandı</div>
                      )}
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
            <h3 className="text-lg font-semibold mb-4">Final</h3>
            <div className="max-w-sm mx-auto">
              {round3Matches.map((match) => (
                <Card key={match.id} className="p-4">
                  <div className="space-y-2">
                    <div className={`p-2 rounded ${match.winner_id === match.player1_id ? 'bg-green-100' : ''}`}>
                      {getPlayerName(match.player1_id)}
                    </div>
                    <div className="text-center text-sm text-muted-foreground">vs</div>
                    <div className={`p-2 rounded ${match.winner_id === match.player2_id ? 'bg-green-100' : ''}`}>
                      {getPlayerName(match.player2_id)}
                    </div>
                    <div className="text-center">
                      {match.status === 'pending' && (match.player1_id === user?.id || match.player2_id === user?.id) && (
                        <Button onClick={() => startMatch(match)} className="w-full">
                          Maçı Başlat
                        </Button>
                      )}
                      {match.status === 'active' && (
                        <div className="text-orange-600 font-medium">Devam Ediyor</div>
                      )}
                      {match.status === 'completed' && (
                        <div className="text-green-600 font-medium">Tamamlandı</div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    loadTournamentData();
  }, [tournamentId, user]);

  // Real-time updates for tournament matches
  useEffect(() => {
    if (!tournamentId) return;

    const channel = supabase
      .channel(`tournament-${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_matches',
          filter: `tournament_id=eq.${tournamentId}`
        },
        (payload) => {
          console.log('Tournament match updated:', payload);
          loadTournamentData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tournaments',
          filter: `id=eq.${tournamentId}`
        },
        (payload) => {
          console.log('Tournament updated:', payload);
          loadTournamentData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

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
        // Only simulate if both players are bots or one is missing
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
          <p className="mt-4">Turnuva yükleniyor...</p>
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
            <Button onClick={() => navigate('/tournament')} className="mt-4">
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
          onClick={() => navigate('/tournament')}
          className="mb-4"
        >
          ← Turnuva Listesine Dön
        </Button>
        
        <Card>
          <CardHeader>
            <CardTitle>{tournament.name}</CardTitle>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span>Durum: {tournament.status === 'active' ? 'Aktif' : tournament.status === 'finished' ? 'Tamamlandı' : 'Bekliyor'}</span>
              <span>Tur: {tournament.current_round}</span>
              <span>Katılımcı: {participants.length}</span>
            </div>
          </CardHeader>
        </Card>
      </div>

      {currentMatch && (
        <Card className="mb-6 border-primary">
          <CardHeader>
            <CardTitle className="text-primary">Sıradaki Maçınız</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p>{getPlayerName(currentMatch.player1_id)} vs {getPlayerName(currentMatch.player2_id)}</p>
                <p className="text-sm text-muted-foreground">Tur {currentMatch.round}, Maç {currentMatch.match_number}</p>
              </div>
              <Button onClick={() => startMatch(currentMatch)}>
                Maçı Başlat
              </Button>
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