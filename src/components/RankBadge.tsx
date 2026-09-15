import { getRankTier, getRankProgress, getNextRankTier } from '@/utils/rankSystem';

interface RankBadgeProps {
  rankPoints: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showProgress?: boolean;
  showRemainingText?: boolean;
  rounded?: boolean;
}

const sizeMap = {
  sm: 'w-12 h-12',
  md: 'w-28 h-28',
  lg: 'w-32 h-32',
};

export const RankBadge = ({ 
  rankPoints, 
  size = 'md', 
  showLabel = true, 
  showProgress = false,
  showRemainingText = true,
  rounded = false
}: RankBadgeProps) => {
  const tier = getRankTier(rankPoints);
  const progress = getRankProgress(rankPoints);
  const nextTier = getNextRankTier(rankPoints);

  const imageClass = rounded ? 'rounded-2xl' : '';
  const frameClass = rounded ? 'border-4 border-yellow-400/60 shadow-xl' : '';

  return (
    <div className="flex flex-col items-center gap-1 w-full">
      <div className={`${sizeMap[size]} relative ${frameClass} ${imageClass} overflow-hidden`}>
        <img
          src={tier.image}
          alt={tier.name}
          className="w-full h-full object-contain"
        />
      </div>
      {showLabel && (
        <div className="text-center">
          <p className="text-xs font-bold text-white">{tier.name}</p>
          <p className="text-[10px] text-white/60">{rankPoints} RP</p>
        </div>
      )}
      {showProgress && nextTier && (
        <div className="w-full mt-1">
          <div className="flex justify-between text-[9px] text-white/50 mb-0.5">
            <span>{tier.name}</span>
            <span>{nextTier.name}</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {showRemainingText && (
            <p className="text-[9px] text-white/40 text-center mt-0.5">
              {nextTier.minPoints - rankPoints} RP kaldı
            </p>
          )}
        </div>
      )}
    </div>
  );
};
