import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import TournamentBracket from './TournamentBracket';
import GamePage from './GamePage';
import { 
  ArrowLeft, 
  Trophy, 
  Users, 
  Clock, 
  Play
} from 'lucide-react';

// Turnuva ilerlemesi için success kartları bileşeni
const TournamentProgressCard = ({ 
  currentRound, 
  isWinner, 
  tournamentName, 
  onContinue 
}: {
  currentRound: number;
  isWinner: boolean;
  tournamentName: string;
  onContinue: () => void;
}) => {
  const getRoundInfo = (round: number) => {
    switch(round) {
      case 1: return {
        name: 'Çeyrek Final',
        nextName: 'Yarı Final',
        icon: '🥉',
        message: isWinner ? 'Çeyrek finali geçtiniz!' : 'Çeyrek finalde elendiz!',
        description: isWinner ? 'Yarı finale hazır olun!' : 'Turnuva deneyiminiz burada sona eriyor.'
      };
      case 2: return {
        name: 'Yarı Final', 
        nextName: 'Final',
        icon: '🥈',
        message: isWinner ? 'Yarı finali geçtiniz!' : 'Yarı finalde elendiz!',
        description: isWinner ? 'Finale bir adım kaldı!' : 'İyi bir performans sergilediz!'
      };
      case 3: return {
        name: 'Final',
        nextName: 'Şampiyonluk',
        icon: '🏆',
        message: isWinner ? 'Turnuva şampiyonu oldunuz!' : 'Finalde elendiz!',
        description: isWinner ? 'Tebrikler, şampiyon!' : 'Finale gelerek harika bir başarı gösterdiz!'
      };
      default: return {
        name: 'Turnuva',
        nextName: 'Sonraki Tur',
        icon: '🎮',
        message: 'Maç tamamlandı!',
        description: ''
      };
    }
  };

  const roundInfo = getRoundInfo(currentRound);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className={`max-w-md w-full ${isWinner ? 'border-yellow-500 bg-gradient-to-br from-yellow-50 to-orange-50' : 'border-gray-400 bg-gray-50'}`}>
        <CardContent className="p-8 text-center space-y-6">
          {/* Ana İkon */}
          <div className="text-6xl animate-bounce">
            {isWinner ? roundInfo.icon : '😔'}
          </div>
          
          {/* Başlık */}
          <div>
            <h2 className={`text-2xl font-bold ${isWinner ? 'text-yellow-700' : 'text-gray-700'}`}>
              {roundInfo.message}
            </h2>
            <p className={`text-lg mt-2 ${isWinner ? 'text-yellow-600' : 'text-gray-600'}`}>
              {roundInfo.name}
            </p>
          </div>

          {/* Turnuva Adı */}
          <div className="bg-white/50 rounded-lg p-3">
            <p className="text-sm text-gray-600">Turnuva</p>
            <p className="font-semibold">{tournamentName}</p>
          </div>

          {/* Açıklama */}
          <p className="text-gray-700">
            {roundInfo.description}
          </p>

          {/* İlerle Butonu */}
          <Button 
            onClick={onContinue}
            className={`w-full py-3 text-lg font-semibold ${
              isWinner 
                ? 'bg-yellow-500 hover:bg-yellow-600 text-white' 
                : 'bg-gray-500 hover:bg-gray-600 text-white'
            }`}
          >
            {isWinner && currentRound < 3 ? `${roundInfo.nextName}'e Geç` : 'Turnuva Durumuna Dön'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

interface Tournament {
  id: string;
  name: string;
  status: string;
  current_round: number;
  max_participants: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  expires_at: string | null;
  timeout_duration: number;
  game_type: string;
}

interface TournamentMatch {
  id: string;
  tournament_id: string;
  round: number;
  match_number: number;
  player1_id: string | null;
  player2_id: string | null;
  player1_score?: number;
  player2_score?: number;
  winner_id: string | null;
  status: string;
  created_at: string;
  updated_at?: string;
  room_id?: string;
}

interface TournamentParticipant {
  id: string;
  tournament_id: string;
  user_id: string | null;
  seed: number;
  is_bot: boolean;
  eliminated_at: string | null;
  profiles?: {
    username: string;
    avatar_url: string | null;
  };
}

const TournamentMatchPage = () => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [participants, setParticipants] = useState<TournamentParticipant[]>([]);
  const [currentMatch, setCurrentMatch] = useState<TournamentMatch | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showProgressCard, setShowProgressCard] = useState(false);
  const [progressCardData, setProgressCardData] = useState<{
    currentRound: number;
    isWinner: boolean;
    tournamentName: string;
  } | null>(null);

  // 🎯 Oyun bitince sonraki aşama kontrolü
const checkNextRoundOrFinish = async () => {
  if (!tournament) return;

  try {
    console.log('🔄 Sonraki tur kontrolü başlıyor...');
    
    const { data: currentTournament } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (!currentTournament) {
      console.log('❌ Turnuva bulunamadı');
      return;
    }

    console.log('📊 Mevcut tur:', currentTournament.current_round);

    const { data: currentRoundMatches, error: matchesError } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('round', currentTournament.current_round);

    if (matchesError) {
      console.error('❌ Maçları çekme hatası:', matchesError);
      return;
    }

    const completedMatches = currentRoundMatches?.filter(m => m.status === 'completed') || [];
    const totalMatches = currentRoundMatches?.length || 0;

    console.log(`Tur ${currentTournament.current_round}: ${completedMatches.length}/${totalMatches} maç tamamlandı`);

    // ✅✅✅ CRITICAL: Tüm maçlar tamamlandı mı?
    if (completedMatches.length === totalMatches && totalMatches > 0) {
      console.log('✅ Tüm maçlar tamamlandı, sonraki tur hazırlanıyor...');
      
      if (currentTournament.current_round === 3) {
        // FINAL BİTTİ
        console.log('🏆 Final tamamlandı, turnuva bitiyor...');
        await supabase
          .from('tournaments')
          .update({ 
            status: 'finished',
            finished_at: new Date().toISOString()
          })
          .eq('id', tournamentId);

      } else {
        // SONRAKI TURA GEÇ
        const nextRound = currentTournament.current_round + 1;
        console.log(`📈 Sonraki tura geçiliyor: ${nextRound}`);

        // ✅✅✅ KAZANANLARI TOPLA
        const allWinners = completedMatches.map(match => match.winner_id).filter(Boolean);
        console.log('🏆 Kazananlar:', allWinners);

        // Yeni tur için maçları oluştur
        const nextRoundMatches = [];
        for (let i = 0; i < allWinners.length; i += 2) {
          if (i + 1 < allWinners.length) {
            const match = {
              tournament_id: tournamentId,
              round: nextRound,
              match_number: nextRoundMatches.length + 1,
              player1_id: allWinners[i],
              player2_id: allWinners[i + 1],
              winner_id: null,
              status: 'pending',
              player1_score: 0,
              player2_score: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            nextRoundMatches.push(match);
            console.log(`🥊 Yeni maç: ${allWinners[i]} vs ${allWinners[i + 1]}`);
          }
        }

        // ✅✅✅ DATABASE'E KAYDET
        if (nextRoundMatches.length > 0) {
          console.log(`💾 ${nextRoundMatches.length} maç kaydediliyor...`);
          const { error: insertError } = await supabase
            .from('tournament_matches')
            .insert(nextRoundMatches);
          
          if (insertError) {
            console.error('❌ Maç ekleme hatası:', insertError);
            throw insertError;
          }

          // ✅✅✅ TURNUVA TURUNU GÜNCELLE
          const { error: updateError } = await supabase
            .from('tournaments')
            .update({ current_round: nextRound })
            .eq('id', tournamentId);
          
          if (updateError) {
            console.error('❌ Tur güncelleme hatası:', updateError);
            throw updateError;
          }

          console.log(`✅ ${nextRound}. tur için ${nextRoundMatches.length} maç oluşturuldu`);
        } else {
          console.log('⚠️ Yeni maç oluşturulamadı');
        }
      }

      // ✅✅✅ VERİLERİ YENİDEN YÜKLE
      await loadTournamentData();
      
    } else {
      console.log('⏳ Henüz tüm maçlar tamamlanmadı');
    }
  } catch (error) {
    console.error('❌ Sonraki tur kontrolü hatası:', error);
  }
};


const startAllMatchesSimultaneously = async () => {
  // Tüm maçları aynı anda başlat
  const { error } = await supabase
    .from('tournament_matches')
    .update({ 
      status: 'active',
      started_at: new Date().toISOString(),
      player1_score: 0,  // 🔥 PUANLI SİSTEM İÇİN
      player2_score: 0   // 🔥 PUANLI SİSTEM İÇİN
    })
    .eq('tournament_id', tournamentId)
    .eq('round', currentRound)
    .eq('status', 'pending');
};

const simulateBotMatch = async (match) => {
  // Bot maçını simüle et - puanlı sistem
  let p1Score = 0;
  let p2Score = 0;
  let winner = null;

  // Rastgele puan artışıyla 500'e ulaşana kadar simüle et
  while (!winner) {
    p1Score += Math.floor(Math.random() * 20) + 5;
    p2Score += Math.floor(Math.random() * 20) + 5;

    if (p1Score >= 500) winner = match.player1_id;
    if (p2Score >= 500) winner = match.player2_id;

    // Her 100ms'de bir puan artışı (gerçekçi olsun diye)
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Maçı tamamla
  await supabase
    .from('tournament_matches')
    .update({
      status: 'completed',
      winner_id: winner,
      player1_score: p1Score,
      player2_score: p2Score,
      updated_at: new Date().toISOString()
    })
    .eq('id', match.id);
};

const completeAllBotMatchesSimultaneously = async () => {
  const botMatches = await getBotMatches();
  
  // TÜM bot maçlarını AYNI ANDA simüle et (parallel)
  await Promise.all(botMatches.map(match => 
    simulateBotMatch(match)
  ));
};

// Tüm maçlar bitene kadar bekle
const waitForAllMatchesToComplete = async () => {
  while (true) {
    const { data: matches } = await supabase
      .from('tournament_matches')
      .select('status')
      .eq('tournament_id', tournamentId)
      .eq('round', currentRound);

    const allCompleted = matches.every(m => m.status === 'completed');
    
    if (allCompleted) {
      console.log('✅ Tüm maçlar tamamlandı!');
      break;
    }
    
    // 5 saniye bekle ve tekrar kontrol et
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  // Sonraki turu başlat
  startNextRound();
};

// Tournament maçı oluştururken zaman sınırı ekle
const createTournamentMatches = async (tournamentId: string, realParticipants: any[]) => {
  try {
    console.log('🏟️ Manuel maç oluşturma başlıyor:', tournamentId);

    // ⛔ Duplicate guard
    const { data: existingMatches } = await supabase
      .from('tournament_matches')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('round', 1);

    if (existingMatches && existingMatches.length > 0) {
      console.log('⛔ İlk tur maçları zaten mevcut');
      return existingMatches;
    }

    // Katılımcıları seed'e göre sırala
    const orderedParticipants = [...realParticipants].sort((a, b) => a.seed - b.seed);
    
    const matches = [];
    const TIME_LIMIT = 10 * 60 * 1000; // 🔥 10 DAKİKA zaman sınırı

    // 4 maç oluştur
    for (let i = 0; i < 4; i++) {
      let player1_id = null;
      let player2_id = null;

      if (i * 2 < orderedParticipants.length) {
        const p1 = orderedParticipants[i * 2];
        player1_id = p1?.user_id || null;
      }
      
      if (i * 2 + 1 < orderedParticipants.length) {
        const p2 = orderedParticipants[i * 2 + 1];
        player2_id = p2?.user_id || null;
      }

      const match = {
        tournament_id: tournamentId,
        round: 1,
        match_number: i + 1,
        player1_id: player1_id,
        player2_id: player2_id,
        winner_id: null,
        room_id: null,
        status: 'pending',
        player1_score: 0, // 🔥 PUANLI SİSTEM İÇİN
        player2_score: 0, // 🔥 PUANLI SİSTEM İÇİN
        time_limit: TIME_LIMIT, // 🔥 ZAMAN SINIRI EKLENDİ
        grid_seed: `seed_${tournamentId}_${i}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      matches.push(match);
    }

    // ✅✅✅ TEK TEK INSERT et
    for (let i = 0; i < matches.length; i++) {
      console.log(`💾 Maç ${i+1} kaydediliyor...`);
      const { error } = await supabase
        .from('tournament_matches')
        .insert(matches[i]);

      if (error) {
        console.error(`❌ Maç ${i+1} kaydetme hatası:`, error);
        throw error;
      }
      console.log(`✅ Maç ${i+1} kaydedildi`);
    }

    console.log('✅ Tüm maçlar başarıyla oluşturuldu');
    return matches;

  } catch (error) {
    console.error('❌ createTournamentMatches hatası:', error);
    throw error;
  }
};

// Aktivite kaydetme fonksiyonu
const recordPlayerActivity = async (matchId: string, playerId: string) => {
  try {
    await supabase
      .from('player_activities')
      .upsert({
        match_id: matchId,
        player_id: playerId,
        last_action_time: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('❌ Aktivite kaydetme hatası:', error);
  }
};

// Her maç için aktivite takibi
const checkActivity = async (matchId: string, playerId: string) => {
  try {
    const { data: activity } = await supabase
      .from('player_activities')
      .select('last_action_time')
      .eq('match_id', matchId)
      .eq('player_id', playerId)
      .single();

    const now = new Date();
    const lastActionTime = new Date(activity?.last_action_time || now);
    const inactiveTime = now - lastActionTime;

    return { inactive: inactiveTime > 60000, time: inactiveTime };
  } catch (error) {
    console.error('❌ Aktivite kontrol hatası:', error);
    return { inactive: false, time: 0 };
  }
};

// 2 dakika boyunca kelime girişi yoksa elenme
const checkForElimination = async (matchId) => {
  const { data: match } = await supabase
    .from('tournament_matches')
    .select('*')
    .eq('id', matchId)
    .single();

  // Her iki oyuncunun da aktivitesini kontrol et
  const player1Activity = await checkActivity(matchId, match.player1_id);
  const player2Activity = await checkActivity(matchId, match.player2_id);

  // Eğer bir oyuncu 2 dakika boyunca kelime girmemişse
  if (player1Activity.inactive && player1Activity.time > 120000) {
    await eliminatePlayer(matchId, match.player1_id, 'inactivity');
  }
  
  if (player2Activity.inactive && player2Activity.time > 120000) {
    await eliminatePlayer(matchId, match.player2_id, 'inactivity');
  }
};

const eliminatePlayer = async (matchId: string, playerId: string, reason: string) => {
  try {
    console.log(`❌ ${playerId} elendi - Sebep: ${reason}`);
    
    // Maç bilgilerini al
    const { data: match } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (!match) return;

    // Kazananı belirle (elenenin rakibi)
    const winnerId = match.player1_id === playerId ? match.player2_id : match.player1_id;

    // Maçı tamamla
    await supabase
      .from('tournament_matches')
      .update({
        status: 'completed',
        winner_id: winnerId,
        player1_score: match.player1_id === winnerId ? 500 : 0,
        player2_score: match.player2_id === winnerId ? 500 : 0,
        end_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', matchId);

    // Oyuncuyu turnuvadan elenmiş olarak işaretle
    await supabase
      .from('tournament_participants')
      .update({
        eliminated_at: new Date().toISOString(),
        elimination_reason: reason
      })
      .eq('tournament_id', match.tournament_id)
      .eq('user_id', playerId);

  } catch (error) {
    console.error('❌ Elenme hatası:', error);
  }
};

// Her maç için zaman aşımı kontrolü
const checkTimeLimit = async (matchId: string) => {
  try {
    const { data: match } = await supabase
      .from('tournament_matches')
      .select('created_at, time_limit, status, player1_score, player2_score, player1_id, player2_id, tournament_id')
      .eq('id', matchId)
      .single();

    if (!match || match.status !== 'active') return;

    const now = new Date();
    const startTime = new Date(match.created_at);
    const elapsedTime = now - startTime;

    // Zaman aşımı olduysa
    if (elapsedTime > match.time_limit) {
      // En yüksek puanlı oyuncu kazanır
      let winnerId = null;
      if (match.player1_score > match.player2_score) {
        winnerId = match.player1_id;
      } else if (match.player2_score > match.player1_score) {
        winnerId = match.player2_id;
      } else {
        // Beraberlikse rastgele kazanan seç
        winnerId = Math.random() > 0.5 ? match.player1_id : match.player2_id;
      }

      await supabase
        .from('tournament_matches')
        .update({
          status: 'completed',
          winner_id: winnerId,
          end_reason: 'time_limit',
          updated_at: new Date().toISOString()
        })
        .eq('id', matchId);
    }
  } catch (error) {
    console.error('❌ Zaman aşımı kontrol hatası:', error);
  }
};

// Tüm maçları monitor et
const monitorTournamentMatches = async () => {
  if (!tournamentId) return;

  try {
    // Aktif maçları getir
    const { data: activeMatches } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('status', 'active');

    if (!activeMatches) return;

    for (const match of activeMatches) {
      // Zaman aşımı kontrolü
      await checkTimeLimit(match.id);
      
      // Her iki oyuncu için aktivite kontrolü
      if (match.player1_id) {
        const activity1 = await checkActivity(match.id, match.player1_id);
        if (activity1.inactive && activity1.time > 120000) {
          await eliminatePlayer(match.id, match.player1_id, 'inactivity');
        }
      }
      
      if (match.player2_id) {
        const activity2 = await checkActivity(match.id, match.player2_id);
        if (activity2.inactive && activity2.time > 120000) {
          await eliminatePlayer(match.id, match.player2_id, 'inactivity');
        }
      }
    }
  } catch (error) {
    console.error('❌ Turnuva monitor hatası:', error);
  }
};

const autoCompleteBotMatches = async () => {
  try {
    console.log('🤖 Otomatik bot maç tamamlama başlıyor...');
    
    if (!tournament) return;

    // Mevcut turdaki TÜM maçları al
    const { data: currentRoundMatches } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('round', tournament.current_round)
      .eq('status', 'pending'); // Sadece pending olanları

    if (!currentRoundMatches || currentRoundMatches.length === 0) return;

    // Bot maçlarını bul (player1_id veya player2_id null olanlar)
    const botMatches = currentRoundMatches.filter(match => 
      match.player1_id === null || match.player2_id === null
    );

    console.log(`🤖 ${botMatches.length} bot maçı bulundu`);

    // Her bot maçını otomatik tamamla
    for (const match of botMatches) {
      console.log(`🤖 Bot maçı otomatik tamamlanıyor: ${match.id}`);
      
      // Rastgele kazanan seç (50/50 şans)
      const randomWinner = Math.random() > 0.5 ? match.player1_id : match.player2_id;
      const player1Score = Math.floor(Math.random() * 50) + 10;
      const player2Score = Math.floor(Math.random() * 50) + 10;

      // Maçı tamamla
      const { error } = await supabase
        .from('tournament_matches')
        .update({
          status: 'completed',
          winner_id: randomWinner,
          player1_score: player1Score,
          player2_score: player2Score,
          updated_at: new Date().toISOString()
        })
        .eq('id', match.id);

      if (error) {
        console.error(`❌ Bot maçı tamamlama hatası:`, error);
      } else {
        console.log(`✅ Bot maçı tamamlandı: ${match.id}`);
      }

      // 1 saniye bekle (database overload önlemek için)
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('✅ Tüm bot maçları otomatik tamamlandı');
    
    // Bot maçları tamamlandıktan sonra sonraki turu kontrol et
    setTimeout(() => {
      checkNextRoundOrFinish();
    }, 2000);

  } catch (error) {
    console.error('❌ Otomatik bot maç tamamlama hatası:', error);
  }
};

const completeBotMatches = async () => {
  try {
    console.log('🤖 Bot maçları tamamlanıyor...');
    
    const { data: currentTournament } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (!currentTournament) return;

    // Mevcut turdaki TÜM maçları al
    const { data: currentRoundMatches } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('round', currentTournament.current_round);

    if (!currentRoundMatches) return;

    // Bot maçlarını bul (player1_id veya player2_id null olanlar)
    const botMatches = currentRoundMatches.filter(match => 
      match.status === 'pending' && 
      (match.player1_id === null || match.player2_id === null)
    );

    console.log(`🤖 ${botMatches.length} bot maçı bulundu`);

    // Her bot maçını otomatik tamamla
    for (const match of botMatches) {
      console.log(`🤖 Bot maçı tamamlanıyor: ${match.id}`);
      
      // Rastgele kazanan seç (50/50 şans)
      const randomWinner = Math.random() > 0.5 ? match.player1_id : match.player2_id;
      const player1Score = Math.floor(Math.random() * 50) + 10;
      const player2Score = Math.floor(Math.random() * 50) + 10;

      // Maçı tamamla
      const { error } = await supabase
        .from('tournament_matches')
        .update({
          status: 'completed',
          winner_id: randomWinner,
          player1_score: player1Score,
          player2_score: player2Score,
          updated_at: new Date().toISOString()
        })
        .eq('id', match.id);

      if (error) {
        console.error(`❌ Bot maçı tamamlama hatası:`, error);
      } else {
        console.log(`✅ Bot maçı tamamlandı: ${match.id}`);
      }
    }

    // Tüm bot maçları tamamlandıktan sonra sonraki turu kontrol et
    if (botMatches.length > 0) {
      setTimeout(() => {
        checkNextRoundOrFinish();
      }, 2000);
    }

  } catch (error) {
    console.error('❌ Bot maçları tamamlama hatası:', error);
  }
};

  
// YENİ FONKSIYON: Kullanıcının sonraki maçını kontrol et
const checkUserNextMatch = async () => {
  if (!user || !tournament) return;
  
  try {
    console.log('🔍 Kullanıcının sonraki maçı kontrol ediliyor...');
    
    // Güncel maçları al
    const { data: allMatches } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round')
      .order('match_number');

    if (!allMatches) return;

    // Kullanıcının pending maçını bul
    const userPendingMatch = allMatches.find(match => 
      (match.player1_id === user.id || match.player2_id === user.id) && 
      match.status === 'pending'
    );

    console.log('🔍 Kullanıcının sonraki maçı:', {
      found: !!userPendingMatch,
      round: userPendingMatch?.round,
      matchId: userPendingMatch?.id?.slice(-8)
    });

    if (userPendingMatch) {
      const roundName = userPendingMatch.round === 2 ? 'Yarı Final' : 
                       userPendingMatch.round === 3 ? 'Final' : 'Çeyrek Final';
      
      // Eşleştirme tamamlandı mesajı
      toast({
        title: `🎯 ${roundName} Eşleştirmesi Yapıldı!`,
        description: '10 saniye içinde maçınız otomatik başlayacak...',
        duration: 10000,
      });

      // 10 saniye bekle ve maçı otomatik başlat
      setTimeout(async () => {
        await startUserMatchAutomatically(userPendingMatch.id, roundName);
      }, 10000);
      
    } else {
      console.log('❌ Kullanıcının sonraki maçı bulunamadı');
      
      // Elendi mi kontrol et
      const userParticipant = participants.find(p => p.user_id === user.id);
      if (userParticipant?.eliminated_at) {
        console.log('⚠️ Kullanıcı turnuvadan elendi');
        toast({
          title: '❌ Turnuvadan Elendiniz',
          description: 'Maçı kaybettiniz, turnuva size veda...',
          duration: 5000,
        });
      } else if (tournament.status === 'finished') {
        // Turnuva bitti, şampiyon var mı kontrol et
        const finalMatch = allMatches.find(m => m.round === 3 && m.status === 'completed');
        if (finalMatch?.winner_id === user.id) {
          toast({
            title: '🏆 TURNUVA ŞAMPİYONU!',
            description: 'Tebrikler! Turnuvayı kazandınız!',
            duration: 5000,
          });
        }
      }
    }

  } catch (error) {
    console.error('❌ Sonraki maç kontrolü hatası:', error);
  }
};
// YENİ FONKSIYON: Kullanıcının maçını otomatik başlat
const startUserMatchAutomatically = async (matchId: string, roundName: string) => {
  try {
    console.log('🎮 Otomatik maç başlatılıyor:', matchId);

    // Maçı active yap
    const { error: updateError } = await supabase
      .from('tournament_matches')
      .update({ 
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', matchId);

    if (updateError) {
      console.error('❌ Maç başlatma hatası:', updateError);
      
      // Retry mekanizması
      setTimeout(async () => {
        console.log('🔄 Maç başlatma tekrar deneniyor...');
        await startUserMatchAutomatically(matchId, roundName);
      }, 2000);
      return;
    }

    // Verileri yeniden yükle
    await loadTournamentData();
    
    toast({
      title: `🚀 ${roundName} Başlıyor!`,
      description: 'Oyuna yönlendiriliyorsunuz...',
      duration: 3000,
    });

    // 1 saniye bekle ve oyunu başlat
    setTimeout(() => {
      setIsPlaying(true);
    }, 1000);

  } catch (error) {
    console.error('❌ Otomatik maç başlatma hatası:', error);
  }
};
  
// Progress card'ı kapatma fonksiyonu
const handleProgressContinue = async () => {
  if (!progressCardData) return;

  const { currentRound, isWinner } = progressCardData;
  
  setShowProgressCard(false);
  setProgressCardData(null);
  
  // Eğer kaybettiyse, sadece sonraki tur kontrolü yap
  if (!isWinner) {
    setTimeout(() => {
      checkNextRoundOrFinish();
    }, 500);
    return;
  }
  
  // KAZANIRSA - sonraki tur kontrolü ve hazırlık
  console.log('🏆 Kullanıcı kazandı, sonraki tur hazırlığı:', currentRound);
  
  // Önce diğer maçların tamamlanması için sonraki tur kontrolü
  setTimeout(async () => {
    await checkNextRoundOrFinish();
    
    // Sonraki tur oluşturulduktan sonra, kullanıcının yeni maçını kontrol et
    setTimeout(() => {
      checkAndStartNextUserMatch(currentRound);
    }, 1000);
  }, 500);
};

// 3. YENİ FONKSIYON: Kullanıcının sonraki maçını kontrol et ve başlat
const checkAndStartNextUserMatch = async (completedRound: number) => {
  if (!user || !tournament) return;
  
  try {
    // Güncel maçları al
    const { data: allMatches } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round')
      .order('match_number');

    if (!allMatches) return;

    // Kullanıcının sonraki turda maçı var mı?
    const nextRound = completedRound + 1;
    const userNextMatch = allMatches.find(match => 
      (match.player1_id === user.id || match.player2_id === user.id) && 
      match.round === nextRound &&
      match.status === 'pending'
    );

    console.log('🔍 Kullanıcının sonraki maçı:', {
      nextRound,
      found: !!userNextMatch,
      matchId: userNextMatch?.id?.slice(-8)
    });

    if (userNextMatch) {
      // Sonraki tur var, countdown göster
      const roundName = nextRound === 2 ? 'Yarı Final' : nextRound === 3 ? 'Final' : 'Sonraki Tur';
      
      toast({
        title: `🏆 ${roundName} Hazırlığı`,
        description: '10 saniye içinde maçınız başlayacak...',
        duration: 10000,
      });

      // 10 saniye bekle ve maçı başlat
      setTimeout(async () => {
        await startUserMatch(userNextMatch.id);
      }, 10000);
      
    } else {
      // Kullanıcının sonraki maçı yok (elendi veya turnuva bitti)
      console.log('❌ Kullanıcının sonraki maçı bulunamadı');
      
      if (nextRound > 3) {
        // Turnuva bitti
        toast({
          title: '🏆 Turnuva Tamamlandı!',
          description: 'Turnuva sona erdi.',
        });
      }
    }

  } catch (error) {
    console.error('❌ Sonraki maç kontrolü hatası:', error);
  }
};

// 4. YENİ FONKSIYON: Kullanıcının maçını başlat
const startUserMatch = async (matchId: string) => {
  try {
    console.log('🎮 Kullanıcı maçı başlatılıyor:', matchId);

    // Maçı active yap
    const { error: updateError } = await supabase
      .from('tournament_matches')
      .update({ 
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', matchId);

    if (updateError) {
      console.error('❌ Maç başlatma hatası:', updateError);
      return;
    }

    // Verileri yeniden yükle
    await loadTournamentData();
    
    // Oyunu başlat
    setTimeout(() => {
      setIsPlaying(true);
    }, 1000);

    toast({
      title: '🎮 Maç Başlıyor!',
      description: 'Oyuna yönlendiriliyorsunuz...',
      duration: 2000,
    });

  } catch (error) {
    console.error('❌ startUserMatch hatası:', error);
  }
};

// MEVCUT loadTournamentData fonksiyonunu bununla değiştir:
const loadTournamentData = async () => {
 if (!tournamentId) return;

 try {
   // Öncelikle participants'ı yükle
   const { data: participantsData, error: participantsError } = await supabase
     .from('tournament_participants')
     .select(`
       *,
       profiles:user_id (username, avatar_url)
     `)
     .eq('tournament_id', tournamentId)
     .order('seed');

   if (participantsError) throw participantsError;
   
   console.log('✅ Participants yüklendi:', participantsData?.length || 0);
   setParticipants(participantsData || []);

   // Tournament verilerini yükle
   const { data: tournamentData, error: tournamentError } = await supabase
     .from('tournaments')
     .select('*')
     .eq('id', tournamentId)
     .single();

   if (tournamentError) throw tournamentError;
   setTournament(tournamentData);

   // Matches verilerini yükle
   const { data: matchesData, error: matchesError } = await supabase
     .from('tournament_matches')
     .select('*')
     .eq('tournament_id', tournamentId)
     .order('round')
     .order('match_number');

   if (matchesError) throw matchesError;

   // Matches debug bilgisi
   console.log('📊 Matches yüklendi:', {
     count: matchesData?.length || 0,
     matches: matchesData?.map(m => ({
       id: m.id.slice(-8),
       round: m.round,
       match_number: m.match_number,
       player1: m.player1_id?.slice(-8) || 'NULL',
       player2: m.player2_id?.slice(-8) || 'NULL', 
       status: m.status,
       winner: m.winner_id?.slice(-8) || 'NULL'
     }))
   });
   
   setMatches(matchesData || []);

   // Aktif maç kontrolü - geliştirilmiş versiyon
   if (user && matchesData && matchesData.length > 0) {
     const userActiveMatch = matchesData.find(match => {
       const isPlayer1 = match.player1_id === user.id;
       const isPlayer2 = match.player2_id === user.id;
       const isActive = match.status === 'active';
       
       return (isPlayer1 || isPlayer2) && isActive;
     });

     // Debug için detaylı log
     console.log('👤 Kullanıcının aktif maç kontrolü:', {
       userId: user.id.slice(-8),
       totalMatches: matchesData.length,
       activeMatchFound: !!userActiveMatch,
       activeMatchDetails: userActiveMatch ? {
         id: userActiveMatch.id.slice(-8),
         round: userActiveMatch.round,
         player1: userActiveMatch.player1_id?.slice(-8) || 'NULL',
         player2: userActiveMatch.player2_id?.slice(-8) || 'NULL',
         status: userActiveMatch.status,
         isUserPlayer1: userActiveMatch.player1_id === user.id,
         isUserPlayer2: userActiveMatch.player2_id === user.id
       } : null
     });
     
     setCurrentMatch(userActiveMatch || null);

     // Pending maç kontrolü de ekle
     if (!userActiveMatch) {
       const userPendingMatch = matchesData.find(match => {
         const isPlayer1 = match.player1_id === user.id;
         const isPlayer2 = match.player2_id === user.id;
         const isPending = match.status === 'pending';
         
         return (isPlayer1 || isPlayer2) && isPending;
       });

       console.log('⏰ Kullanıcının pending maçı:', {
         found: !!userPendingMatch,
         matchDetails: userPendingMatch ? {
           id: userPendingMatch.id.slice(-8),
           round: userPendingMatch.round,
           player1: userPendingMatch.player1_id?.slice(-8) || 'NULL',
           player2: userPendingMatch.player2_id?.slice(-8) || 'NULL'
         } : null
       });
     }
   }

   if (matchesData && matchesData.length > 0) {
      const pendingMatches = matchesData.filter(m => m.status === 'pending');
      if (pendingMatches.length > 0) {
        console.log(`⏰ ${pendingMatches.length} pending maç var, botlar kontrol ediliyor...`);
        setTimeout(() => {
          autoCompleteBotMatches();
        }, 3000);
      }
    }


 } catch (error) {
   console.error('❌ Error loading tournament data:', error);
   toast({
     title: 'Hata',
     description: 'Turnuva verileri yüklenemedi',
     variant: 'destructive',
   });
 } finally {
   setLoading(false);
 }
};

// ✅✅✅ useEffect'İN İÇİNE EKLE - Diğer useEffect'lerin yanına
useEffect(() => {
  if (!tournamentId) return;

  // 30 saniyede bir turnuva maçlarını kontrol et
  const monitorInterval = setInterval(() => {
    monitorTournamentMatches();
  }, 30000);

  return () => clearInterval(monitorInterval);
}, [tournamentId]);

// Tüm aktif maçları sürekli kontrol et
useEffect(() => {
  const tournamentMonitor = setInterval(async () => {
    if (!tournamentId) return;

    // Aktif maçları getir
    const { data: activeMatches } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('status', 'active');

    if (!activeMatches) return;

    // Her maç için kontrol yap
    for (const match of activeMatches) {
      // Zaman aşımı kontrolü
      await checkTimeLimit(match.id);
      
      // Aktivite kontrolü
      await checkForElimination(match.id);
      
      // Puan kontrolü (500'e ulaşan var mı?)
      if (match.player1_score >= 500 || match.player2_score >= 500) {
        const winner = match.player1_score >= 500 ? 
                      match.player1_id : match.player2_id;
        await completeMatch(winner, match.player1_score, match.player2_score);
      }
    }
  }, 30000); // 30 saniyede bir kontrol et

  return () => clearInterval(tournamentMonitor);
}, [tournamentId]);

// Kelime girişi yapılmadığında uyarı göster
useEffect(() => {
  const inactivityCheck = setInterval(async () => {
    if (!currentMatch || !user) return;

    const activity = await checkActivity(currentMatch.id, user.id);
    
    if (activity.inactive) {
      // 1 dakika: Uyarı göster
      if (activity.time > 60000 && activity.time < 120000) {
        toast({
          title: '⏰ Uyarı!',
          description: '1 dakikadır kelime girişi yapılmadı. 1 dakika sonra elenebilirsiniz!',
          variant: 'destructive',
        });
      }
      // 2 dakika: Elenme
      else if (activity.time > 120000) {
        await eliminatePlayer(currentMatch.id, user.id, 'inactivity');
      }
    }
  }, 30000); // 30 saniyede bir kontrol

  return () => clearInterval(inactivityCheck);
}, [currentMatch, user]);

// Her skor güncellemesinde kazananı kontrol et
useEffect(() => {
  if (gameType === 'score') {
    // 500 puana ulaşan var mı?
    if (playerScore >= 500 || opponentScore >= 500) {
      const winner = playerScore >= 500 ? user.id : opponentId;
      completeMatch(winner, playerScore, opponentScore);
    }
  }
}, [playerScore, opponentScore, gameType]);

// Tüm maçların durumunu real-time takip et
useEffect(() => {
  const channel = supabase
    .channel('tournament-sync')
    .on('postgres_changes', {
      event: 'UPDATE',
      table: 'tournament_matches',
      filter: `tournament_id=eq.${tournamentId}`
    }, (payload) => {
      // Maç bitince diğerlerini de bitir
      if (payload.new.status === 'completed') {
        completeAllBotMatchesSimultaneously();
      }
    })
    .subscribe();
}, []);


// Real-time turnuva ilerlemesi için yeni useEffect
useEffect(() => {
  if (!tournamentId || !user) return;

  const tournamentChannel = supabase
    .channel(`tournament-progress-${tournamentId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'tournaments',
      filter: `id=eq.${tournamentId}`
    }, async (payload) => {
      console.log('🔄 Turnuva güncellendi:', payload.new);
      
      // Turnuva turu değiştiyse, yeni maçları kontrol et
      const newTournamentData = payload.new as any;
      if (newTournamentData.current_round !== tournament?.current_round) {
        console.log('🎯 Turnuva turu değişti, yeni maçlar kontrol ediliyor...');
        await loadTournamentData();
        checkUserNextMatch();
      }
    })
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'tournament_matches',
      filter: `tournament_id=eq.${tournamentId}`
    }, async (payload) => {
      console.log('🆕 Yeni maç eklendi:', payload.new);
      await loadTournamentData();
      
      // Yeni maç eklendiyse, kullanıcının maçını kontrol et
      const newMatch = payload.new as any;
      if (newMatch.player1_id === user.id || newMatch.player2_id === user.id) {
        setTimeout(() => {
          checkUserNextMatch();
        }, 1000);
      }
    })
    .subscribe();

  return () => {
    supabase.removeChannel(tournamentChannel);
  };
}, [tournamentId, user, tournament?.current_round]);

  useEffect(() => {
    loadTournamentData();
  }, [tournamentId, user]);

  // Real-time güncellemeler için subscription
  useEffect(() => {
    if (!tournamentId) return;

    const channel = supabase
      .channel(`tournament-${tournamentId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournament_matches',
        filter: `tournament_id=eq.${tournamentId}`
      }, () => {
        loadTournamentData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournaments',
        filter: `id=eq.${tournamentId}`
      }, () => {
        loadTournamentData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  // Otomatik maç başlatma effect'i ekle
useEffect(() => {
  if (!tournament || !user) return;

  const userPendingMatch = matches.find(match => 
    (match.player1_id === user.id || match.player2_id === user.id) && 
    match.status === 'pending'
  );

  if (userPendingMatch) {
    console.log('Pending maç bulundu:', userPendingMatch.id);
    
    // Duplicate başlatma engelleyici
    const alreadyStarting = localStorage.getItem(`starting_${userPendingMatch.id}`);
    if (alreadyStarting) {
      console.log('Bu maç zaten başlatılıyor, atlanıyor');
      return;
    }
    
    localStorage.setItem(`starting_${userPendingMatch.id}`, 'true');
    
    // Hangi turda olduğumuzu belirle
    const roundName = userPendingMatch.round === 1 ? 'Çeyrek Final' : 
                     userPendingMatch.round === 2 ? 'Yarı Final' : 'Final';
    
    // Bildirim göster
    toast({
      title: `${roundName} Maçınız!`,
      description: '10 saniye içinde otomatik olarak oyuna başlayacaksınız...',
      duration: 10000,
    });
    
    const startMatch = async () => {
      await autoStartMatch(userPendingMatch.id);
      localStorage.removeItem(`starting_${userPendingMatch.id}`);
    };
    
    // 10 saniye bekle ve başlat
    setTimeout(startMatch, 10000);
  }
}, [tournament, matches, user]);
  
  // Dependencies kontrol et
// Otomatik maç başlatma fonksiyonu
const autoStartMatch = async (matchId: string) => {
  try {
    console.log('🎮 Maç otomatik başlatılıyor:', matchId);

    const { data, error } = await supabase
      .from('tournament_matches')
      .update({ 
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', matchId);

    if (error) {
      console.error('❌ Database güncelleme hatası:', error);
      return;
    }

    console.log('✅ Match başarıyla güncellendi:', data);

    toast({
      title: '🎮 Turnuva Maçı Başladı!',
      description: 'Otomatik olarak oyuna yönlendiriliyorsunuz...',
      duration: 2000,
    });

    // Veri güncelle
    await loadTournamentData();
    
    // ÖNEMLİ: Otomatik olarak oyunu başlat
    setTimeout(() => {
      setIsPlaying(true);
    }, 1000);

  } catch (error) {
    console.error('❌ autoStartMatch genel hatası:', error);
  }
};

  // 🏁 Maçı bitirme fonksiyonu
const completeMatch = async (winnerId: string, player1Score: number, player2Score: number) => {
  if (!currentMatch) return;

  try {
    console.log('🏁 Maç bitiriliyor:', { winnerId, player1Score, player2Score });

    // Maçı tamamla
    const { error: updateError } = await supabase
      .from('tournament_matches')
      .update({
        status: 'completed',
        winner_id: winnerId,
        player1_score: player1Score,
        player2_score: player2Score,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentMatch.id);

    if (updateError) throw updateError;

    console.log('✅ Maç başarıyla tamamlandı');

    // ✅✅✅ OTOMATİK: Bot maçlarını hemen tamamla
    setTimeout(() => {
      autoCompleteBotMatches();
    }, 1000);

  } catch (error) {
    console.error('Error completing match:', error);
    toast({
      title: 'Hata',
      description: 'Maç tamamlanamadı',
      variant: 'destructive',
    });
  }
};
  
  const updatePlayerStatistics = async (
    userId: string,
    gameScore: number,
    words: Array<{word: string, score: number}>,
    isWinner: boolean
  ) => {
    try {
      console.log('📊 Turnuva istatistikleri güncelleniyor:', { userId, gameScore, words: words.length, isWinner });
    
      await supabase.rpc('update_game_statistics', {
        p_user_id: userId,
        p_game_score: gameScore,
        p_words: words,
        p_is_winner: isWinner
      });
    
      console.log('✅ Turnuva istatistikleri güncellendi');
    } catch (error) {
      console.error('❌ Turnuva istatistik güncelleme hatası:', error);
    }
  };

  const checkBadges = async (userId: string, wordsCount?: number) => {
    try {
      console.log('🏆 Turnuva rozet kontrolü yapılıyor:', userId);
    
      // General badge check
      const { data: generalBadges, error: generalError } = await supabase.rpc('check_and_award_badges', {
        p_user_id: userId
      });
    
      if (generalError) {
        console.error('❌ Genel rozet kontrolü hatası:', generalError);
      } else if (generalBadges && generalBadges.length > 0) {
        generalBadges.forEach((badge: any) => {
          toast({
            title: '🏆 Yeni Rozet!',
            description: `"${badge.new_badge_name}" rozetini kazandınız! ${badge.new_badge_icon}`,
            duration: 4000,
          });
        });
      }
    
      // Words per game badge check
      if (wordsCount && wordsCount > 0) {
        const { data: wordsBadges, error: wordsError } = await supabase.rpc('check_words_per_game_badge', {
          p_user_id: userId,
          p_words_count: wordsCount
        });
      
        if (wordsError) {
          console.error('❌ Kelime rozeti kontrolü hatası:', wordsError);
        } else if (wordsBadges && wordsBadges.length > 0) {
          wordsBadges.forEach((badge: any) => {
            toast({
              title: '🏆 Yeni Rozet!',
              description: `"${badge.new_badge_name}" rozetini kazandınız! ${badge.new_badge_icon}`,
              duration: 4000,
            });
          });
        }
      }
    
      console.log('✅ Turnuva rozet kontrolü tamamlandı');
    } catch (error) {
      console.error('❌ Turnuva rozet kontrolü hatası:', error);
    }
  };

  // TournamentMatchPage.tsx'e bu fonksiyonu ekle
const fixBrokenMatches = async () => {
  try {
    console.log('🔧 Bozuk maçlar düzeltiliyor...');
    
    // player2_id'si null olan maçları bul
    const { data: brokenMatches } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .is('player2_id', null);

    if (brokenMatches && brokenMatches.length > 0) {
      console.log(`🛠️ ${brokenMatches.length} bozuk maç bulundu`);
      
      for (const match of brokenMatches) {
        // Bozuk maçları düzelt
        const { error } = await supabase
          .from('tournament_matches')
          .update({
            player2_id: `bot_fixed_${match.id}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', match.id);
        
        if (error) {
          console.error('❌ Maç düzeltme hatası:', error);
        } else {
          console.log('✅ Maç düzeltildi:', match.id);
        }
      }
      
      // Verileri yeniden yükle
      await loadTournamentData();
    }
  } catch (error) {
    console.error('❌ Bozuk maç düzeltme hatası:', error);
  }
};

// useEffect içinde çağır
useEffect(() => {
  if (tournamentId) {
    fixBrokenMatches();
  }
}, [tournamentId]);

useEffect(() => {
  if (!tournamentId || !tournament) return;

  // Her 10 saniyede bir bot maçlarını kontrol et
  const botCheckInterval = setInterval(() => {
    if (tournament.status === 'active') {
      console.log('⏰ Bot maçları kontrol ediliyor...');
      autoCompleteBotMatches();
    }
  }, 10000); // 10 saniye

  return () => clearInterval(botCheckInterval);
}, [tournamentId, tournament?.status]);


  // Kullanıcının sıradaki maçını bul
  const getUserNextMatch = () => {
    if (!user) return null;
    return matches.find(match => 
      (match.player1_id === user.id || match.player2_id === user.id) && 
      match.status === 'pending'
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
        <div className="max-w-4xl mx-auto text-center py-8">
          <h2 className="text-2xl font-bold mb-4">Turnuva Bulunamadı</h2>
          <Button onClick={() => navigate('/tournaments')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Turnuvalara Dön
          </Button>
        </div>
      </div>
    );
  }

  // 🎮 Oyun modunda ise GamePage'i göster
  if (isPlaying && currentMatch) {
  return (
    <GamePage 
      gameMode="tournament"
      onGameComplete={completeMatch}
      tournamentMatch={currentMatch} // Bu doğru match'i içermeli
      gameType={(tournament.game_type as string) === 'score' ? 'score' : 'timed'}
      participants={participants}
    />
  );
}

  const userNextMatch = getUserNextMatch();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => navigate('/tournaments')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Turnuvalara Dön
          </Button>
          <div className="text-center">
            <h1 className="text-2xl font-bold">{tournament.name}</h1>
            <div className="flex items-center justify-center space-x-4 mt-2">
              <Badge variant={tournament.status === 'active' ? 'default' : 'secondary'}>
                {tournament.status === 'active' ? '🎮 Aktif' : 
                 tournament.status === 'finished' ? '🏆 Bitti' : '⏳ Bekliyor'}
              </Badge>
              <Badge variant="outline">
                {(tournament.game_type as string) === 'timed' ? '⏱️ Süreli' : '🎯 Puanlı'}
              </Badge>
              <Badge variant="outline">
                🏆 {tournament.current_round === 1 ? 'Çeyrek Final' : 
                    tournament.current_round === 2 ? 'Yarı Final' : 
                    tournament.current_round === 3 ? 'Final' : `${tournament.current_round}. Tur`}
              </Badge>
            </div>
          </div>
          <div className="w-16" />
        </div>

        {/* Kullanıcının Durumu */}
{user && (
  <Card className="border-primary">
    <CardHeader>
      <CardTitle className="flex items-center">
        <Users className="w-5 h-5 mr-2" />
        Sizin Durumunuz
      </CardTitle>
    </CardHeader>
    <CardContent>
      {currentMatch ? (
  <div className="space-y-4">
    <div className="text-center">
      <Badge variant="default" className="text-lg px-4 py-2 animate-pulse">
        🎮 Oyun Başlıyor...
      </Badge>
      <p className="text-sm text-muted-foreground mt-2">
        Otomatik olarak oyuna yönlendiriliyorsunuz
      </p>
    </div>
  </div>
) : userNextMatch ? (
        <div className="space-y-4">
          <div className="text-center">
            <Badge variant="secondary" className="text-lg px-4 py-2 animate-pulse">
              ⏰ Maç 10 Saniye İçinde Başlayacak
            </Badge>
            <p className="text-sm text-muted-foreground mt-2">
              {userNextMatch.round === 2 ? 'Yarı Final' : 
               userNextMatch.round === 3 ? 'Final' : 'Çeyrek Final'} - 
              Maç {userNextMatch.match_number}
            </p>
          </div>
          <div className="text-center">
            <div className="animate-pulse text-primary font-medium">
              🎮 Otomatik başlatılıyor...
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Rakibinizle birlikte otomatik oyuna alınacaksınız
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <Badge variant="outline" className="text-lg px-4 py-2">
            👀 Turnuvayı İzliyorsunuz
          </Badge>
          <p className="text-sm text-muted-foreground mt-2">
            {tournament.status === 'finished' ? 
              'Turnuva sona erdi' : 
              'Elendikten sonra turnuvayı takip edebilirsiniz'}
          </p>
        </div>
      )}
    </CardContent>
  </Card>
)}

        {user && tournament?.status === 'active' && (
        <Card className="bg-orange-50 border-orange-200 mt-4">
          <CardContent className="p-4">
            <h3 className="font-semibold text-orange-800 mb-2">⚠️ Manuel İlerleme</h3>
            <p className="text-sm text-orange-600 mb-3">
              Otomatik ilerleme çalışmazsa bu butonu kullanın
            </p>
            <div className="space-y-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={checkNextRoundOrFinish}
                className="w-full"
              >
                🔄 Sonraki Turu Zorla
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={checkUserNextMatch}
                className="w-full"
              >
                🔍 Maçımı Kontrol Et
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
        {/* Turnuva Ağacı */}
        <TournamentBracket 
          matches={matches}
          participants={participants}
          currentUserId={user?.id}
        />

        {/* Rest of the existing JSX... */}
        {/* (Diğer kartlar ve istatistikler aynı kalacak) */}

        {/* Progress Card */}
        {showProgressCard && progressCardData && (
        <TournamentProgressCard 
          currentRound={progressCardData.currentRound}
          isWinner={progressCardData.isWinner}
          tournamentName={progressCardData.tournamentName}
          onContinue={handleProgressContinue}
        />
      )}
      </div>
    </div>
  );
};

export default TournamentMatchPage;
