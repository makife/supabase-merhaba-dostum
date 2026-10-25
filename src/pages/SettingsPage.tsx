import { MusicPackSelector } from "@/components/MusicPackSelector";
import { usePageSwipeNav } from "@/hooks/usePageSwipeNav";
import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { useSounds } from "@/hooks/useSounds";
import { useMusic } from "@/contexts/MusicContext";
import { useUserPurchases } from "@/hooks/useUserPurchases";
import { nativeStorage, STORAGE_KEYS } from "@/utils/nativeStorage";
import { ContactDialog } from "@/components/ContactDialog";
import { useExitGameConfirm } from "@/hooks/useExitGameConfirm";
import { showSignedOutCard } from "@/components/SignedOutOverlay";
import DeleteAccountCardDialog from "@/components/DeleteAccountCardDialog";
import {
  ArrowLeft,
  Bell,
  Info,
  Shield,
  HelpCircle,
  Mail,
  Smartphone,
  PlayCircle,
  ShieldCheck,
  Settings,
  Trash2,
  AlertTriangle,
  Music,
  Volume,
  Gamepad2,
  LogOut,
} from "lucide-react";
import { triggerGlobalStorageClear } from "@/hooks/useLocalStorageClear";
import { useMobileNotifications } from "@/hooks/useMobileNotifications";

// ─── OS uygulama ayarlarını açar (capacitor-native-settings gerektirmez) ───
const openAppSettings = async () => {
  try {
    const { Capacitor } = await import("@capacitor/core");
    const platform = Capacitor.getPlatform();
    if (platform === "android") {
      const { App } = await import("@capacitor/app");
      const info = await App.getInfo();
      window.open(`package:${info.id}`, "_system");
    } else if (platform === "ios") {
      window.open("app-settings:", "_system");
    }
  } catch (e) {
    console.error("Ayarlar açılamadı:", e);
  }
};

