import { useEffect, useState, useCallback, useRef } from "react";
import { stopAllSounds, stopAllHTML5Sounds } from "@/services/nativeAudioService";
import { stopAllIOSWebSounds } from "@/services/iosWebAudioService";
import { useMusic } from "@/contexts/MusicContext";

/**
 * Maç ekranı 3 kademeli ses düğmesi.
 *
 * Maç ekranına girildiğinde arka plan müziği / radyo GameCountdown tarafından
 * fade-out ile kapatılır. Başlangıç durumu bu yüzden "kis" (müzik kapalı,
 * efektler açık) kabul edilir.
 *
 * Kademeler (döngü):
 *   kis  → ac   → kis  → kapat → ac → kis → kapat ...
 *
 *  - ac    → hem arka plan müziği hem ses efektleri AÇIK
 *  - kis   → sadece arka plan müziği KAPALI, ses efektleri AÇIK
 *  - kapat → hem arka plan müziği hem ses efektleri KAPALI
 *
 * MusicContext.fadeInBackgroundMusic maç öncesi kaynağı (radyo/müzik)
 * hatırladığı için doğru kaynağı geri getirir.
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

interface SoundEffectsToggleProps {
  className?: string;
}

const SoundEffectsToggle = ({ className = "" }: SoundEffectsToggleProps) => {
  const { fadeOutBackgroundMusic, fadeInBackgroundMusic, setMusicEnabled } = useMusic();

  // Başlangıç: efektler kapalıysa direkt "kapat", değilse "kis"
  // (müzik maç başlangıcında fade-out edildiği için).
  const [state, setState] = useState<ToggleState>(() =>
    readSoundsEnabled() ? "kis" : "kapat"
  );

  // Ayarlar sayfasından/harici değişiklik ile senkron
  useEffect(() => {
    const sync = () => {
      const on = readSoundsEnabled();
      setState((cur) => {
        if (!on && cur !== "kapat") return "kapat";
        if (on && cur === "kapat") return "kis";
        return cur;
      });
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const applyTransition = useCallback(
    (prev: ToggleState, next: ToggleState) => {
      const prevMusicOn = prev === "ac";
      const nextMusicOn = next === "ac";
      const prevEffectsOn = prev !== "kapat";
      const nextEffectsOn = next !== "kapat";

      // Efekt ayarını yaz
      if (prevEffectsOn !== nextEffectsOn) {
        writeSoundsEnabled(nextEffectsOn);
        if (!nextEffectsOn) stopEverySoundEffect();
      }

      // Arka plan müziği (radyo değil — kullanıcı maç ekranı toggle'ıyla
      // sadece arka plan müziğinin açılıp kapanmasını bekliyor).
      if (nextMusicOn && !prevMusicOn) {
        // fadeInBackgroundMusic(musicOnly) global ayarı da atomik olarak açar.
        // Önce setMusicEnabled çağırmak iki ayrı play() isteğini yarıştırıp
        // fade-in'in isStartingRef tarafından atlanmasına neden oluyordu.
        try { fadeInBackgroundMusic(800, { musicOnly: true }); } catch {}
      } else if (!nextMusicOn && prevMusicOn) {
        try { fadeOutBackgroundMusic(600); } catch {}
        // Floating menü ile senkron: global ayarı da kapat.
        try { setMusicEnabled(false); } catch {}
      }
    },
    [fadeInBackgroundMusic, fadeOutBackgroundMusic, setMusicEnabled]
  );


  const onClick = useCallback(() => {
    setState((cur) => {
      const idx = CYCLE.indexOf(cur);
      const next = CYCLE[(idx + 1) % CYCLE.length];
      applyTransition(cur, next);
      return next;
    });
  }, [applyTransition]);

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
        onClick();
      }}
      aria-label={label}
      className={`inline-flex items-center justify-center h-8 w-8 rounded-md border border-white/10 hover:border-white/20 hover:bg-white/10 active:scale-95 transition ${className}`}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <img src={iconSrc} alt="" className="w-5 h-5" draggable={false} />
    </button>
  );
};

export default SoundEffectsToggle;
