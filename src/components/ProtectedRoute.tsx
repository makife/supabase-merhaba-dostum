import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { Navigate, useLocation } from "react-router-dom";
import { ReactNode, useEffect, useState, useRef } from "react";
import { loadSessionFromStorage } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { isSystemConnected } = useUser();
  const location = useLocation();
  
  const isNative = Capacitor.isNativePlatform();

  // State
  const [showLoading, setShowLoading] = useState(true);
  const [hasStoredSession, setHasStoredSession] = useState<boolean | null>(null);
  const [giveUp, setGiveUp] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  
  const checkedStorageRef = useRef(false);

  // 🔧 User geldiğinde tüm loading'leri kapat
  useEffect(() => {
    if (user) {
      console.log("✅ [ProtectedRoute] User geldi");
      setShowLoading(false);
      setGiveUp(false);
      setIsRecovering(false);
    }
  }, [user]);

  // 🔧 Session recovered eventi dinle
  useEffect(() => {
    const handleSessionRecovered = () => {
      console.log("[ProtectedRoute] 🔐 Session recovered eventi alındı!");
      setIsRecovering(false);
      // User state'i güncellenecek, yukarıdaki useEffect tetiklenecek
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
        
        if (hasSession) {
          setIsRecovering(true);
        }
      } catch {
        setHasStoredSession(false);
      }
    };
    
    checkStorage();
  }, [isNative]);

  // 🔧 Loading timeout'ları
  useEffect(() => {
    // Auth yüklemesi bittiyse kısa süre sonra loading kapat
    let loadingTimeout: NodeJS.Timeout;
    
    if (!authLoading) {
      loadingTimeout = setTimeout(() => setShowLoading(false), 500);
    }
    
    // 🔥 NATIVE'DE: Storage'da session varsa 20 saniye bekle (önceden 15 idi)
    // Storage'da session yoksa 8 saniye bekle
    const maxWait = isNative && hasStoredSession ? 20000 : 8000;
    
    const giveUpTimeout = setTimeout(() => {
      if (!user) {
        console.log(`⏰ [ProtectedRoute] ${maxWait}ms timeout`);
        
        // 🛡️ Native'de storage'da session varsa giveUp YAPMA
        if (isNative && hasStoredSession && isRecovering) {
          console.log("[ProtectedRoute] 🛡️ Session recovery devam ediyor, beklemeye devam...");
          // Ek 15 saniye daha bekle
          setTimeout(() => {
            if (!user) {
              console.log("[ProtectedRoute] ⚠️ 35sn doldu, artık redirect");
              setGiveUp(true);
            }
          }, 15000);
        } else {
          setGiveUp(true);
        }
      }
    }, maxWait);
    
    return () => {
      clearTimeout(loadingTimeout);
      clearTimeout(giveUpTimeout);
    };
  }, [authLoading, user, isNative, hasStoredSession, isRecovering]);

  // 1. USER VARSA - hemen göster
  if (user) {
    return <>{children}</>;
  }

  // 2. İlk yükleme
  if (authLoading || showLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary"></div>
        <p className="mt-4 text-muted-foreground">Kelimele yükleniyor...</p>
      </div>
    );
  }

  // 3. Native'de storage'da session varsa ve recovery devam ediyorsa - bekle
  if (isNative && hasStoredSession && !giveUp) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <p className="text-primary font-medium animate-pulse">
            {isRecovering ? "Oturum geri yükleniyor..." : "Bağlantı kontrol ediliyor..."}
          </p>
        </div>
      </div>
    );
  }

  // 4. Timeout - redirect
  if (giveUp) {
    console.log("🚪 [ProtectedRoute] Redirect to /auth");
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // 5. Sistem bağlı - kısa bekle
  if (isSystemConnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        <p className="mt-4 text-sm text-muted-foreground">Bağlantı kontrol ediliyor...</p>
      </div>
    );
  }

  // 6. Fallback loading
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-primary"></div>
    </div>
  );
};

export default ProtectedRoute;
