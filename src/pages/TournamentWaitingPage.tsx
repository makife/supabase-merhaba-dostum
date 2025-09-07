import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Users, Clock, Bot, Trophy, AlertTriangle } from 'lucide-react';
import { Tournament, TournamentParticipant } from '@/types/tournament';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const TournamentWaitingPage = () => {
  const { tournamentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [participants, setParticipants] = useState<TournamentParticipant[]>([]);
  const [timeLeft, setTimeLeft] = useState(15);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [realPlayerCount, setRealPlayerCount] = useState(1); 
  const [totalParticipants, setTotalParticipants] = useState(1);
  const [tournamentStarted, setTournamentStarted] = useState(false);
  const [cancelInfo, setCancelInfo] = useState<{ title: string; message: string } | null>(null);

  // Tournament bilgilerini ve katılımcıları getir
  const fetchTournamentData = async () => {
    try {
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

        // Geçen süreyi hesapla
        const timeout = tournamentData.timeout_duration ?? 15;
        const createdAtMs = new Date(tournamentData.created_at).getTime();
        const elapsed = Math.floor((Date.now() - createdAtMs) / 1000);
        const remaining = Math.max(0, timeout - elapsed);
        setTimeLeft(remaining);
      }
      
      await fetchParticipants();
    } catch (error) {
      console.error('Turnuva verisi alınamadı:', error);
    }
  };

  const fetchParticipants = async () => {
    try {
      const { data: participantsData, error } = await supabase
        .from('tournament_participants')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('joined_at', { ascending: true });

      if (error || !participantsData) return;

      const realPlayers = participantsData.filter(p => !p.is_bot);
      const totalPlayers = participantsData.length;
      
      setRealPlayerCount(realPlayers.length);
      setTotalParticipants(totalPlayers);
      
      console.log(`👥 Gerçek oyuncu: ${realPlayers.length}, Toplam: ${totalPlayers}`);
      
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

  const startTournament = async () => {
    if (tournamentStarted) {
      console.log('Turnuva zaten başlatılıyor, tekrar çağrı engellendi');
      return;
    }
    
    console.log('Turnuva başlatılıyor...');
    setTournamentStarted(true);
    
    try {
      const { data, error } = await supabase.rpc('start_tournament_automatically', {
        p_tournament_id: tournamentId
      });

      if (error) {
        console.error('Turnuva başlatma hatası:', error);
        setTournamentStarted(false);
        return;
      }

      const result = data as any;
      
      if (result?.success) {
        console.log('Turnuva başlatıldı, bracket sayfasına yönlendiriliyor...');
        navigate(`/tournament-bracket/${tournamentId}`);
      } else {
        console.error('Turnuva başlatma hatası:', result?.error);
        
        // Yeterli oyuncu yok mesajı
        if (result?.error?.includes('At least 2 real players required')) {
          // Turnuvayı iptal et
          await supabase
            .from('tournaments')
            .update({ status: 'cancelled' })
            .eq('id', tournamentId);

          setCancelInfo({
            title: 'Turnuva iptal edildi',
            message: 'Yeterli gerçek oyuncu katılmadı (en az 2 kişi gerekli).'
          });
        } else {
          setCancelInfo({
            title: 'Turnuva başlatılamadı',
            message: String(result?.error || 'Bilinmeyen bir hata oluştu.')
          });
        }
        
        setTournamentStarted(false);
      }
      
    } catch (error) {
      console.error('Turnuva başlatma hatası:', error);
      setCancelInfo({
        title: 'Turnuva başlatılamadı',
        message: 'Bir hata oluştu. Lütfen tekrar deneyin veya daha sonra tekrar deneyin.'
      });
      setTournamentStarted(false);
    }
  };

  // İlk yükleme
  useEffect(() => {
    if (!tournamentId) return;
    fetchTournamentData();
  }, [tournamentId]);

  // Timer - sadece turnuva oluşturan için
  useEffect(() => {
    if (!tournament || tournament.creator_id !== user?.id || timeLeft <= 0) return;

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
  }, [tournament?.creator_id, user?.id, timeLeft]);

  // Sonradan katılanlar için real-time listener
  useEffect(() => {
    if (!tournamentId || !user || !tournament) return;

    console.log('Real-time tournament listener başlatılıyor...');

    const channel = supabase
      .channel(`tournament-status-${tournamentId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tournaments',
        filter: `id=eq.${tournamentId}`
      }, (payload) => {
        console.log('Turnuva durumu güncellendi:', payload.new);
        const newStatus = payload.new.status;
        
        if (newStatus === 'in_progress') {
          console.log('Turnuva başladı, bracket sayfasına yönlendiriliyor...');
          navigate(`/tournament-bracket/${tournamentId}`);
        } else if (newStatus === 'cancelled') {
          console.log('Turnuva iptal edildi');
          setCancelInfo({
            title: 'Turnuva iptal edildi',
            message: 'Turnuva yeterli oyuncu olmadığı için iptal edildi.'
          });
        }
      })
      .subscribe();

    return () => {
      console.log('Real-time tournament listener temizleniyor...');
      supabase.removeChannel(channel);
    };
  }, [tournamentId, user?.id, tournament, navigate]);

  // Katılımcı real-time güncellemeleri - TÜM EVENTLER
  useEffect(() => {
    if (!tournamentId) return;

    console.log(`Katılımcı real-time listener başlatılıyor: ${tournamentId}`);

    const participantsChannel = supabase
      .channel(`tournament-participants-${tournamentId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'tournament_participants',
        filter: `tournament_id=eq.${tournamentId}`
      }, (payload) => {
        console.log('Yeni katılımcı eklendi:', payload.new);
        fetchParticipants();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tournament_participants',
        filter: `tournament_id=eq.${tournamentId}`
      }, (payload) => {
        console.log('Katılımcı güncellendi:', payload.new);
        fetchParticipants();
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'tournament_participants',
        filter: `tournament_id=eq.${tournamentId}`
      }, (payload) => {
        console.log('Katılımcı silindi:', payload.old);
        fetchParticipants();
      })
      .subscribe();

    return () => {
      console.log('Katılımcı real-time listener temizleniyor...');
      supabase.removeChannel(participantsChannel);
    };
  }, [tournamentId]);

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

              {tournament.creator_id !== user?.id && (
                <p className="text-blue-300 text-sm">
                  Turnuva başlatılması bekleniyor...
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
              {/* Gerçek oyuncular */}
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

              {/* Botlar */}
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

        <Dialog open={!!cancelInfo} onOpenChange={(open) => { if (!open) { setCancelInfo(null); navigate('/tournament'); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                {cancelInfo?.title}
              </DialogTitle>
              <DialogDescription>
                {cancelInfo?.message}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end">
              <Button onClick={() => { setCancelInfo(null); navigate('/tournament'); }}>
                Tamam
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default TournamentWaitingPage;