const SettingsPage = () => {
  const navigate = useNavigate();
  const { containerRef: swipeRef, swipeHandlers } = usePageSwipeNav({ route: "/settings" });
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const { requestExit: requestSignOut, ExitConfirmDialog: SignOutConfirmDialog } = useExitGameConfirm();
  const { theme, setTheme } = useTheme();
  const { soundsEnabled, setSoundsEnabled, playSound } = useSounds();
  const { musicEnabled, setMusicEnabled } = useMusic();
  const { hasPurchased, settings, updateSettings } = useUserPurchases();
  const {
    isPermissionGranted,
    isMobile,
    requestPermissions,
    disableNotifications,
    showLocalNotification,
    checkPermissionStatus,
  } = useMobileNotifications();

  // Settings state
  const [notifications, setNotifications] = useState(false);
  const [language, setLanguage] = useState("tr");
  const [gameInvitesEnabled, setGameInvitesEnabled] = useState(true);
  const [gameInvitesLoading, setGameInvitesLoading] = useState(false);

  // Auto-save tracking
  const initialSettingsRef = useRef<any>(null);
  const hasChangedRef = useRef(false);
  const isInitialMount = useRef(true);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ title: "", content: "" });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteFinalConfirmOpen, setDeleteFinalConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [notificationWarningOpen, setNotificationWarningOpen] = useState(false);

  // Load settings and check real OS permission status
  useEffect(() => {
    const loadSettings = async () => {
      const savedSettings = await nativeStorage.getItem(STORAGE_KEYS.SETTINGS);

      // 🔧 FIX: Gerçek OS izin durumunu kontrol et (localStorage'a güvenme)
      let realPermissionGranted = false;
      if (Capacitor.isNativePlatform()) {
        try {
          const { PushNotifications } = await import("@capacitor/push-notifications");
          const status = await PushNotifications.checkPermissions();
          realPermissionGranted = status.receive === "granted";
          console.log("📱 [Settings] Gerçek OS bildirim izni:", status.receive);
        } catch (e) {
          console.log("Push permission check failed:", e);
        }
      } else if ("Notification" in window) {
        realPermissionGranted = Notification.permission === "granted";
      }

      setNotifications(realPermissionGranted);

      if (savedSettings) {
        const s = JSON.parse(savedSettings);
        setLanguage(s.language ?? "tr");
        initialSettingsRef.current = {
          notifications: realPermissionGranted,
          sounds: soundsEnabled,
          music: musicEnabled,
          theme,
          language: s.language ?? "tr",
        };
      } else {
        initialSettingsRef.current = {
          notifications: realPermissionGranted,
          sounds: soundsEnabled,
          music: musicEnabled,
          theme,
          language: "tr",
        };
      }
    };

    loadSettings();
  }, [soundsEnabled, musicEnabled, theme]);

  // Oyun daveti ayarını Supabase'den yükle
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("accepts_game_invites")
        .eq("id", user.id)
        .single();
      if (data && data.accepts_game_invites !== null && data.accepts_game_invites !== undefined) {
        setGameInvitesEnabled(data.accepts_game_invites);
      }
    })();
  }, [user]);

  const handleGameInvitesChange = async (checked: boolean) => {
    if (!user || gameInvitesLoading) return;
    setGameInvitesEnabled(checked);
    setGameInvitesLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ accepts_game_invites: checked })
        .eq("id", user.id);
      if (error) throw error;
      playSound("buttonClick");
    } catch (error) {
      console.error("Oyun daveti ayarı güncellenemedi:", error);
      setGameInvitesEnabled(!checked);
      toast({
        title: "Hata",
        description: "Ayar güncellenemedi. Lütfen tekrar deneyin.",
        variant: "destructive",
      });
    } finally {
      setGameInvitesLoading(false);
    }
  };

  // Uygulama ön plana geldiğinde OS izin durumunu yeniden kontrol et
  useEffect(() => {
    if (!isMobile) return;
    let cleanup: (() => void) | undefined;

    const setupListener = async () => {
      try {
        const { App } = await import("@capacitor/app");
        const listener = await App.addListener("appStateChange", async ({ isActive }) => {
          if (isActive) {
            await checkPermissionStatus();
            const { SafePushNotifications } = await import("@/utils/safePluginWrapper");
            const status = await SafePushNotifications.checkPermissions();
            if (status?.receive === "granted") {
              setNotifications(true);
            } else if (status?.receive === "denied") {
              setNotifications(false);
            }
          }
        });
        cleanup = () => listener.remove();
      } catch (e) {
        console.log("App listener setup failed:", e);
      }
    };

    setupListener();
    return () => cleanup?.();
  }, [isMobile, checkPermissionStatus]);

  // Auto-save when settings change
  useEffect(() => {
    if (!initialSettingsRef.current) return;

    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const currentSettings = {
      notifications,
      sounds: soundsEnabled,
      music: musicEnabled,
      theme,
      language,
    };

    const hasRealChange = JSON.stringify(currentSettings) !== JSON.stringify(initialSettingsRef.current);

    if (hasRealChange) {
      hasChangedRef.current = true;
      nativeStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(currentSettings));
      window.dispatchEvent(new Event("settingsChanged"));
      initialSettingsRef.current = currentSettings;
      playSound("buttonClick");
      toast({
        title: "✅ Ayarlar Kaydedildi",
        description: "Değişiklikleriniz başarıyla kaydedildi.",
      });
    }
  }, [notifications, soundsEnabled, musicEnabled, theme, language, playSound, toast]);

  // ─── Bildirim switch handler ────────────────────────────────────────────────
  const handleNotificationChange = async (checked: boolean) => {
    try {
      if (checked) {
        // Switch ON → izin iste
        if (isMobile) {
          const { SafePushNotifications } = await import("@/utils/safePluginWrapper");
          const currentStatus = await SafePushNotifications.checkPermissions();

          if (currentStatus?.receive === "denied") {
            // Daha önce reddedilmiş → OS ayarlarına yönlendir
            setNotifications(false);
            toast({
              title: "📱 Ayarlardan İzin Verin",
              description: "Bildirim izni daha önce kapatılmış. Ayarlar'dan açabilirsiniz.",
              action: (
                <ToastAction altText="Ayarları Aç" onClick={openAppSettings}>
                  Ayarları Aç
                </ToastAction>
              ),
            });
            return;
          }

          // İzin prompt ya da granted → iste
          const permissionGranted = await requestPermissions();
          if (permissionGranted) {
            setNotifications(true);
            toast({
              title: "✅ Bildirimler Aktif",
              description: "Oyun bildirimleri başarıyla aktif edildi.",
            });
            setTimeout(() => {
              showLocalNotification("Bildirimler Aktif", "Kelimele bildirimleriniz aktif edildi!");
            }, 1000);
          } else {
            setNotifications(false);
            toast({
              title: "⚠️ İzin Verilmedi",
              description: "Ayarlar'dan bildirim iznini açabilirsiniz.",
              action: (
                <ToastAction altText="Ayarları Aç" onClick={openAppSettings}>
                  Ayarları Aç
                </ToastAction>
              ),
            });
          }
        } else {
          // Web
          setNotifications(true);
        }
      } else {
        // Switch OFF → uyarı dialogu göster, switch'i geri aç
        // Çünkü uygulama içinden bildirim kapatılamaz, OS ayarlarından kapatılmalı
        setNotificationWarningOpen(true);
        // Switch'i tekrar açık konuma getir (gerçek kapatma OS'tan yapılır)
      }
    } catch (error) {
      console.error("❌ Bildirim ayarı hatası:", error);
      toast({
        title: "Hata",
        description: "Bildirim ayarları güncellenirken bir hata oluştu.",
        variant: "destructive",
      });
      setNotifications(false);
    }
  };

  // ─── Modal helpers ───────────────────────────────────────────────────────────
  const openModal = (title: string, content: string) => {
    setModalContent({ title, content });
    setModalOpen(true);
  };

  const openHowToPlay = () => {
    const content = `
      <div class="space-y-4">
        <h3 class="font-semibold text-lg">Oyunun Amacı</h3>
        <p>4x4 ızgarada bulunan harf karelerinden kelimeler oluşturarak puan toplamak ve rakibinizi geçmek.</p>
        
        <h3 class="font-semibold text-lg">Nasıl Oynanır</h3>
        <ol class="list-decimal list-inside space-y-2">
          <li>Harf karelerine tıklayarak harfleri seçin</li>
          <li>Seçtiğiniz harflerden anlamlı kelimeler oluşturun</li>
          <li>Kelime en az 3 harf olmalıdır</li>
          <li>Doğru kelimeler için puan kazanın</li>
          <li>Yanlış kelimeler puan vermez</li>
          <li>Süre bitiminde en yüksek puanı alan kazanır</li>
        </ol>
        
        <h3 class="font-semibold text-lg">Oyun Modları</h3>
        <ul class="list-disc list-inside space-y-2">
          <li><strong>Yapay Zekaya Karşı:</strong> AI rakibe karşı oynayın</li>
          <li><strong>Özel Oda:</strong> Arkadaşlarınızla özel oyun oluşturun</li>
          <li><strong>Rastgele Rakip:</strong> Online oyuncularla eşleşin</li>
          <li><strong>Turnuva:</strong> 8 kişilik turnuvalara katılın</li>
        </ul>
        
        <h3 class="font-semibold text-lg">Puanlama</h3>
        <ul class="list-disc list-inside space-y-1">
          <li>3 harfli kelime: 10 puan</li>
          <li>4 harfli kelime: 20 puan</li>
          <li>5+ harfli kelime: 30 puan</li>
          <li>Nadir harflerle bonus puan!</li>
        </ul>
      </div>
    `;
    openModal("Nasıl Oynanır", content);
  };

  const openSupport = () => {
    const content = `
      <div class="space-y-4">
        <h3 class="font-semibold text-lg">Yardım & Destek</h3>
        <p>Kelimele oyunu hakkında soru, görüş ve önerilerinizi iletişim butonuna tıklayarak açılan formu doldurup iletebilirsiniz:</p>
        
        <div class="space-y-3">
          <div class="p-3 bg-[#0f1829] rounded-lg border border-indigo-500/20">
            <h4 class="font-medium text-white">E-posta Desteği</h4>
            <p class="text-sm text-slate-400">team@kelimele.site</p>
            <p class="text-sm text-slate-300">24 saat içinde yanıtlanır</p>
          </div>
          
          <div class="p-3 bg-[#0f1829] rounded-lg border border-indigo-500/20">
            <h4 class="font-medium text-white">Teknik Sorunlar</h4>
            <p class="text-sm text-slate-300">Uygulama ile ilgili teknik sorunları bildirin. Cihaz modelinizi ve hatanın ne zaman oluştuğunu belirtmeyi unutmayın.</p>
          </div>
        </div>
      </div>
    `;
    openModal("Yardım & Destek", content);
  };

  const openPrivacyPolicy = () => {
    const content = `
      <div class="space-y-4">
        <h3 class="font-semibold text-lg">Gizlilik Politikası</h3>
        
        <div class="space-y-3">
          <section>
            <h4 class="font-medium">Toplanan Bilgiler</h4>
            <p class="text-sm text-slate-400">• E-posta adresi (hesap oluşturma için)</p>
            <p class="text-sm text-slate-400">• Oyun istatistikleri</p>
            <p class="text-sm text-slate-400">• Uygulama kullanım verileri</p>
          </section>
          
          <section>
            <h4 class="font-medium text-white">Verilerin Kullanımı</h4>
            <p class="text-sm text-slate-400">• Oyun deneyimini geliştirmek</p>
            <p class="text-sm text-slate-400">• Hesap güvenliğini sağlamak</p>
            <p class="text-sm text-slate-400">• İstatistik ve liderlik tabloları</p>
          </section>
          
          <section>
            <h4 class="font-medium text-white">Veri Güvenliği</h4>
            <p class="text-sm text-slate-400">Tüm veriler şifrelenerek güvenli sunucularda saklanır. Kişisel bilgileriniz üçüncü taraflarla paylaşılmaz.</p>
          </section>
        </div>
      </div>
    `;
    openModal("Gizlilik Politikası", content);
  };

  const openAbout = () => {
    const content = `
      <div class="space-y-4">
        <div class="text-center space-y-2">
          <h4 class="text-2xl font-bold text-primary">KELİMELE</h4>
          <p class="text-lg font-medium">Versiyon 6.4.8</p>
        </div>
        
        <div class="space-y-3">
          <section>
            <h4 class="font-medium">Geliştirici</h4>
            <p class="text-sm text-slate-400">Ergan yazılım ekibi tarafından geliştirilmiştir.</p>
          </section>
        </div>
        
        <div class="text-center text-xs text-slate-500 border-t border-indigo-500/20 pt-3">
          <p>© 2026 Ergan Yazılım</p>
        </div>
      </div>
    `;
    openModal("Hakkımızda", content);
  };

  return (
    <div
      ref={swipeRef}
      {...swipeHandlers}
      className="fixed inset-0 flex flex-col text-slate-100 overflow-hidden"
      style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}
    >
      {/* Light Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent pointer-events-none opacity-30" />

      {/* Header */}
      <div className="flex-none z-30 bg-[#1e2d45] border-b border-indigo-500/20 shadow-2xl">
        <div className="px-5 py-4">
          <div className="flex items-center justify-between">
            <Button
              onClick={() => {
                playSound("buttonClick");
                navigate("/");
              }}
              className="bg-[#1e2d45] border border-indigo-500/20 text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Geri
            </Button>

            <div className="flex items-center gap-2">
              <img src="/icons/ayarlar-gorsel.svg" alt="" className="w-9 h-9 object-contain drop-shadow-md" />
              <img src="/icons/ayarlar-text.svg" alt="Ayarlar" className="h-7 object-contain" />
            </div>

            <div className="w-20" />
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 relative z-10">
        {/* Game Settings */}
        <div className="bg-[#1e2d45] border border-indigo-500/20 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-bold text-white">Oyun Ayarları</h2>
          </div>

          <div className="space-y-4">
            {/* Notifications */}
            <div className="flex items-center justify-between p-3 bg-[#0f1829] rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                  <Bell className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Bildirimler</p>
                  <p className="text-xs text-slate-400">Oyun bildirimlerini alın</p>
                </div>
              </div>
              <Switch
                checked={notifications}
                onCheckedChange={handleNotificationChange}
                className="data-[state=checked]:bg-green-500"
              />
            </div>

            {/* Sounds */}
            <div className="flex items-center justify-between p-3 bg-[#0f1829] rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Volume className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Ses Efektleri</p>
                  <p className="text-xs text-slate-400">Oyun seslerini aç/kapat</p>
                </div>
              </div>
              <Switch
                checked={soundsEnabled}
                onCheckedChange={(checked) => {
                  setSoundsEnabled(checked);
                  if (checked) playSound("buttonClick");
                }}
                className="data-[state=checked]:bg-green-500"
              />
            </div>

            {/* Music */}
            <div className="flex items-center justify-between p-3 bg-[#0f1829] rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Music className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Arka Plan Müziği</p>
                  <p className="text-xs text-slate-400">Oyun müziğini aç/kapat</p>
                </div>
              </div>
              <Switch
                checked={musicEnabled}
                onCheckedChange={(checked) => {
                  setMusicEnabled(checked);
                  if (checked) playSound("buttonClick");
                }}
                className="data-[state=checked]:bg-green-500"
              />
            </div>

            {/* Game Invites */}
            <div className="flex items-center justify-between p-3 bg-[#0f1829] rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pink-500/20 rounded-lg flex items-center justify-center">
                  <Gamepad2 className="w-5 h-5 text-pink-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Oyun Davet İstekleri</p>
                  <p className="text-xs text-slate-400">Diğer oyunculardan davet al</p>
                </div>
              </div>
              <Switch
                checked={gameInvitesEnabled}
                onCheckedChange={handleGameInvitesChange}
                disabled={gameInvitesLoading}
                className="data-[state=checked]:bg-green-500"
              />
            </div>
          </div>
        </div>

        {/* Support & Info */}
        <div className="bg-[#1e2d45] border border-indigo-500/20 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
              <Info className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-bold text-white">Destek & Bilgi</h2>
          </div>

          <div className="space-y-2">
            <button
              onClick={openHowToPlay}
              className="w-full flex items-center gap-3 p-3 bg-[#0f1829] rounded-xl transition-all active:scale-95"
            >
              <PlayCircle className="w-5 h-5 text-indigo-400" />
              <span className="text-white font-medium">Nasıl Oynanır</span>
            </button>

            <button
              onClick={openSupport}
              className="w-full flex items-center gap-3 p-3 bg-[#0f1829] rounded-xl transition-all active:scale-95"
            >
              <HelpCircle className="w-5 h-5 text-blue-400" />
              <span className="text-white font-medium">Yardım & Destek</span>
            </button>

            <button
              onClick={openPrivacyPolicy}
              className="w-full flex items-center gap-3 p-3 bg-[#0f1829] rounded-xl transition-all active:scale-95"
            >
              <Shield className="w-5 h-5 text-green-400" />
              <span className="text-white font-medium">Gizlilik Politikası</span>
            </button>

            <button
              onClick={openAbout}
              className="w-full flex items-center gap-3 p-3 bg-[#0f1829] rounded-xl transition-all active:scale-95"
            >
              <Info className="w-5 h-5 text-purple-400" />
              <span className="text-white font-medium">Hakkımızda</span>
            </button>

            <button
              onClick={() => setContactOpen(true)}
              className="w-full flex items-center gap-3 p-3 bg-[#0f1829] rounded-xl transition-all active:scale-95"
            >
              <Mail className="w-5 h-5 text-cyan-400" />
              <span className="text-white font-medium">İletişim</span>
            </button>
          </div>
        </div>

        {/* Admin Panel */}
        {user?.email === "info@kelimele.site" && (
          <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-400/30 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-red-400">Admin Panel</h2>
            </div>

            <Button
              onClick={async () => {
                const result = await triggerGlobalStorageClear();
                if (result.success) {
                  toast({
                    title: "Başarılı",
                    description: "Tüm kullanıcıların localStorage'ı temizlenecek.",
                  });
                }
              }}
              className="w-full bg-red-500 hover:bg-red-600 text-white"
            >
              <ShieldCheck className="w-4 h-4 mr-2" />
              Tüm Kullanıcı Ayarlarını Sıfırla
            </Button>
          </div>
        )}

        {/* Çıkış Yap */}
        <div className="bg-[#1e2d45] border border-indigo-500/20 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-indigo-500/30 rounded-lg flex items-center justify-center">
              <LogOut className="w-5 h-5 text-indigo-300" />
            </div>
            <h2 className="text-lg font-bold text-white">Hesap</h2>
          </div>

          <p className="text-xs text-slate-400 mb-3">
            Hesabından çıkış yaparak giriş ekranına dönebilirsin.
          </p>

          <Button
            onClick={() => {
              requestSignOut(async () => {
                try {
                  showSignedOutCard();
                  await signOut();
                  setTimeout(() => navigate("/auth"), 1800);
                } catch (e) {
                  toast({ title: "Hata", description: "Çıkış yapılamadı.", variant: "destructive" });
                }
              });
            }}
            className="w-full bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-400/30"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Çıkış Yap
          </Button>
        </div>

        {/* Delete Account */}
        <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-400/20 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-red-500/30 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-red-400">Hesap Silme</h2>
          </div>

          <p className="text-xs text-slate-400 mb-3">
            Hesabınızı sildiğinizde tüm verileriniz kalıcı olarak silinecektir.
          </p>

          <Button
            onClick={() => setDeleteConfirmOpen(true)}
            className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-400/30"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Hesabımı Sil
          </Button>
        </div>

        {/* Version */}
        <div className="bg-[#1e2d45] border border-indigo-500/20 rounded-2xl p-4 text-center">
          <p className="text-sm text-slate-400">Kelimele v6.4.8</p>
          <p className="text-xs text-slate-500 mt-1">© 2026 Ergan Yazılım</p>
        </div>

        {/* Bottom Spacer */}
        <div className="h-20" />
      </div>

      {/* Modal Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-[#1e2d45] border-indigo-500/20 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">{modalContent.title}</DialogTitle>
          </DialogHeader>
          <div
            className="prose prose-sm prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: modalContent.content }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteAccountCardDialog
        open={deleteConfirmOpen}
        step="confirm"
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={() => {
          setDeleteConfirmOpen(false);
          setDeleteFinalConfirmOpen(true);
        }}
      />

      <ContactDialog open={contactOpen} onOpenChange={setContactOpen} />

      {/* Final Delete Confirmation Dialog */}
      <DeleteAccountCardDialog
        open={deleteFinalConfirmOpen}
        step="final"
        loading={isDeleting}
        onCancel={() => setDeleteFinalConfirmOpen(false)}
        onConfirm={async () => {
          setIsDeleting(true);
          try {
            const { data, error } = await supabase.functions.invoke("delete-user-account");

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            setDeleteFinalConfirmOpen(false);
            setDeleteConfirmOpen(false);

            await nativeStorage.clear();
            await supabase.auth.signOut();

            window.location.href = "/auth";
          } catch (error) {
            console.error("Delete error:", error);
            toast({
              title: "Hata",
              description: "Hesap silinemedi. Lütfen tekrar deneyin.",
              variant: "destructive",
            });
            setIsDeleting(false);
            setDeleteFinalConfirmOpen(false);
          }
        }}
      />

      {/* Bildirim Kapatma Uyarı Dialogu */}
      <AlertDialog open={notificationWarningOpen} onOpenChange={setNotificationWarningOpen}>
        <AlertDialogContent
          className="max-w-sm rounded-2xl border-0"
          style={{
            background: "linear-gradient(145deg, #0f1729 0%, #1a1a2e 50%, #16213e 100%)",
            boxShadow: "0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.07)",
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-indigo-400" />
              Bildirimleri Kapatma
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/60 leading-relaxed">
              <p>
                Bildirimleri uygulama içinden kapatmak mümkün değildir. Telefonunuzun ayarlarından kapatabilirsiniz.
              </p>
              <p className="text-xs text-white/40 mt-3">
                Bildirimleri tekrar açmak için de aynı yolu izleyebilirsiniz.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel
              className="w-full h-10 border-white/10 text-white/70 hover:bg-white/5 hover:text-white"
              style={{ background: "rgba(255,255,255,0.06)", marginTop: 0 }}
            >
              Tamam
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Çıkış Yap onay diyaloğu */}
      {SignOutConfirmDialog}

    </div>
  );
};

export default SettingsPage;
