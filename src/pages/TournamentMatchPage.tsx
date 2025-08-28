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
  const [nextRoundMatches, setNextRoundMatches] = useState<TournamentMatch[]>([]);
  const [nextRoundCountdown, setNextRoundCountdown] = useState<number | null>(null);
  const [nextRoundNumber, setNextRoundNumber] = useState<number | null>(null);

  // Otomatik maç başlatma sistemi
const startAutoMatch = async (match: TournamentMatch) => {
  if (!user) return;

  try {
    console.log('🚀 Otomatik maç başlatılıyor:', match.id);

    // ✅ DOĞRUDAN GamePage'e yönlendir - room oluşturma
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

  // Turnuva durumunu kontrol et ve sonraki turu başlat
const checkCurrentTournamentProgress = async () => {
  if (!tournamentId) return;

  try {
    console.log('🏆 Turnuva ilerlemesi kontrol ediliyor...', tournamentId);
    
    const { data: currentTournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (tournamentError || !currentTournament) {
      console.error('❌ Tournament bulunamadı:', tournamentError);
      return;
    }

    // Eğer turnuva zaten finished durumundaysa ilerleme kontrolü yapma!
    if (currentTournament.status === 'finished') {
      console.log('⏹️ Turnuva zaten tamamlanmış, ilerleme kontrolü yapılmıyor');
      return;
    }

    const currentRound = currentTournament.current_round;
    
    // Mevcut turun tüm maçları tamamlandı mı kontrol et
    const { data: roundMatches, error: matchesError } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('round', currentRound);

    if (matchesError || !roundMatches) {
      console.error('❌ Maç sorgu hatası:', matchesError);
      return;
    }

    console.log(`🏆 Tur ${currentRound} maçları:`, roundMatches);
    const allCompleted = roundMatches.every(match => match.status === 'completed');
    console.log('🏆 Tüm maçlar tamamlandı mı?', allCompleted);
    
    if (allCompleted && currentRound < 3) {
      const nextRound = currentRound + 1;
      console.log(`🏆 Tur ${currentRound} tamamlandı, tur ${nextRound} için hazırlanıyor...`);
      
      // Kazananları topla
      const winners = roundMatches
        .filter(match => match.winner_id !== null)
        .map(match => match.winner_id);

      console.log('🏆 Kazananlar:', winners);

      if ((nextRound === 2 && winners.length < 4) || (nextRound === 3 && winners.length < 2)) {
        console.error('❌ Yeterli kazanan yok!');
        return;
      }

      // Sonraki tur maçlarını OLUŞTUR ama HEMEN KAYDETME!
      const newMatches = setNextRoundMatches(nextRound, winners);
      
      if (newMatches.length > 0) {
        // State'i güncelle ve countdown başlat
        setNextRoundMatches(newMatches);
        setNextRoundNumber(nextRound);
        setNextRoundCountdown(10); // 10 saniye countdown
        
        console.log(`⏰ ${nextRound}. tur için 10 saniye countdown başlatıldı`);
        
        // Tournament current_round'u güncelle (ama maçları henüz kaydetme)
        const { error: updateError } = await supabase
          .from('tournaments')
          .update({ 
            current_round: nextRound,
            updated_at: new Date().toISOString()
          })
          .eq('id', tournamentId);

        if (updateError) {
          console.error('❌ Tur güncelleme hatası:', updateError);
        }
      }
    }
    else if (allCompleted && currentRound === 3) {
      console.log('🏆 Turnuva tamamlandı!');
      
      // Turnuvayı bitir
      const { error: finishError } = await supabase
        .from('tournaments')
        .update({ 
          status: 'finished',
          finished_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', tournamentId);

      if (finishError) {
        console.error('❌ Turnuva bitirme hatası:', finishError);
      } else {
        console.log('✅ Turnuva başarıyla tamamlandı');
        loadTournamentData();
      }
    }
  } catch (error) {
    console.error('❌ Turnuva ilerleme kontrolü hatası:', error);
  }
};

  // Sonraki turu oluştur
 const createNextRound = async (nextRound: number, winners: (string | null)[]) => {
  try {
    console.log('🎯 Sonraki tur oluşturuluyor:', { nextRound, winners });

    const nextRoundMatches = [];
    const validWinners = winners.filter(winner => winner !== null) as string[];
    
    console.log('🎯 Geçerli kazananlar:', validWinners);

    if (nextRound === 2 && validWinners.length === 4) {
      console.log('🎯 Yarı final maçları oluşturuluyor');
      // Yarı final: 4 kazanan -> 2 maç
      for (let i = 0; i < 4; i += 2) {
        const matchData = {
          tournament_id: tournamentId,
          round: 2,
          match_number: Math.floor(i / 2) + 1,
          player1_id: validWinners[i],
          player2_id: validWinners[i + 1],
          status: 'pending',
          player1_score: 0,
          player2_score: 0,
          created_at: new Date().toISOString()
        };
        
        console.log(`🥊 Yarı final maç ${Math.floor(i / 2) + 1}:`, matchData);
        nextRoundMatches.push(matchData);
      }
    } else if (nextRound === 3 && validWinners.length === 2) {
      console.log('🎯 Final maçı oluşturuluyor');
      // Final: 2 kazanan -> 1 maç
      const matchData = {
        tournament_id: tournamentId,
        round: 3,
        match_number: 1,
        player1_id: validWinners[0],
        player2_id: validWinners[1],
        status: 'pending',
        player1_score: 0,
        player2_score: 0,
        created_at: new Date().toISOString()
      };
      
      console.log('🥊 Final maçı:', matchData);
      nextRoundMatches.push(matchData);
    } else {
      console.error('❌ Yeterli kazanan yok!', { 
        nextRound, 
        validWinnersCount: validWinners.length,
        required: nextRound === 2 ? 4 : 2 
      });
      return;
    }

    if (nextRoundMatches.length > 0) {
      console.log('💾 Maçlar veritabanına kaydediliyor:', nextRoundMatches);
      
      const { error: insertError } = await supabase
        .from('tournament_matches')
        .insert(nextRoundMatches);

      if (insertError) {
        console.error('❌ Maç oluşturma hatası:', insertError);
        throw insertError;
      } else {
        console.log(`✅ ${nextRound}. tur maçları oluşturuldu`);
      }
    }
  } catch (error) {
    console.error('❌ Sonraki tur oluşturma hatası:', error);
    throw error;
  }
};

const loadTournamentData = async () => {
  if (!tournamentId || !user) return;

  try {
    console.log('📊 Turnuva verileri yükleniyor:', tournamentId);
    
    // Tüm katılımcıları çek (sadece bu turnuva için)
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
      
      // Debug için
      console.log('🥊 Maçlar yüklendi:', matchesData.length);
      matchesData.forEach(match => {
        console.log(`🥊 Maç ${match.round}-${match.match_number}:`, 
          `${getPlayerName(match.player1_id)} vs ${getPlayerName(match.player2_id)}`, 
          `- ${match.status}`
        );
      });
    }

  } catch (error) {
    console.error('❌ Turnuva veri yükleme hatası:', error);
  } finally {
    setLoading(false);
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

// Maçları veritabanına kaydet
const saveNextRoundMatches = async () => {
  if (nextRoundMatches.length === 0 || !nextRoundNumber) return;

  try {
    console.log('💾 Sonraki tur maçları kaydediliyor:', nextRoundMatches);
    
    // Geçici ID'leri kaldır
    const matchesToSave = nextRoundMatches.map(match => ({
      ...match,
      id: undefined // ID'yi undefined yap ki Supabase otomatik oluştursun
    }));

    const { error: insertError } = await supabase
      .from('tournament_matches')
      .insert(matchesToSave);

    if (insertError) {
      console.error('❌ Maç kaydetme hatası:', insertError);
    } else {
      console.log(`✅ ${nextRoundNumber}. tur maçları kaydedildi`);
      
      // State'leri temizle
      setNextRoundMatches([]);
      setNextRoundNumber(null);
      setNextRoundCountdown(null);
      
      // Verileri yenile
      loadTournamentData();
      
      // Kullanıcıya bilgi ver
      toast({
        title: `🏆 ${nextRoundNumber === 2 ? 'Yarı Final' : 'Final'} Başlıyor!`,
        description: 'Yeni tur maçları oluşturuldu.',
        duration: 3000,
      });
    }
  } catch (error) {
    console.error('❌ Maç kaydetme hatası:', error);
  }
};
  

const getPlayerName = (playerId: string | null): string => {
  if (!playerId) return 'Bot';
  
  // Önce participants içinde ara
  const participant = participants.find(p => p.user_id === playerId);
  
  if (participant) {
    if (participant.is_bot) {
      return `Bot ${participant.seed || '?'}`; // ✅ seed kontrolü ekle
    }
    return participant.profiles?.username || 'Bilinmeyen Oyuncu';
  }
  
  // Eğer participants'ta bulamazsak, direkt olarak user bilgisini kontrol et
  if (playerId === user?.id) {
    return user.user_metadata?.name || user.email?.split('@')[0] || 'Ben';
  }
  
  return 'Bilinmeyen Oyuncu';
};


const renderNextRoundCountdown = () => {
  if (nextRoundCountdown === null || !nextRoundNumber) return null;

  return (
    <Card className="mb-6 border-blue-500 bg-blue-50">
      <CardContent className="p-6 text-center">
        <div className="text-6xl font-bold text-blue-600 mb-4">
          {nextRoundCountdown}
        </div>
        <h3 className="text-xl font-semibold mb-2">
          {nextRoundNumber === 2 ? 'Yarı Final' : 'Final'} Başlıyor!
        </h3>
        <p className="text-muted-foreground">
          {nextRoundNumber === 2 ? '4 kazanan' : '2 kazanan'} yeni tur için hazırlanıyor...
        </p>
        <p className="text-sm text-blue-600 mt-2">
          Otomatik olarak {nextRoundNumber === 2 ? 'yarı final' : 'final'} maçları başlatılacak...
        </p>
      </CardContent>
    </Card>
  );
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {round1Matches.map((match, index) => (
            <Card key={match.id} className={`p-4 ${match.winner_id ? 'border-green-200 bg-green-50' : ''}`}>
              <div className="space-y-2">
                <div className={`flex items-center justify-between p-2 rounded ${
                  match.winner_id === match.player1_id ? 'bg-green-100 border border-green-300' : 'bg-gray-100'
                }`}>
                  <span className="font-medium">{getPlayerName(match.player1_id)}</span>
                  {/* ✅ player1_score kontrolü */}
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
                  {/* ✅ player2_score kontrolü */}
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

      {/* Round 2 - Semifinals */}
      {round2Matches.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Yarı Final</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md mx-auto">
            {round2Matches.map((match) => (
              <Card key={match.id} className={`p-4 ${match.winner_id ? 'border-green-200 bg-green-50' : ''}`}>
                <div className="space-y-2">
                  <div className={`flex items-center justify-between p-2 rounded ${
                    match.winner_id === match.player1_id ? 'bg-green-100 border border-green-300' : 'bg-gray-100'
                  }`}>
                    <span className="font-medium">{getPlayerName(match.player1_id)}</span>
                    {/* ✅ player1_score kontrolü */}
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
                    {/* ✅ player2_score kontrolü */}
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
          <h3 className="text-lg font-semibold mb-4">Final</h3>
          <div className="max-w-sm mx-auto">
            {round3Matches.map((match) => (
              <Card key={match.id} className={`p-4 ${match.winner_id ? 'border-yellow-200 bg-yellow-50' : ''}`}>
                <div className="space-y-2">
                  <div className={`flex items-center justify-between p-2 rounded ${
                    match.winner_id === match.player1_id ? 'bg-yellow-100 border border-yellow-300' : 'bg-gray-100'
                  }`}>
                    <span className="font-medium">{getPlayerName(match.player1_id)}</span>
                    {/* ✅ player1_score kontrolü */}
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
                    {/* ✅ player2_score kontrolü */}
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

// TournamentMatchPage.tsx - Countdown useEffect'i
useEffect(() => {
  if (nextRoundCountdown === null || nextRoundCountdown <= 0) return;

  const timer = setInterval(() => {
    setNextRoundCountdown(prev => {
      if (prev === null || prev <= 1) {
        clearInterval(timer);
        // Countdown bittiğinde maçları KAYDET
        saveNextRoundMatches();
        return 0;
      }
      return prev - 1;
    });
  }, 1000);

  return () => clearInterval(timer);
}, [nextRoundCountdown]);


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
  if (!tournamentId || nextRoundCountdown !== null) return;

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
      async (payload) => {
        // Eğer countdown yoksa ve maç tamamlandıysa
        if (payload.new.status === 'completed' && tournament?.status !== 'finished') {
          console.log('✅ Maç tamamlandı, ilerleme kontrolü yapılıyor...');
          setTimeout(() => {
            checkTournamentProgress();
          }, 3000);
        }
        
        loadTournamentData();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [tournamentId, tournament?.status, nextRoundCountdown]);

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
        <p className="mt-4">Turnuva veriler yükleniyor...</p>
        <p className="text-sm text-muted-foreground mt-2">
          Sonraki tur eşleştirmesi kontrol ediliyor...
        </p>
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
              <span>Tur: {tournament.current_round}</span>
              <span>Katılımcı: {participants.length}</span>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Countdown gösterimi */}
      {renderNextRoundCountdown()}

      {/* Normal maç bilgileri */}
      {!countdown && currentMatch && (
        <Card className="mb-6 border-primary">
          <CardHeader>
            <CardTitle className="text-primary">Sıradaki Maçınız</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p>{getPlayerName(currentMatch.player1_id)} vs {getPlayerName(currentMatch.player2_id)}</p>
                <p className="text-sm text-muted-foreground">Tur {currentMatch.round}, Maç {currentMatch.match_number}</p>
                <p className="text-sm text-orange-600 mt-2">10 saniye içinde otomatik başlatılacak...</p>
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