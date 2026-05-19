import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Award, Lock } from "lucide-react";
import { useSounds } from "@/hooks/useSounds";

interface BadgeData {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earned_at?: string;
  condition_type?: string;
  condition_value?: number;
}

interface UserStats {
  total_games?: number;
  total_score?: number;
  win_streak?: number;
  total_words_created?: number;
  longest_word_length?: number;
  tournament_wins?: number;
  degistir_joker_used?: number;
  fisilida_joker_used?: number;
  senyaz_joker_used?: number;
  vs_bot_games?: number;
  private_room_games?: number;
  random_match_games?: number;
  wins?: number;
  fastest_word_time?: number;
}

interface BadgesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  badges: BadgeData[];
  userStats?: UserStats;
}

const getCurrentValue = (conditionType: string, stats: UserStats): number => {
  switch (conditionType) {
    case "total_games":
      return stats.total_games || 0;
    case "total_score":
      return stats.total_score || 0;
    case "win_streak":
      return stats.win_streak || 0;
    case "total_words":
      return stats.total_words_created || 0;
    case "longest_word":
      return stats.longest_word_length || 0;
    case "tournament_wins":
    case "tournaments_won":
      return stats.tournament_wins || 0;
    case "degistir_joker_used":
      return stats.degistir_joker_used || 0;
    case "fisilida_joker_used":
      return stats.fisilida_joker_used || 0;
    case "senyaz_joker_used":
      return stats.senyaz_joker_used || 0;
    case "vs_bot_games":
      return stats.vs_bot_games || 0;
    case "private_room_games":
      return stats.private_room_games || 0;
    case "random_match_games":
      return stats.random_match_games || 0;
    case "wins":
      return stats.wins || 0;
    case "fast_typing":
      return stats.fastest_word_time || 0;
    default:
      return 0;
  }
};

const formatProgress = (current: number, target: number): string => {
  if (current >= target) return "Tamamlandı!";
  return `${current.toLocaleString("tr-TR")} / ${target.toLocaleString("tr-TR")}`;
};

export const BadgesDialog = ({ open, onOpenChange, badges, userStats }: BadgesDialogProps) => {
  const earnedBadges = badges.filter((b) => b.earned);
  const lockedBadges = badges.filter((b) => !b.earned);
  const { playSound } = useSounds();

  const handleOpenChange = (next: boolean) => {
    if (!next && open) {
      playSound("buttonClick");
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] bg-gradient-to-br from-[#0f1729] via-[#1a1a2e] to-[#16213e] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Award className="w-6 h-6 text-indigo-400" />
            Rozetler
          </DialogTitle>
          <DialogDescription className="text-white/50">
            Kazanılan ve kilitli rozetlerinizi görüntüleyin
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-6">

            {/* Kazanılan Rozetler */}
            {earnedBadges.length > 0 && (
              <div>
                <h3 className="text-base font-semibold mb-3 text-indigo-300">
                  Kazanılan Rozetler ({earnedBadges.length})
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  {earnedBadges.map((badge) => (
                    <div
                      key={badge.id}
                      className="p-4 rounded-xl border-2 border-indigo-400/40 bg-gradient-to-br from-indigo-500/20 to-purple-500/10 hover:border-indigo-400/60 hover:from-indigo-500/25 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-4xl shrink-0">{badge.icon}</div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-white mb-0.5">{badge.name}</h4>
                          <p className="text-sm text-white/60">{badge.description}</p>
                          {badge.earned_at && (
                            <Badge
                              variant="secondary"
                              className="mt-2 text-xs bg-indigo-500/20 text-indigo-300 border-indigo-400/30"
                            >
                              {new Date(badge.earned_at).toLocaleDateString("tr-TR")}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Kilitli Rozetler */}
            {lockedBadges.length > 0 && (
              <div>
                <h3 className="text-base font-semibold mb-3 text-white/50">
                  Kilitli Rozetler ({lockedBadges.length})
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  {lockedBadges.map((badge) => {
                    const currentValue =
                      userStats && badge.condition_type
                        ? getCurrentValue(badge.condition_type, userStats)
                        : 0;
                    const targetValue = badge.condition_value || 1;
                    const progressPercent = Math.min((currentValue / targetValue) * 100, 100);
                    const hasProgress = userStats && badge.condition_type && badge.condition_value;

                    return (
                      <div
                        key={badge.id}
                        className="p-4 rounded-xl border border-white/10 bg-white/5"
                      >
                        <div className="flex items-start gap-4">
                          <div className="relative shrink-0">
                            <div className="text-4xl grayscale opacity-40">{badge.icon}</div>
                            <Lock className="w-4 h-4 absolute -top-1 -right-1 text-white/40" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-white/70 mb-0.5">{badge.name}</h4>
                            <p className="text-sm text-white/45">{badge.description}</p>

                            {hasProgress && (
                              <div className="mt-3 space-y-1.5">
                                <div className="flex justify-between text-xs text-white/50">
                                  <span>İlerleme</span>
                                  <span>{formatProgress(currentValue, targetValue)}</span>
                                </div>
                                <Progress value={progressPercent} className="h-1.5" />
                                <div className="text-xs text-right text-white/35">
                                  %{Math.round(progressPercent)}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
