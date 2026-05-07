import { useState } from "react";
import Lottie from "lottie-react";
import aiRobotAnim from "@/assets/aiRobot.json";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Camera, Bell, Shield, CheckCircle2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
// SafePushNotifications artık kullanılmıyor — doğrudan Capacitor plugin kullanılıyor
import nativeStorage from "@/utils/nativeStorage";
import { getValidFcmToken, isApnsTokenFormat } from "@/utils/pushToken";

const getCapacitorCamera = async () => {
  try {
    const module = await import("@capacitor/camera");
    return module.Camera;
  } catch (error) {
    console.log("Camera plugin yüklenemedi:", error);
    return null;
  }
};

interface OnboardingPermissionsProps {
  open: boolean;
  onComplete: () => void;
  onShowIntro?: () => void;
}

export const OnboardingPermissions = ({ open, onComplete, onShowIntro }: OnboardingPermissionsProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [kvkkAccepted, setKvkkAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState({
    notifications: false,
    camera: false,
  });

  const { user } = useAuth();
  const isMobile = Capacitor.getPlatform() !== "web";

  const steps = [
    {
      title: "Gizlilik & KVKK",
      description: "Kişisel verilerinizin korunması",
      icon: Shield,
      content: (
        <div className="space-y-4">
          <div
            className="max-h-52 overflow-y-auto p-4 rounded-2xl text-sm space-y-3"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <h4 className="font-semibold text-white/90">Kişisel Verilerin Korunması</h4>
            <p className="text-white/55 leading-relaxed">
              Kelimele uygulaması, 6698 sayılı KVKK kapsamında kişisel verilerinizin korunmasına önem vermektedir.
            </p>

            <h4 className="font-semibold text-white/90">Toplanan Veriler</h4>
            <ul className="text-white/55 space-y-1 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-0.5">›</span> E-posta adresi
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-0.5">›</span> Kullanıcı adı ve profil bilgileri
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-0.5">›</span> Oyun istatistikleri ve başarılar
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-0.5">›</span> Cihaz bilgileri
              </li>
            </ul>

            <h4 className="font-semibold text-white/90">Verilerin Kullanımı</h4>
            <ul className="text-white/55 space-y-1 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-0.5">›</span> Oyun deneyiminizi kişiselleştirmek
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-0.5">›</span> Hesap güvenliğinizi sağlamak
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-0.5">›</span> Liderlik tabloları oluşturmak
              </li>
            </ul>

            <h4 className="font-semibold text-white/90">Veri Güvenliği</h4>
            <p className="text-white/55 leading-relaxed">
              Tüm verileriniz şifrelenerek güvenli sunucularda saklanır. Üçüncü taraflarla paylaşılmaz ve satılmaz.
            </p>

            <p className="text-xs text-white/30 pt-2">İletişim: info@kelimele.site</p>
          </div>

          <div
            className="flex items-start gap-3 p-4 rounded-2xl cursor-pointer transition-all active:scale-[0.98]"
            style={{
              background: kvkkAccepted ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.04)",
              border: kvkkAccepted ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.08)",
            }}
            onClick={() => setKvkkAccepted(!kvkkAccepted)}
          >
            <Checkbox
              id="kvkk"
              checked={kvkkAccepted}
              onCheckedChange={(checked) => setKvkkAccepted(!!checked)}
              className="mt-0.5 border-white/30 data-[state=checked]:bg-indigo-500 data-[state=checked]:border-indigo-500"
            />
            <label htmlFor="kvkk" className="text-sm text-white/70 cursor-pointer select-none leading-relaxed">
              KVKK metnini okudum, anladım ve kişisel verilerimin işlenmesine onay veriyorum.
            </label>
          </div>
        </div>
      ),
    },
    {
      title: "İzinler",
      description: "Uygulama özelliklerini kullanabilmek için",
      icon: Bell,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-white/50 leading-relaxed">
            Kelimele'nin tüm özelliklerinden faydalanabilmek için aşağıdaki izinlere ihtiyacımız var:
          </p>

          <div className="space-y-3">
            {/* Bildirim İzni */}
            <div
              className="p-4 rounded-2xl flex items-center justify-between transition-all"
              style={{
                background: permissionsGranted.notifications ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.04)",
                border: permissionsGranted.notifications
                  ? "1px solid rgba(34,197,94,0.25)"
                  : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(99,102,241,0.15)" }}
                >
                  <Bell className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="font-semibold text-white/90 text-sm">Bildirimler</p>
                  <p className="text-xs text-white/45">Oyun davetleri ve güncellemeler</p>
                </div>
              </div>
              {permissionsGranted.notifications && <CheckCircle2 className="w-5 h-5 text-green-400" />}
            </div>

            {/* Kamera İzni */}
            <div
              className="p-4 rounded-2xl flex items-center justify-between transition-all"
              style={{
                background: permissionsGranted.camera ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.04)",
                border: permissionsGranted.camera
                  ? "1px solid rgba(34,197,94,0.25)"
                  : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(99,102,241,0.15)" }}
                >
                  <Camera className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="font-semibold text-white/90 text-sm">Kamera & Galeri</p>
                  <p className="text-xs text-white/45">Profil fotoğrafı için</p>
                </div>
              </div>
              {permissionsGranted.camera && <CheckCircle2 className="w-5 h-5 text-green-400" />}
            </div>
          </div>

          <p className="text-xs text-white/30">* İzinleri daha sonra ayarlardan değiştirebilirsiniz</p>
        </div>
      ),
    },
  ];

  const savePushToken = async (userId: string, token: string) => {
    const safeToken = getValidFcmToken(token);

    if (!safeToken) {
      console.warn(
        isApnsTokenFormat(token)
          ? "⚠️ [Onboarding] APNs token geldi, profile kaydedilmedi"
          : "⚠️ [Onboarding] Geçersiz push token geldi, profile kaydedilmedi",
      );
      return false;
    }

    try {
      const { error } = await supabase.from("profiles").update({ push_token: safeToken }).eq("id", userId);

      if (error) {
        await nativeStorage.setJSON("push_token_pending", { token: safeToken });
        localStorage.setItem("push_token_pending", JSON.stringify({ token: safeToken }));
        return false;
      }

      await nativeStorage.removeItem("push_token_pending");
      localStorage.removeItem("push_token_pending");
      return true;
    } catch (error) {
      console.error("Push token kaydetme hatası:", error);
      await nativeStorage.setJSON("push_token_pending", { token: safeToken });
      localStorage.setItem("push_token_pending", JSON.stringify({ token: safeToken }));
      return false;
    }
  };

  const requestPermissions = async () => {
    const granted = { notifications: false, camera: false };

    if (isMobile) {
      try {
        // 🔥 FIX: SafePushNotifications yerine doğrudan Capacitor plugin kullan
        // SafePushNotifications ayrı module cache'i ile çakışma yaratıyordu
        const { PushNotifications } = await import("@capacitor/push-notifications");
        
        // Önce izin durumunu kontrol et — iOS'ta sadece "prompt" ise dialog açılır
        const currentStatus = await PushNotifications.checkPermissions();
        console.log("📱 [Onboarding] Mevcut izin durumu:", currentStatus.receive);
        
        if (currentStatus.receive === "granted") {
          // Zaten izin var, sadece register yap
          granted.notifications = true;
          console.log("✅ [Onboarding] Push izni zaten granted");
        } else if (currentStatus.receive === "prompt" || currentStatus.receive === "prompt-with-rationale") {
          // İzin iste — iOS native dialog burada açılacak
          console.log("📱 [Onboarding] iOS bildirim izni isteniyor...");
          const result = await PushNotifications.requestPermissions();
          console.log("📱 [Onboarding] İzin sonucu:", result.receive);
          granted.notifications = result.receive === "granted";
        } else {
          console.log("❌ [Onboarding] Push izni denied durumunda");
        }

        if (granted.notifications) {
          // Listener'ları ekle
          await PushNotifications.addListener("registration", async (token: { value?: string }) => {
            const safeToken = getValidFcmToken(token?.value);
            if (!safeToken) {
              console.warn(
                isApnsTokenFormat(token?.value)
                  ? "⚠️ [Onboarding] Registration APNs token döndürdü, FCM bekleniyor"
                  : "⚠️ [Onboarding] Registration geçersiz token döndürdü",
              );
              return;
            }
            console.log("✅ [Onboarding] FCM token alındı:", safeToken.substring(0, 30) + "...");
            if (user?.id) {
              await savePushToken(user.id, safeToken);
            } else {
              await nativeStorage.setJSON("push_token_pending", { token: safeToken });
            }
          });

          await PushNotifications.addListener("registrationError", (error: any) => {
            console.error("❌ [Onboarding] Push registration hatası:", error?.error ?? error);
          });

          await PushNotifications.register();
          console.log("✅ [Onboarding] Push notifications registered successfully");
        }
      } catch (err) {
        console.error("Bildirim izni hatası:", err);
      }
    } else if ("Notification" in window) {
      try {
        const permission = await Notification.requestPermission();
        granted.notifications = permission === "granted";
      } catch (err) {
        console.error("Web bildirim izni hatası:", err);
      }
    }

    if (isMobile) {
      try {
        const CapacitorCamera = await getCapacitorCamera();
        if (CapacitorCamera) {
          const permission = await CapacitorCamera.requestPermissions();
          granted.camera = permission.camera === "granted";
        }
      } catch (err) {
        console.error("Kamera izni hatası:", err);
      }
    }

    setPermissionsGranted(granted);
    return granted;
  };

  const handleNext = async () => {
    if (currentStep === 0) {
      if (!kvkkAccepted) {
        toast.error("Devam etmek için KVKK metnini kabul etmelisiniz");
        return;
      }
      setCurrentStep(1);
    } else if (currentStep === 1) {
      setIsLoading(true);
      try {
        const permissionPromise = requestPermissions();
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 8000));
        await Promise.race([permissionPromise, timeoutPromise]);

        localStorage.setItem("kelimeci-permissions-completed", "true");
        const settings = JSON.parse(localStorage.getItem("kelimeci-settings") || "{}");
        settings.notifications = true;
        localStorage.setItem("kelimeci-settings", JSON.stringify(settings));

        window.dispatchEvent(new Event("permissionsCompleted"));
        toast.success("Kurulum tamamlandı! Hoş geldiniz 🎉");
      } catch (error) {
        localStorage.setItem("kelimeci-permissions-completed", "true");
        toast.info("Kurulum tamamlandı.");
      } finally {
        setIsLoading(false);
        onComplete();
        const introCompleted = localStorage.getItem("kelimeci-intro-completed");
        if (onShowIntro && !introCompleted) {
          setTimeout(() => onShowIntro(), 400);
        }
      }
    }
  };

  const handleSkip = () => {
    localStorage.setItem("kelimeci-permissions-completed", "true");
    toast.info("Kurulumu atladınız. İzinleri ayarlardan verebilirsiniz.");
    onComplete();
    const introCompleted = localStorage.getItem("kelimeci-intro-completed");
    if (onShowIntro && !introCompleted) {
      setTimeout(() => onShowIntro(), 400);
    }
  };

  const CurrentIcon = steps[currentStep].icon;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-sm w-[calc(100%-2rem)] rounded-3xl border-0 p-0 shadow-2xl overflow-hidden"
        style={{
          background: "linear-gradient(145deg, #0f1729 0%, #1a1a2e 50%, #16213e 100%)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.07)",
        }}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Glow efekti */}
        <div
          className="absolute -top-20 -right-20 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)" }}
        />

        {/* Header */}
        <div className="relative z-10 px-6 pt-7 pb-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.3)" }}
            >
              <CurrentIcon className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-white leading-tight">{steps[currentStep].title}</h2>
              <p className="text-xs text-white/40">{steps[currentStep].description}</p>
            </div>
            <div className="shrink-0 -mr-2 -mt-2 pointer-events-none">
              <Lottie animationData={aiRobotAnim} loop autoplay style={{ width: 64, height: 64 }} />
            </div>
          </div>
        </div>

        {/* İçerik */}
        <div className="relative z-10 px-6 py-5">{steps[currentStep].content}</div>

        {/* Footer */}
        <div
          className="relative z-10 px-6 pb-6 pt-4 flex items-center justify-between"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <button
            onClick={handleSkip}
            className="text-sm text-white/35 hover:text-white/60 transition-colors px-2 py-1"
          >
            Atla
          </button>

          <div className="flex items-center gap-2">
            {/* Adım göstergesi */}
            <div className="flex gap-1.5 mr-3">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: index === currentStep ? "16px" : "6px",
                    height: "6px",
                    background: index === currentStep ? "#6366f1" : "rgba(255,255,255,0.2)",
                  }}
                />
              ))}
            </div>

            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white/60 hover:text-white/90 transition-colors"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                Geri
              </button>
            )}

            <button
              onClick={handleNext}
              disabled={(currentStep === 0 && !kvkkAccepted) || isLoading}
              className="px-5 py-2 rounded-xl text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-40"
              style={{
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                boxShadow: "0 4px 15px rgba(99,102,241,0.35)",
              }}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Yükleniyor
                </span>
              ) : currentStep === steps.length - 1 ? (
                "Tamamla"
              ) : (
                "İleri"
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
