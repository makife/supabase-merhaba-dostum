import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Users, Clock, Bot, Trophy } from 'lucide-react';
import { Tournament, TournamentParticipant } from '@/types/tournament';

const TournamentWaitingPage = () => {
  const { tournamentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [participants, setParticipants] = useState<TournamentParticipant[]>([]);
  const [timeLeft, setTimeLeft] = useState(15);
  const [tournament, setTournament] = useState<Tournament | null>(null);

  useEffect(() => {
    if (!tournamentId) return;

    fetchTournamentData();
    startCountdown();

    // Real-time katılımcı takibi
    const channel = supabase
      .channel(`tournament-${tournamentId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'tournament_participants',
        filter: `tournament_id=eq.${tournamentId}`
      }, (payload) => {
        fetchParticipants();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tournaments',
        filter: `id=eq.${tournamentId}`
      }, (payload) => {
        const updatedTournament = payload.new as any;
        setTournament({
          ...updatedTournament,
          status: updatedTournament.status as 'waiting' | 'in_progress' | 'completed' | 'cancelled',
          max_players: updatedTournament.max_participants,
          current_players: updatedTournament.current_round
        } as Tournament);
        
        if (updatedTournament.status === 'in_progress') {
          navigate(`/tournament-bracket/${tournamentId}`);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  const fetchTournamentData = async () => {
    try {
      // Turnuva bilgilerini al
      const { data: tournamentData } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tournamentData) {
        setTournament({
          ...tournamentData,
          status: tournamentData.status as 'waiting' | 'in_progress' | 'completed' | 'cancelled',
          max_players: tournamentData.max_participants,
          current_players: tournamentData.current_round
        } as Tournament);
      }
      
      fetchParticipants();
    } catch (error) {
      console.error('Turnuva verisi alınamadı:', error);
    }
  };

  const fetchParticipants = async () => {
    try {
      const { data } = await supabase
        .from('tournament_participants')
        .select(`
          *,
          profiles:user_id (
            username,
            avatar_url
          )
        `)
        .eq('tournament_id', tournamentId);

      setParticipants(data || []);
    } catch (error) {
      console.error('Katılımcılar alınamadı:', error);
    }
  };

  const startCountdown = () => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          startTournament();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  };

  const startTournament = async () => {
    try {
      const currentPlayers = participants.length;
      const neededBots = 8 - currentPlayers;

      // Botları ekle
      for (let i = 1; i <= neededBots; i++) {
        await supabase
          .from('tournament_participants')
          .insert({
            tournament_id: tournamentId,
            user_id: `bot_${tournamentId}_${i}`,
            is_bot: true,
            joined_at: new Date().toISOString()
          } as any);
      }

      // Turnuva durumunu güncelle
      await supabase
        .from('tournaments')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
          current_round: 8 // 8 katılımcı olduğunu belirt
        })
        .eq('id', tournamentId);

      // Maçları oluştur
      await createTournamentMatches();
    } catch (error) {
      console.error('Turnuva başlatma hatası:', error);
    }
  };

  const createTournamentMatches = async () => {
    if (!tournamentId) return;
    
    try {
      // Katılımcıları al ve karıştır
      const { data: allParticipants } = await supabase
        .from('tournament_participants')
        .select('user_id')
        .eq('tournament_id', tournamentId);

      if (!allParticipants) return;

      const shuffledParticipants = [...allParticipants].sort(() => Math.random() - 0.5);
      const matchCount = shuffledParticipants.length / 2;

      // Maçları oluştur
      for (let i = 0; i < matchCount; i++) {
        await supabase
          .from('tournament_matches')
          .insert({
            tournament_id: tournamentId,
            round: 1,
            match_number: i + 1,
            player1_id: shuffledParticipants[i * 2].user_id,
            player2_id: shuffledParticipants[i * 2 + 1].user_id,
            status: 'pending'
          } as any);
      }
    } catch (error) {
      console.error('Maç oluşturma hatası:', error);
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Geri sayım */}
        <Card className="mb-6 bg-white/10 backdrop-blur-md border-white/20">
          <CardContent className="p-6 text-center">
            <Clock className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Turnuva Başlıyor!</h2>
            <div className="text-4xl font-bold text-yellow-400 mb-4">
              {timeLeft}s
            </div>
            <p className="text-gray-300">
              {participants.length}/8 katılımcı bekleniyor...
            </p>
          </CardContent>
        </Card>

        {/* Katılımcı Listesi */}
        <Card className="bg-white/10 backdrop-blur-md border-white/20">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Katılımcılar ({participants.length}/8)
            </h3>
            
            <div className="space-y-2">
              {participants.map((participant, index) => (
                <div key={participant.id} className="flex items-center p-3 bg-white/5 rounded-lg">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-white font-medium">
                      {participant.profiles?.username || 'Oyuncu'}
                    </p>
                  </div>
                  {participant.is_bot && (
                    <Bot className="w-4 h-4 text-gray-400 ml-2" />
                  )}
                </div>
              ))}

              {/* Boş slotlar */}
              {Array.from({ length: 8 - participants.length }, (_, i) => (
                <div key={i} className="flex items-center p-3 bg-white/5 rounded-lg opacity-50">
                  <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {participants.length + i + 1}
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-gray-400">Boş Slot</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TournamentWaitingPage;
