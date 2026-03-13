// Rank sistemi - Sadece rastgele eşleşme maçları için
export interface RankTier {
  id: string;
  name: string;
  minPoints: number;
  maxPoints: number; // Infinity for top tier
  image: string;
}

export const RANK_TIERS: RankTier[] = [
  { id: 'cirak',  name: 'Çırak',   minPoints: 0,    maxPoints: 400,      image: '/cirak.png' },
  { id: 'katip',  name: 'Katip',   minPoints: 400,  maxPoints: 1000,     image: '/katip.png' },
  { id: 'yazar',  name: 'Yazar',   minPoints: 1000, maxPoints: 1800,     image: '/yazar.png' },
  { id: 'sair',   name: 'Şair',    minPoints: 1800, maxPoints: 2800,     image: '/sair.png' },
  { id: 'bilge',  name: 'Bilge',   minPoints: 2800, maxPoints: 4000,     image: '/bilge.png' },
  { id: 'efsane', name: 'Efsane',  minPoints: 4000, maxPoints: Infinity, image: '/efsane.png' },
];

export const RANK_WIN_POINTS = 50;
export const RANK_LOSS_POINTS = -30;

export function getRankTier(rankPoints: number): RankTier {
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (rankPoints >= RANK_TIERS[i].minPoints) {
      return RANK_TIERS[i];
    }
  }
  return RANK_TIERS[0];
}

export function getRankProgress(rankPoints: number): number {
  const tier = getRankTier(rankPoints);
  if (tier.maxPoints === Infinity) return 100;
  const range = tier.maxPoints - tier.minPoints;
  const progress = rankPoints - tier.minPoints;
  return Math.min(100, Math.round((progress / range) * 100));
}

export function getNextRankTier(rankPoints: number): RankTier | null {
  const currentTier = getRankTier(rankPoints);
  const idx = RANK_TIERS.findIndex(t => t.id === currentTier.id);
  if (idx < RANK_TIERS.length - 1) return RANK_TIERS[idx + 1];
  return null;
}
