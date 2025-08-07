import { useState, useEffect } from 'react';
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
  Save
} from 'lucide-react';

const SettingsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { soundsEnabled, setSoundsEnabled, playSound } = useSounds();

  // Settings state
  const [notifications, setNotifications] = useState(true);
  const [language, setLanguage] = useState('tr');

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('kelimeci-settings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setNotifications(settings.notifications ?? true);
      setLanguage(settings.language ?? 'tr');
    }
  }, []);

  // Save settings to localStorage
  const saveSettings = () => {
    const settings = {
      notifications,
      sounds: soundsEnabled,
      theme,
      language
    };
    localStorage.setItem('kelimeci-settings', JSON.stringify(settings));
    
    // Dispatch custom event to notify other components
    window.dispatchEvent(new Event('settingsChanged'));
    
    playSound('buttonClick');
    toast({
      title: 'Ayarlar Kaydedildi',
      description: 'Değişiklikleriniz başarıyla kaydedildi.',
    });
  };

  const handleNotificationChange = (checked: boolean) => {
    setNotifications(checked);
    if (checked && 'Notification' in window) {
      Notification.requestPermission();
    }
  };

  const openAbout = () => {
    toast({
      title: 'Kelimeci v1.0.0',
      description: 'Türkçe kelime oyunu. Geliştirici: Kelimeci Ekibi',
    });
  };

  const openPrivacyPolicy = () => {
    toast({
      title: 'Gizlilik Politikası',
      description: 'Gizlilik politikamız yakında hazır olacak.',
    });
  };

  const openSupport = () => {
    toast({
      title: 'Destek',
      description: 'Destek ekibimizle iletişime geçmek için support@kelimeci.com adresine mail atabilirsiniz.',
    });
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

            {/* Theme */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Palette className="w-5 h-5" />
                <div>
                  <p className="font-medium">Tema</p>
                  <p className="text-sm text-muted-foreground">Görünümü seçin</p>
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
              onClick={() => window.open('mailto:support@kelimeci.com')}
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
              <p>© 2024 Kelimeci Ekibi</p>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <Card>
          <CardContent className="pt-6">
            <Button 
              onClick={saveSettings}
              className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-semibold"
              size="lg"
            >
              <Save className="w-4 h-4 mr-2" />
              Ayarları Kaydet
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;