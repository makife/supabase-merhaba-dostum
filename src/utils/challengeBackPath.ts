/**
 * Mini oyunlardan / maçlardan geri dönerken kullanıcıyı geldiği
 * hub sayfasına (düello veya oyun modları) döndürür.
 */
const KEY = "gameHubPath";

export const setGameHubPath = (path: string) => {
  try {
    if (path === "/") sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, path);
  } catch {}
};

export const homeBackPath = () => {
  if (typeof window === "undefined") return "/";
  if (window.location.pathname.startsWith("/challenge/")) return "/challenge";
  try {
    const stored = sessionStorage.getItem(KEY);
    if (stored) return stored;
  } catch {}
  return "/";
};
