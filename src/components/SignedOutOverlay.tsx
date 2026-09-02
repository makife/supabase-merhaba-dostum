import { useEffect, useState } from "react";
import cikisYapildiImg from "@/assets/cikisYapildi.webp";

export const SIGNED_OUT_EVENT = "show-signed-out-card";

export function showSignedOutCard() {
  window.dispatchEvent(new CustomEvent(SIGNED_OUT_EVENT));
}

/**
 * Çıkış yapıldığında ProtectedRoute yönlendirmesi sayfayı unmount ettiği için
 * "Çıkış Yapıldı" kartı global olarak burada gösterilir.
 */
export default function SignedOutOverlay() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = () => setVisible(true);
    window.addEventListener(SIGNED_OUT_EVENT, handler);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), 1800);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 animate-in fade-in duration-200">
      <img
        src={cikisYapildiImg}
        alt="Çıkış Yapıldı"
        className="w-full max-w-[420px] h-auto select-none animate-in fade-in zoom-in-95 duration-300"
        draggable={false}
      />
    </div>
  );
}
