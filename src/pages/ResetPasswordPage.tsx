// ResetPasswordPage.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";

const ResetPasswordPage = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Şifre Sıfırlama | Kelimele";

    // 🔹 Supabase PASSWORD_RECOVERY event'ini dinle
    // URL'deki token otomatik olarak session'a dönüştürülür
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[ResetPassword] Auth event:", event);
      
      if (event === "PASSWORD_RECOVERY") {
        console.log("[ResetPassword] ✅ Password recovery session hazır");
        setIsSessionReady(true);
        setSessionError(null);
      } else if (event === "SIGNED_IN" && session) {
        // Bazı durumlarda SIGNED_IN olarak da gelebilir
        console.log("[ResetPassword] ✅ Session aktif");
        setIsSessionReady(true);
        setSessionError(null);
      }
    });

    // 🔹 Mevcut session'ı kontrol et (sayfa yenilendiğinde)
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (session) {
        console.log("[ResetPassword] ✅ Mevcut session bulundu");
        setIsSessionReady(true);
      } else if (error) {
        console.log("[ResetPassword] ❌ Session hatası:", error.message);
        setSessionError("Oturum bulunamadı. Lütfen şifre sıfırlama linkini tekrar kullanın.");
      } else {
        // Session yok - URL'den token bekleniyor
        // Hash fragment'ı kontrol et
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const type = hashParams.get("type");
        
        if (type === "recovery" && accessToken) {
          console.log("[ResetPassword] 🔄 Recovery token bulundu, session oluşturuluyor...");
          // Supabase otomatik olarak session oluşturacak
        } else {
          // Query params da kontrol et
          const queryParams = new URLSearchParams(window.location.search);
          const code = queryParams.get("code");
          
          if (code) {
            console.log("[ResetPassword] 🔄 Recovery code bulundu");
            // exchangeCodeForSession otomatik çalışacak
          } else {
            setSessionError("Geçersiz veya süresi dolmuş link. Lütfen yeni bir şifre sıfırlama talebi oluşturun.");
          }
        }
      }
    };

    // Biraz bekle, Supabase URL'yi işlesin
    const timer = setTimeout(checkSession, 500);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({
        title: "Geçersiz Şifre",
        description: "Şifre en az 6 karakter olmalıdır.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Eşleşmeyen Şifreler",
        description: "Şifre ve doğrulama şifresi aynı olmalıdır.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    // 🔹 Supabase ile şifre güncelle (session zaten aktif)
    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      toast({
        title: "Hata",
        description: "Şifre güncellenemedi. Link süresi dolmuş olabilir.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Başarılı!",
      description: "Şifreniz güncellendi. Giriş yapabilirsiniz.",
    });

    // Çıkış yap ve login sayfasına yönlendir
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // Session hatası varsa
  if (sessionError) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 game-grid">
        <Card className="w-full max-w-md border-0 bg-card/50 backdrop-blur">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle>Link Geçersiz</CardTitle>
            <CardDescription>{sessionError}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full" 
              onClick={() => navigate("/auth")}
            >
              Giriş Sayfasına Dön
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  // Session hazır değilse loading göster
  if (!isSessionReady) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 game-grid">
        <Card className="w-full max-w-md border-0 bg-card/50 backdrop-blur">
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
              <p className="text-muted-foreground">Doğrulanıyor...</p>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 game-grid">
      <Card className="w-full max-w-md border-0 bg-card/50 backdrop-blur">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-primary" />
          </div>
          <CardTitle>Yeni Şifre Belirle</CardTitle>
          <CardDescription>
            Hesabınız için yeni bir şifre oluşturun
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Yeni Şifre</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Yeni Şifre (Tekrar)</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Güncelleniyor..." : "Şifreyi Güncelle"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
};

export default ResetPasswordPage;
