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
}

const rankColors = ["text-amber-400", "text-slate-300", "text-amber-600"];
const rankBgs = ["bg-amber-500/20", "bg-slate-400/10", "bg-amber-700/10"];

export const ChallengeLeaderboard = ({ leaderboard, title = "Günlük Sıralama" }: Props) => {
  const { user } = useAuth();

  if (leaderboard.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
        <p className="text-xs text-slate-500">Henüz kimse oynamamış. İlk sen ol! 🚀</p>
      </div>
    );
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 w-full">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-amber-400" />
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
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
              <Avatar className="w-7 h-7">
                <AvatarImage src={entry.avatar_url || undefined} />
                <AvatarFallback className="bg-white/10 text-[10px] text-white">
                  {(entry.username || "?")[0]}
                </AvatarFallback>
              </Avatar>
              <span className={`flex-1 text-xs font-bold truncate ${isMe ? "text-white" : "text-slate-300"}`}>
                {entry.username}
                {isMe && <span className="text-[9px] text-slate-500 ml-1">(Sen)</span>}
              </span>
              <span className="text-xs font-bold text-amber-400">{typeof entry.score === 'number' ? entry.score.toFixed(2) : entry.score}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
