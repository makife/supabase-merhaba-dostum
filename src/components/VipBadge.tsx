import React from 'react';
import { cn } from '@/lib/utils';

interface VipBadgeProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-7 h-7',
};

export const VipBadge: React.FC<VipBadgeProps> = ({ size = 'sm', className }) => {
  return (
    <div
      className={cn(
        'rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center border-2 border-white/80 shadow-lg',
        sizeMap[size],
        className
      )}
      title="VIP Yazar"
    >
      <svg
        viewBox="0 0 512 512"
        className="w-[60%] h-[60%]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Certificate body */}
        <path
          d="M501 37v278c0 15-12 28-28 28H39c-15 0-28-13-28-28V37C11 22 24 9 39 9h434c16 0 28 13 28 28z"
          fill="#fff"
          fillOpacity="0.9"
        />
        {/* Top bar */}
        <path
          d="M501 37v30H11V37c0-15 13-28 28-28h434c16 0 28 13 28 28z"
          fill="#F23488"
        />
        {/* Medal ribbons */}
        <path
          d="M181 374l-42 96 47-7 27 40 39-90h10l39 90 27-40 47 7-42-96H181z"
          fill="#F23488"
        />
        {/* Medal body */}
        <path
          d="M340 315c0-17 9-36 1-49-8-14-29-16-43-24-14-8-26-26-42-26s-29 18-42 26c-14 8-36 10-44 24-7 13 2 32 2 49s-9 36-2 49c8 14 30 16 44 24 13 8 25 26 42 26s28-18 42-26c14-8 35-10 43-24 8-13-1-32-1-49z"
          fill="#EA9B22"
        />
        {/* Medal center */}
        <circle cx="256" cy="315" r="46" fill="#F23488" />
        {/* Text lines */}
        <rect x="52" y="98" width="140" height="8" rx="4" fill="#EA9B22" fillOpacity="0.4" />
        <rect x="52" y="145" width="176" height="8" rx="4" fill="#ccc" fillOpacity="0.5" />
        <rect x="52" y="192" width="135" height="8" rx="4" fill="#ccc" fillOpacity="0.5" />
        <rect x="284" y="145" width="166" height="8" rx="4" fill="#ccc" fillOpacity="0.5" />
        <rect x="315" y="192" width="135" height="8" rx="4" fill="#ccc" fillOpacity="0.5" />
        <rect x="367" y="239" width="83" height="8" rx="4" fill="#ccc" fillOpacity="0.5" />
        <rect x="52" y="239" width="83" height="8" rx="4" fill="#ccc" fillOpacity="0.5" />
      </svg>
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
