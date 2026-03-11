import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Preferences } from "@capacitor/preferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, EyeOff, Mail, Lock, User, CheckCircle2 } from "lucide-react";
import { useSounds } from "@/hooks/useSounds";
import kelimeleLogo from "/kelimeleLogo.png";

const AuthPage = () => {
  const navigate = useNavigate();
  const { signIn, signUp, resetPassword, user } = useAuth();
  const { toast } = useToast();
  const { playSound } = useSounds();

  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [signUpCooldown, setSignUpCooldown] = useState(0);

  const [signInData, setSignInData] = useState({
    email: "",
    password: "",
  });

  const [signUpData, setSignUpData] = useState({
    email: "",
    password: "",
    username: "",
  });

  // User varsa ana sayfaya yönlendir
  useEffect(() => {
    if (user) {
      console.log("[AuthPage] ✅ User detected, navigating to home...");
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  // Kayıtlı bilgileri yükle
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

  // Cooldown timer
  useEffect(() => {
    if (signUpCooldown <= 0) return;
    const timer = setInterval(() => {
      setSignUpCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [signUpCooldown]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    await Preferences.set({ key: "kelimele-saved-email", value: signInData.email });
    await Preferences.set({ key: "kelimele-saved-password", value: signInData.password });

    const { error } = await signIn(signInData.email, signInData.password);
    setLoading(false);

    if (!error) {
      console.log("[AuthPage] ✅ SignIn successful, navigating to home...");
      navigate("/", { replace: true });
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signUpCooldown > 0) return;
    setLoading(true);

    const { data: existingUser } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", signUpData.email)
      .maybeSingle();

    if (existingUser) {
      setLoading(false);
      toast({
        title: "Bu e-posta zaten kayıtlı",
        description: "Bu e-posta adresiyle zaten bir hesap mevcut. Lütfen giriş yapın.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await signUp(signUpData.email, signUpData.password, signUpData.username);
    setLoading(false);

    if (error) {
      if (error.message?.includes("rate") || error.message?.includes("429") || error.status === 429) {
        toast({
          title: "Çok Hızlı İstek",
          description: "Lütfen 60 saniye bekleyip tekrar deneyin.",
          variant: "destructive",
        });
        setSignUpCooldown(60);
      }
    } else {
      setRegisteredEmail(signUpData.email);
      setShowEmailConfirmation(true);
      setSignUpData({ email: "", password: "", username: "" });
      setSignUpCooldown(60);
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
    <div
      className="fixed inset-0 flex items-center justify-center overflow-hidden"
      style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}
    >
      {/* Arka plan ışık efekti */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none opacity-40" />

      {/* Ana kart */}
      <div className="relative z-10 w-full max-w-md mx-4 space-y-6">
        {/* Logo ve başlık */}
        <div className="text-center space-y-4">
          <div className="inline-block">
            <img src={kelimeleLogo} alt="Kelimele" className="w-24 h-24 rounded-3xl shadow-2xl ring-4 ring-white/10" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-widest">Kelimele</h1>
            <p className="text-xs text-slate-400 mt-1">Kelime oyununun en eğlenceli hali</p>
          </div>
        </div>

        {/* Form kartı */}
        <div className="bg-[#16213e]/90 ring-1 ring-white/10 rounded-3xl overflow-hidden shadow-2xl">
          {/* Tab başlıkları */}
          <div className="px-4 pt-5 pb-3 border-b border-white/5 flex gap-2">
            <button
              onClick={() => { playSound("buttonClick"); setActiveTab("signin"); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all
                ${
                  activeTab === "signin"
                    ? "bg-white/10 text-white ring-1 ring-white/20"
                    : "bg-transparent text-white/40 hover:text-white/60"
                }`}
            >
              Giriş Yap
            </button>
            <button
              onClick={() => { playSound("buttonClick"); setActiveTab("signup"); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all
                ${
                  activeTab === "signup"
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20"
                    : "bg-transparent text-white/40 hover:text-white/60"
                }`}
            >
              Kayıt Ol
            </button>
          </div>

          {/* ── GİRİŞ YAP ── */}
          {activeTab === "signin" && (
            <div className="px-5 py-5 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-5 bg-indigo-400 rounded-full" />
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Hoş Geldin</h2>
              </div>

              <form onSubmit={handleSignIn} className="space-y-3">
                {/* Email */}
                <div>
                  <Label htmlFor="signin-email" className="text-xs text-slate-400 mb-1.5 block">
                    E-posta
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="ornek@email.com"
                      value={signInData.email}
                      onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                      required
                      className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 rounded-xl h-11"
                    />
                  </div>
                </div>

                {/* Şifre */}
                <div>
                  <Label htmlFor="signin-password" className="text-xs text-slate-400 mb-1.5 block">
                    Şifre
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      id="signin-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={signInData.password}
                      onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                      required
                      className="pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 rounded-xl h-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Şifremi unuttum */}
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setResetDialogOpen(true)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Şifremi unuttum
                  </button>
                </div>

                {/* Giriş butonu */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20"
                >
                  {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
                </button>
              </form>
            </div>
          )}

          {/* ── KAYIT OL ── */}
          {activeTab === "signup" && (
            <div className="px-5 py-5 space-y-4">
              {showEmailConfirmation ? (
                // Email doğrulama ekranı
                <div className="text-center space-y-4 py-6">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-400/30 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase tracking-widest mb-2">
                      E-posta Doğrulama
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      <span className="text-amber-400 font-semibold">{registeredEmail}</span> adresine doğrulama linki
                      gönderdik.
                    </p>
                    <p className="text-xs text-slate-400 mt-2">Lütfen e-postanızı kontrol edin ve linke tıklayın.</p>
                    <p className="text-[10px] text-slate-500 mt-1">(Spam klasörünü de kontrol edin)</p>
                  </div>
                  <button
                    onClick={() => setShowEmailConfirmation(false)}
                    className="w-full py-3 rounded-xl bg-white/8 ring-1 ring-white/10 text-white font-semibold text-sm hover:bg-white/12 transition-all active:scale-95"
                  >
                    Yeni Kayıt Yap
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1 h-5 bg-amber-400 rounded-full" />
                    <h2 className="text-sm font-black text-white uppercase tracking-widest">Hesap Oluştur</h2>
                  </div>

                  <form onSubmit={handleSignUp} className="space-y-3">
                    {/* Kullanıcı adı */}
                    <div>
                      <Label htmlFor="signup-username" className="text-xs text-slate-400 mb-1.5 block">
                        Kullanıcı Adı
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input
                          id="signup-username"
                          type="text"
                          placeholder="Kullanıcı Adı"
                          value={signUpData.username}
                          onChange={(e) => setSignUpData({ ...signUpData, username: e.target.value })}
                          required
                          className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 rounded-xl h-11"
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <Label htmlFor="signup-email" className="text-xs text-slate-400 mb-1.5 block">
                        E-posta
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="ornek@email.com"
                          value={signUpData.email}
                          onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                          required
                          className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 rounded-xl h-11"
                        />
                      </div>
                    </div>

                    {/* Şifre */}
                    <div>
                      <Label htmlFor="signup-password" className="text-xs text-slate-400 mb-1.5 block">
                        Şifre
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input
                          id="signup-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={signUpData.password}
                          onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                          required
                          className="pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 rounded-xl h-11"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Kayıt butonu */}
                    <button
                      type="submit"
                      disabled={loading || signUpCooldown > 0}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-sm uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20"
                    >
                      {loading
                        ? "Kayıt olunuyor..."
                        : signUpCooldown > 0
                          ? `Bekleyin (${signUpCooldown}s)`
                          : "Kayıt Ol"}
                    </button>
                  </form>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── ŞİFRE SIFIRLAMA DİALOG ── */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
             w-[calc(100%-2rem)] max-w-sm rounded-3xl border-0 p-0 
             shadow-2xl bg-[#16213e] ring-1 ring-white/10"
        >
          <div className="px-5 pt-6 pb-4 border-b border-white/5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-5 bg-red-400 rounded-full" />
              <h2 className="text-sm font-black text-white uppercase tracking-widest">Şifre Sıfırlama</h2>
            </div>
            <p className="text-[11px] text-slate-400 ml-3">E-posta adresinize şifre sıfırlama linki göndereceğiz.</p>
          </div>
          <form onSubmit={handleResetPassword} className="px-5 py-4 space-y-3">
            <div>
              <Label htmlFor="reset-email" className="text-xs text-slate-400 mb-1.5 block">
                E-posta
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="ornek@email.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 rounded-xl h-11"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={resetLoading}
              className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-red-600/20"
            >
              {resetLoading ? "Gönderiliyor..." : "Sıfırlama Linki Gönder"}
            </button>
          </form>
          <div className="h-2" />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuthPage;
