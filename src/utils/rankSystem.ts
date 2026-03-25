// Rank sistemi - Sadece rastgele eşleşme maçları için

export interface RankTier {
  id: string;
  name: string;
  minPoints: number;
  maxPoints: number; // Infinity for top tier
  image: string;
  displayName: string; // "Çırak-1", "Katip-2", etc.
  group: string;       // "cirak", "katip", etc.
  subLevel: number;    // 1, 2, 3 (or 4 for cirak)
}

// Puan dağılımı (artan aralıklarla, toplam ~5500):
// Çırak  (4 sub): 0–100–200–320  → her biri ~100-120 puan
// Katip  (3 sub): 320–500–720    → ~180-220 puan
// Yazar  (3 sub): 720–980–1280   → ~260-300 puan
// Şair   (3 sub): 1280–1620–2000 → ~340-380 puan
// Bilge  (3 sub): 2000–2450–2950 → ~450-500 puan
// Efsane (3 sub): 2950–3530–4160 → ~580-630 puan
// Üstat  (3 sub): 4160–4860–5500 → ~700 puan

export const RANK_TIERS: RankTier[] = [
  // Çırak (birinciYesil) - 4 sub seviye
  { id: 'cirak_1',   group: 'cirak',   subLevel: 1, name: 'Çırak-1',   displayName: 'Çırak-1',   minPoints: 0,    maxPoints: 100,      image: '/ranks/birinciYesil1.svg' },
  { id: 'cirak_2',   group: 'cirak',   subLevel: 2, name: 'Çırak-2',   displayName: 'Çırak-2',   minPoints: 100,  maxPoints: 210,      image: '/ranks/birinciYesil2.svg' },
  { id: 'cirak_3',   group: 'cirak',   subLevel: 3, name: 'Çırak-3',   displayName: 'Çırak-3',   minPoints: 210,  maxPoints: 320,      image: '/ranks/birinciYesil3.svg' },
  { id: 'cirak_4',   group: 'cirak',   subLevel: 4, name: 'Çırak-4',   displayName: 'Çırak-4',   minPoints: 320,  maxPoints: 450,      image: '/ranks/birinciYesil4.svg' },

  // Katip (ikinciMavi) - 3 sub seviye
  { id: 'katip_1',   group: 'katip',   subLevel: 1, name: 'Katip-1',   displayName: 'Katip-1',   minPoints: 450,  maxPoints: 630,      image: '/ranks/ikinciMavi1.svg' },
  { id: 'katip_2',   group: 'katip',   subLevel: 2, name: 'Katip-2',   displayName: 'Katip-2',   minPoints: 630,  maxPoints: 840,      image: '/ranks/ikinciMavi2.svg' },
  { id: 'katip_3',   group: 'katip',   subLevel: 3, name: 'Katip-3',   displayName: 'Katip-3',   minPoints: 840,  maxPoints: 1080,     image: '/ranks/ikinciMavi3.svg' },

  // Yazar (ucuncuKahverengi) - 3 sub seviye
  { id: 'yazar_1',   group: 'yazar',   subLevel: 1, name: 'Yazar-1',   displayName: 'Yazar-1',   minPoints: 1080, maxPoints: 1340,     image: '/ranks/ucuncuKahverengi1.svg' },
  { id: 'yazar_2',   group: 'yazar',   subLevel: 2, name: 'Yazar-2',   displayName: 'Yazar-2',   minPoints: 1340, maxPoints: 1640,     image: '/ranks/ucuncuKahverengi2.svg' },
  { id: 'yazar_3',   group: 'yazar',   subLevel: 3, name: 'Yazar-3',   displayName: 'Yazar-3',   minPoints: 1640, maxPoints: 1980,     image: '/ranks/ucuncuKahverengi3.svg' },

  // Şair (dorduncuKirmizi) - 3 sub seviye
  { id: 'sair_1',    group: 'sair',    subLevel: 1, name: 'Şair-1',    displayName: 'Şair-1',    minPoints: 1980, maxPoints: 2360,     image: '/ranks/dorduncuKirmizi1.svg' },
  { id: 'sair_2',    group: 'sair',    subLevel: 2, name: 'Şair-2',    displayName: 'Şair-2',    minPoints: 2360, maxPoints: 2780,     image: '/ranks/dorduncuKirmizi2.svg' },
  { id: 'sair_3',    group: 'sair',    subLevel: 3, name: 'Şair-3',    displayName: 'Şair-3',    minPoints: 2780, maxPoints: 3240,     image: '/ranks/dorduncuKirmizi3.svg' },

  // Bilge (besinciSari) - 3 sub seviye
  { id: 'bilge_1',   group: 'bilge',   subLevel: 1, name: 'Bilge-1',   displayName: 'Bilge-1',   minPoints: 3240, maxPoints: 3740,     image: '/ranks/besinciSari1.svg' },
  { id: 'bilge_2',   group: 'bilge',   subLevel: 2, name: 'Bilge-2',   displayName: 'Bilge-2',   minPoints: 3740, maxPoints: 4290,     image: '/ranks/besinciSari2.svg' },
  { id: 'bilge_3',   group: 'bilge',   subLevel: 3, name: 'Bilge-3',   displayName: 'Bilge-3',   minPoints: 4290, maxPoints: 4700,     image: '/ranks/besinciSari3.svg' },

  // Efsane (altinciGri) - 3 sub seviye
  { id: 'efsane_1',  group: 'efsane',  subLevel: 1, name: 'Efsane-1',  displayName: 'Efsane-1',  minPoints: 4700, maxPoints: 4980,     image: '/ranks/altinciGri1.svg' },
  { id: 'efsane_2',  group: 'efsane',  subLevel: 2, name: 'Efsane-2',  displayName: 'Efsane-2',  minPoints: 4980, maxPoints: 5200,     image: '/ranks/altinciGri2.svg' },
  { id: 'efsane_3',  group: 'efsane',  subLevel: 3, name: 'Efsane-3',  displayName: 'Efsane-3',  minPoints: 5200, maxPoints: 5350,     image: '/ranks/altinciGri3.svg' },

  // Üstat (yedinciElit) - 3 sub seviye
  { id: 'ustat_1',   group: 'ustat',   subLevel: 1, name: 'Üstat-1',   displayName: 'Üstat-1',   minPoints: 5350, maxPoints: 5430,     image: '/ranks/yedinciElit1.svg' },
  { id: 'ustat_2',   group: 'ustat',   subLevel: 2, name: 'Üstat-2',   displayName: 'Üstat-2',   minPoints: 5430, maxPoints: 5480,     image: '/ranks/yedinciElit2.svg' },
  { id: 'ustat_3',   group: 'ustat',   subLevel: 3, name: 'Üstat-3',   displayName: 'Üstat-3',   minPoints: 5480, maxPoints: Infinity, image: '/ranks/yedinciElit3.svg' },
];

export const RANK_WIN_POINTS  = 50;
export const RANK_LOSS_POINTS = -30;
export const RANK_DRAW_POINTS = 10;

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

// Aynı gruptaki tüm sub-tier'ları döndürür (progress bar için)
export function getGroupTiers(group: string): RankTier[] {
  return RANK_TIERS.filter(t => t.group === group);
}
