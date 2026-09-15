// Daily challenge tamamlanınca çalınacak ortak ses
let cached: HTMLAudioElement | null = null;

export const playChallengeWinSound = () => {
  try {
    const settings = JSON.parse(localStorage.getItem("kelimeci-settings") || "{}");
    if (settings.sounds === false) return;
  } catch {}

  try {
    if (!cached) {
      cached = new Audio(`${window.location.origin}/BoostArtiSes.mp3`);
      cached.preload = "auto";
      cached.volume = 0.85;
    }
    cached.currentTime = 0;
    cached.play().catch(() => {});
  } catch {}
};
