import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Trophy, Users, Clock, Plus, Swords } from 'lucide-react';
import { Tournament } from '@/types/tournament';

const TournamentPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTournaments, setActiveTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveTournaments();
  }, []);

  const fetchActiveTournaments = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('status', 'waiting')
        .order('created_at', { ascending: true });

      if (!error && data) {
        // Eski isimleri yeni isimlere map et
        const mappedData = data.map(tournament => ({
          ...tournament,
          max_players: tournament.max_participants,
          current_players: tournament.current_round // Geçici çözüm
        })) as Tournament[];
        
        setActiveTournaments(mappedData);
      }
    } catch (error) {
      console.error('Turnuva listeleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTournament = async () => {
    if (!user) return;

    try {
      // Yeni turnuva oluştur
      const { data: tournament, error } = await supabase
        .from('tournaments')
        .insert({
          creator_id: user.id,
          name: `Turnuva ${new Date().toLocaleTimeString()}`,
          status: 'waiting',
          game_type: 'timed',
          max_participants: 8,
          current_round: 1,
          timeout_duration: 15
        })
        .select()
        .single();

      if (!error && tournament) {
        // Kendimizi katılımcı olarak ekle
        await supabase
          .from('tournament_participants')
          .insert({
            tournament_id: tournament.id,
            user_id: user.id,
            is_bot: false,
            seed: 1,
            joined_at: new Date().toISOString()
          });

        // 15 saniye beklemeye başla
        navigate(`/tournament-waiting/${tournament.id}`);
      }
    } catch (error) {
      console.error('Turnuva oluşturma hatası:', error);
    }
  };

const handleJoinTournament = async (tournamentId: string) => {
  if (!user) return;

  try {
    // Önce user'ın zaten katılıp katılmadığını kontrol et
    const { data: existingParticipation } = await supabase
      .from('tournament_participants')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('user_id', user.id)
      .single();

    if (existingParticipation) {
      // Zaten katılmış, beklemeye yönlendir
      navigate(`/tournament-waiting/${tournamentId}`);
      return;
    }

    // Yeni katılımcı olarak ekle
    const { error: joinError } = await supabase
      .from('tournament_participants')
      .insert({
        tournament_id: tournamentId,
        user_id: user.id,
        is_bot: false,
        seed: 2, // Sonradan katılanlar
        joined_at: new Date().toISOString()
      });

    if (joinError) {
      console.error('Katılma hatası:', joinError);
      return;
    }

    // Turnuva sayfasını güncelle
    await fetchActiveTournaments();

    navigate(`/tournament-waiting/${tournamentId}`);

  } catch (error) {
    console.error('Turnuvaya katılma hatası:', error);
  }
};

  if (loading) {
    return <div>Yükleniyor...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Başlık */}
        <div className="text-center mb-8">
          <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white">Turnuvalar</h1>
          <p className="text-gray-300">8 kişilik heyecan dolu turnuvalara katıl!</p>
        </div>

        {/* Turnuva Oluştur Butonu */}
        <Card className="mb-8 bg-white/10 backdrop-blur-md border-white/20">
          <CardContent className="p-6 text-center">
            <Button 
              onClick={createTournament}
              className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold py-4 px-8 text-lg"
              size="lg"
            >
              <Plus className="w-6 h-6 mr-2" />
              Yeni Turnuva Oluştur
            </Button>
          </CardContent>
        </Card>

        {/* Aktif Turnuvalar */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white mb-4">Aktif Turnuvalar</h2>
          
          {activeTournaments.length === 0 ? (
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardContent className="p-6 text-center text-gray-300">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Şu anda aktif turnuva bulunmuyor</p>
                <p className="text-sm">İlk turnuvayı sen oluştur!</p>
              </CardContent>
            </Card>
          ) : (
            activeTournaments.map((tournament) => (
              <Card key={tournament.id} className="bg-white/10 backdrop-blur-md border-white/20">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center">
                      <Trophy className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{tournament.name}</h3>
                      <p className="text-gray-300 text-sm">
                        {tournament.current_round || 1}/8 Katılımcı
                      </p>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={() => handleJoinTournament(tournament.id)}
                    disabled={(tournament.current_round || 1) >= 8}
                    className="bg-green-500 hover:bg-green-600 text-white"
                  >
                    <Swords className="w-4 h-4 mr-2" />
                    Katıl
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TournamentPage;