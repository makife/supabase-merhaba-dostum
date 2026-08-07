import { useCallback, useEffect, useState } from "react";
import { useMusic } from "@/contexts/MusicContext";
import { stopAllSounds, stopAllHTML5Sounds } from "@/services/nativeAudioService";
import { stopAllIOSWebSounds } from "@/services/iosWebAudioService";
import { useRadio } from "@/contexts/RadioContext";
import { useSounds } from "@/hooks/useSounds";


/**
 * Ana sayfa 2 kademeli ses düğmesi: "ac" (müzik + efektler açık) / "kapat" (ikisi de kapalı).
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
    window.dispatchEvent(new CustomEvent("soundEffectsToggled", { detail: { enabled } }));
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
  const { musicEnabled, setMusicEnabled } = useMusic();
  const { isPlaying: radioPlaying, stop: stopRadio } = useRadio();
  const { playSound } = useSounds();

  const [effectsOn, setEffectsOn] = useState<boolean>(() => readSoundsEnabled());

  useEffect(() => {
    const sync = () => setEffectsOn(readSoundsEnabled());
    window.addEventListener("storage", sync);
    window.addEventListener("soundEffectsToggled", sync as EventListener);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("soundEffectsToggled", sync as EventListener);
    };
  }, []);

  const on = effectsOn && (musicEnabled || radioPlaying);

  const handleClick = useCallback(() => {
    if (on) {
      try { playSound("buttonClick"); } catch {}
      writeSoundsEnabled(false);
      setEffectsOn(false);
      stopEverySoundEffect();
      if (radioPlaying) { try { stopRadio(); } catch {} }
      try { setMusicEnabled(false); } catch {}
    } else {
      writeSoundsEnabled(true);
      setEffectsOn(true);
      try { setMusicEnabled(true); } catch {}
      setTimeout(() => { try { playSound("buttonClick"); } catch {} }, 30);
    }
  }, [on, radioPlaying, stopRadio, setMusicEnabled, playSound]);


  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleClick();
      }}
      aria-label={on ? "Ses efektleri ve müzik açık" : "Ses efektleri ve müzik kapalı"}
      className={`relative w-11 h-11 flex items-center justify-center active:scale-90 transition-transform ${className}`}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <img
        src={on ? "/macEkraniSesEfektiAc.svg" : "/macEkraniSesEfektiKapat.svg"}
        alt=""
        className="w-9 h-9 object-contain drop-shadow-md"
        draggable={false}
      />
    </button>
  );
};

export default HomeSoundToggle;
