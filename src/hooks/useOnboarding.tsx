import { useState, useEffect } from "react";

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string; // CSS selector for highlighting
  position?: "top" | "bottom" | "left" | "right";
}

export const useOnboarding = () => {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const ONBOARDING_KEY = "kelimeci-onboarding-completed";
  const PERMISSIONS_KEY = "kelimeci-permissions-completed";

  useEffect(() => {
    // İlk açılışta onboarding'i göster - ancak permission onboarding'den sonra
    const hasSeenOnboarding = localStorage.getItem(ONBOARDING_KEY);
    const hasCompletedPermissions = localStorage.getItem(PERMISSIONS_KEY);
    
    if (!hasSeenOnboarding && hasCompletedPermissions) {
      // 500ms gecikme ile göster (permission dialog kapandıktan sonra)
      setTimeout(() => {
        setShowOnboarding(true);
      }, 500);
    }
  }, []);

  const steps: OnboardingStep[] = [
    {
      id: "welcome",
      title: "Kelime Oyununa Hoş Geldiniz! 🎮",
      description: "Size oyunun özelliklerini tanıtmak isteriz. Hazırsanız başlayalım!",
    },
    {
      id: "floating-menu",
      title: "Yüzer Menü 📱",
      description: "Sağ alttaki yüzer menüden profil, liderlik tablosu, ayarlar ve daha fazlasına erişebilirsiniz.",
      targetSelector: '[data-onboarding="floating-menu"]',
      position: "left",
    },
    {
      id: "daily-wheel",
      title: "Günlük Çark 🎡",
      description: "Her gün çarkı çevirip ödüller kazanabilirsiniz! Joker, kredi ve daha fazlası...",
      targetSelector: '[data-onboarding="daily-wheel"]',
      position: "bottom",
    },
    {
      id: "mini-games",
      title: "Mini Oyunlar 🎯",
      description: "Hafıza oyunu, puzzle, yılan ve daha fazlası! Eğlenceli mini oyunlarla vakit geçirin.",
      targetSelector: '[data-onboarding="mini-games"]',
      position: "bottom",
    },
    {
      id: "game-modes",
      title: "Oyun Modları 🎮",
      description: "Bilgisayara karşı, rastgele eşleşme, özel oda veya turnuva! Favori oyun modunuzu seçin.",
      targetSelector: '[data-onboarding="game-modes"]',
      position: "top",
    },
    {
      id: "demo",
      title: "Örnek Oyun Oynayalım! 🚀",
      description: "Şimdi bilgisayara karşı bir örnek oyun oynayarak oyunu öğrenelim!",
    },
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      completeOnboarding();
    }
  };

  const skipOnboarding = () => {
    completeOnboarding();
  };

  const completeOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setShowOnboarding(false);
    setCurrentStep(0);
  };

  const startDemoGame = () => {
    completeOnboarding();
    // Demo oyunu başlatma eventi
    window.dispatchEvent(new CustomEvent("startDemoGame"));
  };

  const resetOnboarding = () => {
    localStorage.removeItem(ONBOARDING_KEY);
    setCurrentStep(0);
    setShowOnboarding(true);
  };

  return {
    showOnboarding,
    currentStep,
    steps,
    nextStep,
    skipOnboarding,
    completeOnboarding,
    startDemoGame,
    resetOnboarding,
  };
};
