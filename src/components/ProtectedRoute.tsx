import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { Navigate, useLocation } from "react-router-dom";
import { ReactNode, useEffect, useState, useRef, useCallback } from "react";
import { getCachedSession } from "@/utils/persistentState";
import { ReconnectingOverlay } from "@/components/ReconnectingOverlay";

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { isSystemConnected } = useUser();
  const location = useLocation();

  // State'ler
  const [showLoadingLonger, setShowLoadingLonger] = useState(true);
  const [giveUpAndRedirect, setGiveUpAndRedirect] = useState(false);
  const [optimisticAuth, setOptimisticAuth] = useState(false);
  const [showReconnectOverlay, setShowReconnectOverlay] = useState(false);
  
  const hasCheckedCacheRef = useRef(false);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRecoveringRef = useRef(false); // 🆕 Auth recovery durumunu takip et

  // 🔧 User geldiğinde TÜM bekleme state'lerini temizle
  useEffect(() => {
    if (user) {
      console.log("✅ [ProtectedRoute] User geldi, tüm loading/redirect state'leri temizleniyor");
      setShowLoadingLonger(false);
      setGiveUpAndRedirect(false);
      setOptimisticAuth(false);
      setShowReconnectOverlay(false);
      
      // Bekleyen timeout'ları temizle
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
    }
  }, [user]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    let optimisticTimeout: NodeJS.Timeout;

    if (!authLoading) {
      // Auth yüklemesi bittikten 300ms sonra loading'i kapat
      timeout = setTimeout(() => setShowLoadingLonger(false), 300);
    }

    // 🆕 AGRESİF OPTİMİSTİC AUTH: 800ms içinde user gelmezse cached session'a bak
    optimisticTimeout = setTimeout(async () => {
      if (!user && !hasCheckedCacheRef.current) {
        hasCheckedCacheRef.current = true;
        console.log("⏰ [ProtectedRoute] 800ms doldu, agresif optimistic auth kontrolü...");
        
        try {
          const cachedSession = await getCachedSession();
          if (cachedSession && cachedSession.expiresAt > Date.now()) {
            console.log("✅ [ProtectedRoute] Cached session bulundu, ANINDA optimistic auth aktif");
            setOptimisticAuth(true);
            setShowReconnectOverlay(true);
            
            // 5 saniye sonra overlay'i kapat (daha hızlı)
            setTimeout(() => setShowReconnectOverlay(false), 5000);
          }
        } catch (e) {
          console.error("[ProtectedRoute] Cache kontrol hatası:", e);
        }
      }
    }, 800); // 🔧 2000ms -> 800ms (daha agresif)

    // 🔧 6 saniye boyunca hiçbir şey olmazsa güvenli redirect (3s -> 6s)
    // 🛡️ isRecoveringRef true ise redirect ASLA YAPMA! Max 15 saniye bekle.
    // 🆕 KRİTİK: 6sn dolsa bile isRecovering true ise /auth'a ASLA yönlendirme!
    redirectTimeoutRef.current = setTimeout(() => {
      // 🛡️ ÖNCE RECOVERY KONTROLÜ - 6sn dolsa bile recovery varsa BEKLE
      if (isRecoveringRef.current) {
        console.log("⏳ [ProtectedRoute] 6sn doldu AMA recovery devam ediyor - /auth'a YÖNLENDİRME YOK!");
        console.log("⏳ [ProtectedRoute] Max 15sn boyunca LoadingScreen'de tutulacak (Misafir yok!)");
        
        // 🆕 Recovery bitene kadar veya max 15sn boyunca bekle
        // Bu süre boyunca ASLA redirect yapma, ASLA 'Misafir' olarak içeri sokma
        let waitedMs = 0;
        const maxWaitMs = 15000; // Toplam max bekleme
        
        const recoveryCheckInterval = setInterval(() => {
          waitedMs += 1000;
          
          if (!isRecoveringRef.current) {
            // Recovery bitti
            clearInterval(recoveryCheckInterval);
            console.log("✅ [ProtectedRoute] Recovery bitti (" + waitedMs + "ms sonra)");
            
            // User geldi mi kontrol et
            // NOT: Bu closure user'ı yakalıyor, güncel değeri alamayabiliriz
            // Bu yüzden sadece optimisticAuth kontrolü yap
            if (!optimisticAuth) {
              console.log("⚠️ [ProtectedRoute] Recovery bitti, optimistic auth yok, biraz daha bekle...");
              // 2 saniye daha bekle - user state'i güncellensin
              setTimeout(() => {
                // Bu noktada component re-render olmuş olmalı
                // giveUpAndRedirect true yapmak yerine sessizce bekle
              }, 2000);
            }
          } else if (waitedMs >= maxWaitMs) {
            // Max bekleme doldu - AMA HALA REDIRECT YAPMA!
            clearInterval(recoveryCheckInterval);
            console.log("⚠️ [ProtectedRoute] 15sn doldu, recovery hala devam ediyor - LoadingScreen'de kalınacak");
            // 🛡️ KRİTİK: setGiveUpAndRedirect(true) YAPMA!
            // Kullanıcı LoadingScreen'de kalacak, Misafir olarak içeri alınmayacak
          }
        }, 1000);
        
        return; // Bu callback'ten çık, redirect YAPMA
      }
      
      // Recovery yok ve user/optimisticAuth da yok - artık redirect yapılabilir
      if (!user && !optimisticAuth) {
        console.log("⏰ [ProtectedRoute] 6sn zaman aşımı, recovery yok, /auth'a yönlendiriliyor...");
        setGiveUpAndRedirect(true);
      }
    }, 6000);

    return () => {
      clearTimeout(timeout);
      clearTimeout(optimisticTimeout);
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, [authLoading, user, optimisticAuth]);

  // Optimistic auth aktifken user gelirse
  useEffect(() => {
    if (user && optimisticAuth) {
      console.log("✅ [ProtectedRoute] Gerçek user geldi, optimistic auth kapatılıyor");
      setOptimisticAuth(false);
      setShowReconnectOverlay(false);
    }
  }, [user, optimisticAuth]);

  // 🆕 Auth recovery event'lerini dinle
  useEffect(() => {
    const handleRecoveryStart = () => {
      console.log("[ProtectedRoute] 🔄 Auth recovery başladı");
      isRecoveringRef.current = true;
    };
    
    const handleRecoveryEnd = () => {
      console.log("[ProtectedRoute] ✅ Auth recovery bitti");
      isRecoveringRef.current = false;
    };
    
    window.addEventListener('auth-recovery-start', handleRecoveryStart);
    window.addEventListener('auth-recovery-end', handleRecoveryEnd);
    
    return () => {
      window.removeEventListener('auth-recovery-start', handleRecoveryStart);
      window.removeEventListener('auth-recovery-end', handleRecoveryEnd);
    };
  }, []);

  // 🆕 OPTIMISTIC UI: İlk mount'ta hemen storage kontrol et
  useEffect(() => {
    const checkStorageImmediately = async () => {
      try {
        const cachedSession = await getCachedSession();
        if (cachedSession && cachedSession.expiresAt > Date.now()) {
          console.log("⚡ [ProtectedRoute] İlk mount - cached session bulundu, ANINDA optimistic");
          setOptimisticAuth(true);
        }
      } catch (e) {
        // Sessiz hata
      }
    };
    
    // Sadece user yoksa kontrol et
    if (!user) {
      checkStorageImmediately();
    }
  }, []); // Sadece mount'ta çalış

  // 🔧 1. USER VARSA - HEMEN children göster (en öncelikli)
  if (user) {
    return (
      <>
        {children}
        <ReconnectingOverlay 
          isVisible={showReconnectOverlay} 
          status="reconnecting"
        />
      </>
    );
  }

  // 2. İlk yükleme anı (user henüz gelmedi)
  if (authLoading || showLoadingLonger) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary"></div>
        <p className="mt-4 text-muted-foreground">Kelimele yükleniyor...</p>
      </div>
    );
  }

  // 3. Zaman aşımı olduysa ve optimistic auth da yoksa -> /auth'a git
  if (giveUpAndRedirect && !optimisticAuth) {
    console.log("🚪 [ProtectedRoute] Redirect to /auth");
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // 4. Optimistic auth aktifse - sayfayı göster ama overlay ekle
  if (optimisticAuth) {
    return (
      <>
        {children}
        <ReconnectingOverlay 
          isVisible={showReconnectOverlay} 
          status="restoring"
          message="Oturumunuz geri yükleniyor..."
        />
      </>
    );
  }

  // 5. User yok ama sistem bağlı - kısa süre bekle
  if (isSystemConnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          </div>
          <p className="text-primary font-medium animate-pulse">Bağlantı tazeleniyor...</p>
          <p className="text-xs text-muted-foreground">Oturumunuz güvenli bir şekilde korunuyor</p>
        </div>
      </div>
    );
  }

  // 6. Hiçbir koşul sağlanmadı - loading göster
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-primary"></div>
    </div>
  );
};

export default ProtectedRoute;
