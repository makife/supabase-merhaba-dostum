import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Camera, Bell, Shield, CheckCircle2 } from 'lucide-react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Camera as CapacitorCamera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

interface OnboardingPermissionsProps {
  open: boolean;
  onComplete: () => void;
}

export const OnboardingPermissions = ({ open, onComplete }: OnboardingPermissionsProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [kvkkAccepted, setKvkkAccepted] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState({
    notifications: false,
    camera: false,
  });

  const isMobile = Capacitor.getPlatform() !== 'web';

  const steps = [
    {
      title: 'KVKK Onayı',
      description: 'Kişisel verilerinizin korunması ve kullanımı hakkında',
      icon: Shield,
      content: (
        <div className="space-y-4">
          <div className="max-h-60 overflow-y-auto p-4 bg-muted rounded-lg text-sm">
            <h4 className="font-semibold mb-2">Kişisel Verilerin Korunması</h4>
            <p className="mb-3">
              Kelimeci uygulaması, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında 
              kişisel verilerinizin korunmasına ve gizliliğinize önem vermektedir.
            </p>
            
            <h4 className="font-semibold mb-2">Toplanan Veriler</h4>
            <ul className="list-disc list-inside mb-3 space-y-1">
              <li>E-posta adresi (hesap oluşturma için)</li>
              <li>Kullanıcı adı ve profil bilgileri</li>
              <li>Oyun istatistikleri ve başarılar</li>
              <li>Cihaz bilgileri (uygulama performansı için)</li>
            </ul>

            <h4 className="font-semibold mb-2">Verilerin Kullanımı</h4>
            <ul className="list-disc list-inside mb-3 space-y-1">
              <li>Oyun deneyiminizi kişiselleştirmek</li>
              <li>Hesap güvenliğinizi sağlamak</li>
              <li>Liderlik tabloları ve istatistikler oluşturmak</li>
              <li>Uygulama performansını iyileştirmek</li>
            </ul>

            <h4 className="font-semibold mb-2">Veri Güvenliği</h4>
            <p className="mb-3">
              Tüm kişisel verileriniz şifrelenerek güvenli sunucularda saklanır. 
              Verileriniz üçüncü taraflarla paylaşılmaz ve satılmaz.
            </p>

            <h4 className="font-semibold mb-2">Haklarınız</h4>
            <p className="mb-3">
              KVKK kapsamında verilerinize erişme, düzeltme, silme ve veri işlemenin 
              durdurulmasını talep etme haklarına sahipsiniz.
            </p>

            <p className="text-xs text-muted-foreground mt-4">
              İletişim: info@erganmuhendislik.com
            </p>
          </div>

          <div className="flex items-start space-x-3 p-3 border rounded-lg">
            <Checkbox 
              id="kvkk" 
              checked={kvkkAccepted} 
              onCheckedChange={(checked) => setKvkkAccepted(!!checked)}
            />
            <label htmlFor="kvkk" className="text-sm cursor-pointer">
              KVKK metnini okudum, anladım ve kabul ediyorum. Kişisel verilerimin 
              yukarıda belirtilen amaçlarla işlenmesine onay veriyorum.
            </label>
          </div>
        </div>
      ),
    },
    {
      title: 'İzinler',
      description: 'Uygulama özelliklerini kullanabilmek için',
      icon: Bell,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground mb-4">
            Kelimeci'nin tüm özelliklerinden faydalanabilmek için aşağıdaki izinlere ihtiyacımız var:
          </p>

          <div className="space-y-3">
            {/* Bildirim İzni */}
            <div className="p-4 border rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Bell className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium">Bildirimler</p>
                    <p className="text-xs text-muted-foreground">
                      Oyun davetleri ve önemli güncellemeler için
                    </p>
                  </div>
                </div>
                {permissionsGranted.notifications && (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                )}
              </div>
            </div>

            {/* Kamera İzni */}
            <div className="p-4 border rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Camera className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium">Kamera</p>
                    <p className="text-xs text-muted-foreground">
                      Profil fotoğrafı çekmek için
                    </p>
                  </div>
                </div>
                {permissionsGranted.camera && (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                )}
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            * Bu izinleri daha sonra ayarlardan değiştirebilirsiniz
          </p>
        </div>
      ),
    },
  ];

  const requestPermissions = async () => {
    const granted = { notifications: false, camera: false };

    // Bildirim izni
    if (isMobile) {
      try {
        const permission = await PushNotifications.requestPermissions();
        if (permission.receive === 'granted') {
          await PushNotifications.register();
          granted.notifications = true;
          console.log('Bildirim izni verildi ✅');
        }
      } catch (err) {
        console.error('Bildirim izni hatası:', err);
      }
    } else if ('Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        granted.notifications = permission === 'granted';
      } catch (err) {
        console.error('Web bildirim izni hatası:', err);
      }
    }

    // Kamera izni
    if (isMobile) {
      try {
        const permission = await CapacitorCamera.requestPermissions();
        granted.camera = permission.camera === 'granted';
      } catch (err) {
        console.error('Kamera izni hatası:', err);
      }
    }

    setPermissionsGranted(granted);
    return granted;
  };

  const handleNext = async () => {
    if (currentStep === 0) {
      if (!kvkkAccepted) {
        toast.error('Devam etmek için KVKK metnini kabul etmelisiniz');
        return;
      }
      setCurrentStep(1);
    } else if (currentStep === 1) {
      // İzinleri iste
      const granted = await requestPermissions();
      
      // Permission onboarding tamamlandı olarak işaretle
      localStorage.setItem('kelimeci-permissions-completed', 'true');
      
      // Bildirim ayarını kaydet - granted.notifications değerini kullan
      const settings = JSON.parse(localStorage.getItem('kelimeci-settings') || '{}');
      settings.notifications = granted.notifications;
      localStorage.setItem('kelimeci-settings', JSON.stringify(settings));
      
      console.log('✅ Onboarding tamamlandı - Bildirimler:', granted.notifications);
      
      // Custom event dispatch et - onboarding tutorial'ı başlatmak için
      window.dispatchEvent(new Event('permissionsCompleted'));
      
      toast.success('Kurulum tamamlandı! Hoş geldiniz 🎉');
      onComplete();
    }
  };

  const handleSkip = () => {
    localStorage.setItem('kelimeci-permissions-completed', 'true');
    toast.info('Kurulumu atladınız. İzinleri ayarlardan verebilirsiniz.');
    onComplete();
  };

  const CurrentIcon = steps[currentStep].icon;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-md"  onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center space-x-3 mb-2">
            <CurrentIcon className="w-6 h-6 text-primary" />
            <DialogTitle>{steps[currentStep].title}</DialogTitle>
          </div>
          <DialogDescription>{steps[currentStep].description}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {steps[currentStep].content}
        </div>

        <div className="flex justify-between items-center">
          <Button variant="ghost" onClick={handleSkip}>
            Atla
          </Button>
          
          <div className="flex space-x-2">
            {currentStep > 0 && (
              <Button variant="outline" onClick={() => setCurrentStep(currentStep - 1)}>
                Geri
              </Button>
            )}
            <Button 
              onClick={handleNext}
              disabled={currentStep === 0 && !kvkkAccepted}
            >
              {currentStep === steps.length - 1 ? 'Tamamla' : 'İleri'}
            </Button>
          </div>
        </div>

        <div className="flex justify-center space-x-2 mt-2">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-2 w-2 rounded-full transition-colors ${
                index === currentStep ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
