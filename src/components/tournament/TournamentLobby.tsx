import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Clock, Bot, User } from 'lucide-react';

interface TournamentLobbyProps {
  tournament: any;
  onLeave: () => void;
}

const TournamentLobby = ({ tournament, onLeave }: TournamentLobbyProps) => {
  const [participants, setParticipants] = useState<any[]>([]);
  const [waitingTime, setWaitingTime] = useState(30);
  const { toast } = useToast();
  const { user } = useAuth();

  // Katılımcıları yükle
  const loadParticipants = async () => {
    try {
      const { data, error } = await supabase
        .from('tournament_participants')
        .select(`
          *,
          profiles:user_id (username, avatar_url)
        `)
        .eq('tournament_id', tournament.id)
        .order('seed');

      if (!error && data) {
        setParticipants(data);
      }
    } catch (error) {
      console.error('Error loading participants:', error);
    }
  };

  // Turnuva otomatik başlatma
  const startTournament = async () => {
    try {
      console.log('🚀 Turnuva başlatılıyor...');
      
      // Mevcut gerçek oyuncu sayısını kontrol et
      const { data: realPlayers } = await supabase
        .from('tournament_participants')
        .select('*')
        .eq('tournament_id', tournament.id)
        .eq('is_bot', false);

      const realPlayerCount = realPlayers?.length || 0;
      
      if (realPlayerCount < 1) {
        toast({
          title: '⚠️ Yetersiz Katılımcı',
          description: 'Turnuva için en az 1 oyuncu gereklidir.',
          variant: 'destructive',
        });
        return;
      }

      // Bot ekleme - Toplam 8 olana kadar
      const { data: allParticipants } = await supabase
        .from('tournament_participants')
        .select('*')
        .eq('tournament_id', tournament.id);

      const currentTotal = allParticipants?.length || 0;
      const botsNeeded = 8 - currentTotal;

      if (botsNeeded > 0) {
        console.log('Bot ekleniyor:', botsNeeded);
        const botsToAdd = [];
        for (let i = 0; i < botsNeeded; i++) {
          const botUserId = crypto.randomUUID();
          botsToAdd.push({
            tournament_id: tournament.id,
            user_id: botUserId,
            seed: currentTotal + i + 1,
            is_bot: true
          });
        }
        await supabase.from('tournament_participants').insert(botsToAdd);
      }

      // Turnuvayı aktif yap
      await supabase
        .from('tournaments')
        .update({ 
          status: 'active', 
          started_at: new Date().toISOString() 
        })
        .eq('id', tournament.id);

      // Çeyrek final maçları oluştur
      await createQuarterFinalMatches();
      
      toast({
        title: '🏆 Turnuva Başladı!',
        description: 'Çeyrek final maçları başlıyor...',
        duration: 3000,
      });
      
    } catch (error) {
      console.error('❌ Turnuva başlatma hatası:', error);
      toast({
        title: 'Hata',
        description: 'Turnuva başlatılamadı',
        variant: 'destructive',
      });
    }
  };

  // Çeyrek final maçları oluştur
  const createQuarterFinalMatches = async () => {
    try {
      // Tüm katılımcıları seed sırasına göre al
      const { data: allParticipants } = await supabase
        .from('tournament_participants')
        .select('*')
        .eq('tournament_id', tournament.id)
        .order('seed');

      if (!allParticipants || allParticipants.length !== 8) {
        throw new Error('8 katılımcı bulunamadı');
      }

      // 4 maç oluştur: 1vs8, 2vs7, 3vs6, 4vs5
      const matches = [];
      for (let i = 0; i < 4; i++) {
        const player1 = allParticipants[i];
        const player2 = allParticipants[7 - i]; // Karşı taraftan

        matches.push({
          tournament_id: tournament.id,
          round: 1, // Çeyrek final
          match_number: i + 1,
          player1_id: player1?.user_id || null,
          player2_id: player2?.user_id || null,
          status: 'pending'
        });
      }

      // Maçları kaydet
      for (const match of matches) {
        await supabase.from('tournament_matches').insert(match);
      }

      console.log('✅ 4 çeyrek final maçı oluşturuldu');
    } catch (error) {
      console.error('❌ Çeyrek final maçları oluşturma hatası:', error);
      throw error;
    }
  };

  // Timer effect
  useEffect(() => {
    if (tournament?.expires_at) {
      const expiresAt = new Date(tournament.expires_at).getTime();
      const now = new Date().getTime();
      const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
      setWaitingTime(remaining);
    }

    const timer = setInterval(() => {
      setWaitingTime(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          startTournament();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [tournament]);

  // Real-time updates
  useEffect(() => {
    loadParticipants();
    
    const channel = supabase
      .channel(`tournament-participants-${tournament.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournament_participants',
        filter: `tournament_id=eq.${tournament.id}`
      }, () => {
        loadParticipants();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournament.id]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={onLeave}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Ayrıl
          </Button>
          <h1 className="text-2xl font-bold">{tournament.name}</h1>
          <div className="w-16" />
        </div>

        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              Turnuva Başlıyor
            </CardTitle>
            <CardDescription>
              30 saniye içinde otomatik başlayacak
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{waitingTime}s</div>
                <Progress value={((30 - waitingTime) / 30) * 100} className="mt-2" />
              </div>
              <div className="text-sm text-muted-foreground text-center">
                {participants.length}/8 oyuncu katıldı
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Katılımcılar ({participants.length}/8)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {participants.map((participant) => (
                <div key={participant.id} className="flex items-center space-x-2 p-2 rounded-lg bg-muted">
                  {participant.is_bot ? (
                    <Bot className="w-5 h-5" />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                  <span className="font-medium">
                    {participant.is_bot ? 
                      `Bot ${participant.seed}` : 
                      (participant.profiles?.username || `Oyuncu ${participant.seed}`)
                    }
                  </span>
                  <Badge variant="outline" className="ml-auto">
                    #{participant.seed}
                  </Badge>
                </div>
              ))}
              {Array.from({ length: 8 - participants.length }, (_, i) => (
                <div key={`empty-${i}`} className="flex items-center space-x-2 p-2 rounded-lg border-2 border-dashed border-muted">
                  <div className="w-5 h-5 bg-muted rounded" />
                  <span className="text-muted-foreground">Bekleniyor...</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TournamentLobby;