import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { ReactNode, useEffect, useState, useRef } from "react";
import { loadSessionFromStorage } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";
import Lottie from "lottie-react";
import parmakLoadingAnim from "@/assets/parmakLoading.json";

interface ProtectedRouteProps {
  children: ReactNode;
}

// Koyu tema loading spinner - tüm durumlar için ortak
const DarkLoadingScreen = () => (
  <div
    className="fixed inset-0 flex flex-col items-center justify-center gap-4"
    style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}
  >
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none opacity-40" />
    <div className="relative z-10 flex flex-col items-center gap-4">
      <img src="/kelimeleLogo.webp" alt="Kelimele" className="w-16 h-16 rounded-2xl shadow-2xl ring-2 ring-white/10" />
      <Lottie animationData={parmakLoadingAnim} loop autoplay style={{ width: 80, height: 80 }} />
      <p className="text-white/50 text-xs font-bold uppercase tracking-widest">Yükleniyor</p>
    </div>
  </div>
);

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();

  const isNative = Capacitor.isNativePlatform();

  const [showLoading, setShowLoading] = useState(true);
  const [hasStoredSession, setHasStoredSession] = useState<boolean | null>(null);
  const [giveUp, setGiveUp] = useState(false);

  const checkedStorageRef = useRef(false);

  useEffect(() => {
    if (user) {
      setShowLoading(false);
      setGiveUp(false);
    }
  }, [user]);

  useEffect(() => {
    const handleSessionRecovered = () => {
      console.log("[ProtectedRoute] 🔐 Session recovered eventi alındı!");
    };
    window.addEventListener("session-recovered", handleSessionRecovered);
    return () => window.removeEventListener("session-recovered", handleSessionRecovered);
  }, []);

  useEffect(() => {
    if (!isNative || checkedStorageRef.current) return;
    checkedStorageRef.current = true;

    const checkStorage = async () => {
      try {
        const stored = await loadSessionFromStorage();
        setHasStoredSession(!!(stored?.refresh_token && stored?.user));
      } catch {
        setHasStoredSession(false);
      }
    };

    checkStorage();
  }, [isNative]);

  useEffect(() => {
    let loadingTimeout: NodeJS.Timeout;

    if (!authLoading) {
      loadingTimeout = setTimeout(() => setShowLoading(false), 500);
    }

    const maxWait = isNative && hasStoredSession ? 15000 : 5000;

    const giveUpTimeout = setTimeout(() => {
      if (!user) {
        console.log(`⏰ [ProtectedRoute] ${maxWait}ms timeout, redirect to auth`);
        setGiveUp(true);
      }
    }, maxWait);

    return () => {
      clearTimeout(loadingTimeout);
      clearTimeout(giveUpTimeout);
    };
  }, [authLoading, user, isNative, hasStoredSession]);

  if (user) return <>{children}</>;

  if (authLoading || showLoading) return <DarkLoadingScreen />;

  if (isNative && hasStoredSession && !giveUp) return <DarkLoadingScreen />;

  if (giveUp) {
    console.log("🚪 [ProtectedRoute] Redirect to /auth");
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <DarkLoadingScreen />;
};

export default ProtectedRoute;
