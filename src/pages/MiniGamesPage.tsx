import { useNavigate } from "react-router-dom";
import { useSounds } from "@/hooks/useSounds";
import { useMemoryGame } from "@/hooks/useMemoryGame";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

const MiniGamesPage = () => {
  const navigate = useNavigate();
  const { playSound } = useSounds();
  const { canPlay: canPlayMemory, timeUntilNextPlay } = useMemoryGame();
  

  const miniGamesConfig = [
    { id: "snake", title: "Yılan", icon: "🐍", description: "Klasik yılan oyunu", gradient: "from-green-500 to-emerald-700", route: "/snake-game" },
    { id: "memory", title: "Hafıza", icon: "🧠", description: "Kartları eşle", gradient: "from-purple-500 to-violet-700", route: "/memory-game", disabled: !canPlayMemory, cooldown: timeUntilNextPlay },
    { id: "neon", title: "Refleks", icon: "⚡", description: "Hızını test et", gradient: "from-cyan-500 to-blue-700", route: "/neon-blitz" },
    
  ];

  return (
    <div
      className="fixed inset-0 flex flex-col text-slate-100 font-sans overflow-hidden"
      style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}
    >
      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-center gap-3">
        <button
          onClick={() => { navigate(-1); playSound("buttonClick"); }}
          className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center active:scale-90 transition-transform"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div>
          <h1 className="text-xl font-black text-white tracking-tight">Mini Oyunlar</h1>
          <p className="text-xs text-slate-400">Eğlenceli mini oyunlar</p>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-5 pb-28">
        <div className="grid grid-cols-2 gap-4 mt-2">
          {miniGamesConfig.map((game) => (
            <div
              key={game.id}
              onClick={() => {
                if (game.disabled) return;
                navigate(game.route);
                playSound("buttonClick");
              }}
              className={`relative group cursor-pointer rounded-3xl p-4 h-32 flex flex-col justify-between transition-transform duration-200 active:scale-[0.97] border border-white/10 shadow-lg overflow-hidden ${game.disabled ? "opacity-40 grayscale" : ""}`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${game.gradient} opacity-90 group-hover:opacity-100 transition-opacity rounded-3xl`} />
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl pointer-events-none" />

              <div className="relative z-10 flex justify-between items-start">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-2xl shadow-inner">
                  {game.icon}
                </div>
                {game.disabled && game.cooldown && (
                  <span className="text-[10px] bg-black/30 text-white/80 px-2 py-0.5 rounded-full font-mono">
                    {game.cooldown}
                  </span>
                )}
              </div>

              <div className="relative z-10">
                <h3 className="text-base font-bold text-white leading-none mb-0.5 drop-shadow-md">{game.title}</h3>
                <p className="text-[10px] text-white/70 font-medium">{game.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default MiniGamesPage;
