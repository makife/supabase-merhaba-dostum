import { useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Bot, User, ArrowLeft } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { TournamentCountdown } from "@/components/TournamentCountdown";
import { useTournament } from "@/hooks/useTournament";
import { usePageResync } from "@/hooks/useGlobalResync";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const TournamentWaitingPage = () => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const {
    currentTournament,
    participants,
    loading,
    timeLeft,
    isCreator,
    hasJoined,
    realPlayerCount,
    fetchTournamentDetails,
    leaveTournament,
    joinTournament,
  } = useTournament(tournamentId);

  // 🔄 Global Resync Hook - bağlantı geri geldiğinde turnuva detaylarını otomatik tazele
  const handleResync = useCallback(() => {
    if (tournamentId) {
      console.log("🔄 [TournamentWaitingPage] Resync triggered");
      fetchTournamentDetails(tournamentId);
    }
  }, [tournamentId, fetchTournamentDetails]);

  usePageResync(handleResync, "TournamentWaitingPage", true);

  useEffect(() => {
    if (tournamentId) {
      fetchTournamentDetails(tournamentId);
    }
  }, [tournamentId]);

  // Turnuva başladıysa bracket sayfasına yönlendir
  useEffect(() => {
    if (currentTournament?.status === "in_progress" && tournamentId) {
      navigate(`/tournament/bracket/${tournamentId}`);
    }
  }, [currentTournament?.status, tournamentId, navigate]);

  const handleLeave = async () => {
    await leaveTournament();
  };

  if (loading || !currentTournament) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 p-4 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Turnuva yükleniyor...</p>
        </div>
      </div>
    );
  }

  const realPlayers = participants.filter((p) => !p.is_bot);
  const bots = participants.filter((p) => p.is_bot);
  const emptySlots = 8 - participants.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">{currentTournament.name}</h1>

          <Button onClick={handleLeave} variant="destructive" size="lg">
            Ayrıl
          </Button>
        </div>

        {/* Countdown */}
        <TournamentCountdown
          timeLeft={timeLeft}
          realPlayerCount={realPlayerCount}
          totalParticipants={participants.length}
          isCreator={isCreator}
        />

        {/* Participants List */}
        <Card className="bg-white/10 backdrop-blur-md border-white/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Katılımcılar
              </h3>
              <div className="text-sm">
                <span className="text-green-400 font-bold">{realPlayerCount} Oyuncu</span>
                {bots.length > 0 && (
                  <>
                    <span className="text-gray-400 mx-1">+</span>
                    <span className="text-gray-400">{bots.length} Bot</span>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {/* Real Players */}
              {realPlayers.map((participant, index) => (
                <div
                  key={participant.id}
                  className="flex items-center p-3 bg-green-500/10 rounded-lg border border-green-500/20"
                >
                  <Avatar className="w-10 h-10" showFrame={true}>
                    <AvatarImage src={participant.profiles?.avatar_url || undefined} />
                    <AvatarFallback className="bg-green-500 text-white">
                      <User className="w-5 h-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="ml-3 flex-1">
                    <div className="flex items-center">
                      <span className="text-white font-medium">{participant.profiles?.username || "Oyuncu"}</span>
                      {participant.user_id === currentTournament.creator_id && (
                        <span className="ml-2 text-xs bg-yellow-500 text-black px-2 py-1 rounded">KURUCU</span>
                      )}
                    </div>
                  </div>
                  <div className="text-green-400 text-xs font-medium">OYUNCU</div>
                </div>
              ))}

              {/* Bots */}
              {bots.map((participant, index) => (
                <div
                  key={participant.id}
                  className="flex items-center p-3 bg-gray-500/10 rounded-lg border border-gray-500/20"
                >
                  <div className="flex items-center flex-1">
                    <div className="flex items-center">
                      <Bot className="w-4 h-4 mr-2 text-gray-400" />
                      <span className="text-gray-300">{participant.profiles?.username || "Bot"}</span>
                    </div>
                  </div>
                  <Bot className="w-4 h-4 text-gray-400" />
                </div>
              ))}

              {/* Empty Slots */}
              {Array.from({ length: emptySlots }, (_, i) => (
                <div key={`empty-${i}`} className="flex items-center p-3 bg-white/5 rounded-lg opacity-50">
                  <span className="text-gray-400">Boş Slot</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tournament Cancelled Dialog */}
        <Dialog open={currentTournament?.status === "cancelled"} onOpenChange={() => navigate("/tournament")}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Turnuva İptal Edildi</DialogTitle>
              <DialogDescription>Turnuva yeterli oyuncu olmadığı için iptal edildi.</DialogDescription>
            </DialogHeader>
            <div className="flex justify-end">
              <Button onClick={() => navigate("/tournament")}>Tamam</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default TournamentWaitingPage;
