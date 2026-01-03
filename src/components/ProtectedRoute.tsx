import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext"; // Native durumu için ekledik
import { Navigate, useLocation } from "react-router-dom";
import { ReactNode, useEffect, useState } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { isSystemConnected } = useUser(); // Bizim ölümsüz bağlantı değişkenimiz
  const location = useLocation();
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Uygulama ilk açıldığında loading'i biraz beklet ki auth tam otursun
  useEffect(() => {
    if (!authLoading) {
      const timer = setTimeout(() => setIsInitialLoading(false), 500);
      return () => clearTimeout(timer);
    }
  }, [authLoading]);

  // 1. DURUM: Sistem henüz yükleniyorsa
  if (authLoading || isInitialLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-20 w-20 border-b-2 border-primary"></div>
        <p className="mt-4 text-muted-foreground animate-pulse">Oturum kontrol ediliyor...</p>
      </div>
    );
  }

  // 2. DURUM: KRİTİK NOKTA!
  // Eğer kullanıcı yoksa AMA Native kanal bağlıysa (isSystemConnected: true)
  // Seni hemen dışarı atmıyoruz, JS tarafının kendine gelmesini bekliyoruz.
  if (!user && isSystemConnected) {
    console.log("⚠️ ProtectedRoute: Kullanıcı saniyelik kayboldu ama Native bağlı. Bekleniyor...");
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="animate-pulse text-primary font-semibold">Bağlantı tazeleniyor...</div>
      </div>
    );
  }

  // 3. DURUM: Gerçekten kullanıcı yoksa VE bağlantı da koptuysa (60sn dolduysa)
  if (!user) {
    console.log("🚫 ProtectedRoute: Oturum ve bağlantı yok. Auth sayfasına yönlendiriliyor.");
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // 4. DURUM: Her şey yolunda, içeri gir kanka!
  return <>{children}</>;
};

export default ProtectedRoute;
