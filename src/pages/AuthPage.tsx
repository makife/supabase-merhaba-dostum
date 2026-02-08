// AuthPage.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Preferences } from "@capacitor/preferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, Mail, CheckCircle } from "lucide-react";
import { HeaderAnimation } from "@/components/HeaderAnimation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const AuthPage = () => {
  const navigate = useNavigate();
  const { signIn, signUp, resetPassword, user } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  // 🔧 Email'i Preferences'dan yükle
  const [signInData, setSignInData] = useState({
    email: "",
    password: "",
  });

  // 🔥 User değişince ana sayfaya yönlendir (giriş başarılı)
  useEffect(() => {
    if (user) {
      console.log("[AuthPage] ✅ User detected, navigating to home...");
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  // İlk yüklemede kayıtlı bilgileri al
  useEffect(() => {
    const loadSavedCredentials = async () => {
      const { value: savedEmail } = await Preferences.get({ key: "kelimele-saved-email" });
      const { value: savedPassword } = await Preferences.get({ key: "kelimele-saved-password" });
      if (savedEmail || savedPassword) {
        setSignInData({
          email: savedEmail || "",
          password: savedPassword || "",
        });
      }
    };
    loadSavedCredentials();
  }, []);

  const [signUpData, setSignUpData] = useState({
    email: "",
    password: "",
    username: "",
  });

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // 🔧 Giriş bilgilerini Preferences'a kaydet
    await Preferences.set({ key: "kelimele-saved-email", value: signInData.email });
    await Preferences.set({ key: "kelimele-saved-password", value: signInData.password });

    const { error } = await signIn(signInData.email, signInData.password);
    setLoading(false);

    // 🔥 Hata yoksa direkt yönlendir (useEffect yedeği)
    if (!error) {
      console.log("[AuthPage] ✅ SignIn successful, navigating to home...");
      navigate("/", { replace: true });
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signUp(signUpData.email, signUpData.password, signUpData.username);
    setLoading(false);

    if (!error) {
      setRegisteredEmail(signUpData.email);
      setShowEmailConfirmation(true);
      setSignUpData({ email: "", password: "", username: "" });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    const { error } = await resetPassword(resetEmail);
    setResetLoading(false);

    if (!error) {
      setResetDialogOpen(false);
      setResetEmail("");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 game-grid touch-none overscroll-none">
      <div className="w-full max-w-md space-y-6 bounce-in touch-auto overscroll-auto">
        <Card className="border-0 bg-card/50 backdrop-blur relative overflow-hidden">
          <HeaderAnimation />

          <div className="text-center space-y-2 p-6 relative z-10">
            <h1
              className="text-3xl font-bold font-bungee tracking-wider uppercase bg-gradient-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent drop-shadow-2xl"
              style={{
                textShadow:
                  "1px 1px 0px hsl(var(--primary)), 2px 2px 0px rgba(0,0,0,0.3), 0 0 15px hsl(var(--primary) / 0.5)",
                WebkitTextStroke: "0.5px hsl(var(--border))",
              }}
            >
              KELİMELE
            </h1>
            <p className="text-muted-foreground font-medium">Kelime oyununun en eğlenceli hali</p>
          </div>
        </Card>

        <Card className="border-0 bg-card/50 backdrop-blur">
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Giriş Yap</TabsTrigger>
              <TabsTrigger
                value="signup"
                className="
    transition-all
    data-[state=active]:bg-gradient-to-r
    data-[state=active]:from-purple-600
    data-[state=active]:to-indigo-600
    data-[state=active]:text-white
    data-[state=active]:shadow-md
  "
              >
                Kayıt Ol
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <CardHeader>
                <CardTitle>Giriş Yap</CardTitle>
                <CardDescription>E-posta adresiniz ve şifrenizle giriş yapın</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">E-posta</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="ornek@email.com"
                      value={signInData.email}
                      onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Şifre</Label>
                    <div className="relative">
                      <Input
                        id="signin-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={signInData.password}
                        onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                        required
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

                  <div className="text-right">
                    <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                      <DialogTrigger asChild>
                        <Button
                          type="button"
                          variant="link"
                          className="px-0 text-sm text-muted-foreground hover:text-primary"
                        >
                          Şifremi unuttum
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Şifre Sıfırlama</DialogTitle>
                          <DialogDescription>E-posta adresinize şifre sıfırlama linki göndereceğiz.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleResetPassword} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="reset-email">E-posta</Label>
                            <Input
                              id="reset-email"
                              type="email"
                              placeholder="ornek@email.com"
                              value={resetEmail}
                              onChange={(e) => setResetEmail(e.target.value)}
                              required
                            />
                          </div>
                          <Button type="submit" className="w-full" disabled={resetLoading}>
                            {resetLoading ? "Gönderiliyor..." : "Şifre Sıfırlama Linki Gönder"}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
                  </Button>
                </form>
              </CardContent>
            </TabsContent>

            <TabsContent value="signup">
              <CardHeader>
                {" "}
                <CardTitle>Kayıt Ol</CardTitle>{" "}
                <CardDescription>Yeni bir hesap oluşturun ve oyuna başlayın</CardDescription>{" "}
              </CardHeader>
              <CardContent>
                {showEmailConfirmation ? (
                  <div className="text-center space-y-4 py-4">
                    <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
                      <Mail className="w-8 h-8 text-green-500" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-foreground">E-posta Doğrulama Gerekli!</h3>
                      <p className="text-muted-foreground text-sm">
                        <span className="font-medium text-primary">{registeredEmail}</span> adresine bir doğrulama linki
                        gönderdik.
                      </p>
                      <p className="text-muted-foreground text-sm">
                        Lütfen e-postanızı kontrol edin ve linke tıklayarak hesabınızı doğrulayın. Ardından giriş
                        yapabilirsiniz.
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-2">(Spam/Gereksiz klasörünü de kontrol edin)</p>
                    </div>
                    <Button variant="outline" className="w-full" onClick={() => setShowEmailConfirmation(false)}>
                      Yeni Kayıt Yap
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-username">Kullanıcı Adı</Label>
                      <Input
                        id="signup-username"
                        type="text"
                        placeholder="kullaniciadi"
                        value={signUpData.username}
                        onChange={(e) => setSignUpData({ ...signUpData, username: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">E-posta</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="ornek@email.com"
                        value={signUpData.email}
                        onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Şifre</Label>
                      <div className="relative">
                        <Input
                          id="signup-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={signUpData.password}
                          onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                          required
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
                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                      disabled={loading}
                    >
                      {loading ? "Kayıt olunuyor..." : "Kayıt Ol"}
                    </Button>
                  </form>
                )}
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

export default AuthPage;
