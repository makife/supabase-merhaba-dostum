import { useState } from "react";
import inviteCardBg from "@/assets/oyunDavetKarti.png";

interface GameInviteCardProps {
  open: boolean;
  avatarUrl?: string | null;
  username: string;
  busy?: boolean;
  onAccept: () => void;
  onReject: () => void;
}

/**
 * oyunDavetKarti.png (688x1000) piksel piksel analiz edilerek çıkarılan alan koordinatları.
 * Görsel bir aspect-ratio (688/1000) kilitli container içinde gösterildiği için
 * bu yüzdeler container boyutu ne olursa olsun (mobil/masaüstü) doğru hizalanır.
 */
const LAYOUT = {
  avatar: { left: "15.84%", top: "33.8%", width: "22.09%", height: "15.2%" },
  usernameField: { left: "43.9%", top: "37.9%", width: "40.84%", height: "7.3%" },
  rejectButton: { left: "13.23%", top: "69.7%", width: "34.88%", height: "10.9%" },
  acceptButton: { left: "51.6%", top: "69.5%", width: "35.17%", height: "9.1%" },
};

const triggerHaptic = (pattern: number | number[]) => {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Haptik desteklenmiyor, sessizce geç
  }
};

export function GameInviteCard({ open, avatarUrl, username, busy, onAccept, onReject }: GameInviteCardProps) {
  const [pressed, setPressed] = useState<"accept" | "reject" | null>(null);

  if (!open) return null;

  const handlePress = (kind: "accept" | "reject", action: () => void) => {
    if (busy) return;
    triggerHaptic(kind === "accept" ? [10, 25, 10] : 18);
    setPressed(kind);
    window.setTimeout(() => setPressed(null), 140);
    action();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 px-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-[280px]" style={{ aspectRatio: "688 / 1000" }}>
        <img
          src={inviteCardBg}
          alt="Oyun Daveti"
          className="w-full h-full select-none pointer-events-none drop-shadow-2xl"
          draggable={false}
        />

        {/* Dairesel alan: daveti gönderenin avatarı */}
        <div
          className="absolute rounded-full overflow-hidden bg-slate-700 flex items-center justify-center shadow-inner"
          style={LAYOUT.avatar}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={username} className="w-full h-full object-cover" draggable={false} />
          ) : (
            <span className="text-white font-black" style={{ fontSize: "clamp(16px, 6vw, 30px)" }}>
              {(username || "?").charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Input alanı: daveti gönderenin rumuzu, ortalı */}
        <div className="absolute flex items-center justify-center px-2 overflow-hidden" style={LAYOUT.usernameField}>
          <span
            className="text-[#16213e] font-black truncate text-center leading-none"
            style={{ fontSize: "clamp(11px, 3.4vw, 17px)" }}
          >
            {username}
          </span>
        </div>

        {/* Reddet - görünmez, sadece heptic + hafif basılma efekti */}
        <button
          type="button"
          disabled={busy}
          onClick={() => handlePress("reject", onReject)}
          aria-label="Daveti Reddet"
          className="absolute bg-transparent border-0 outline-none cursor-pointer disabled:cursor-not-allowed touch-manipulation"
          style={{
            ...LAYOUT.rejectButton,
            transform: pressed === "reject" ? "scale(0.94)" : "scale(1)",
            transition: "transform 100ms ease",
            WebkitTapHighlightColor: "transparent",
          }}
        />

        {/* Kabul Et - görünmez, sadece heptic + hafif basılma efekti */}
        <button
          type="button"
          disabled={busy}
          onClick={() => handlePress("accept", onAccept)}
          aria-label="Daveti Kabul Et"
          className="absolute bg-transparent border-0 outline-none cursor-pointer disabled:cursor-not-allowed touch-manipulation"
          style={{
            ...LAYOUT.acceptButton,
            transform: pressed === "accept" ? "scale(0.94)" : "scale(1)",
            transition: "transform 100ms ease",
            WebkitTapHighlightColor: "transparent",
          }}
        />
      </div>
    </div>
  );
}
