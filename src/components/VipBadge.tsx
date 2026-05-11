import React, { useEffect, useState } from 'react';
import Lottie from 'lottie-react';
import { cn } from '@/lib/utils';

interface VipBadgeProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

// Biraz büyütülmüş boyutlar (önceki + ~%30)
const sizeMap = {
  xs: 'w-5 h-5',
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
};

// Module-level cache so the JSON is fetched only once
let _premiumLottieCache: any = null;
let _premiumLottiePromise: Promise<any> | null = null;
const loadPremiumLottie = (): Promise<any> => {
  if (_premiumLottieCache) return Promise.resolve(_premiumLottieCache);
  if (!_premiumLottiePromise) {
    _premiumLottiePromise = fetch('/premiumLottie.json')
      .then((r) => r.json())
      .then((d) => {
        _premiumLottieCache = d;
        return d;
      })
      .catch(() => null);
  }
  return _premiumLottiePromise;
};

export const VipBadge: React.FC<VipBadgeProps> = ({ size = 'sm', className }) => {
  const [data, setData] = useState<any>(_premiumLottieCache);

  useEffect(() => {
    if (!data) loadPremiumLottie().then((d) => d && setData(d));
  }, [data]);

  return (
    <div
      className={cn('inline-block shrink-0', sizeMap[size], className)}
      title="VIP"
    >
      {data ? (
        <Lottie
          animationData={data}
          loop
          autoplay
          style={{ width: '100%', height: '100%' }}
        />
      ) : null}
    </div>
  );
};

/**
 * Helper to check if a user has active VIP/premium subscription
 */
export const isUserPremium = (premiumUntil: string | null | undefined): boolean => {
  if (!premiumUntil) return false;
  return new Date(premiumUntil) > new Date();
};
