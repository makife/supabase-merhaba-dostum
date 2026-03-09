import { MusicPackSelector } from "@/components/MusicPackSelector";
import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { useSounds } from "@/hooks/useSounds";
import { useMusic } from "@/contexts/MusicContext";
import { useUserPurchases } from "@/hooks/useUserPurchases";
import { nativeStorage, STORAGE_KEYS } from "@/utils/nativeStorage";
import { ContactDialog } from "@/components/ContactDialog";
import {
  ArrowLeft,
  Bell,
  Palette,
  Volume2,
  Info,
  Shield,
  HelpCircle,
  Mail,
  Smartphone,
  PlayCircle,
  Sparkles,
  Gift,
  ShieldCheck,
  Settings,
  Trash2,
  Download,
  AlertTriangle,
  Music,
  Volume,
} from "lucide-react";
import { triggerGlobalStorageClear } from "@/hooks/useLocalStorageClear"; // ✅ Doğru import
import { useMobileNotifications } from "@/hooks/useMobileNotifications";

const SettingsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { soundsEnabled, setSoundsEnabled, playSound } = useSounds();
  const { musicEnabled, setMusicEnabled } = useMusic();
  const { hasPurchased, settings, updateSettings } = useUserPurchases();
  const { isPermissionGranted, isMobile, requestPermissions, disableNotifications, showLocalNotification } =
    useMobileNotifications();

  // Settings state
  const [notifications, setNotifications] = useState(false);
  const [language, setLanguage] = useState("tr");

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

  // Load settings from native storage and set initial values
  useEffect(() => {
    const loadSettings = async () => {
      const savedSettings = await nativeStorage.getItem(STORAGE_KEYS.SETTINGS);
      const permissionsCompleted = await nativeStorage.getItem(STORAGE_KEYS.PERMISSIONS_COMPLETED);

      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setNotifications(settings.notifications ?? false);
        setLanguage(settings.language ?? "tr");

        initialSettingsRef.current = {
          notifications: settings.notifications ?? false,
          sounds: soundsEnabled,
          music: musicEnabled,
          theme,
          language: settings.language ?? "tr",
        };
      } else if (permissionsCompleted && isPermissionGranted) {
        setNotifications(true);
        initialSettingsRef.current = {
          notifications: true,
          sounds: soundsEnabled,
          music: musicEnabled,
          theme,
          language: "tr",
        };
      } else {
        initialSettingsRef.current = {
          notifications: false,
          sounds: soundsEnabled,
          music: musicEnabled,
          theme,
          language: "tr",
        };
      }
    };

    loadSettings();
  }, [soundsEnabled, musicEnabled, theme, isPermissionGranted]);

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

  const handleNotificationChange = async (checked: boolean) => {
    try {
      console.log("🔔 Bildirim değişikliği:", checked);
      console.log("🔔 isMobile:", isMobile);

      if (checked) {
        // Önce switch'i aç (optimistic update)
        setNotifications(true);

        const permissionGranted = await requestPermissions();
        console.log("🔔 İzin sonucu:", permissionGranted);

        if (permissionGranted) {
          toast({
            title: "✅ Bildirimler Aktif",
            description: "Oyun bildirimleri başarıyla aktif edildi",
          });

          setTimeout(() => {
            showLocalNotification("Bildirimler Aktif", "Kelimele bildirimleriniz aktif edildi!");
          }, 1000);
        } else {
          // İzin reddedildiyse geri al
          setNotifications(false);
          toast({
            title: "⚠️ İzin Gerekli",
            description: "Bildirim izni verilemedi. Lütfen uygulama ayarlarından izin verin.",
            variant: "destructive",
          });
        }
      } else {
        setNotifications(false);
        await disableNotifications();
        toast({
          title: "🔕 Bildirimler Kapatıldı",
          description: "Artık oyun bildirimi almayacaksınız",
        });
      }
    } catch (error) {
      console.error("❌ Bildirim ayarı hatası:", error);
      toast({
        title: "Hata",
        description: "Bildirim ayarları güncellenirken bir hata oluştu",
        variant: "destructive",
      });
      setNotifications(false);
    }
  };

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
          <div class="p-3 bg-slate-800/60 rounded-lg border border-white/10">
            <h4 class="font-medium text-white">E-posta Desteği</h4>
            <p class="text-sm text-slate-400">team@kelimele.site</p>
            <p class="text-sm text-slate-300">24 saat içinde yanıtlanır</p>
          </div>
          
          <div class="p-3 bg-slate-800/60 rounded-lg border border-white/10">
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
          <p class="text-lg font-medium">Versiyon 5.3.4</p>
        </div>
        
        <div class="space-y-3">
          <section>
            <h4 class="font-medium">Geliştirici</h4>
            <p class="text-sm text-slate-400">Ergan yazılım ekibi tarafından geliştirilmiştir.</p>
          </section>
        </div>
        
        <div class="text-center text-xs text-slate-500 border-t border-white/10 pt-3">
          <p>© 2025 Ergan Yazılım</p>
        </div>
      </div>
    `;
    openModal("Hakkımızda", content);
  };

  return (
    <div
      className="fixed inset-0 flex flex-col text-slate-100 overflow-hidden"
      style={{ background: "linear-gradient(135deg, #2a2035 0%, #2d2540 100%)" }}
    >
      {/* Light Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent pointer-events-none opacity-30" />

      {/* Header */}
      <div className="flex-none z-30 bg-[#2a2035] border-b border-white/5 shadow-2xl">
        <div className="px-5 py-4">
          <div className="flex items-center justify-between">
            <Button
              onClick={() => navigate("/")}
              className="bg-[#16213e]/80 hover:bg-[#16213e] border border-white/10 text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Geri
            </Button>

            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">Ayarlar</h1>
            </div>

            <div className="w-20" />
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 relative z-10">
        {/* Game Settings */}
        <div className="bg-[#16213e]/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-bold text-white">Oyun Ayarları</h2>
          </div>

          <div className="space-y-4">
            {/* Notifications */}
            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl hover:bg-slate-800/70 transition-colors">
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
            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl hover:bg-slate-800/70 transition-colors">
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
            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl hover:bg-slate-800/70 transition-colors">
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
          </div>
        </div>

        {/* Support & Info */}
        <div className="bg-[#16213e]/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
              <Info className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-bold text-white">Destek & Bilgi</h2>
          </div>

          <div className="space-y-2">
            <button
              onClick={openHowToPlay}
              className="w-full flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl hover:bg-slate-800/70 transition-all active:scale-95"
            >
              <PlayCircle className="w-5 h-5 text-indigo-400" />
              <span className="text-white font-medium">Nasıl Oynanır</span>
            </button>

            <button
              onClick={openSupport}
              className="w-full flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl hover:bg-slate-800/70 transition-all active:scale-95"
            >
              <HelpCircle className="w-5 h-5 text-blue-400" />
              <span className="text-white font-medium">Yardım & Destek</span>
            </button>

            <button
              onClick={openPrivacyPolicy}
              className="w-full flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl hover:bg-slate-800/70 transition-all active:scale-95"
            >
              <Shield className="w-5 h-5 text-green-400" />
              <span className="text-white font-medium">Gizlilik Politikası</span>
            </button>

            <button
              onClick={openAbout}
              className="w-full flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl hover:bg-slate-800/70 transition-all active:scale-95"
            >
              <Info className="w-5 h-5 text-purple-400" />
              <span className="text-white font-medium">Hakkımızda</span>
            </button>

            <button
              onClick={() => setContactOpen(true)} // <-- değişti
              className="w-full flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl hover:bg-slate-800/70 transition-all active:scale-95"
            >
              <Mail className="w-5 h-5 text-cyan-400" />
              <span className="text-white font-medium">İletişim</span>
            </button>
          </div>
        </div>

        {/* Admin Panel */}
        {user?.email === "info@kelimele.site" && (
          <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 backdrop-blur-md border border-red-400/30 rounded-2xl p-4 shadow-xl">
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

        {/* Delete Account */}
        <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 backdrop-blur-md border border-red-400/20 rounded-2xl p-4 shadow-xl">
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
        <div className="bg-[#16213e]/40 backdrop-blur-md border border-white/5 rounded-2xl p-4 text-center">
          <p className="text-sm text-slate-400">Kelimele v1.0.0</p>
          <p className="text-xs text-slate-500 mt-1">© 2025 Ergan Yazılım</p>
        </div>

        {/* Bottom Spacer */}
        <div className="h-20" />
      </div>

      {/* Modal Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-[#16213e] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">{modalContent.title}</DialogTitle>
          </DialogHeader>
          <div
            className="prose prose-sm prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: modalContent.content }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialogs */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-[#16213e] border-red-400/30 text-white">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Hesabı Silmeyi Onaylayın
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Bu işlem geri alınamaz. Tüm verileriniz kalıcı olarak silinecektir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <ul className="list-disc list-inside text-sm text-slate-400 space-y-1">
              <li>Profil bilgileriniz</li>
              <li>Oyun geçmişiniz ve istatistikleriniz</li>
              <li>Rozetleriniz ve başarılarınız</li>
              <li>Satın alımlarınız ve envanter</li>
            </ul>

            <div className="flex gap-2">
              <Button
                onClick={() => setDeleteConfirmOpen(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600"
                disabled={isDeleting}
              >
                İptal
              </Button>
              <Button
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setDeleteFinalConfirmOpen(true);
                }}
                className="flex-1 bg-red-500 hover:bg-red-600"
                disabled={isDeleting}
              >
                Evet, Hesabımı Sil
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ContactDialog open={contactOpen} onOpenChange={setContactOpen} />

      <Dialog open={deleteFinalConfirmOpen} onOpenChange={setDeleteFinalConfirmOpen}>
        <DialogContent className="bg-[#16213e] border-red-400/30 text-white">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Son Onay
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-base pt-2">
              Bu son onay aşamasıdır ve geri alınması imkansızdır.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-4">
            <Button
              onClick={() => setDeleteFinalConfirmOpen(false)}
              className="flex-1 bg-slate-700 hover:bg-slate-600"
              disabled={isDeleting}
            >
              Kalıyorum
            </Button>
            <Button
              onClick={async () => {
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
              className="flex-1 bg-red-500 hover:bg-red-600"
              disabled={isDeleting}
            >
              {isDeleting ? "Siliniyor..." : "Hesabımı Sil"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPage;
