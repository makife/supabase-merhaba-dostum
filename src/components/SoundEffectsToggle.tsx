import { useEffect, useState, useCallback } from "react";

/**
 * Maç ekranı sağ üst köşe ses efekti aç/kapa düğmesi.
 * Ayarlar sayfası ile aynı `kelimeci-settings.sounds` bayrağını okur/yazar,
 * böylece koordineli çalışır. Diğer sekmelerdeki useSounds hook'unun anında
 * yakalayabilmesi için storage event de tetiklenir.
 */
const readSoundsEnabled = (): boolean => {
  try {
    const raw = localStorage.getItem("kelimeci-settings");
    const settings = raw ? JSON.parse(raw) : {};
    return settings.sounds !== false;
  } catch {
    return true;
  }
};

const SoundEffectsToggle = () => {
  const [enabled, setEnabled] = useState<boolean>(() => readSoundsEnabled());

  // Ayarlar sayfası (veya başka bir yer) değiştirdiğinde yansıt
  useEffect(() => {
    const sync = () => setEnabled(readSoundsEnabled());
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const toggle = useCallback(() => {
    try {
      const raw = localStorage.getItem("kelimeci-settings");
      const settings = raw ? JSON.parse(raw) : {};
      const next = !(settings.sounds !== false);
      settings.sounds = next;
      localStorage.setItem("kelimeci-settings", JSON.stringify(settings));
      setEnabled(next);
      // Aynı sekmedeki useSounds hook'unun da haberi olsun
      try {
        window.dispatchEvent(new StorageEvent("storage", { key: "kelimeci-settings" }));
      } catch {
        window.dispatchEvent(new Event("storage"));
      }
    } catch (e) {
      console.warn("Ses efekti toggle yazılamadı:", e);
    }
  }, []);

  const iconSrc = enabled ? "/macEkraniSesEfektiAc.svg" : "/macEkraniSesEfektiKapat.svg";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={enabled ? "Ses efektlerini kapat" : "Ses efektlerini aç"}
      aria-pressed={enabled}
      className="fixed top-2 right-2 z-[60] w-11 h-11 rounded-full bg-slate-900/70 backdrop-blur-sm border border-white/10 flex items-center justify-center active:scale-95 transition-transform"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <img src={iconSrc} alt="" className="w-6 h-6" draggable={false} />
    </button>
  );
};

export default SoundEffectsToggle;
