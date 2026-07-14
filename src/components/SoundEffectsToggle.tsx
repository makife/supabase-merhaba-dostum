import { useEffect, useState, useCallback, useRef } from "react";
import { stopAllSounds, stopAllHTML5Sounds } from "@/services/nativeAudioService";
import { stopAllIOSWebSounds } from "@/services/iosWebAudioService";
import { useMusic } from "@/contexts/MusicContext";
import { useRadio } from "@/contexts/RadioContext";

/**
 * Maç ekranı ses efekti aç/kapa düğmesi.
 * Ayarlar sayfası ile aynı `kelimeci-settings.sounds` bayrağını okur/yazar.
 * Kapatıldığında o an çalan tüm ses efektleri anında susturulur ve
 * arka plan müziği / radyo da birlikte fade-out edilir.
 * Tekrar açıldığında müzik / radyo tekrar fade-in ile geri getirilir.
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

const stopEverySoundEffect = () => {
  try {
    stopAllHTML5Sounds();
  } catch {
    /* ignore */
  }
  try {
    stopAllIOSWebSounds();
  } catch {
    /* ignore */
  }
  // Native (Android/iOS Capacitor) preload edilmiş kanallar
  stopAllSounds().catch(() => {
    /* ignore */
  });
};

interface SoundEffectsToggleProps {
  className?: string;
}

const SoundEffectsToggle = ({ className = "" }: SoundEffectsToggleProps) => {
  const [enabled, setEnabled] = useState<boolean>(() => readSoundsEnabled());
  const { fadeOutBackgroundMusic, fadeInBackgroundMusic, isPlaying: musicIsPlaying } = useMusic();
  const { fadeOut: fadeOutRadio, isPlaying: radioIsPlaying } = useRadio();

  // Toggle KAPALI iken önceden ne çalıyordu — açılınca doğru kaynağı geri getir
  const wasMusicPlayingRef = useRef(false);
  const wasRadioPlayingRef = useRef(false);

  useEffect(() => {
    const sync = () => setEnabled(readSoundsEnabled());
    window.addEventListener("storage", sync);
    window.addEventListener("soundEffectsToggled", sync as EventListener);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("soundEffectsToggled", sync as EventListener);
    };
  }, []);

  const toggle = useCallback(() => {
    try {
      const raw = localStorage.getItem("kelimeci-settings");
      const settings = raw ? JSON.parse(raw) : {};
      const next = !(settings.sounds !== false);
      settings.sounds = next;
      localStorage.setItem("kelimeci-settings", JSON.stringify(settings));
      setEnabled(next);

      if (!next) {
        // Kapatıldı → efektleri anında sustur + müzik/radyoyu fade-out
        stopEverySoundEffect();
        try {
          wasMusicPlayingRef.current = !!musicIsPlaying;
          wasRadioPlayingRef.current = !!radioIsPlaying;
        } catch {
          /* ignore */
        }
        try {
          if (musicIsPlaying) fadeOutBackgroundMusic(600);
        } catch {
          /* ignore */
        }
        try {
          if (radioIsPlaying) fadeOutRadio(600);
        } catch {
          /* ignore */
        }
      } else {
        // Açıldı → maçtan önce çalan kaynağı geri getir
        try {
          if (wasRadioPlayingRef.current) {
            window.dispatchEvent(new Event("radio-resume"));
          } else if (wasMusicPlayingRef.current) {
            fadeInBackgroundMusic(800);
          } else {
            // İlk kez maç ekranında açıldıysa (kapalıyken girdiyse)
            // müziği yine de yumuşakça getirmeyi dene
            fadeInBackgroundMusic(800);
          }
        } catch {
          /* ignore */
        }
      }

      // Aynı sekmedeki useSounds hook'u + diğer dinleyiciler
      try {
        window.dispatchEvent(new StorageEvent("storage", { key: "kelimeci-settings" }));
      } catch {
        window.dispatchEvent(new Event("storage"));
      }
      window.dispatchEvent(
        new CustomEvent("soundEffectsToggled", { detail: { enabled: next } })
      );
    } catch (e) {
      console.warn("Ses efekti toggle yazılamadı:", e);
    }
  }, [
    fadeOutBackgroundMusic,
    fadeInBackgroundMusic,
    fadeOutRadio,
    musicIsPlaying,
    radioIsPlaying,
  ]);

  const iconSrc = enabled ? "/macEkraniSesEfektiAc.svg" : "/macEkraniSesEfektiKapat.svg";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
      aria-label={enabled ? "Ses efektlerini kapat" : "Ses efektlerini aç"}
      aria-pressed={enabled}
      className={`inline-flex items-center justify-center h-8 w-8 rounded-md border border-white/10 hover:border-white/20 hover:bg-white/10 active:scale-95 transition ${className}`}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <img src={iconSrc} alt="" className="w-5 h-5" draggable={false} />
    </button>
  );
};

export default SoundEffectsToggle;
