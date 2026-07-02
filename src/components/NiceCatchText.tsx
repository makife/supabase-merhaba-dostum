import { memo, useEffect, useState } from "react";

interface NiceCatchTextProps {
  /** Her arttığında yeni animasyon tetiklenir */
  eventId: number;
  /** Kelime uzunluğu (6 => "İyi yakaladın!" beyaz, >=7 => "Muhteşem!" mavi) */
  wordLength: number;
}

const LETTER_IN_STEP_MS = 50;   // soldan gelirken harfler arası
const HOLD_MS = 1000;           // ortada bekleme
const LETTER_OUT_STEP_MS = 50;  // sağa akarken harfler arası
const LETTER_ANIM_MS = 300;     // her harfin kayma süresi

type Phase = "in" | "hold" | "out" | "done";

const NiceCatchText = memo(({ eventId, wordLength }: NiceCatchTextProps) => {
  const [state, setState] = useState<{
    id: number;
    text: string;
    color: "white" | "blue";
    phase: Phase;
  } | null>(null);

  useEffect(() => {
    if (eventId === 0 || wordLength < 6) return;
    const isXLong = wordLength >= 7;
    const text = isXLong ? "Muhteşem!" : "İyi yakaladın!";
    const color: "white" | "blue" = isXLong ? "blue" : "white";
    setState({ id: eventId, text, color, phase: "in" });

    const inDuration = text.length * LETTER_IN_STEP_MS + LETTER_ANIM_MS;
    const outStart = inDuration + HOLD_MS;
    const outDuration = text.length * LETTER_OUT_STEP_MS + LETTER_ANIM_MS;

    const t1 = setTimeout(() => {
      setState((s) => (s && s.id === eventId ? { ...s, phase: "hold" } : s));
    }, inDuration);
    const t2 = setTimeout(() => {
      setState((s) => (s && s.id === eventId ? { ...s, phase: "out" } : s));
    }, outStart);
    const t3 = setTimeout(() => {
      setState((s) => (s && s.id === eventId ? null : s));
    }, outStart + outDuration);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [eventId, wordLength]);

  if (!state) return null;

  const isBlue = state.color === "blue";
  const fill = isBlue ? "#3ba7ff" : "#ffffff";
  const stroke = isBlue ? "#ffffff" : "#0b1a3a";

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "calc(50% + 2.2cm)",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        whiteSpace: "nowrap",
        fontStyle: "italic",
        fontWeight: 900,
        fontSize: "1.75rem",
        color: fill,
        WebkitTextStroke: `1.5px ${stroke}`,
        textShadow: `0 2px 6px rgba(0,0,0,0.55)`,
        letterSpacing: "0.02em",
        zIndex: 30,
      }}
    >
      {state.text.split("").map((ch, i) => {
        const inDelay = i * LETTER_IN_STEP_MS;
        const outDelay = i * LETTER_OUT_STEP_MS;
        let transform = "translateX(0)";
        let opacity = 1;
        let transition = `transform ${LETTER_ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1) ${inDelay}ms, opacity ${LETTER_ANIM_MS}ms ease ${inDelay}ms`;

        if (state.phase === "in") {
          // başlangıç durumu (mount öncesi) -> ilk render'da hemen "0"a gitmesi için
          // React ilk paint'te transform:0 uygular; sadece "önce" transform'u -120vw yaparız
          // Bunu inline animation ile değil, key ile yeni mount yaparak sağlıyoruz
          transform = "translateX(0)";
          opacity = 1;
        } else if (state.phase === "hold") {
          transform = "translateX(0)";
          opacity = 1;
          transition = "none";
        } else if (state.phase === "out") {
          transform = "translateX(120vw)";
          opacity = 0;
          transition = `transform ${LETTER_ANIM_MS}ms cubic-bezier(0.55, 0, 0.85, 0.3) ${outDelay}ms, opacity ${LETTER_ANIM_MS}ms ease ${outDelay}ms`;
        }

        return (
          <span
            key={`${state.id}-${i}`}
            style={{
              display: "inline-block",
              transform,
              opacity,
              transition,
              // ilk mount'ta soldan gelmesi için CSS animation
              animation:
                state.phase === "in"
                  ? `niceCatchIn ${LETTER_ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1) ${inDelay}ms both`
                  : undefined,
              whiteSpace: "pre",
            }}
          >
            {ch === " " ? "\u00A0" : ch}
          </span>
        );
      })}
      <style>{`
        @keyframes niceCatchIn {
          from { transform: translateX(-120vw); opacity: 0; }
          to   { transform: translateX(0);      opacity: 1; }
        }
      `}</style>
    </div>
  );
});

NiceCatchText.displayName = "NiceCatchText";
export default NiceCatchText;
