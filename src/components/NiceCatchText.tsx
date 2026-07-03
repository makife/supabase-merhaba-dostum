import { memo, useEffect, useRef, useState } from "react";

interface NiceCatchTextProps {
  /** Her arttığında yeni animasyon tetiklenir */
  eventId: number;
  /** Kelime uzunluğu (5-8+ arası farklı mesajlar). customText verilirse yoksayılır. */
  wordLength?: number;
  /** Verilirse wordLength yerine bu metin gösterilir */
  customText?: string;
  /** Ortada bekleme süresi (ms). Varsayılan 300 */
  holdMs?: number;
  /** Soldan gelirken harfler arası adım (ms). Varsayılan 30 */
  letterInStepMs?: number;
  /** Sağa akarken harfler arası adım (ms). Varsayılan 30 */
  letterOutStepMs?: number;
  /** Yazı boyutu. Varsayılan 1.75rem */
  fontSize?: string;
}

const DEFAULT_LETTER_IN_STEP_MS = 30;
const DEFAULT_HOLD_MS = 300;
const DEFAULT_LETTER_OUT_STEP_MS = 30;
const LETTER_ANIM_MS = 300;     // her harfin kayma süresi

const POOL_5 = ["İyiydi!", "Güzel!", "Fena değil!", "Bravo!"];
const POOL_6 = ["İyi yakaladın!", "Harika!", "Çok iyi!", "Süper"];
const POOL_7 = ["Muhteşem..!", "Fevkalade..!", "Mükemmel..!", "Şahane..!"];

type Phase = "in" | "hold" | "out" | "done";

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getTextForLength(len: number): string {
  if (len >= 8) return "EFSANEVİ!";
  if (len === 7) return pickRandom(POOL_7);
  if (len === 6) return pickRandom(POOL_6);
  if (len === 5) return pickRandom(POOL_5);
  return "";
}

const NiceCatchText = memo(({
  eventId,
  wordLength = 0,
  customText,
  holdMs = DEFAULT_HOLD_MS,
  letterInStepMs = DEFAULT_LETTER_IN_STEP_MS,
  letterOutStepMs = DEFAULT_LETTER_OUT_STEP_MS,
  fontSize = "1.75rem",
}: NiceCatchTextProps) => {
  const [state, setState] = useState<{
    id: number;
    text: string;
    color: "white" | "blue";
    phase: Phase;
  } | null>(null);

  // İlk mount'taki eventId'yi baz al: rematch sonrası eski değerle tekrar tetiklenmesin
  const baselineIdRef = useRef<number>(eventId);

  useEffect(() => {
    if (eventId === 0) return;
    if (eventId <= baselineIdRef.current) return;
    const text = customText ?? getTextForLength(wordLength);
    if (!text) return;
    const color = "white" as const;
    setState({ id: eventId, text, color, phase: "in" });

    const inDuration = text.length * letterInStepMs + LETTER_ANIM_MS;
    const outStart = inDuration + holdMs;
    const outDuration = text.length * letterOutStepMs + LETTER_ANIM_MS;

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
  }, [eventId, wordLength, customText, holdMs, letterInStepMs, letterOutStepMs]);

  if (!state) return null;

  const fill = "#ffffff";

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
        fontSize,
        color: fill,
        letterSpacing: "0.02em",
        zIndex: 30,
      }}
    >
      {state.text.split("").map((ch, i) => {
        const inDelay = i * letterInStepMs;
        const outDelay = i * letterOutStepMs;
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
