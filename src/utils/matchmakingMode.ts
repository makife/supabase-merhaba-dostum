/**
 * Eşleşme Modu Yöneticisi
 * Matchmaking aktifken gereksiz arka plan polling'lerini duraklatır.
 * Bu sayede bant genişliği ve CPU eşleşme işlemine ayrılır.
 */

let _isActive = false;
const listeners = new Set<(active: boolean) => void>();

export const matchmakingMode = {
  /** Matchmaking başladığında çağır */
  activate: () => {
    if (_isActive) return;
    _isActive = true;
    console.log("[MatchmakingMode] 🚀 AKTİF — arka plan polling duraklatıldı");
    listeners.forEach((l) => l(true));
  },

  /** Matchmaking bittiğinde (eşleşme bulundu, iptal, timeout) çağır */
  deactivate: () => {
    if (!_isActive) return;
    _isActive = false;
    console.log("[MatchmakingMode] ✅ KAPALI — arka plan polling devam ediyor");
    listeners.forEach((l) => l(false));
  },

  /** Matchmaking aktif mi? */
  isActive: () => _isActive,

  /** Durum değişikliği dinle */
  onChange: (listener: (active: boolean) => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
