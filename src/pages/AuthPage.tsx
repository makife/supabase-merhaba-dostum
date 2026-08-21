import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, EyeOff, Mail, Lock, User, CheckCircle2 } from "lucide-react";
import { useSounds } from "@/hooks/useSounds";
import { checkUsernameAvailable, usernameErrorMessage } from "@/utils/usernameValidation";
import kelimeleLogo from "/kelimeleLogo.webp";

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

    // Username (rumuz) doğrulaması: benzersizlik (büyük/küçük harf duyarsız) + banlist
    const usernameCheck = await checkUsernameAvailable(signUpData.username);
    if (usernameCheck !== "ok") {
      setLoading(false);
      toast({
        title: "Geçersiz Rumuz",
        description: usernameErrorMessage(usernameCheck) ?? "Lütfen başka bir rumuz deneyin.",
        variant: "destructive",
      });
      return;
    }


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

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const isNative = Capacitor.isNativePlatform();
      const redirectUrl = isNative ? "kelimele://auth/callback" : window.location.origin;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: isNative,
        },
      });
      if (error) {
        toast({ title: "Google Giriş Hatası", description: error.message, variant: "destructive" });
        return;
      }
      if (isNative && data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast({ title: "Google Giriş Hatası", description: err?.message || "Bir hata oluştu", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setLoading(true);
    try {
      const isNative = Capacitor.isNativePlatform();
      const redirectUrl = isNative ? "kelimele://auth/callback" : window.location.origin;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: isNative,
        },
      });
      if (error) {
        toast({ title: "Apple Giriş Hatası", description: error.message, variant: "destructive" });
        return;
      }
      if (isNative && data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast({ title: "Apple Giriş Hatası", description: err?.message || "Bir hata oluştu", variant: "destructive" });
    } finally {
      setLoading(false);
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
              onClick={() => {
                playSound("buttonClick");
                setActiveTab("signin");
              }}
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
              onClick={() => {
                playSound("buttonClick");
                setActiveTab("signup");
              }}
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
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20 flex items-center justify-center"
                >
                  <span className="flex items-center justify-center gap-2">
                    {!loading && (
                      <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512">
                        <path style={{fill:"#687F82"}} d="M282.524,7.887C205.947,8.327,144.559,71.61,144.559,148.188v36.322h42.053v-36.615c0-53.25,42.52-97.436,95.768-97.952c53.769-0.52,97.677,43.068,97.677,96.719v75.193c0,11.402,8.866,21.112,20.26,21.517c11.962,0.425,21.793-9.146,21.793-21.013v-75.696C422.111,69.87,359.417,7.446,282.524,7.887z"/>
                        <path style={{fill:"#4ACFD9"}} d="M464.164,504.115H102.505V253.897c0-17.419,14.12-31.54,31.54-31.54h298.579c17.419,0,31.54,14.122,31.54,31.54V504.115z"/>
                        <g>
                          <path style={{fill:"#FFD1A9"}} d="M359.031,432.624c0-41.805-33.891-75.696-75.696-75.696s-75.696,33.891-75.696,75.696v42.053h151.392V432.624z"/>
                          <circle style={{fill:"#FFD1A9"}} cx="283.335" cy="298.053" r="46.259"/>
                        </g>
                        <path style={{fill:"#0295AA"}} d="M134.045,222.357c-17.42,0-31.54,14.12-31.54,31.54v250.218h180.83V222.357H134.045z"/>
                        <g>
                          <path style={{fill:"#FF8C29"}} d="M207.639,432.624v42.053h75.696v-117.75C241.528,356.928,207.639,390.819,207.639,432.624z"/>
                          <path style={{fill:"#FF8C29"}} d="M237.076,298.053c0,25.548,20.71,46.259,46.259,46.259v-92.517C257.786,251.795,237.076,272.505,237.076,298.053z"/>
                        </g>
                        <g>
                          <path style={{fill:"#FFFFFF"}} d="M422.111,390.045c-4.355,0-7.885-3.53-7.885-7.885V277.027c0-4.355,3.53-7.885,7.885-7.885c4.355,0,7.885,3.53,7.885,7.885V382.16C429.996,386.515,426.466,390.045,422.111,390.045z"/>
                          <path style={{fill:"#FFFFFF"}} d="M422.111,461.536c-4.355,0-7.885-3.53-7.885-7.885v-42.053c0-4.355,3.53-7.885,7.885-7.885c4.355,0,7.885,3.53,7.885,7.885v42.053C429.996,458.006,426.466,461.536,422.111,461.536z"/>
                        </g>
                        <g>
                          <path style={{fill:"#F0353D"}} d="M80.546,191.075h-32.71c-4.355,0-7.885-3.53-7.885-7.885s3.53-7.885,7.885-7.885h32.71c4.355,0,7.885,3.53,7.885,7.885S84.901,191.075,80.546,191.075z"/>
                          <path style={{fill:"#F0353D"}} d="M89.678,164.312c-2.018,0-4.036-0.77-5.575-2.31l-20.815-20.815c-3.079-3.079-3.079-8.072,0-11.152s8.072-3.079,11.15,0l20.815,20.815c3.079,3.079,3.079,8.072,0,11.152C93.714,163.542,91.695,164.312,89.678,164.312z"/>
                          <path style={{fill:"#F0353D"}} d="M68.651,238.653c-2.018,0-4.036-0.77-5.575-2.31c-3.079-3.079-3.079-8.072,0-11.15l20.815-20.815c3.079-3.079,8.072-3.079,11.15,0c3.079,3.079,3.079,8.072,0,11.15l-20.815,20.815C72.687,237.883,70.669,238.653,68.651,238.653z"/>
                        </g>
                        <path d="M432.624,214.472h-2.628v-67.811c0-39.275-15.378-76.194-43.302-103.959C358.977,15.144,322.305,0,283.343,0c-0.287,0-0.576,0.001-0.864,0.002C202.081,0.464,136.674,66.94,136.674,148.188v36.322c0,4.355,3.53,7.885,7.885,7.885h42.053c4.355,0,7.885-3.53,7.885-7.885v-36.615c0-49.193,39.459-89.597,87.96-90.067c23.882-0.187,46.361,8.91,63.356,25.741c16.998,16.835,26.36,39.241,26.36,63.093v67.811H134.045c-21.74,0-39.425,17.686-39.425,39.425v250.218c0,4.355,3.53,7.885,7.885,7.885h361.659c4.355,0,7.885-3.53,7.885-7.885V253.897C472.049,232.158,454.364,214.472,432.624,214.472z M356.909,72.363c-20.009-19.816-46.504-30.609-74.605-30.305c-57.113,0.554-103.577,48.031-103.577,105.836v28.73h-26.283v-28.437c0-72.602,58.374-132.003,130.126-132.416c0.259-0.001,0.512-0.002,0.771-0.002c34.765,0,67.497,13.519,92.235,38.115c24.924,24.782,38.651,57.731,38.651,92.776v67.811h-26.283v-67.811C387.943,118.568,376.921,92.182,356.909,72.363z M456.279,496.23H110.39V253.897c0-13.044,10.611-23.655,23.655-23.655h246.037h42.029h10.513c13.044,0,23.655,10.611,23.655,23.655V496.23z"/>
                        <path d="M297.578,350.283c22.964-6.271,39.9-27.304,39.9-52.229c0-29.855-24.289-54.144-54.144-54.144c-29.855,0-54.144,24.289-54.144,54.144c0,24.925,16.936,45.958,39.9,52.229c-39.322,6.783-69.338,41.112-69.338,82.342v42.053c0,4.355,3.53,7.885,7.885,7.885h151.392c4.355,0,7.885-3.53,7.885-7.885v-42.053C366.916,391.395,336.9,357.066,297.578,350.283z M244.961,298.053c0-21.159,17.215-38.374,38.374-38.374s38.374,17.215,38.374,38.374c0,21.159-17.215,38.374-38.374,38.374S244.961,319.213,244.961,298.053z M351.146,466.793H215.524v-34.168c0-37.391,30.42-67.811,67.811-67.811s67.811,30.42,67.811,67.811V466.793z"/>
                      </svg>
                    )}
                    {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
                  </span>
                </button>
              </form>

              {/* Ayırıcı */}
              <div className="flex items-center gap-3 px-1">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">veya</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Google ile giriş */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 ring-1 ring-white/10 text-white font-bold text-base transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google ile Giriş Yap
              </button>

              {/* Apple ile giriş - sadece iOS ve web'de göster */}
              {Capacitor.getPlatform() !== 'android' && (
                <button
                  type="button"
                  onClick={handleAppleSignIn}
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 ring-1 ring-white/10 text-white font-bold text-base transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                  </svg>
                  Apple ile Giriş Yap
                </button>
              )}
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
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-sm uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                    >
                      {!loading && signUpCooldown === 0 && (
                        <svg className="w-5 h-5" viewBox="0 0 24 24" version="1.1" xmlns="http://www.w3.org/2000/svg">
                          <g transform="translate(0 -1028.4)">
                            <path d="m22 12c0 5.523-4.477 10-10 10-5.5228 0-10-4.477-10-10 0-5.5228 4.4772-10 10-10 5.523 0 10 4.4772 10 10z" transform="translate(0 1029.4)" fill="#27ae60"/>
                            <path d="m22 12c0 5.523-4.477 10-10 10-5.5228 0-10-4.477-10-10 0-5.5228 4.4772-10 10-10 5.523 0 10 4.4772 10 10z" transform="translate(0 1028.4)" fill="#2ecc71"/>
                            <path d="m6.0001 1042.4h4.9999v5h2v-5h5v-2h-5v-5h-2v5h-4.9999v2z" fill="#27ae60"/>
                            <path d="m6 1041.4h5v5h2v-5h5v-2h-5v-5h-2v5h-5v2z" fill="#ecf0f1"/>
                          </g>
                        </svg>
                      )}
                      {loading
                        ? "Kayıt olunuyor..."
                        : signUpCooldown > 0
                          ? `Bekleyin (${signUpCooldown}s)`
                          : "Kayıt Ol"}
                    </button>
                  </form>

                  {/* Ayırıcı */}
                  <div className="flex items-center gap-3 px-1">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">veya</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>

                  {/* Google ile kayıt */}
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 ring-1 ring-white/10 text-white font-bold text-base transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Google ile Kayıt Ol
                  </button>

                  {/* Apple ile kayıt - sadece iOS ve web'de göster */}
                  {Capacitor.getPlatform() !== 'android' && (
                    <button
                      type="button"
                      onClick={handleAppleSignIn}
                      disabled={loading}
                      className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 ring-1 ring-white/10 text-white font-bold text-base transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                      </svg>
                      Apple ile Kayıt Ol
                    </button>
                  )}
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
