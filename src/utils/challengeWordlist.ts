// Shared wordlist loader for daily challenges
let wordSet: Set<string> | null = null;
let wordArray: string[] | null = null;
let loadPromise: Promise<void> | null = null;

export const loadChallengeWordlist = async (): Promise<void> => {
  if (wordSet) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const response = await fetch('/wordlist.txt');
      if (!response.ok) throw new Error('Wordlist yüklenemedi');
      const text = await response.text();
      const words = text
        .split('\n')
        .map(w => w.trim())
        .filter(w => w.length >= 3 && w.length <= 25 && /^[A-ZÇĞIİÖŞÜa-zçğıiöşü]+$/.test(w))
        .map(w => w.toLocaleUpperCase('tr-TR'));

      wordSet = new Set(words);
      wordArray = Array.from(wordSet);
    } catch (e) {
      console.error('Challenge wordlist error:', e);
      wordSet = new Set();
      wordArray = [];
    }
  })();

  return loadPromise;
};

export const isValidWord = (word: string): boolean => {
  if (!wordSet) return false;
  return wordSet.has(word.toLocaleUpperCase('tr-TR'));
};

export const getWordsByLength = (len: number): string[] => {
  if (!wordArray) return [];
  return wordArray.filter(w => w.length === len);
};

export const getWordsStartingWith = (letter: string): string[] => {
  if (!wordArray) return [];
  const upper = letter.toLocaleUpperCase('tr-TR');
  return wordArray.filter(w => w.startsWith(upper));
};

export const getRandomWord = (minLen = 3, maxLen = 7): string | null => {
  if (!wordArray) return null;
  const candidates = wordArray.filter(w => w.length >= minLen && w.length <= maxLen);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
};

// Turkish alphabet for letter generation
const TR_LETTERS = 'AAAAAABBCCÇDDEEEEFFGĞHHIIİİKKLLMMNNOOÖPRRSŞTTUUÜVYZ';

export const getRandomLetter = (): string => {
  return TR_LETTERS[Math.floor(Math.random() * TR_LETTERS.length)];
};

export const generateLetterPool = (count: number): string[] => {
  // Ensure at least one vowel and consonant mix
  const vowels = 'AAEEIİOÖUÜ';
  const consonants = 'BBCÇDDFGĞHKKLLMMNNPRRSŞTTVYZ';
  
  const letters: string[] = [];
  // Guarantee some vowels
  const vowelCount = Math.max(4, Math.floor(count * 0.35));
  for (let i = 0; i < vowelCount; i++) {
    letters.push(vowels[Math.floor(Math.random() * vowels.length)]);
  }
  for (let i = vowelCount; i < count; i++) {
    letters.push(consonants[Math.floor(Math.random() * consonants.length)]);
  }
  // Shuffle
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  return letters;
};

export const canFormWord = (word: string, availableLetters: string[]): boolean => {
  const pool = [...availableLetters];
  for (const letter of word.toLocaleUpperCase('tr-TR')) {
    const idx = pool.indexOf(letter);
    if (idx === -1) return false;
    pool.splice(idx, 1);
  }
  return true;
};
