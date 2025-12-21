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
} from "lucide-react";
import { triggerGlobalStorageClear } from "@/hooks/useLocalStorageClear";
import { useMobileNotifications } from "@/hooks/useMobileNotifications";

const SettingsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { soundsEnabled, setSoundsEnabled, playSound } = useSounds();
  const { musicEnabled, setMusicEnabled } = useMusic();
  const { hasPurchased, settings, updateSettings } = useUserPurchases();
  const { isPermissionGranted, isMobile, requestPermissions, disableNotifications, showLocalNotification } = useMobileNotifications();

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
  const [isDeleting, setIsDeleting] = useState(false);

  // Load settings from localStorage and set initial values
  useEffect(() => {
    const savedSettings = localStorage.getItem("kelimeci-settings");
    const permissionsCompleted = localStorage.getItem("kelimeci-permissions-completed");

    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setNotifications(settings.notifications ?? false);
      setLanguage(settings.language ?? "tr");

      // Store initial settings for comparison
      initialSettingsRef.current = {
        notifications: settings.notifications ?? false,
        sounds: soundsEnabled,
        music: musicEnabled,
        theme,
        language: settings.language ?? "tr",
      };
    } else if (permissionsCompleted && isPermissionGranted) {
      // Eğer izin onboarding'i tamamlanmışsa ve izin verildiyse, notifications'ı true yap
      setNotifications(true);
      initialSettingsRef.current = {
        notifications: true,
        sounds: soundsEnabled,
        music: musicEnabled,
        theme,
        language: "tr",
      };
    } else {
      // Store initial settings even if no saved settings exist
      initialSettingsRef.current = {
        notifications: false,
        sounds: soundsEnabled,
        music: musicEnabled,
        theme,
        language: "tr",
      };
    }
  }, [soundsEnabled, musicEnabled, theme, isPermissionGranted]);

  // Auto-save when settings change
  useEffect(() => {
    if (!initialSettingsRef.current) return;

    // İlk mount'ta toast gösterme
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

    // Check if any setting has actually changed
    const hasRealChange = JSON.stringify(currentSettings) !== JSON.stringify(initialSettingsRef.current);

    if (hasRealChange) {
      hasChangedRef.current = true;
      localStorage.setItem("kelimeci-settings", JSON.stringify(currentSettings));

      // Dispatch custom event to notify other components
      window.dispatchEvent(new Event("settingsChanged"));

      // Update initial settings ref for next comparison
      initialSettingsRef.current = currentSettings;

      playSound("buttonClick");
      toast({
        title: "Ayarlar Kaydedildi",
        description: "Değişiklikleriniz kaydedildi.",
      });
    }
  }, [notifications, soundsEnabled, musicEnabled, theme, language, playSound, toast]);

  const handleNotificationChange = async (checked: boolean) => {
    try {
      setNotifications(checked);

      if (checked) {
        // Mobile veya web bildirim izinlerini iste
        if (isMobile) {
          await requestPermissions();
        } else if ("Notification" in window) {
          const permission = await Notification.requestPermission();
          if (permission === "granted") {
            toast({
              title: "Bildirimler Aktif",
              description: "Oyun bildirimleri başarıyla aktif edildi",
            });
          } else {
            toast({
              title: "İzin Reddedildi",
              description: "Bildirim izni reddedildi. Tarayıcı ayarlarından izin verebilirsiniz.",
              variant: "destructive",
            });
            setNotifications(false);
            return;
          }
        }

        // Test bildirimi göster
        setTimeout(() => {
          showLocalNotification("Bildirimler Aktif", "Kelimeci bildirimleriniz aktif edildi!");
        }, 2000);
      } else {
        // Bildirimleri kapat - push token'ı veritabanından sil
        await disableNotifications();
        toast({
          title: "Bildirimler Kapatıldı",
          description: "Artık oyun bildirimi almayacaksınız",
        });
      }
    } catch (error) {
      console.error("Bildirim ayarı hatası:", error);
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
        <p>Ekrandaki harf karelerinden kelimeler oluşturarak puan toplamak ve rakibinizi geçmek.</p>
        
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
        <p>Kelimeci oyunu hakkında sorularınız için aşağıdaki kanalı kullanabilirsiniz:</p>
        
        <div class="space-y-3">
          <div class="p-3 bg-muted rounded-lg">
            <h4 class="font-medium">E-posta Desteği</h4>
            <p class="text-sm text-muted-foreground">info@erganmuhendislik.com</p>
            <p class="text-sm">24 saat içinde yanıtlanır</p>
          </div>
          
          <div class="p-3 bg-muted rounded-lg">
            <h4 class="font-medium">Teknik Sorunlar</h4>
            <p class="text-sm">Uygulama ile ilgili teknik sorunları bildirin. Cihaz modelinizi ve hatanın ne zaman oluştuğunu belirtmeyi unutmayın.</p>
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
            <p class="text-sm text-muted-foreground">• E-posta adresi (hesap oluşturma için)</p>
            <p class="text-sm text-muted-foreground">• Oyun istatistikleri</p>
            <p class="text-sm text-muted-foreground">• Uygulama kullanım verileri</p>
          </section>
          
          <section>
            <h4 class="font-medium">Verilerin Kullanımı</h4>
            <p class="text-sm text-muted-foreground">• Oyun deneyimini geliştirmek</p>
            <p class="text-sm text-muted-foreground">• Hesap güvenliğini sağlamak</p>
            <p class="text-sm text-muted-foreground">• İstatistik ve liderlik tabloları</p>
          </section>
          
          <section>
            <h4 class="font-medium">Veri Güvenliği</h4>
            <p class="text-sm text-muted-foreground">Tüm veriler şifrelenerek güvenli sunucularda saklanır. Kişisel bilgileriniz üçüncü taraflarla paylaşılmaz.</p>
          </section>
          
          <section>
            <h4 class="font-medium">Çerezler</h4>
            <p class="text-sm text-muted-foreground">Oyun ayarlarınızı hatırlamak için yerel depolama kullanılır.</p>
          </section>
          
          <section>
            <h4 class="font-medium">İletişim</h4>
            <p class="text-sm text-muted-foreground">Gizlilik konularında: privacy@kelimeci.com</p>
          </section>
        </div>
      </div>
    `;
    openModal("Gizlilik Politikası", content);
  };

  const openAbout = () => {
    const content = `
      <div class="space-y-4">
        <h3 class="font-semibold text-lg">Kelimeci Hakkında</h3>
        
        <div class="text-center space-y-2">
          <h4 class="text-2xl font-bold text-primary">KELİMECİ</h4>
          <p class="text-lg font-medium">Versiyon 1.0.0</p>
        </div>
        
        <div class="space-y-3">
          <section>
            <h4 class="font-medium">Geliştirici</h4>
            <p class="text-sm text-muted-foreground">Ergan Mühendislik tarafından geliştirilmiştir.</p>
            <p class="text-sm text-muted-foreground">Web: <a href="https://erganmuhendislik.com" class="text-primary underline">erganmuhendislik.com</a></p>
          </section>
          
          <section>
            <h4 class="font-medium">Misyonumuz</h4>
            <p class="text-sm text-muted-foreground">Türkçe kelime dağarcığını geliştirmeyi amaçlayan, eğlenceli ve rekabetçi bir oyun deneyimi sunmak.</p>
          </section>
          
          <section>
            <h4 class="font-medium">Özellikler</h4>
            <p class="text-sm text-muted-foreground">• Çoklu oyun modları</p>
            <p class="text-sm text-muted-foreground">• Gerçek zamanlı çok oyunculu</p>
            <p class="text-sm text-muted-foreground">• Kapsamlı Türkçe kelime sözlüğü</p>
            <p class="text-sm text-muted-foreground">• Liderlik tabloları</p>
            <p class="text-sm text-muted-foreground">• Sosyal özellikler</p>
          </section>
          
          <section>
            <h4 class="font-medium">Teşekkürler</h4>
            <p class="text-sm text-muted-foreground">Kelimeci'yi tercih ettiğiniz için teşekkür ederiz!</p>
          </section>
        </div>
        
        <div class="text-center text-xs text-muted-foreground border-t pt-3">
          <p>© 2025 Ergan Yazılım</p>
          <p>Tüm hakları saklıdır</p>
        </div>
      </div>
    `;
    openModal("Hakkımızda", content);
  };

  const openContact = () => {
    const content = `
      <div class="space-y-4">
        <h3 class="font-semibold text-lg">İletişim</h3>
        
        <div class="space-y-4">
          <div class="p-4 bg-muted rounded-lg">
            <h4 class="font-medium flex items-center mb-3">
              <Mail class="w-4 h-4 mr-2 flex-shrink-0" />
              <span class="whitespace-nowrap">E-posta</span>
            </h4>
            <div class="space-y-2">
              <p class="text-sm font-mono break-all">info@erganmuhendislik.com</p>
              <p class="text-xs text-muted-foreground">Genel sorular, destek ve tüm konular</p>
            </div>
          </div>
          
          <div class="space-y-2 pt-3 border-t">
            <h4 class="font-medium">Yanıt Süreleri</h4>
            <p class="text-sm text-muted-foreground">• Genel sorular: 24 saat</p>
            <p class="text-sm text-muted-foreground">• Teknik sorunlar: 48 saat</p>
            <p class="text-sm text-muted-foreground">• Acil durumlar: 6 saat</p>
          </div>
          
          <div class="text-center pt-3 border-t">
            <p class="text-sm text-muted-foreground">Size en iyi hizmeti verebilmek için buradayız!</p>
          </div>
        </div>
      </div>
    `;
    openModal("İletişim", content);
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-background to-muted overflow-x-hidden">
      {/* Fixed Header */}
      <div className="sticky top-0 z-10 bg-purple-50/95 backdrop-blur-sm border-b border-purple-200 p-3 pt-6">
        <div className="max-w-2xl mx-auto">
          <div className="space-y-4">
            {" "}
            {/* space-y-4'ü buraya ekledim */}
            {/* Header */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/")}
                className="text-purple-600 border-purple-500/30 hover:bg-purple-500/20 bg-purple-500/10"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Geri
              </Button>

              <div className="relative inline-block">
                {/* Stroke Background */}
                <img
                  src="/stroke.png"
                  alt="Stroke Background"
                  className="absolute inset-0 w-full h-full object-contain opacity-50"
                />
                {/* Ayarlar Title */}
                <h1 className="text-3xl font-bold flex items-center text-purple-600 relative z-10 px-6 py-3">
                  <Settings className="w-6 h-6 mr-3 text-purple-500" />
                  Ayarlar
                </h1>
              </div>

              <div className="w-16" />
            </div>
            {/* Game Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Smartphone className="w-5 h-5 mr-2" />
                  Oyun Ayarları
                </CardTitle>
                <CardDescription>Oyun deneyiminizi kişiselleştirin</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 space-y-6 pb-8">
          {/* Game Settings Content */}
          <Card>
            <CardContent className="pt-6 space-y-6">
              {/* Notifications */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Bell className="w-5 h-5" />
                  <div>
                    <p className="font-medium">Bildirimler</p>
                    <p className="text-sm text-muted-foreground">Oyun bildirimlerini alın</p>
                  </div>
                </div>
                <Switch checked={notifications} onCheckedChange={handleNotificationChange} />
              </div>

              <Separator />

              {/* Sounds */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Volume2 className="w-5 h-5" />
                  <div>
                    <p className="font-medium">Ses Efektleri</p>
                    <p className="text-sm text-muted-foreground">Oyun seslerini açın/kapatın</p>
                  </div>
                </div>
                <Switch
                  checked={soundsEnabled}
                  onCheckedChange={(checked) => {
                    setSoundsEnabled(checked);
                    if (checked) playSound("buttonClick");
                  }}
                />
              </div>

              <Separator />

              {/* Music */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Volume2 className="w-5 h-5" />
                  <div>
                    <p className="font-medium">Arka Plan Müziği</p>
                    <p className="text-sm text-muted-foreground">Oyun müziğini açın/kapatın</p>
                  </div>
                </div>
                <Switch
                  checked={musicEnabled}
                  onCheckedChange={(checked) => {
                    setMusicEnabled(checked);
                    if (checked) playSound("buttonClick");
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Support & Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Info className="w-5 h-5 mr-2" />
                Destek & Bilgi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="ghost" className="w-full justify-start" onClick={openHowToPlay}>
                <PlayCircle className="w-4 h-4 mr-2" />
                Nasıl Oynanır
              </Button>

              <Button variant="ghost" className="w-full justify-start" onClick={openSupport}>
                <HelpCircle className="w-4 h-4 mr-2" />
                Yardım & Destek
              </Button>

              <Button variant="ghost" className="w-full justify-start" onClick={openPrivacyPolicy}>
                <Shield className="w-4 h-4 mr-2" />
                Gizlilik Politikası
              </Button>

              <Button variant="ghost" className="w-full justify-start" onClick={openAbout}>
                <Info className="w-4 h-4 mr-2" />
                Hakkımızda
              </Button>

              <Button variant="ghost" className="w-full justify-start" onClick={openContact}>
                <Mail className="w-4 h-4 mr-2" />
                İletişim
              </Button>
            </CardContent>
          </Card>

          {/* Admin Panel - Only show for admin emails */}
          {user?.email === "info@erganmuhendislik.com" && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardHeader>
                <CardTitle className="flex items-center text-destructive">
                  <ShieldCheck className="w-5 h-5 mr-2" />
                  Admin Panel
                </CardTitle>
                <CardDescription>Sistem yönetimi araçları</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={async () => {
                    const result = await triggerGlobalStorageClear();
                    if (result.success) {
                      toast({
                        title: "Başarılı",
                        description: "Tüm kullanıcıların localStorage'ı temizlenecek.",
                        variant: "default",
                      });
                    } else {
                      toast({
                        title: "Hata",
                        description: "İşlem başarısız oldu.",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Tüm Kullanıcı Ayarlarını Sıfırla
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Account Management - KVKK Compliance */}
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="flex items-center text-destructive">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Hesap İşlemleri
              </CardTitle>
              <CardDescription>Hesabınızı yönetin ve verilerinizi kontrol edin (KVKK)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={async () => {
                  try {
                    const { data, error } = await supabase.rpc("export_user_data");

                    if (error) throw error;

                    // JSON dosyası olarak indir
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `kelimeci-verilerin-${new Date().toISOString().split("T")[0]}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);

                    toast({
                      title: "Başarılı",
                      description: "Verileriniz indirildi.",
                    });
                  } catch (error) {
                    toast({
                      title: "Hata",
                      description: "Veriler indirilemedi.",
                      variant: "destructive",
                    });
                  }
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Verilerimi İndir (KVKK)
              </Button>

              <Separator />

              <Button variant="destructive" className="w-full justify-start" onClick={() => setDeleteConfirmOpen(true)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Hesabımı Sil
              </Button>

              <p className="text-xs text-muted-foreground">
                ⚠️ Hesabınızı sildiğinizde tüm verileriniz kalıcı olarak silinecektir. Bu işlem geri alınamaz.
              </p>
            </CardContent>
          </Card>

          {/* App Version */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-sm text-muted-foreground">
                <p>Kelimeci v1.0.0</p>
                <p>© 2025 Ergan Yazılım</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{modalContent.title}</DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: modalContent.content }} />
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Hesabı Silmeyi Onaylayın
            </DialogTitle>
            <DialogDescription>Bu işlem geri alınamaz. Tüm verileriniz kalıcı olarak silinecektir:</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Profil bilgileriniz</li>
              <li>Oyun geçmişiniz ve istatistikleriniz</li>
              <li>Rozetleriniz ve başarılarınız</li>
              <li>Satın alımlarınız ve envanter</li>
              <li>Tüm oyun kayıtlarınız</li>
            </ul>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={isDeleting}
              >
                İptal
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    // Hesap silme fonksiyonunu çağır
                    const { error } = await supabase.rpc("delete_user_account");

                    if (error) throw error;

                    // Başarılı mesajı göster
                    toast({
                      title: "Hesap Silindi",
                      description: "Hesabınız başarıyla silindi. Yönlendiriliyorsunuz...",
                    });

                    // Kullanıcıyı çıkış yap
                    await supabase.auth.signOut();

                    // Ana sayfaya yönlendir
                    setTimeout(() => {
                      navigate("/auth");
                    }, 2000);
                  } catch (error) {
                    console.error("Delete error:", error);
                    toast({
                      title: "Hata",
                      description: "Hesap silinemedi. Lütfen tekrar deneyin.",
                      variant: "destructive",
                    });
                    setIsDeleting(false);
                    setDeleteConfirmOpen(false);
                  }
                }}
              >
                {isDeleting ? "Siliniyor..." : "Evet, Hesabımı Sil"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPage;
