import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { ReactNode, useEffect, useState, useRef } from "react";
import { loadSessionFromStorage } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  
  const isNative = Capacitor.isNativePlatform();

  // State
  const [showLoading, setShowLoading] = useState(true);
  const [hasStoredSession, setHasStoredSession] = useState<boolean | null>(null);
  const [giveUp, setGiveUp] = useState(false);
  
  const checkedStorageRef = useRef(false);

  // 🔧 User geldiğinde tüm loading'leri kapat
  useEffect(() => {
    if (user) {
      console.log("✅ [ProtectedRoute] User geldi");
      setShowLoading(false);
      setGiveUp(false);
    }
  }, [user]);

  // 🔧 Session recovered eventi dinle
  useEffect(() => {
    const handleSessionRecovered = () => {
      console.log("[ProtectedRoute] 🔐 Session recovered eventi alındı!");
    };

    window.addEventListener("session-recovered", handleSessionRecovered);
    return () => window.removeEventListener("session-recovered", handleSessionRecovered);
  }, []);

  // 🔧 Storage'da session var mı kontrol et (sadece native)
  useEffect(() => {
    if (!isNative || checkedStorageRef.current) return;
    
    checkedStorageRef.current = true;
    
    const checkStorage = async () => {
      try {
        const stored = await loadSessionFromStorage();
        const hasSession = !!(stored?.refresh_token && stored?.user);
        console.log("[ProtectedRoute] 📦 Storage session:", hasSession);
        setHasStoredSession(hasSession);
      } catch {
        setHasStoredSession(false);
      }
    };
    
    checkStorage();
  }, [isNative]);

  // 🔧 Loading timeout'ları - BASİT
  useEffect(() => {
    // Auth yüklemesi bittiyse kısa süre sonra loading kapat
    let loadingTimeout: NodeJS.Timeout;
    
    if (!authLoading) {
      loadingTimeout = setTimeout(() => setShowLoading(false), 500);
    }
    
    // Maksimum bekleme süresi
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

  // 1. USER VARSA - hemen göster
  if (user) {
    return <>{children}</>;
  }

  // 2. İlk yükleme - SADECE spinner, mesaj yok
  if (authLoading || showLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary"></div>
      </div>
    );
  }

  // 3. Native'de storage'da session varsa - bekle, SADECE spinner
  if (isNative && hasStoredSession && !giveUp) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  // 4. Timeout - redirect
  if (giveUp) {
    console.log("🚪 [ProtectedRoute] Redirect to /auth");
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // 5. Fallback - SADECE spinner
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-primary"></div>
    </div>
  );
};

export default ProtectedRoute;
