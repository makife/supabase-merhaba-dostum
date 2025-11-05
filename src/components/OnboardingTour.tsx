// components/OnboardingTour.tsx
import { useEffect } from 'react';
import { useOnboarding, OnboardingStep } from '@/hooks/useOnboarding';
import { TourStep } from '@/components/TourStep';
import { FinalStep } from '@/components/FinalStep';

interface OnboardingTourProps {
  steps: OnboardingStep[];
  onComplete: () => void;
  onSkip: () => void;
  finalStep?: {
    title: string;
    description: string;
    skipText: string;
    actionText: string;
  };
}

export const OnboardingTour = ({ 
  steps, 
  onComplete, 
  onSkip,
  finalStep 
}: OnboardingTourProps) => {
  const {
    isOnboardingActive,
    currentStep,
    startOnboarding,
    nextStep,
    prevStep,
    completeOnboarding,
    skipOnboarding
  } = useOnboarding();

  useEffect(() => {
    // Sayfa yüklendiğinde onboarding'i başlat
    const timer = setTimeout(() => {
      startOnboarding();
    }, 1000);

    return () => clearTimeout(timer);
  }, [startOnboarding]);

  const handleNext = () => {
    if (currentStep === steps.length - 1) {
      // Son adıma geldik, final step'i göster
      nextStep();
    } else {
      nextStep();
    }
  };

  const handleComplete = () => {
    completeOnboarding();
    onComplete();
  };

  const handleSkip = () => {
    skipOnboarding();
    onSkip();
  };

  if (!isOnboardingActive) return null;

  // Final step (soru ekranı)
  if (currentStep === steps.length) {
    return (
      <FinalStep
        title={finalStep?.title || "Hazır mısın?"}
        description={finalStep?.description || "Bilgisayara karşı pratik bir oyun oynayarak başlayalım mı?"}
        skipText={finalStep?.skipText || "Atla"}
        actionText={finalStep?.actionText || "Oyna"}
        onSkip={handleSkip}
        onAction={handleComplete}
      />
    );
  }

  // Normal tour steps
  const currentStepData = steps[currentStep];

  return (
    <TourStep
      {...currentStepData}
      currentStep={currentStep}
      totalSteps={steps.length}
      onNext={handleNext}
      onPrev={prevStep}
      onSkip={handleSkip}
      isFirst={currentStep === 0}
      isLast={currentStep === steps.length - 1}
    />
  );
};
