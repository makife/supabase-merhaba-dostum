import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useTournamentAdvancement = (tournamentId: string | null) => {
  const { toast } = useToast();

  // Tüm maçlar bittiğinde sonraki tura geç
  const checkRoundCompletion = async (tournamentId: string, round: number) => {
    try {
      console.log(`Round ${round} tamamlanma kontrolü başlıyor...`);
      
      // Bu rounddaki tüm maçları kontrol et
      const { data: roundMatches } = await supabase
        .from('tournament_matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('round', round);

      if (!roundMatches || roundMatches.length === 0) {
        console.log(`Round ${round} için maç bulunamadı`);
        return;
      }

      // Tüm maçlar tamamlandı mı?
      const completedMatches = roundMatches.filter(m => m.status === 'completed');
      const allCompleted = completedMatches.length === roundMatches.length;

      console.log(`Round ${round}: ${completedMatches.length}/${roundMatches.length} maç tamamlandı`);

      if (allCompleted) {
        await advanceToNextRound(tournamentId, round, completedMatches);
      }
    } catch (error) {
      console.error('Round completion check error:', error);
    }
  };

  // Sonraki tura geçiş
const advanceToNextRound = async (tournamentId: string, currentRound: number, completedMatches: any[]) => {
  try {
    console.log(`=== ADVANCE TO NEXT ROUND START - Round ${currentRound} ===`);
    
    // Kazananları topla - null olanları filtrele
    const winners = completedMatches
      .map(match => match.winner_id)
      .filter(id => id !== null && id !== undefined);
    
    console.log(`Round ${currentRound} kazananları:`, winners);
    console.log(`Toplam kazanan sayısı: ${winners.length}`);

    if (currentRound === 1) {
      // Çeyrek final bitti -> Yarı finale geç
      console.log(`Yarı final kontrolü: ${winners.length} kazanan var`);
      
      // RACE CONDITION KORUMASI: Zaten yarı final oluşturulmuş mu?
      const { data: existingSemiFinals } = await supabase
        .from('tournament_matches')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('round', 2);
      
      if (existingSemiFinals && existingSemiFinals.length > 0) {
        console.log('Yarı final maçları zaten oluşturulmuş, atlanıyor...');
        return;
      }
      
      if (winners.length >= 2) {
        let finalWinners = [...winners];
        
        // Eğer 4'ten az kazanan varsa, mevcut kazananları kullanarak 4'e tamamla
        while (finalWinners.length < 4) {
          const additionalWinner = finalWinners[finalWinners.length % winners.length];
          finalWinners.push(additionalWinner);
          console.log(`Eksik kazanan tamamlandı: ${additionalWinner?.substring(0, 8)}`);
        }
        
        console.log(`Yarı final için kullanılacak kazananlar: ${finalWinners.length}`);
        
        // Atomic transaction ile yarı final oluştur
        await createSemiFinalMatchesAtomic(tournamentId, finalWinners.slice(0, 4));
        await updateTournamentRound(tournamentId, 2);
        
        // Bot maçlarını otomatik tamamla
        setTimeout(() => {
          completeBotMatches(tournamentId, 2);
        }, 3000);

        toast({
          title: 'Yarı Final Başladı!',
          description: 'Yarı final maçları oluşturuldu',
        });
        
        console.log(`=== YARI FİNAL OLUŞTURULDU ===`);
      } else {
        console.log(`Yetersiz kazanan: ${winners.length}, minimum 2 gerekli`);
      }
      
    } else if (currentRound === 2) {
      // Yarı final bitti -> Finale geç
      console.log(`Final kontrolü: ${winners.length} kazanan var`);
      
      // RACE CONDITION KORUMASI: Zaten final oluşturulmuş mu?
      const { data: existingFinals } = await supabase
        .from('tournament_matches')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('round', 3);
      
      if (existingFinals && existingFinals.length > 0) {
        console.log('Final maçı zaten oluşturulmuş, atlanıyor...');
        return;
      }
      
      if (winners.length >= 2) {
        await createFinalMatchAtomic(tournamentId, winners.slice(0, 2));
        await updateTournamentRound(tournamentId, 3);
        
        toast({
          title: 'Final Maçı Başladı!',
          description: 'Final maçı oluşturuldu',
        });
        
        console.log(`=== FİNAL OLUŞTURULDU ===`);
      } else {
        console.log(`Final için yetersiz kazanan: ${winners.length}`);
      }
      
    } else if (currentRound === 3) {
      // Final bitti -> Turnuvayı bitir
      console.log(`Turnuva bitiş kontrolü: ${winners.length} kazanan var`);
      
      if (winners.length >= 1) {
        await completeTournament(tournamentId, winners[0]);
        
        toast({
          title: 'Turnuva Tamamlandı!',
          description: 'Şampiyon belirlendi!',
        });
        
        console.log(`=== TURNUVA TAMAMLANDI ===`);
      } else {
        console.log('Final kazananı bulunamadı!');
      }
    }
    
    console.log(`=== ADVANCE TO NEXT ROUND END - Round ${currentRound} ===`);
    
  } catch (error) {
    console.error('Advance to next round error:', error);
    toast({
      title: 'Tur İlerletme Hatası',
      description: 'Sonraki tura geçiş başarısız oldu',
      variant: 'destructive'
    });
  }
};

// Atomic yarı final oluşturma
const createSemiFinalMatchesAtomic = async (tournamentId: string, winners: string[]) => {
  console.log('Atomic yarı final oluşturuluyor...');
  
  const matches = [
    {
      tournament_id: tournamentId,
      round: 2,
      match_number: 1,
      player1_id: winners[0],
      player2_id: winners[1],
      status: 'pending'
    },
    {
      tournament_id: tournamentId,
      round: 2,
      match_number: 2,
      player1_id: winners[2],
      player2_id: winners[3],
      status: 'pending'
    }
  ];

  const { error } = await supabase
    .from('tournament_matches')
    .insert(matches);

  if (error) {
    console.error('Yarı final oluşturma hatası:', error);
    throw error;
  }
  
  console.log('Yarı final maçları oluşturuldu (atomic)');
};

// Atomic final oluşturma
const createFinalMatchAtomic = async (tournamentId: string, winners: string[]) => {
  console.log('Atomic final oluşturuluyor...');
  
  const match = {
    tournament_id: tournamentId,
    round: 3,
    match_number: 1,
    player1_id: winners[0],
    player2_id: winners[1],
    status: 'pending'
  };

  const { error } = await supabase
    .from('tournament_matches')
    .insert([match]);

  if (error) {
    console.error('Final oluşturma hatası:', error);
    throw error;
  }
  
  console.log('Final maçı oluşturuldu (atomic)');
};
  
  // Yarı final maçları oluştur
  const createSemiFinalMatches = async (tournamentId: string, winners: string[]) => {
    const matches = [
      {
        tournament_id: tournamentId,
        round: 2,
        match_number: 1,
        player1_id: winners[0],
        player2_id: winners[1],
        status: 'pending'
      },
      {
        tournament_id: tournamentId,
        round: 2,
        match_number: 2,
        player1_id: winners[2],
        player2_id: winners[3],
        status: 'pending'
      }
    ];

    const { error } = await supabase
      .from('tournament_matches')
      .insert(matches);

    if (error) throw error;
    console.log('Yarı final maçları oluşturuldu');
  };

  // Final maçı oluştur
  const createFinalMatch = async (tournamentId: string, winners: string[]) => {
    const match = {
      tournament_id: tournamentId,
      round: 3,
      match_number: 1,
      player1_id: winners[0],
      player2_id: winners[1],
      status: 'pending'
    };

    const { error } = await supabase
      .from('tournament_matches')
      .insert([match]);

    if (error) throw error;
    console.log('Final maçı oluşturuldu');
  };

  // Turnuva roundunu güncelle
  const updateTournamentRound = async (tournamentId: string, newRound: number) => {
    const { error } = await supabase
      .from('tournaments')
      .update({ 
        current_round: newRound,
        updated_at: new Date().toISOString()
      })
      .eq('id', tournamentId);

    if (error) throw error;
    console.log(`Turnuva round ${newRound}'e güncellendi`);
  };

  // Turnuvayı tamamla
  const completeTournament = async (tournamentId: string, winnerId: string) => {
    const { error } = await supabase
      .from('tournaments')
      .update({
        status: 'completed',
        winner_id: winnerId,
        ended_at: new Date().toISOString()
      })
      .eq('id', tournamentId);

    if (error) throw error;
    console.log('Turnuva tamamlandı, kazanan:', winnerId);
  };

  // Bot maçlarını otomatik tamamla
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
        // Kullanıcı bu maçta var mı kontrol et
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        
        const isUserMatch = match.player1_id === userId || match.player2_id === userId;
        
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

  // Real-time dinleyici
  useEffect(() => {
    if (!tournamentId) return;

    console.log('🔄 Tournament advancement listener kuruldu:', tournamentId);

    const channel = supabase
      .channel(`tournament-advancement-${tournamentId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tournament_matches',
        filter: `tournament_id=eq.${tournamentId}`
      }, async (payload) => {
        console.log('🔥 ADVANCEMENT: Match update detected:', payload.new);
        
        const updatedMatch = payload.new as any;
        if (updatedMatch.status === 'completed') {
          console.log(`🚀 ADVANCEMENT: Maç tamamlandı, round kontrolü başlatılıyor - Round ${updatedMatch.round}`);
          // Kısa bir gecikme ile round kontrolü yap (race condition için)
          setTimeout(async () => {
            await checkRoundCompletion(tournamentId, updatedMatch.round);
          }, 1000);
        }
      })
      .subscribe();

    return () => {
      console.log('🔌 Tournament advancement listener temizlendi');
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  return {
    checkRoundCompletion,
    completeBotMatches
  };
};
