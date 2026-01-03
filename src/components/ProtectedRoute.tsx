import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext"; // Native durumu için ekledik
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { Navigate, useLocation } from "react-router-dom";
import { ReactNode, useEffect, useState } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { isSystemConnected } = useUser();
  const location = useLocation();

  // Failsafe: Eğer Native bağlı kalsa ama JS kullanıcıyı bulamazsa takılı kalmamak için
  const [showLoadingLonger, setShowLoadingLonger] = useState(true);
  const [giveUpAndRedirect, setGiveUpAndRedirect] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (!authLoading) {
      // Auth yüklemesi bittikten yarım saniye sonra normal akışa geç
      timeout = setTimeout(() => setShowLoadingLonger(false), 500);
    }

    // KRİTİK: Eğer 5 saniye boyunca "Bağlantı tazeleniyor" ekranında kalırsak,
    // muhtemelen oturum gerçekten bitmiştir. Zorla yönlendir.
    const failsafeTimeout = setTimeout(() => {
      if (!user) {
        console.log("⏰ Zaman aşımı: Oturum bulunamadı, yönlendiriliyor...");
        setGiveUpAndRedirect(true);
      }
    }, 5000);

    return () => {
      clearTimeout(timeout);
      clearTimeout(failsafeTimeout);
    };
  }, [authLoading, user]);

  // 1. İlk yükleme anı
  if (authLoading || showLoadingLonger) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary"></div>
        <p className="mt-4 text-muted-foreground">Kelimele yükleniyor...</p>
      </div>
    );
  }

  // 2. Zaman aşımı olduysa veya kullanıcı kesinlikle yoksa ve sistem bağlı değilse
  if (giveUpAndRedirect || (!user && !isSystemConnected)) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // 3. Geçici kopma koruması: Kullanıcı saniyelik yok oldu ama Native hala bağlıysa
  // Bu blok artık ilk açılışta (initial boot) takılmayacak çünkü giveUpAndRedirect kontrolü var.
  if (!user && isSystemConnected) {
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

  // 4. Her şey tamam
  return <>{children}</>;
};

export default ProtectedRoute;
