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
  // Çırak grubu (birinciYesil) - 4 sub seviye
  { id: 'cirak_1',   group: 'cirak',   subLevel: 1, name: 'Harf Çırağı',       displayName: 'Harf Çırağı',       minPoints: 0,    maxPoints: 100,      image: '/ranklar/birinciYesil1.svg' },
  { id: 'cirak_2',   group: 'cirak',   subLevel: 2, name: 'Hece Toplayıcı',    displayName: 'Hece Toplayıcı',    minPoints: 100,  maxPoints: 210,      image: '/ranklar/birinciYesil2.svg' },
  { id: 'cirak_3',   group: 'cirak',   subLevel: 3, name: 'Kelime Fidanı',     displayName: 'Kelime Fidanı',     minPoints: 210,  maxPoints: 320,      image: '/ranklar/birinciYesil3.svg' },
  { id: 'cirak_4',   group: 'cirak',   subLevel: 4, name: 'Söz Tomurcuğu',     displayName: 'Söz Tomurcuğu',     minPoints: 320,  maxPoints: 450,      image: '/ranklar/birinciYesil4.svg' },

  // Katip grubu (ikinciMavi) - 3 sub seviye
  { id: 'katip_1',   group: 'katip',   subLevel: 1, name: 'Mürekkep Yolcusu',  displayName: 'Mürekkep Yolcusu',  minPoints: 450,  maxPoints: 630,      image: '/ranklar/ikinciMavi1.svg' },
  { id: 'katip_2',   group: 'katip',   subLevel: 2, name: 'Defter Bekçisi',    displayName: 'Defter Bekçisi',    minPoints: 630,  maxPoints: 840,      image: '/ranklar/ikinciMavi2.svg' },
  { id: 'katip_3',   group: 'katip',   subLevel: 3, name: 'Satır Dokumacısı',  displayName: 'Satır Dokumacısı',  minPoints: 840,  maxPoints: 1080,     image: '/ranklar/ikinciMavi3.svg' },

  // Yazar grubu (ucuncuKahverengi) - 3 sub seviye
  { id: 'yazar_1',   group: 'yazar',   subLevel: 1, name: 'Kalem Zanaatkârı', displayName: 'Kalem Zanaatkârı', minPoints: 1080, maxPoints: 1340,     image: '/ranklar/ucuncuKahverengi1.svg' },
  { id: 'yazar_2',   group: 'yazar',   subLevel: 2, name: 'Divan Şakirdi',     displayName: 'Divan Şakirdi',     minPoints: 1340, maxPoints: 1640,     image: '/ranklar/ucuncuKahverengi2.svg' },
  { id: 'yazar_3',   group: 'yazar',   subLevel: 3, name: 'Beyit İşçisi',      displayName: 'Beyit İşçisi',      minPoints: 1640, maxPoints: 1980,     image: '/ranklar/ucuncuKahverengi3.svg' },

  // Şair grubu (dorduncuKirmizi) - 3 sub seviye
  { id: 'sair_1',    group: 'sair',    subLevel: 1, name: 'Gazel Nakkaşı',     displayName: 'Gazel Nakkaşı',     minPoints: 1980, maxPoints: 2360,     image: '/ranklar/dorduncuKirmizi1.svg' },
  { id: 'sair_2',    group: 'sair',    subLevel: 2, name: 'Mısra Mimarı',      displayName: 'Mısra Mimarı',      minPoints: 2360, maxPoints: 2780,     image: '/ranklar/dorduncuKirmizi2.svg' },
  { id: 'sair_3',    group: 'sair',    subLevel: 3, name: 'Kaside Hattatı',    displayName: 'Kaside Hattatı',    minPoints: 2780, maxPoints: 3240,     image: '/ranklar/dorduncuKirmizi3.svg' },

  // Bilge grubu (besinciSari) - 3 sub seviye
  { id: 'bilge_1',   group: 'bilge',   subLevel: 1, name: 'Söz Simyacısı',     displayName: 'Söz Simyacısı',     minPoints: 3240, maxPoints: 3740,     image: '/ranklar/besinciSari1.svg' },
  { id: 'bilge_2',   group: 'bilge',   subLevel: 2, name: 'Hikmet Dervişi',    displayName: 'Hikmet Dervişi',    minPoints: 3740, maxPoints: 4290,     image: '/ranklar/besinciSari2.svg' },
  { id: 'bilge_3',   group: 'bilge',   subLevel: 3, name: 'İrfan Şeyhi',       displayName: 'İrfan Şeyhi',       minPoints: 4290, maxPoints: 4700,     image: '/ranklar/besinciSari3.svg' },

  // Efsane grubu (altinciGri) - 3 sub seviye
  { id: 'efsane_1',  group: 'efsane',  subLevel: 1, name: 'Lügat Filozofu',    displayName: 'Lügat Filozofu',    minPoints: 4700, maxPoints: 4980,     image: '/ranklar/altinciGri1.svg' },
  { id: 'efsane_2',  group: 'efsane',  subLevel: 2, name: 'Efsane Ozan',       displayName: 'Efsane Ozan',       minPoints: 4980, maxPoints: 5200,     image: '/ranklar/altinciGri2.svg' },
  { id: 'efsane_3',  group: 'efsane',  subLevel: 3, name: 'Söz Sultanı',       displayName: 'Söz Sultanı',       minPoints: 5200, maxPoints: 5350,     image: '/ranklar/altinciGri3.svg' },

  // Üstat grubu (yedinciElit) - 3 sub seviye
  { id: 'ustat_1',   group: 'ustat',   subLevel: 1, name: 'Kelime Piri',       displayName: 'Kelime Piri',       minPoints: 5350, maxPoints: 5430,     image: '/ranklar/yedinciElit1.svg' },
  { id: 'ustat_2',   group: 'ustat',   subLevel: 2, name: 'Lisan-ı Üstad',     displayName: 'Lisan-ı Üstad',     minPoints: 5430, maxPoints: 5480,     image: '/ranklar/yedinciElit2.svg' },
  { id: 'ustat_3',   group: 'ustat',   subLevel: 3, name: 'Kelâm-ı Ezel',      displayName: 'Kelâm-ı Ezel',      minPoints: 5480, maxPoints: Infinity, image: '/ranklar/yedinciElit3.svg' },
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

// Rank çerçevesi: her iki rankta bir değişir (rank1 → rank11)
export function getRankFrame(rankPoints: number): string {
  const tier = getRankTier(rankPoints);
  const idx = RANK_TIERS.findIndex(t => t.id === tier.id);
  const frameNo = Math.min(11, Math.floor(idx / 2) + 1);
  return `/rankCerceve/${frameNo}rank.webp`;
}

// Aynı gruptaki tüm sub-tier'ları döndürür (progress bar için)
export function getGroupTiers(group: string): RankTier[] {
  return RANK_TIERS.filter(t => t.group === group);
}
