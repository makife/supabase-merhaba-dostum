import { TournamentParticipant, TournamentMatch } from "@/types/tournament";

export const formatTournamentTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const calculateTimeRemaining = (expiresAt: string, serverTimeOffset: number = 0): number => {
  const expiry = new Date(expiresAt).getTime();
  const now = Date.now() + serverTimeOffset;
  return Math.max(0, Math.floor((expiry - now) / 1000));
};

export const getRealPlayerCount = (participants: TournamentParticipant[]): number => {
  return participants.filter((p) => !p.is_bot).length;
};

export const getBotCount = (participants: TournamentParticipant[]): number => {
  return participants.filter((p) => p.is_bot).length;
};

export const isUserInTournament = (participants: TournamentParticipant[], userId: string): boolean => {
  return participants.some((p) => p.user_id === userId && !p.is_bot);
};

export const getTournamentStatusMessage = (realPlayerCount: number) => {
  if (realPlayerCount < 2) {
    return {
      text: "En az 2 oyuncu gerekli",
      color: "text-red-400",
      emoji: "⚠️",
    };
  }

  if (realPlayerCount >= 8) {
    return {
      text: "TAM KADRO! 8 oyunculu turnuva",
      color: "text-yellow-400",
      emoji: "🔥",
    };
  }

  if (realPlayerCount >= 4) {
    return {
      text: "Yeterli oyuncu var, harika bir turnuva olacak!",
      color: "text-green-400",
      emoji: "✅",
    };
  }

  return {
    text: `${8 - realPlayerCount} eksik oyuncu bekleniyor`,
    color: "text-gray-300",
    emoji: "🤖",
  };
};

export const organizeMatchesByRound = (matches: TournamentMatch[]) => {
  const rounds: { [key: number]: TournamentMatch[] } = {};

  matches.forEach((match) => {
    if (!rounds[match.round]) {
      rounds[match.round] = [];
    }
    rounds[match.round].push(match);
  });

  // Sort matches within each round
  Object.keys(rounds).forEach((round) => {
    rounds[parseInt(round)].sort((a, b) => a.match_number - b.match_number);
  });

  return rounds;
};

export const getRoundName = (round: number): string => {
  switch (round) {
    case 1:
      return "Çeyrek Final";
    case 2:
      return "Yarı Final";
    case 3:
      return "Final";
    default:
      return `${round}. Tur`;
  }
};

export const getMatchStatus = (match: TournamentMatch): string => {
  switch (match.status) {
    case "pending":
      return "Bekliyor";
    case "in_progress":
      return "Oynanıyor";
    case "completed":
      return "Tamamlandı";
    default:
      return "Bilinmiyor";
  }
};

// Erkek isimleri
const maleNames = [
  "ahmet", "mehmet", "ali", "veli", "mustafa", "emre", "can", "burak", 
  "yusuf", "berk", "arda", "efe", "emir", "kaan", "mert", "kerem",
  "bora", "doruk", "eren", "alp", "ege", "tunç", "uras", "çağlar",
  "koray", "tolga", "onur", "umut", "barış"
];

// Kız isimleri
const femaleNames = [
  "ayşe", "fatma", "zeynep", "elif", "ece", "selin", "merve", "özge",
  "sude", "ada", "defne", "ilayda", "asya", "nisa", "irem", "ela",
  "nehir", "maya", "eylül", "lara", "derin", "pelin", "damla", "su",
  "ceren", "begüm", "deniz"
];

// Tüm isimler (generateBotName için)
const allNames = [...maleNames, ...femaleNames];

// İsmin erkek mi kız mı olduğunu kontrol et
export const isMaleName = (name: string): boolean => {
  const baseName = name.toLowerCase().replace(/[0-9_\.]/g, '').replace(/(.)\1+$/, '$1');
  return maleNames.includes(baseName);
};

// Avatar havuzları — /public/avatarlar/ içindeki 1..90 SVG'leri cinsiyete göre bölünmüş
// (yaklaşık eşit dağılım; isim cinsiyeti ile uyumlu avatar seçilir)
const femaleAvatarIndexes = [2,3,12,14,15,18,19,20,21,22,24,26,29,30,31,32,36,37,39,41,42,44,45,51,52,53,54,55,56,57,58,59,60,61,62,74,76,77,78,79,80,82,83,84,85,86,90];
const femaleAvatarSet = new Set(femaleAvatarIndexes);
const maleAvatarIndexes = Array.from({ length: 90 }, (_, i) => i + 1).filter(n => !femaleAvatarSet.has(n));

// İsme göre bot avatarı oluştur — cinsiyete uyumlu /avatarlar/{n}.svg
export const generateBotAvatar = (seed: number, botName?: string): string => {
  const pool = botName && !isMaleName(botName) ? femaleAvatarIndexes : maleAvatarIndexes;
  const avatarIndex = pool[Math.abs(seed) % pool.length];
  return `/avatarlar/${avatarIndex}.svg`;
};

export const generateBotName = (index: number): string => {
  // Seeded RNG (deterministic) using index
  let seed = index >>> 0 || 0;
  const next = (mod: number) => {
    seed = (seed * 1664525 + 1013904223) >>> 0; // LCG
    return seed % mod;
  };

  // Keep mapping deterministic based on index
  const nameIndex = Math.abs(index) % allNames.length;
  const decorationIndex = Math.floor(Math.abs(index) / allNames.length) % 9;

  const baseName = allNames[nameIndex];
  const num4 = 1000 + next(9000); // 4-digit
  const num2 = 10 + next(90); // 2-digit
  const num3 = 100 + next(900); // 3-digit

  const decorations = [
    (name: string) => name + String(num4),
    (name: string) => name + "_",
    (name: string) => "_" + name,
    (name: string) => "_" + name + "_",
    (name: string) => name + name.charAt(name.length - 1).repeat(2),
    (name: string) => name.charAt(0) + name.slice(1) + String(num2),
    (name: string) => name + "." + String(next(100)),
    (name: string) => name.charAt(0).toUpperCase() + name.slice(1) + String(num3),
    (name: string) => name,
  ];

  return decorations[decorationIndex](baseName);
};
