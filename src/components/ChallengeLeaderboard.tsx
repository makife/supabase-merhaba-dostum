import { Trophy, Medal } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";

interface LeaderboardEntry {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  score: number;
  words_found: number;
}

interface Props {
  leaderboard: LeaderboardEntry[];
  title?: string;
  scrollable?: boolean;
  showLevel?: boolean;
  frameTheme?: "all-time" | "monthly" | "weekly";
  showCompletionOnly?: boolean;
}

const rankColors = ["text-amber-400", "text-slate-300", "text-amber-600"];
const rankBgs = ["bg-amber-500/20", "bg-slate-400/10", "bg-amber-700/10"];

const frameColors = {
  "all-time": "ring-2 ring-red-500 ring-offset-1 ring-offset-slate-900",
  monthly: "ring-2 ring-green-500 ring-offset-1 ring-offset-slate-900",
  weekly: "ring-2 ring-blue-500 ring-offset-1 ring-offset-slate-900",
};

export const ChallengeLeaderboard = ({
  leaderboard,
  title = "Günlük Sıralama",
  scrollable = false,
  showLevel = false,
  frameTheme = "all-time",
  showCompletionOnly = false,
}: Props) => {
  const { user } = useAuth();

  if (leaderboard.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
        <p className="text-xs text-slate-500">Henüz kimse oynamamış. İlk sen ol! 🚀</p>
      </div>
    );
  }

  return (
    <div
      className={`bg-white/5 border border-white/10 rounded-2xl p-4 w-full ${scrollable ? "flex-1 min-h-0 flex flex-col" : ""}`}
    >
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <Trophy className="w-4 h-4 text-amber-400" />
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</h3>
      </div>
      <div className={`space-y-1.5 ${scrollable ? "flex-1 min-h-0 overflow-y-auto" : "max-h-64 overflow-y-auto"}`}>
        {leaderboard.map((entry, i) => {
          const isMe = entry.user_id === user?.id;
          return (
            <div
              key={entry.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
                isMe ? "bg-white/10 border border-white/10" : "hover:bg-white/5"
              }`}
            >
              <span className={`w-6 text-center font-black text-sm ${i < 3 ? rankColors[i] : "text-slate-600"}`}>
                {i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}
              </span>
              <Avatar className={`w-7 h-7 ${frameColors[frameTheme]}`}>
                <AvatarImage src={entry.avatar_url || undefined} />
                <AvatarFallback className="bg-white/10 text-[10px] text-white">
                  {(entry.username || "?")[0]}
                </AvatarFallback>
              </Avatar>
              <span className={`flex-1 text-xs font-bold truncate ${isMe ? "text-white" : "text-slate-300"}`}>
                {entry.username}
                {isMe && <span className="text-[9px] text-slate-500 ml-1">(Sen)</span>}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                {showCompletionOnly ? (
                  entry.score > 0 ? (
                    <span className="text-base">✅</span>
                  ) : (
                    <span className="text-base">❌</span>
                  )
                ) : showLevel ? (
                  <span className="text-xs font-bold text-cyan-400">
                    Lvl {Math.floor(typeof entry.score === "number" ? entry.score : Number(entry.score))}
                  </span>
                ) : (
                  <span className="text-xs font-bold text-amber-400">
                    {typeof entry.score === "number" ? entry.score.toFixed(2) : entry.score}
                  </span>
                )}
                {!showCompletionOnly && entry.words_found > 0 && (
                  <span className="text-[9px] text-slate-500">({entry.words_found})</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
