import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/contexts/UserContext';
import { Heart, Clock } from 'lucide-react';

interface CreditBarProps {
  showRefresh?: boolean;
}

export const CreditBar = ({ showRefresh = false }: CreditBarProps) => {
  const { profile, getDisplayCredits, isPremium, checkAndRefreshCredits } = useUser();
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  // Calculate remaining time for premium or unlimited lives
  useEffect(() => {
    const calculateAndSetTime = () => {
      // Determine which expiry date to use (prefer unlimited_lives_until if active, else premium_until)
      const unlimitedExpiry = profile?.unlimited_lives_until ? new Date(profile.unlimited_lives_until) : null;
      const premiumExpiry = profile?.premium_until ? new Date(profile.premium_until) : null;
      const now = new Date();
      
      // Use unlimited_lives if active, otherwise use premium
      let expiryDate: Date | null = null;
      if (unlimitedExpiry && unlimitedExpiry > now) {
        expiryDate = unlimitedExpiry;
      } else if (premiumExpiry && premiumExpiry > now) {
        expiryDate = premiumExpiry;
      }
      
      if (!expiryDate) {
        setTimeRemaining('');
        return;
      }

      const diff = expiryDate.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining('');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeRemaining(`${days}g ${hours}s`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}s ${minutes}dk`);
      } else if (minutes > 0) {
        setTimeRemaining(`${minutes}dk ${seconds}sn`);
      } else {
        setTimeRemaining(`${seconds}sn`);
      }
    };

    // Initial calculation
    calculateAndSetTime();
    
    // Update every second
    const interval = setInterval(calculateAndSetTime, 1000);

    return () => clearInterval(interval);
  }, [profile?.unlimited_lives_until, profile?.premium_until]);

  if (!profile) return null;

  const { base, bonus } = getDisplayCredits();

  // Check if user has active unlimited lives (temporary package from market)
  const hasUnlimitedLives = profile?.unlimited_lives_until && new Date(profile.unlimited_lives_until) > new Date();
  
  // Check if user has permanent premium subscription
  const hasPermanentPremium = profile?.premium_until && new Date(profile.premium_until) > new Date();

  if (isPremium) {
    return (
      <div className="flex items-center gap-2 bg-gradient-to-r from-accent/20 to-primary/20 rounded-lg p-3 border border-primary/20">
        <Heart className="h-5 w-5 text-primary fill-current" />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-primary">
            {hasPermanentPremium ? 'Premium - Sınırsız Oyun' : 'Sınırsız Oyun'}
          </span>
          {timeRemaining && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Kalan süre: {timeRemaining}
            </span>
          )}
        </div>
      </div>
    );
  }

  // 5 eşit parçalı progress bar segmentleri
  const segments = Array.from({ length: 5 }, (_, i) => {
    const isActive = i < base;
    let segmentColor = 'bg-muted'; // Varsayılan renk (boş)
    
    if (isActive) {
      switch (i + 1) {
        case 1:
          segmentColor = 'bg-red-500'; // 1 hak - kırmızı
          break;
        case 2:
          segmentColor = 'bg-red-400'; // 2 hak - açık kırmızı
          break;
        case 3:
          segmentColor = 'bg-orange-500'; // 3 hak - turuncu
          break;
        case 4:
          segmentColor = 'bg-green-400'; // 4 hak - açık yeşil
          break;
        case 5:
          segmentColor = 'bg-green-500'; // 5 hak - yeşil
          break;
        default:
          segmentColor = 'bg-muted';
      }
    }
    
    return segmentColor;
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-destructive fill-current" />
          <span className="text-sm font-medium">Oyun Hakları</span>
        </div>
        {showRefresh && (
          <button
            onClick={checkAndRefreshCredits}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Yenile
          </button>
        )}
      </div>
      
      <div className="space-y-1">
        {/* 5 Parçalı Progress Bar */}
        <div className="flex gap-1 h-3 w-full">
          {segments.map((color, index) => (
            <div key={index} className="flex-1 rounded-full border border-white p-[1px]">
              <div className={`h-full w-full rounded-full transition-colors duration-300 ${color}`} />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{base + bonus}/5 hak</span>
          <span>15dk'da 1 hak yenilenir</span>
        </div>
      </div>
    </div>
  );
};