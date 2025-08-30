// TournamentBracket.tsx - Real-time updates ve bracket yenileme düzeltmesi

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Trophy, User, Bot, Play, Clock, CheckCircle, RefreshCw } from 'lucide-react';

interface TournamentBracketProps {
  tournament: any;
  userParticipation: any;
  onBackToList?: () => void;
}

const TournamentBracket = ({ tournament, userParticipation, onBackToList }: TournamentBracketProps) => {
  const [matches, setMatches] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Turnuva verilerini yükle - GÜÇLENDİRİLMİŞ
  const loadTournamentData = async (showRefreshMessage = false) => {
    try {
      if (showRefreshMessage) {
        setRefreshing(true);
      }

      console.log('🔄 Turnuva verileri yükleniyor...');

      // Maçları yükle - TÜM ROUNDLAR
      const { data: matchData, error: matchError } = await supabase
        .from('tournament_matches')
        .select('*')
        .eq('tournament_id', tournament.id)
        .order('round')
        .order('match_number');

      if (matchError) {
        console.error('❌ Maçlar yüklenirken hata:', matchError);
        throw matchError;
      }

      // Katılımcıları yükle
      const { data: participantData, error: participantError } = await supabase
        .from('tournament_participants')
        .select(`
          *,
          profiles:user_id (username, avatar_url)
        `)
        .eq('tournament_id', tournament.id)
        .order('seed');

      if (participantError) {
        console.error('❌ Katılımcılar yüklenirken hata:', participantError);
        throw participantError;
      }

      console.log('✅ Veriler yüklendi:', {
        matches: matchData?.length || 0,
        participants: participantData?.length || 0,
        rounds: [...new Set(matchData?.map(m => m.round) || [])]
      });

      if (matchData) setMatches(matchData);
      if (participantData) setParticipants(participantData);
      
      if (showRefreshMessage && matchData && matchData.length > 0) {
        toast({
          title: '🔄 Bracket Güncellendi',
          description: `${matchData.length} maç yüklendi`,
          duration: 2000,
        });
      }
      
    } catch (error) {
      console.error('❌ Turnuva verileri yükleme hatası:', error);
      toast({
        title: 'Hata',
        description: 'Turnuva verileri yüklenemedi',
        variant: 'destructive',
      });
    } finally {
      if (showRefreshMessage) {
        setRefreshing(false);
      }
    }
  };

  // Manual refresh fonksiyonu
  const handleManualRefresh = async () => {
    await loadTournamentData(true);
  };

  // Katılımcı bilgisini al - AYNI
  const getParticipantInfo = (userId: string | null) => {
    if (!userId) {
      const participant = participants.find(p => p.user_id === null);
      const seed = participant?.seed || Math.floor(Math.random() * 8) + 1;
      return { 
        name: `Bot ${seed}`, 
        isBot: true, 
        avatar: null 
      };
    }
    
    const participant = participants.find(p => p.user_id === userId);
    if (!participant) return { name: 'Bilinmiyor', isBot: false, avatar: null };
    
    if (participant.is_bot) {
      return { 
        name: `Bot ${participant.seed}`, 
        isBot: true, 
        avatar: null 
      };
    }
    
    return {
      name: participant.profiles?.username || `Oyuncu ${participant.seed}`,
      isBot: false,
      avatar: participant.profiles?.avatar_url
    };
  };

  // Maça başla - AYNI
  const startMatch = async (match: any) => {
    if (!user || loading) return;
    
    const isUserInMatch = match.player1_id === user.id || match.player2_id === user.id;
    
    if (!isUserInMatch) {
      toast({
        title: 'Bu Maç Size Ait Değil',
        description: 'Bu maçta oynamıyorsunuz.',
        variant: 'destructive',
      });
      return;
    }

    if (match.status !== 'pending') {
      toast({
        title: 'Maç Zaten Başladı',
        description: 'Bu maç zaten başlamış veya tamamlanmış.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    
    try {
      const { error } = await supabase
        .from('tournament_matches')
        .update({ 
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', match.id);

      if (error) throw error;

      navigate(`/game?gameMode=tournament&tournament=${tournament.id}&match=${match.id}&type=timed`);
      
    } catch (error) {
      console.error('Maç başlatma hatası:', error);
      toast({
        title: 'Hata',
        description: 'Maç başlatılamadı',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Round adını al - AYNI
  const getRoundName = (round: number) => {
    switch (round) {
      case 1: return 'Çeyrek Final';
      case 2: return 'Yarı Final';
      case 3: return 'Final';
      default: return `${round}. Tur`;
    }
  };

  // Round'a göre maçları grupla - AYNI
  const getMatchesByRound = (round: number) => {
    return matches.filter(m => m.round === round);
  };

  // ENHANCED Real-time updates
  useEffect(() => {
    loadTournamentData();
    
    console.log('🔔 Enhanced real-time subscription kuruluyor:', tournament.id);
    
    const channel = supabase
      .channel(`enhanced-tournament-bracket-${tournament.id}`)
      // Maç değişiklikleri
      .on('postgres_changes', {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'tournament_matches',
        filter: `tournament_id=eq.${tournament.id}`
      }, (payload) => {
        console.log('🔄 Maç değişikliği:', payload);
        // Hemen yenile
        setTimeout(() => loadTournamentData(), 500);
      })
      // Turnuva durumu değişiklikleri
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public', 
        table: 'tournaments',
        filter: `id=eq.${tournament.id}`
      }, (payload) => {
        console.log('🏆 Turnuva güncellendi:', payload.new);
        // Round değişti mi?
        const newTournament = payload.new as any;
        if (newTournament.current_round !== tournament.current_round) {
          console.log(`📈 Round değişti: ${tournament.current_round} -> ${newTournament.current_round}`);
          // Bracket'i yenile
          setTimeout(() => loadTournamentData(), 1000);
          
          toast({
            title: '🚀 Yeni Round!',
            description: `${getRoundName(newTournament.current_round)} başladı`,
            duration: 4000,
          });
        }
      })
      .subscribe();

    return () => {
      console.log('🔌 Enhanced bracket subscription temizleniyor');
      supabase.removeChannel(channel);
    };
  }, [tournament.id, tournament.current_round]);

  // Match card component - AYNI
  const MatchCard = ({ match }: { match: any }) => {
    const player1 = getParticipantInfo(match.player1_id);
    const player2 = getParticipantInfo(match.player2_id);
    const isUserMatch = match.player1_id === user?.id || match.player2_id === user?.id;
    
    return (
      <Card className={`${isUserMatch ? 'border-primary ring-2 ring-primary/20' : ''}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">
              Maç {match.match_number}
            </CardTitle>
            <Badge variant={
              match.status === 'completed' ? 'default' :
              match.status === 'active' ? 'destructive' : 'secondary'
            }>
              {match.status === 'completed' ? 'Bitti' :
               match.status === 'active' ? 'Devam Ediyor' : 'Bekliyor'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Player 1 */}
          <div className={`flex items-center justify-between p-2 rounded ${
            match.winner_id === match.player1_id ? 'bg-green-100 border border-green-300' : 'bg-muted'
          }`}>
            <div className="flex items-center space-x-2">
              {player1.isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              <span className={`font-medium ${match.player1_id === user?.id ? 'text-primary' : ''}`}>
                {player1.name}
              </span>
              {match.winner_id === match.player1_id && <CheckCircle className="w-4 h-4 text-green-600" />}
            </div>
            <span className="font-bold">
              {match.player1_score !== null ? match.player1_score : '-'}
            </span>
          </div>
          
          <div className="text-center text-sm text-muted-foreground">VS</div>
          
          {/* Player 2 */}
          <div className={`flex items-center justify-between p-2 rounded ${
            match.winner_id === match.player2_id ? 'bg-green-100 border border-green-300' : 'bg-muted'
          }`}>
            <div className="flex items-center space-x-2">
              {player2.isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              <span className={`font-medium ${match.player2_id === user?.id ? 'text-primary' : ''}`}>
                {player2.name}
              </span>
              {match.winner_id === match.player2_id && <CheckCircle className="w-4 h-4 text-green-600" />}
            </div>
            <span className="font-bold">
              {match.player2_score !== null ? match.player2_score : '-'}
            </span>
          </div>

          {/* Action buttons */}
          {isUserMatch && match.status === 'pending' && (
            <Button 
              onClick={() => startMatch(match)}
              disabled={loading}
              className="w-full"
            >
              <Play className="w-4 h-4 mr-2" />
              {loading ? 'Başlatılıyor...' : 'Maça Başla'}
            </Button>
          )}
          
          {isUserMatch && match.status === 'active' && (
            <Button 
              onClick={() => navigate(`/game?gameMode=tournament&tournament=${tournament.id}&match=${match.id}&type=timed`)}
              variant="destructive"
              className="w-full"
            >
              <Clock className="w-4 h-4 mr-2" />
              Maça Devam Et
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header - GÜÇLENDİRİLMİŞ */}
        <div className="flex items-center justify-between">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate('/tournament')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Turnuva Listesi
          </Button>
          <h1 className="text-2xl font-bold flex items-center">
            <Trophy className="w-6 h-6 mr-2" />
            {tournament.name}
          </h1>
          {/* YENİ: Manual refresh butonu */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Yenile</span>
          </Button>
        </div>

        {/* Tournament Info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Turnuva Durumu</h3>
                <p className="text-sm text-muted-foreground">
                  {getRoundName(tournament.current_round)} - {tournament.status === 'active' ? 'Devam Ediyor' : 'Tamamlandı'}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant={tournament.status === 'active' ? 'default' : 'secondary'}>
                  {tournament.status === 'active' ? 'Aktif' : 'Bitti'}
                </Badge>
                {/* YENİ: Maç sayısı göstergesi */}
                <Badge variant="outline">
                  {matches.length} Maç
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ENHANCED Bracket */}
        <div className="space-y-8">
          {[1, 2, 3].map(round => {
            const roundMatches = getMatchesByRound(round);
            
            // Eğer bu round için hiç maç yoksa, gösterme
            if (roundMatches.length === 0) return null;
            
            return (
              <div key={round}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold flex items-center">
                    <Trophy className="w-5 h-5 mr-2" />
                    {getRoundName(round)}
                  </h2>
                  <Badge variant="outline">
                    {roundMatches.filter(m => m.status === 'completed').length}/{roundMatches.length} Tamamlandı
                  </Badge>
                </div>
                <div className={`grid gap-4 ${
                  round === 1 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' :
                  round === 2 ? 'grid-cols-1 md:grid-cols-2' :
                  'grid-cols-1'
                }`}>
                  {roundMatches.map(match => (
                    <MatchCard key={match.id} match={match} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tournament Winner */}
        {tournament.status === 'completed' && tournament.winner_id && (
          <Card className="border-yellow-500 bg-yellow-50">
            <CardContent className="p-6 text-center">
              <Trophy className="w-12 h-12 mx-auto mb-4 text-yellow-600" />
              <h2 className="text-2xl font-bold text-yellow-800 mb-2">
                Turnuva Şampiyonu!
              </h2>
              <p className="text-lg text-yellow-700">
                {getParticipantInfo(tournament.winner_id).name}
              </p>
            </CardContent>
          </Card>
        )}

        {/* YENİ: Maç yoksa mesaj */}
        {matches.length === 0 && !refreshing && (
          <Card>
            <CardContent className="p-8 text-center">
              <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Maçlar Hazırlanıyor</h3>
              <p className="text-muted-foreground mb-4">
                Turnuva maçları oluşturuluyor...
              </p>
              <Button onClick={handleManualRefresh} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Tekrar Dene
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Debug bilgisi (development modunda) */}
        {process.env.NODE_ENV === 'development' && matches.length > 0 && (
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <h4 className="text-sm font-medium mb-2">Debug Info</h4>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Turnuva ID: {tournament.id.slice(-8)}</p>
                <p>Current Round: {tournament.current_round}</p>
                <p>Total Matches: {matches.length}</p>
                {[1, 2, 3].map(round => {
                  const roundMatches = getMatchesByRound(round);
                  if (roundMatches.length === 0) return null;
                  return (
                    <p key={round}>
                      Round {round}: {roundMatches.length} maç 
                      ({roundMatches.filter(m => m.status === 'completed').length} tamamlandı)
                    </p>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TournamentBracket;