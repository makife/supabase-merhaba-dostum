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
      console.log('👥 Katılımcılar alınıyor...');
      
      // Önce sadece temel katılımcı bilgilerini al
      const { data: participantsData, error } = await supabase
        .from('tournament_participants')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('joined_at', { ascending: true });

      if (error) {
        console.error('Katılımcılar alınamadı:', error);
        return;
      }

      if (!participantsData) {
        console.log('Katılımcı bulunamadı');
        setParticipants([]);
        return;
      }

      console.log('📊 Katılımcılar alındı:', participantsData.length);

      // Eğer bot değilse, kullanıcı bilgilerini ayrıca al
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

          try {
            // Kullanıcı bilgilerini ayrıca al
            const { data: profileData } = await supabase
              .from('profiles')
              .select('username, avatar_url')
              .eq('id', participant.user_id)
              .single();

            return {
              ...participant,
              profiles: profileData || { username: 'Oyuncu', avatar_url: null }
            };
          } catch (error) {
            console.error('Profil bilgisi alınamadı:', error);
            return {
              ...participant,
              profiles: { username: 'Oyuncu', avatar_url: null }
            };
          }
        })
      );

      setParticipants(participantsWithProfiles);
      
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
     console.log('🚀 Turnuva başlatılıyor...');
     
     // Yeni database fonksiyonunu kullan
     const { data, error } = await supabase.rpc('start_tournament_automatically', {
       p_tournament_id: tournamentId
     });

     if (error) {
       console.error('Turnuva başlatma hatası:', error);
       return;
     }

     console.log('✅ Turnuva başlatıldı:', data);
     
     // Type assertion ile data'nın doğru tipte olduğunu belirt
     const result = data as { success: boolean; error?: string; real_players?: number; bots_added?: number; matches_created?: number };
     
     // Turnuva başarıyla başladıysa bracket sayfasına yönlendir
     if (result?.success) {
       setTimeout(() => {
         console.log('🚀 TournamentBracket sayfasına yönlendiriliyor...');
         navigate(`/tournament-bracket/${tournamentId}`);
       }, 2000);
     } else {
       console.error('Turnuva başlatma hatası:', result?.error);
     }
     
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
                      {participant.profiles?.username || 
                      (participant.is_bot ? `Bot ${participant.user_id?.split('_').pop()}` : 'Oyuncu')}
                    </p>
                    {participant.user_id === user?.id && (
                      <p className="text-green-400 text-xs">(Siz)</p>
                    )}
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