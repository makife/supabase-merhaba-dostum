import React from 'react';
import { Progress } from '@/components/ui/progress';
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
  const progressValue = (base / 5) * 100;

  if (isPremium) {
    return (
      <div className="flex items-center gap-2 bg-gradient-to-r from-accent/20 to-primary/20 rounded-lg p-3 border border-primary/20">
        <Heart className="h-5 w-5 text-primary fill-current" />
        <span className="text-sm font-medium text-primary">Premium - Sınırsız Oyun</span>
      </div>
    );
  }

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
        <Progress 
          value={progressValue} 
          className="h-2 bg-muted" 
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{base}/5 hak</span>
          <span>15dk'da 1 hak yenilenir</span>
        </div>
      </div>
    </div>
  );
};