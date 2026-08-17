import { useCallback, useEffect, useState } from "react";
import { useMusic } from "@/contexts/MusicContext";
import { stopAllSounds, stopAllHTML5Sounds } from "@/services/nativeAudioService";
import { stopAllIOSWebSounds } from "@/services/iosWebAudioService";
import { useRadio } from "@/contexts/RadioContext";
import { useSounds } from "@/hooks/useSounds";
import { useThemeContext } from "@/components/ThemeProvider";

/**
 * Ana sayfa 3 kademeli ses düğmesi.
 *
 * Kademeler (döngü):
 *   ac    → hem arka plan müziği / radyo hem ses efektleri AÇIK
 *   kis   → sadece arka plan müziği / radyo KAPALI, ses efektleri AÇIK
 *   kapat → hem arka plan müziği / radyo hem ses efektleri KAPALI
 */

type ToggleState = "ac" | "kis" | "kapat";

const CYCLE: ToggleState[] = ["ac", "kis", "kapat"];

const readSoundsEnabled = (): boolean => {
  try {
    const raw = localStorage.getItem("kelimeci-settings");
    const settings = raw ? JSON.parse(raw) : {};
    return settings.sounds !== false;
  } catch {
    return true;
  }
};

const writeSoundsEnabled = (enabled: boolean) => {
  try {
    const raw = localStorage.getItem("kelimeci-settings");
    const settings = raw ? JSON.parse(raw) : {};
    settings.sounds = enabled;
    localStorage.setItem("kelimeci-settings", JSON.stringify(settings));
    try {
      window.dispatchEvent(new StorageEvent("storage", { key: "kelimeci-settings" }));
    } catch {
      window.dispatchEvent(new Event("storage"));
    }
    window.dispatchEvent(
      new CustomEvent("soundEffectsToggled", { detail: { enabled } })
    );
  } catch (e) {
    console.warn("Ses efekti toggle yazılamadı:", e);
  }
};

const stopEverySoundEffect = () => {
  try { stopAllHTML5Sounds(); } catch {}
  try { stopAllIOSWebSounds(); } catch {}
  stopAllSounds().catch(() => {});
};

interface HomeSoundToggleProps {
  className?: string;
}

export const HomeSoundToggle = ({ className = "" }: HomeSoundToggleProps) => {
  const { theme } = useThemeContext();
  const isDarkTheme = theme !== "default";
  const { musicEnabled, setMusicEnabled } = useMusic();
  const { isPlaying: radioPlaying, stop: stopRadio } = useRadio();
  const { playSound } = useSounds();

  // Başlangıç: efektler kapalıysa "kapat", müzik/radyo kapalıysa "kis", değilse "ac"
  const [state, setState] = useState<ToggleState>(() => {
    const effectsOn = readSoundsEnabled();
    const audioOn = musicEnabled || radioPlaying;
    if (!effectsOn) return "kapat";
    if (!audioOn) return "kis";
    return "ac";
  });

  useEffect(() => {
    const sync = () => {
      const effectsOn = readSoundsEnabled();
      setState((cur) => {
        if (!effectsOn && cur !== "kapat") return "kapat";
        if (effectsOn && cur === "kapat") return "kis";
        return cur;
      });
    };
    window.addEventListener("storage", sync);
    window.addEventListener("soundEffectsToggled", sync as EventListener);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("soundEffectsToggled", sync as EventListener);
    };
  }, []);

  const applyTransition = useCallback((next: ToggleState) => {
    const nextMusicOn = next === "ac";
    const nextEffectsOn = next !== "kapat";

    // Efekt ayarını yaz
    writeSoundsEnabled(nextEffectsOn);
    if (!nextEffectsOn) stopEverySoundEffect();

    // Arka plan müziği / radyo
    if (!nextMusicOn) {
      if (radioPlaying) { try { stopRadio(); } catch {} }
      try { setMusicEnabled(false); } catch {}
    } else {
      try { setMusicEnabled(true); } catch {}
    }
  }, [radioPlaying, setMusicEnabled]);

  const handleClick = useCallback(() => {
    setState((cur) => {
      const idx = CYCLE.indexOf(cur);
      const next = CYCLE[(idx + 1) % CYCLE.length];
      applyTransition(next);
      return next;
    });
    // Kendi buton sesi (efektler açık olsa bile bir kez çalabilir)
    try { playSound("buttonClick"); } catch {}
  }, [applyTransition, playSound]);

  const iconSrc =
    state === "ac"
      ? "/macEkraniSesEfektiAc.svg"
      : state === "kis"
      ? "/macEkraniSesEfektiKis.svg"
      : "/macEkraniSesEfektiKapat.svg";

  const label =
    state === "ac"
      ? "Ses efektleri ve müzik açık"
      : state === "kis"
      ? "Sadece ses efektleri açık"
      : "Ses efektleri ve müzik kapalı";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleClick();
      }}
      aria-label={label}
      className={`relative w-11 h-11 flex items-center justify-center rounded-full ${
        isDarkTheme ? "bg-white/90 shadow-[0_2px_8px_rgba(0,0,0,0.25)]" : ""
      } active:scale-90 transition-transform ${className}`}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <img
        src={iconSrc}
        alt=""
        className="w-9 h-9 object-contain drop-shadow-md"
        draggable={false}
      />
    </button>
  );
};

export default HomeSoundToggle;

