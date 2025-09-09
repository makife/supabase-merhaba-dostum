import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/contexts/UserContext';
import { Heart } from 'lucide-react';

interface CreditBarProps {
  showRefresh?: boolean;
}

export const CreditBar = ({ showRefresh = false }: CreditBarProps) => {
  const { profile, getDisplayCredits, isPremium, checkAndRefreshCredits } = useUser();

  if (!profile) return null;

  const { base, bonus } = getDisplayCredits();

  if (isPremium) {
    return (
      <div className="flex items-center gap-2 bg-gradient-to-r from-accent/20 to-primary/20 rounded-lg p-3 border border-primary/20">
        <Heart className="h-5 w-5 text-primary fill-current" />
        <span className="text-sm font-medium text-primary">Premium - Sınırsız Oyun</span>
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
          {bonus > 0 && (
            <Badge variant="secondary" className="text-xs">
              +{bonus}
            </Badge>
          )}
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
        <div className="flex gap-1 h-2 w-full">
          {segments.map((color, index) => (
            <div
              key={index}
              className={`flex-1 rounded-full transition-colors duration-300 ${color}`}
            />
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