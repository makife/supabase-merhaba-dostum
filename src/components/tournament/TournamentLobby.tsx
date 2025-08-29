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
  onStart?: () => void;
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
    console.log('Turnuva başlatılıyor...');
    
    const { data: allParticipants } = await supabase
      .from('tournament_participants')
      .select('*')
      .eq('tournament_id', tournament.id)
      .order('seed');

    const currentTotal = allParticipants?.length || 0;
    const realPlayerCount = allParticipants?.filter(p => !p.is_bot).length || 0;
    
    console.log('Mevcut durum:', { currentTotal, realPlayerCount });
    
    if (realPlayerCount < 1) {
      await supabase
        .from('tournaments')
        .update({ status: 'expired' })
        .eq('id', tournament.id);
      
      toast({
        title: 'Turnuva İptal Edildi',
        description: 'Yeterli katılımcı bulunamadı.',
        variant: 'destructive',
      });
      return;
    }

    const botsNeeded = 8 - currentTotal;
    if (botsNeeded > 0) {
      console.log('Bot ekleniyor:', botsNeeded);
      
      const botsToAdd = [];
      for (let i = 0; i < botsNeeded; i++) {
        botsToAdd.push({
          tournament_id: tournament.id,
          user_id: null,
          seed: currentTotal + i + 1,
          is_bot: true
        });
      }
      
      const { error: botError } = await supabase
        .from('tournament_participants')
        .insert(botsToAdd);
      
      if (botError) {
        console.error('Bot ekleme hatası:', botError);
      } else {
        console.log(`${botsNeeded} bot başarıyla eklendi`);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    const { error: updateError } = await supabase
      .from('tournaments')
      .update({ 
        status: 'active', 
        started_at: new Date().toISOString() 
      })
      .eq('id', tournament.id);

    if (updateError) throw updateError;

    await createQuarterFinalMatches();
    
    // Bot vs Bot maçlarını otomatik tamamla
    setTimeout(async () => {
      await completeBotMatches(tournament.id, 1);
    }, 3000); // 3 saniye sonra bot maçlarını bitir
    
    toast({
      title: 'Turnuva Başladı!',
      description: 'Çeyrek final maçları başlıyor...',
      duration: 3000,
    });
    
  } catch (error) {
    console.error('Turnuva başlatma hatası:', error);
    toast({
      title: 'Hata',
      description: 'Turnuva başlatılamadı',
      variant: 'destructive',
    });
  }
};

// Bu fonksiyonu da TournamentLobby.tsx'e ekleyin:
const completeBotMatches = async (tournamentId: string, round: number) => {
  try {
    console.log(`Bot maçları tamamlanıyor - Round ${round}`);
    
    const { data: botMatches } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('round', round)
      .eq('status', 'pending');

    for (const match of botMatches || []) {
      const isUserMatch = match.player1_id === user?.id || match.player2_id === user?.id;
      
      if (!isUserMatch) {
        const winner = Math.random() > 0.5 ? match.player1_id : match.player2_id;
        const winnerScore = Math.floor(Math.random() * 20) + 25; // 25-45
        const loserScore = Math.floor(Math.random() * 15) + 10;  // 10-25
        
        await supabase
          .from('tournament_matches')
          .update({
            status: 'completed',
            winner_id: winner,
            player1_score: winner === match.player1_id ? winnerScore : loserScore,
            player2_score: winner === match.player2_id ? winnerScore : loserScore,
            updated_at: new Date().toISOString()
          })
          .eq('id', match.id);
        
        console.log(`Bot maçı tamamlandı: ${match.id}`);
      }
    }
    
    console.log(`Round ${round} bot maçları tamamlandı`);
  } catch (error) {
    console.error('Bot maçları tamamlama hatası:', error);
  }
};

const createQuarterFinalMatches = async () => {
  try {
    console.log('Çeyrek final maçları oluşturuluyor...');
    
    const { data: allParticipants, error: fetchError } = await supabase
      .from('tournament_participants')
      .select('*')
      .eq('tournament_id', tournament.id)
      .order('seed');

    if (fetchError) throw fetchError;

    console.log(`${allParticipants?.length || 0} katılımcı bulundu`);

    if (!allParticipants || allParticipants.length < 2) {
      throw new Error(`Yetersiz katılımcı: ${allParticipants?.length || 0}`);
    }

    const matches = [];
    
    if (allParticipants.length >= 8) {
      // 8 kişilik bracket: 1vs8, 2vs7, 3vs6, 4vs5
      for (let i = 0; i < 4; i++) {
        const player1 = allParticipants[i];
        const player2 = allParticipants[7 - i];
        
        matches.push({
          tournament_id: tournament.id,
          round: 1,
          match_number: i + 1,
          player1_id: player1.user_id, // null olabilir (bot)
          player2_id: player2.user_id, // null olabilir (bot)
          status: 'pending'
        });
      }
    } else {
      // Daha az katılımcı varsa çiftler halinde
      const pairCount = Math.floor(allParticipants.length / 2);
      for (let i = 0; i < pairCount; i++) {
        matches.push({
          tournament_id: tournament.id,
          round: 1,
          match_number: i + 1,
          player1_id: allParticipants[i * 2].user_id,
          player2_id: allParticipants[i * 2 + 1].user_id,
          status: 'pending'
        });
      }
    }

    if (matches.length > 0) {
      const { error: matchError } = await supabase
        .from('tournament_matches')
        .insert(matches);

      if (matchError) throw matchError;

      console.log(`${matches.length} maç oluşturuldu`);
    }
    
  } catch (error) {
    console.error('Maç oluşturma hatası:', error);
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