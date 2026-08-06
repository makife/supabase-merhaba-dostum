import { useCallback, useRef, useState } from "react";
import { useSounds } from "@/hooks/useSounds";
import { useNativeGameplay } from "@/hooks/useNativeGameplay";

interface Ripple {
  id: number;
  x: number;
  y: number;
}

interface PressableZoneProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  /** PNG üzerine giydirilen görünmez alan için absolute konum stilleri */
  style?: React.CSSProperties;
  className?: string;
  /** basılıyken beyaz parlama katmanı */
  glow?: boolean;
  /** tıklama noktasından açılan halka */
  ripple?: boolean;
  /** ses efekti anahtarı */
  sound?: string;
  haptic?: "light" | "medium" | "heavy";
  children?: React.ReactNode;
}

/**
 * Native oyun hissi veren görünmez hit-zone butonu.
 * - pointerdown anında tepki (sıfır gecikme)
 * - ses + haptic eşzamanlı
 * - basıldığında küçülme, bırakıldığında yaylanma
 * - parlama katmanı + ripple halkası
 */
export function PressableZone({
  label,
  onPress,
  disabled,
  style,
  className = "",
  glow = true,
  ripple = true,
  sound = "buttonClick",
  haptic = "light",
  children,
}: PressableZoneProps) {
  const [phase, setPhase] = useState<"idle" | "down" | "up">("idle");
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const rippleId = useRef(0);
  const { playSound } = useSounds();
  const { triggerHapticFeedback } = useNativeGameplay();

  const handleDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled) return;
      setPhase("down");
      playSound(sound as any);
      triggerHapticFeedback(haptic);

      if (ripple) {
        const rect = e.currentTarget.getBoundingClientRect();
        const id = ++rippleId.current;
        setRipples((prev) => [
          ...prev,
          { id, x: e.clientX - rect.left, y: e.clientY - rect.top },
        ]);
        setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 450);
      }
    },
    [disabled, playSound, sound, triggerHapticFeedback, haptic, ripple],
  );

  const release = useCallback(
    (fire: boolean, e?: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled) return;
      setPhase((p) => (p === "down" ? "up" : p));
      setTimeout(() => setPhase("idle"), 130);

      if (!fire) return;

      e?.preventDefault();
      e?.stopPropagation();

      // Bu buton kapanan bir pencereyi tetikleyebilir; altta kalan öğeye
      // "ghost click" gitmesini engellemek için bir tur click'i yut.
      const swallow = (ev: MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
      };
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 400);

      // click olayı gönderildikten sonra çalıştır
      setTimeout(() => onPress?.(), 0);
    },
    [disabled, onPress],
  );


  const transform =
    phase === "down" ? "scale(0.93) translateY(2px)" : phase === "up" ? "scale(1.04)" : "scale(1)";

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onPointerDown={handleDown}
      onPointerUp={() => release(true)}
      onPointerLeave={() => release(false)}
      onPointerCancel={() => release(false)}
      className={`absolute bg-transparent overflow-hidden ${className}`}
      style={{
        transform,
        transition:
          phase === "down"
            ? "transform 70ms cubic-bezier(0.4, 0, 1, 1)"
            : "transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
        ...style,
      }}
    >
      {glow && (
        <span
          className="absolute inset-0 rounded-[2cqw] bg-white pointer-events-none"
          style={{
            opacity: phase === "down" ? 0.22 : 0,
            transition: phase === "down" ? "opacity 60ms linear" : "opacity 240ms ease-out",
          }}
        />
      )}

      {ripples.map((r) => (
        <span
          key={r.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: r.x,
            top: r.y,
            width: 8,
            height: 8,
            marginLeft: -4,
            marginTop: -4,
            border: "2px solid rgba(255,255,255,0.85)",
            animation: "pressable-ripple 420ms ease-out forwards",
          }}
        />
      ))}

      {children}
    </button>
  );
}

export default PressableZone;
