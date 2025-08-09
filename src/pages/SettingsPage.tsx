import { SoundPackSelector } from '@/components/SoundPackSelector';
import { MusicPackSelector } from '@/components/MusicPackSelector';
import { ThemeSelector } from '@/components/ThemeSelector';
import { AvatarFrameSelector } from '@/components/AvatarFrameSelector';
import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useSounds } from '@/hooks/useSounds';
import { useMusic } from '@/contexts/MusicContext';
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
  PlayCircle
} from 'lucide-react';

const SettingsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { soundsEnabled, setSoundsEnabled, playSound } = useSounds();
  const { musicEnabled, setMusicEnabled } = useMusic();

  // Settings state
  const [notifications, setNotifications] = useState(true);
  const [language, setLanguage] = useState('tr');
  
  // Auto-save tracking
  const initialSettingsRef = useRef<any>(null);
  const hasChangedRef = useRef(false);
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', content: '' });

  // Load settings from localStorage and set initial values
  useEffect(() => {
    const savedSettings = localStorage.getItem('kelimeci-settings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setNotifications(settings.notifications ?? true);
      setLanguage(settings.language ?? 'tr');
      
      // Store initial settings for comparison
      initialSettingsRef.current = {
        notifications: settings.notifications ?? true,
        sounds: soundsEnabled,
        music: musicEnabled,
        theme,
        language: settings.language ?? 'tr'
      };
    } else {
      // Store initial settings even if no saved settings exist
      initialSettingsRef.current = {
        notifications: true,
        sounds: soundsEnabled,
        music: musicEnabled,
        theme,
        language: 'tr'
      };
    }
  }, [soundsEnabled, musicEnabled, theme]);

  // Auto-save when settings change
  useEffect(() => {
    if (!initialSettingsRef.current) return;

    const currentSettings = {
      notifications,
      sounds: soundsEnabled,
      music: musicEnabled,
      theme,
      language
    };

    // Check if any setting has actually changed
    const hasRealChange = JSON.stringify(currentSettings) !== JSON.stringify(initialSettingsRef.current);
    
    if (hasRealChange) {
      hasChangedRef.current = true;
      localStorage.setItem('kelimeci-settings', JSON.stringify(currentSettings));
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new Event('settingsChanged'));
      
      // Only show toast if there was a real change
      if (hasChangedRef.current) {
        playSound('buttonClick');
        toast({
          title: 'Ayarlar Otomatik Kaydedildi',
          description: 'Değişiklikleriniz otomatik olarak kaydedildi.',
        });
      }
    }
  }, [notifications, soundsEnabled, musicEnabled, theme, language, playSound, toast]);


  const handleNotificationChange = (checked: boolean) => {
    setNotifications(checked);
    if (checked && 'Notification' in window) {
      Notification.requestPermission();
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
          <li><strong>Bilgisayara Karşı:</strong> AI rakibe karşı oynayın</li>
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
            <p class="text-sm text-muted-foreground">makifergan@gmail.com</p>
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
          <p>© 2025 Ergan Mühendislik</p>
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
              <p class="text-sm font-mono break-all">makifergan@gmail.com</p>
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
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Geri
          </Button>
          <h1 className="text-2xl font-bold">Ayarlar</h1>
          <div className="w-16" /> {/* Spacer */}
        </div>

        {/* Game Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Smartphone className="w-5 h-5 mr-2" />
              Oyun Ayarları
            </CardTitle>
            <CardDescription>
              Oyun deneyiminizi kişiselleştirin
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Notifications */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Bell className="w-5 h-5" />
                <div>
                  <p className="font-medium">Bildirimler</p>
                  <p className="text-sm text-muted-foreground">Oyun bildirimlerini alın</p>
                </div>
              </div>
              <Switch
                checked={notifications}
                onCheckedChange={handleNotificationChange}
              />
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
                  if (checked) playSound('buttonClick');
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
                  if (checked) playSound('buttonClick');
                }}
              />
            </div>

            <Separator />

            {/* Sound Pack Selector */}
            {soundsEnabled && (
              <>
                <SoundPackSelector />
                <Separator />
              </>
            )}

            {/* Music Pack Selector */}
            {musicEnabled && (
              <>
                <MusicPackSelector />
                <Separator />
              </>
            )}

            {/* Theme Selector */}
            <ThemeSelector />
            
            <Separator />

            {/* Avatar Frame Selector */}
            <AvatarFrameSelector />
            
            <Separator />
            
            {/* Legacy Theme for backward compatibility */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Palette className="w-5 h-5" />
                <div>
                  <p className="font-medium">Sistem Teması</p>
                  <p className="text-sm text-muted-foreground">Açık/Koyu sistem ayarı</p>
                </div>
              </div>
              <Select value={theme} onValueChange={(value) => setTheme(value as 'light' | 'dark' | 'system')}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Açık</SelectItem>
                  <SelectItem value="dark">Koyu</SelectItem>
                  <SelectItem value="system">Sistem</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Account Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Hesap
            </CardTitle>
            <CardDescription>
              Hesap bilgilerinizi yönetin
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">E-posta</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
              <Button variant="outline" size="sm">
                Değiştir
              </Button>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Şifre</p>
                <p className="text-sm text-muted-foreground">Son değişiklik: 1 hafta önce</p>
              </div>
              <Button variant="outline" size="sm">
                Değiştir
              </Button>
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
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={openHowToPlay}
            >
              <PlayCircle className="w-4 h-4 mr-2" />
              Nasıl Oynanır
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={openSupport}
            >
              <HelpCircle className="w-4 h-4 mr-2" />
              Yardım & Destek
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={openPrivacyPolicy}
            >
              <Shield className="w-4 h-4 mr-2" />
              Gizlilik Politikası
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={openAbout}
            >
              <Info className="w-4 h-4 mr-2" />
              Hakkımızda
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={openContact}
            >
              <Mail className="w-4 h-4 mr-2" />
              İletişim
            </Button>
          </CardContent>
        </Card>

        {/* App Version */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-sm text-muted-foreground">
              <p>Kelimeci v1.0.0</p>
              <p>© 2025 Ergan Mühendislik</p>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Modal Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{modalContent.title}</DialogTitle>
          </DialogHeader>
          <div 
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: modalContent.content }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPage;