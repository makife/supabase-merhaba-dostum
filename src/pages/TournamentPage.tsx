import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Home, Trophy, Users, Plus } from "lucide-react";
import { TournamentCard } from "@/components/TournamentCard";
import { useTournamentContext } from "@/contexts/TournamentContext";
import { useUser } from "@/contexts/UserContext";
import { toast } from "sonner";

const TournamentPage = () => {
  const navigate = useNavigate();
  const { tournaments, loading, createTournament, joinTournament, fetchTournaments } = useTournamentContext();
  const { profile, isPremium } = useUser();

  useEffect(() => {
    fetchTournaments();
  }, []);

  const handleCreateTournament = async () => {
    // Kredi kontrolü
    if (!isPremium && (profile?.game_credits || 0) + (profile?.bonus_credits || 0) <= 0) {
      toast.error("Yetersiz oyun hakkı!", {
        description: "Turnuva oluşturmak için hak satın alın veya dolmasını bekleyin.",
        duration: 4000,
      });
      return;
    }

    const tournamentId = await createTournament();
    if (tournamentId) {
      navigate(`/tournament-waiting/${tournamentId}`);
    }
  };

  const handleJoinTournament = async (tournamentId: string) => {
    // Kredi kontrolü
    if (!isPremium && (profile?.game_credits || 0) + (profile?.bonus_credits || 0) <= 0) {
      toast.error("Yetersiz oyun hakkı!", {
        description: "Turnuvaya katılmak için hak satın alın veya dolmasını bekleyin.",
        duration: 4000,
      });
      return;
    }

    const success = await joinTournament(tournamentId);
    if (success) {
      navigate(`/tournament-waiting/${tournamentId}`);
    }
  };

  return (
    // Ana arka plandan resmi kaldırdık, sadece gradyan kaldı
    <div className="relative min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 flex flex-col">
      {/* Sabit üst bölüm */}
      <div className="sticky top-0 z-10 bg-gradient-to-br from-purple-900 to-blue-900/95 p-4 backdrop-blur-sm shadow-xl">
        {/* Çıkış butonu */}
        <div className="absolute top-4 left-4 z-20">
          <Button
            onClick={() => navigate("/")}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg"
          >
            <Home className="w-4 h-4 mr-2" />
            Ana Sayfa
          </Button>
        </div>

        <div className="max-w-4xl mx-auto pt-12">
          {/* --- GÜNCELLENEN BAŞLIK ALANI (BANNER) --- */}
          <div className="relative text-center mb-8 p-8 rounded-2xl overflow-hidden border border-white/10 shadow-2xl group">
            {/* 1. Katman: Arka Plan Resmi */}
            <div className="absolute inset-0 bg-[url('/turnuvaBracket.png')] bg-cover bg-center opacity-60 mix-blend-overlay transition-transform duration-700 group-hover:scale-105"></div>

            {/* 2. Katman: Karartma (Yazıların okunması için) */}
            <div className="absolute inset-0 bg-gradient-to-b from-purple-900/40 to-blue-900/80"></div>

            {/* 3. Katman: İçerik (z-10 ile en öne aldık) */}
            <div className="relative z-10">
              <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
              <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-md tracking-wide">Turnuvalar</h1>
              <p className="text-gray-100 text-lg font-medium drop-shadow-sm">
                8 oyunculu heyecan dolu turnuvalara katıl!
              </p>
            </div>
          </div>
          {/* --- BAŞLIK ALANI SONU --- */}

          {/* Turnuva Oluştur */}
          <Card className="mb-8 bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="p-6 text-center">
              <Button
                onClick={handleCreateTournament}
                disabled={loading}
                className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold py-4 px-8 text-lg shadow-lg hover:shadow-orange-500/20 transition-all"
                size="lg"
              >
                <Plus className="w-6 h-6 mr-2" />
                {loading ? "Oluşturuluyor..." : "Yeni Turnuva Oluştur"}
              </Button>
              <p className="text-gray-300 text-sm mt-2">Kendi turnuvanı oluştur ve arkadaşlarını davet et!</p>

              {/* Yenile butonu */}
              <div className="mt-4">
                <Button
                  onClick={fetchTournaments}
                  variant="outline"
                  size="sm"
                  className="bg-transparent border-white/30 text-white hover:bg-white/10"
                >
                  Listeyi Yenile
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Scroll edilebilir içerik */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="max-w-4xl mx-auto space-y-4">
          <h2 className="text-2xl font-bold text-white pl-2 border-l-4 border-yellow-500">Aktif Turnuvalar</h2>

          {loading ? (
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardContent className="p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                <p className="text-gray-300">Turnuvalar yükleniyor...</p>
              </CardContent>
            </Card>
          ) : tournaments.length === 0 ? (
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardContent className="p-8 text-center">
                <Users className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-xl font-bold text-white mb-2">Aktif Turnuva Yok</h3>
                <p className="text-gray-300 mb-4">Şu anda beklemedeki turnuva bulunmuyor.</p>
                <p className="text-gray-400 text-sm">İlk turnuvayı sen oluştur ve eğlence başlasın!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {tournaments.map((tournament) => (
                <TournamentCard
                  key={tournament.id}
                  tournament={tournament}
                  onJoin={handleJoinTournament}
                  disabled={loading}
                />
              ))}
            </div>
          )}

          {/* Bilgi */}
          <Card className="mt-8 bg-white/5 backdrop-blur-md border-white/10">
            <CardContent className="p-4">
              <h3 className="text-lg font-bold text-white mb-2">Turnuva Kuralları</h3>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• Her turnuvada maksimum 8 oyuncu katılabilir</li>
                <li>• Yetersiz oyuncu durumunda botlar otomatik eklenir</li>
                <li>• Turnuva 3 aşamada tamamlanır: Çeyrek Final → Yarı Final → Final</li>
                <li>• Her maç zamana karşı oynanır (2 dakika)</li>
                <li>• Turnuva başladıktan sonra katılım mümkün değildir</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TournamentPage;
