import { useEffect, useRef, useState, memo } from "react";
import Lottie from "lottie-react";
import { playPitchedBeep } from "@/services/pitchedBeepService";
import { playNativeSound } from "@/services/nativeAudioService";
 
/**
 * ComboBoost
 * - `comboEventId` her arttığında, comboCount değerine göre Boost{N}.json + BoostX.json yan yana oynatılır (2x-9x).
 * - `bonusEventId` her arttığında, bonusAmount değerine göre BoostArti{X}.json (10/20/30/50/100) oynatılır.
 * - Görseller "son 10 saniye" lottie boyutuyla aynı: 16rem x 16rem.
 */
 
export type BonusAmount = 10 | 20 | 30 | 50 | 100;
 
interface ComboBoostProps {
  comboEventId: number;
  comboCount: number; // 2..9
  bonusEventId: number;
  bonusAmount: BonusAmount | 0;
  resetId?: number;
}
 
// Cache loaded animations
const cache = new Map<string, any>();
const loading = new Map<string, Promise<any>>();
 
function loadAnim(path: string): Promise<any> {
  if (cache.has(path)) return Promise.resolve(cache.get(path));
  if (loading.has(path)) return loading.get(path)!;
  const p = fetch(path)
    .then((r) => r.json())
    .then((data) => {
      cache.set(path, data);
      loading.delete(path);
      return data;
    })
    .catch((err) => {
      loading.delete(path);
      console.error("Lottie fetch hatası:", path, err);
      return null;
    });
  loading.set(path, p);
  return p;
}
 
// Önceden yükle (idle)
if (typeof window !== "undefined") {
  setTimeout(() => {
    [2, 3, 4, 5, 6, 7, 8, 9].forEach((n) => loadAnim(`/Boost${n}.json`));
    loadAnim("/BoostX.json");
    [10, 20, 30, 50, 100].forEach((n) => loadAnim(`/BoostArti${n}.json`));
  }, 1500);
}
 
const ComboBoost = memo(
  ({ comboEventId, comboCount, bonusEventId, bonusAmount, resetId }: ComboBoostProps) => {
    const [comboData, setComboData] = useState<{ id: number; num: any; x: any } | null>(null);
    const [bonusData, setBonusData] = useState<{ id: number; data: any } | null>(null);
    const lastComboIdRef = useRef(0);
    const lastBonusIdRef = useRef(0);
 
    const lastResetIdRef = useRef(0);
 
    // Reset — render anında kontrol et, effect bekleme
    if (resetId && resetId !== lastResetIdRef.current) {
      lastResetIdRef.current = resetId;
      lastComboIdRef.current = 0;
      lastBonusIdRef.current = 0;
      // State'leri sıfırla (bu render'da null olarak devam eder)
      if (comboData !== null) setComboData(null);
      if (bonusData !== null) setBonusData(null);
    }
 
    // Combo trigger
    useEffect(() => {
      if (comboEventId === 0 || comboEventId === lastComboIdRef.current) return;
      lastComboIdRef.current = comboEventId;
      const n = Math.max(2, Math.min(9, comboCount));
      Promise.all([loadAnim(`/Boost${n}.json`), loadAnim("/BoostX.json")]).then(([num, x]) => {
        if (num && x) setComboData({ id: comboEventId, num, x });
      });
      // İnce/yüksek bip — combo arttıkça pitch yükselsin (n=2 -> 1.4x, n=9 -> 2.8x)
      const rate = 1.4 + (n - 2) * 0.2;
      playPitchedBeep("combo", rate, 0.6).catch(() => {});
      // Auto clear after animation
      const t = setTimeout(() => {
        setComboData((prev) => (prev?.id === comboEventId ? null : prev));
      }, 1200);
      return () => clearTimeout(t);
    }, [comboEventId, comboCount]);
 
    // Bonus trigger
    useEffect(() => {
      if (bonusEventId === 0 || bonusEventId === lastBonusIdRef.current || !bonusAmount) return;
      lastBonusIdRef.current = bonusEventId;
      loadAnim(`/BoostArti${bonusAmount}.json`).then((data) => {
        if (data) setBonusData({ id: bonusEventId, data });
      });
      // BoostArtiSes — native iOS/Android'de NativeAudio, web'de HTML5 fallback
      playNativeSound("boost_arti_ses", 0.85).catch(() => {});
      const t = setTimeout(() => {
        setBonusData((prev) => (prev?.id === bonusEventId ? null : prev));
      }, 1800);
      return () => clearTimeout(t);
    }, [bonusEventId, bonusAmount]);
 
 
 
    if (!comboData && !bonusData) return null;
 
    return (
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "calc(50% + 2.2cm)",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
        }}
      >
        {comboData && (
          <>
            <div style={{ width: "5rem", height: "5rem" }}>
              <Lottie
                animationData={comboData.num}
                loop={false}
                autoplay
                style={{ width: "100%", height: "100%" }}
              />
            </div>
            <div style={{ width: "3.5rem", height: "3.5rem", marginLeft: "-1.5rem" }}>
              <Lottie
                animationData={comboData.x}
                loop={false}
                autoplay
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          </>
        )}
        {bonusData && !comboData && (
          <div style={{ width: "32rem", height: "32rem" }}>
            <Lottie
              animationData={bonusData.data}
              loop={false}
              autoplay
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        )}
      </div>
    );
  }
);
 
ComboBoost.displayName = "ComboBoost";
 
export default ComboBoost;
 
