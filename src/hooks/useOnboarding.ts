// hooks/useOnboarding.ts
import { useState, useEffect } from 'react';

export interface OnboardingStep {
  target: string;
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const useOnboarding = () => {
  const [isOnboardingActive, setIsOnboardingActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    // LocalStorage'dan onboarding durumunu kontrol et
    const onboardingCompleted = localStorage.getItem('kelimeci-onboarding-completed');
    if (!onboardingCompleted) {
      setIsOnboardingActive(true);
    }
  }, []);

  const startOnboarding = () => {
    setIsOnboardingActive(true);
    setCurrentStep(0);
    setCompleted(false);
  };

  const nextStep = () => {
    setCurrentStep(prev => prev + 1);
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  };

  const completeOnboarding = () => {
    setIsOnboardingActive(false);
    setCompleted(true);
    localStorage.setItem('kelimeci-onboarding-completed', 'true');
  };

  const skipOnboarding = () => {
    setIsOnboardingActive(false);
    setCompleted(true);
    localStorage.setItem('kelimeci-onboarding-completed', 'true');
  };

  return {
    isOnboardingActive,
    currentStep,
    completed,
    startOnboarding,
    nextStep,
    prevStep,
    completeOnboarding,
    skipOnboarding
  };
};
