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
  const [realPlayerCount, setRealPlayerCount] = useState(1); 
  const [totalParticipants, setTotalParticipants] = useState(1);

useEffect(() => {
  if (!tournamentId) return;

  // Real-time katılımcı takibi
  const channel = supabase
    .channel(`tournament-${tournamentId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'tournament_participants',
      filter: `tournament_id=eq.${tournamentId}`
    }, (payload) => {
      // Yeni katılımcı geldi, listeyi güncelle
      setParticipants(prev => [...prev, payload.new as TournamentParticipant]);
      
      // Katılımcı sayısını güncelle
      setTournament(prev => prev ? {
        ...prev,
        current_round: prev.current_round + 1
      } : prev);
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

        // Geri sayımı kalan süreye göre başlat
        const timeout = (tournamentData.timeout_duration ?? 15);
        const createdAtMs = new Date(tournamentData.created_at).getTime();
        const elapsed = Math.floor((Date.now() - createdAtMs) / 1000);
        const remaining = Math.max(0, timeout - elapsed);
        setTimeLeft(remaining);
      }
      
      fetchParticipants();
    } catch (error) {
      console.error('Turnuva verisi alınamadı:', error);
    }
  };

  useEffect(() => {
    if (!tournamentId) return;

    fetchTournamentData();

    // Güvenli geri sayım - kapanış değişkenlerine takılmadan çalışır
    const cleanup = startCountdown();
    return cleanup;
  }, [tournamentId, timeLeft]);

 const fetchParticipants = async () => {
    try {
      const { data: participantsData, error } = await supabase
        .from('tournament_participants')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('joined_at', { ascending: true });

      if (error || !participantsData) return;

      // Gerçek oyuncu sayısını hesapla
      const realPlayers = participantsData.filter(p => !p.is_bot);
      const totalPlayers = participantsData.length;
      
      setRealPlayerCount(realPlayers.length);
      setTotalParticipants(totalPlayers);
      
      console.log(`👥 Gerçek oyuncu: ${realPlayers.length}, Toplam: ${totalPlayers}`);
      
      // Oyuncu bilgilerini yükle
      const participantsWithProfiles = await Promise.all(
        participantsData.map(async (participant) => {
          if (participant.is_bot) {
            return {
              ...participant,
              profiles: {
                username: `Bot ${participant.user_id.split('_').pop()}`,
                avatar_url: null
              }
            };
          }

          // Gerçek oyuncu profili yükle
          const { data: profileData } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', participant.user_id)
            .single();

          return {
            ...participant,
            profiles: profileData || { username: 'Oyuncu', avatar_url: null }
          };
        })
      );

      setParticipants(participantsWithProfiles);
    } catch (error) {
      console.error('Katılımcı yükleme hatası:', error);
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
    console.log('🚀 Turnuva başlatılıyor...');
    
    // Tüm katılımcıları al
    const { data: participants } = await supabase
      .from('tournament_participants')
      .select('*')
      .eq('tournament_id', tournamentId);
    
    if (!participants || participants.length < 2) {
      console.error('Yeterli katılımcı yok');
      return;
    }
    
    // İlk tur maçlarını oluştur
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    const matchCount = Math.floor(shuffled.length / 2);
    
    const firstRoundMatches = [];
    for (let i = 0; i < matchCount; i++) {
      firstRoundMatches.push({
        tournament_id: tournamentId,
        round: 1,
        match_number: i + 1,
        player1_id: shuffled[i * 2].user_id,
        player2_id: shuffled[i * 2 + 1]?.user_id || null,
        status: 'pending',
        created_at: new Date().toISOString()
      });
    }
    
    // Maçları database'e kaydet
    const { error: matchError } = await supabase
      .from('tournament_matches')
      .insert(firstRoundMatches);
    
    if (matchError) {
      console.error('Maçlar oluşturulamadı:', matchError);
      return;
    }
    
    // Turnuva durumunu güncelle
    const { error: tournamentError } = await supabase
      .from('tournaments')
      .update({ 
        status: 'in_progress',
        current_round: 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', tournamentId);
    
    if (tournamentError) {
      console.error('Turnuva güncellenemedi:', tournamentError);
      return;
    }
    
    console.log('✅ Turnuva başlatıldı!');
    navigate(`/tournament-bracket/${tournamentId}`);
    
  } catch (error) {
    console.error('Turnuva başlatma hatası:', error);
  }
};

const createTournamentMatches = async () => {
  // Bu fonksiyon artık database içinde yapılıyor
  console.log('Maçlar database fonksiyonu tarafından oluşturuluyor...');
};

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 p-4 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Turnuva yükleniyor...</p>
        </div>
      </div>
    );
  }

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
            
            {/* Gerçek oyuncu odaklı mesaj */}
            <div className="space-y-2">
              <p className="text-green-300 font-bold">
                🎯 {realPlayerCount} Gerçek Oyuncu Katıldı
              </p>
              
              {realPlayerCount < 8 && (
                <p className="text-gray-300 text-sm">
                  {8 - realPlayerCount} eksik oyuncu botlarla doldurulacak
                </p>
              )}
              
              {realPlayerCount >= 4 && (
                <p className="text-green-400 text-sm">
                  ✅ Yeterli oyuncu var, harika bir turnuva olacak!
                </p>
              )}
              
              {realPlayerCount === 8 && (
                <p className="text-yellow-300 text-sm font-bold">
                  🔥 TAM KADRO! 8 gerçek oyunculu turnuva
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Katılımcı Listesi */}
        <Card className="bg-white/10 backdrop-blur-md border-white/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Katılımcılar
              </h3>
              <div className="text-sm">
                <span className="text-green-400 font-bold">{realPlayerCount} Gerçek</span>
                {totalParticipants - realPlayerCount > 0 && (
                  <>
                    <span className="text-gray-400 mx-1">+</span>
                    <span className="text-gray-400">{totalParticipants - realPlayerCount} Bot</span>
                  </>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              {/* Gerçek oyuncuları önce göster */}
              {participants
                .filter(p => !p.is_bot)
                .map((participant, index) => (
                <div key={participant.id} className="flex items-center p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-white font-medium">
                      {participant.profiles?.username || 'Oyuncu'}
                    </p>
                    {participant.user_id === user?.id && (
                      <p className="text-green-400 text-xs font-bold">(Siz)</p>
                    )}
                  </div>
                  <div className="text-green-400 text-xs font-medium">
                    GERÇEK OYUNCU
                  </div>
                </div>
              ))}

              {/* Botları sonra göster */}
              {participants
                .filter(p => p.is_bot)
                .map((participant, index) => (
                <div key={participant.id} className="flex items-center p-3 bg-gray-500/10 rounded-lg border border-gray-500/20">
                  <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {realPlayerCount + index + 1}
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-gray-300">
                      {participant.profiles?.username || 'Bot'}
                    </p>
                  </div>
                  <Bot className="w-4 h-4 text-gray-400" />
                </div>
              ))}

              {/* Boş slotlar */}
              {Array.from({ length: 8 - totalParticipants }, (_, i) => (
                <div key={i} className="flex items-center p-3 bg-white/5 rounded-lg opacity-50">
                  <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {totalParticipants + i + 1}
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