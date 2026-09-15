/**
 * Global sound settings check - tüm ses çalan componentler bu fonksiyonu kullanmalı
 */
export const isSoundEffectsEnabled = (): boolean => {
  try {
    const settings = JSON.parse(localStorage.getItem("kelimeci-settings") || "{}");
    return settings.sounds !== false; // default true
  } catch {
    return true;
  }
};
