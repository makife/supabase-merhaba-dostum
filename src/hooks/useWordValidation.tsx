import { useState, useEffect, useRef, useCallback } from 'react';

interface WordValidationResult {
  isValid: boolean;
  points: number;
  message: string;
}

export const useWordValidation = () => {
  // TÜM STATE'LER VE REF'LER EN ÜSTTE - HİÇBİR KOŞULLU RETURN YOK
  const [isValidating, setIsValidating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const wordSetRef = useRef<Set<string> | null>(null);
  const loadPromiseRef = useRef<Promise<void> | null>(null);
  const isInitializedRef = useRef(false);

  // TÜM CALLBACK'LER STABLE - DEPENDENCİ ARRAY'LER DOĞRU
  const loadWordList = useCallback(async (): Promise<void> => {
  if (wordSetRef.current !== null || isInitializedRef.current) {
    console.log('📚 Wordlist already loaded, skipping...');
    return;
  }

  isInitializedRef.current = true;

  try {
    console.log('📚 Starting wordlist load...');
    console.log('📚 Fetching from: /wordlist.txt');
    
    const response = await fetch('/wordlist.txt');
    
    if (!response.ok) {
      throw new Error(`Wordlist dosyası bulunamadı! Status: ${response.status}`);
    }
    
    const text = await response.text();
    console.log('📚 Raw text length:', text.length);
    console.log('📚 First 200 chars:', text.slice(0, 200));
    
    console.log('📄 Processing words...');
    const startTime = performance.now();
    
    const rawWords = text
      .split('\n')
      .map(word => word.trim())
      .filter(word => {
        const isValid = word.length >= 3 && 
               word.length <= 25 && 
               /^[A-ZÇĞIİÖŞÜa-zçğıiöşü]+$/.test(word);
        return isValid;
      });
    
    // Sadece Türkçe büyük harfli halini ekle (birebir eşleşme)
    const allWords = new Set<string>();
    
    rawWords.forEach(word => {
      allWords.add(word.toLocaleUpperCase('tr-TR'));
    });
    
    wordSetRef.current = allWords;
    
    const endTime = performance.now();
    const processingTime = Math.round(endTime - startTime);
    
    console.log(`🎉 ${rawWords.length.toLocaleString()} kelime yüklendi!`);
    console.log(`🎉 ${allWords.size.toLocaleString()} toplam varyant (case variants dahil)!`);
    console.log(`⚡ İşlem süresi: ${processingTime}ms`);
    console.log('📚 Sample original words:', rawWords.slice(0, 5));
    console.log('📚 Sample variants:', Array.from(allWords).slice(0, 10));
    
  } catch (error) {
    console.error('❌ Wordlist yüklenirken hata:', error);
    console.log('💡 Çözüm: wordlist.txt dosyasını public/ klasörüne koyduğunuzdan emin olun');
    
    // Boş set oluştur
    wordSetRef.current = new Set<string>();
    console.log('⚠️ Boş wordlist ile devam ediliyor');
  }
}, []);

  const calculatePoints = useCallback((word: string): number => {
    // Not: Gerçek oyun puanlaması GamePage.tsx → validateWordLocal içinde yapılır.
    // Bu fonksiyon yalnızca yedek/uyumluluk amaçlıdır. Aynı formülü kullanır:
    // harf × 2 + nadir harf bonusu (her biri +3), minimum 5.
    const basePoints = word.length * 2;
    const rareLetters = ["J", "Z", "Ğ", "Ü", "Ö", "Ç", "Ş"];
    const upper = word.toLocaleUpperCase("tr-TR");
    let rareBonus = 0;
    for (const letter of upper) {
      if (rareLetters.includes(letter)) rareBonus += 3;
    }
    return Math.max(basePoints + rareBonus, 5);
  }, []); // Boş dependency array

  const validateWord = useCallback(async (word: string): Promise<WordValidationResult> => {
  console.log('🔍 === WORD VALIDATION START ===');
  console.log('🔍 Input word:', word);
  console.log('🔍 Word length:', word.length);
  console.log('🔍 Wordlist loaded:', wordSetRef.current !== null);
  console.log('🔍 Wordlist size:', wordSetRef.current?.size || 0);
  
  // Hızlı pre-validations
  if (word.length < 3) {
    console.log('❌ Word too short');
    return {
      isValid: false,
      points: 0,
      message: 'Kelime en az 3 harf olmalıdır.'
    };
  }

  if (word.length > 25) {
    console.log('❌ Word too long');
    return {
      isValid: false,
      points: 0,
      message: 'Kelime çok uzun.'
    };
  }

  if (!/^[A-ZÇĞIİÖŞÜa-zçğıiöşü]+$/.test(word)) {
    console.log('❌ Invalid characters');
    return {
      isValid: false,
      points: 0,
      message: 'Sadece Türkçe harfler kullanabilirsiniz.'
    };
  }

  setIsValidating(true);

  try {
    // Wordlist henüz yüklenmediyse bekle
    if (loadPromiseRef.current) {
      console.log('⏳ Waiting for wordlist to load...');
      await loadPromiseRef.current;
    }

    // Wordlist kontrolü
    if (!wordSetRef.current) {
      console.log('❌ Wordlist not available');
      return {
        isValid: false,
        points: 0,
        message: 'Sözlük yüklenemedi.'
      };
    }

    const upperWord = word.toLocaleUpperCase('tr-TR');
    console.log('🔍 Checking exact TR word:', upperWord);
    
    let isValid = false;
    let foundVariant = '';
    
    if (wordSetRef.current.has(upperWord)) {
      isValid = true;
      foundVariant = upperWord;
      console.log('✅ Exact match found:', upperWord);
    } else {
      console.log('❌ No exact match for:', upperWord);
    }
    
    const points = isValid ? calculatePoints(word) : 0;

    console.log('🔍 Word found in wordlist (exact):', isValid);
    console.log('🔍 Found as:', foundVariant);
    console.log('🔍 Points calculated:', points);
    
    // Debug: Sample wordlist check
    if (!isValid) {
      console.log('🔍 Sample words from wordlist:', 
        Array.from(wordSetRef.current).slice(0, 10)
      );
      
      // Check if similar words exist
      const similarWords = Array.from(wordSetRef.current).filter(w => 
        w.toLowerCase().includes(word.toLowerCase().slice(0, 3)) || 
        word.toLowerCase().includes(w.toLowerCase().slice(0, 3))
      ).slice(0, 5);
      console.log('🔍 Similar words found:', similarWords);
    }

    const result: WordValidationResult = {
      isValid,
      points,
      message: isValid 
        ? `Doğru! +${points} puan` 
        : 'Bu kelime sözlükte bulunmuyor.'
    };

    console.log('🔍 Final result:', result);
    console.log('🔍 === WORD VALIDATION END ===');
    return result;

  } catch (error) {
    console.error('❌ Kelime doğrulama hatası:', error);
    return {
      isValid: false,
      points: 0,
      message: 'Kelime doğrulanamadı.'
    };
  } finally {
    setIsValidating(false);
  }
}, [calculatePoints]);

  const getWordListStats = useCallback(() => {
    if (!wordSetRef.current) return null;
    
    const allWords = Array.from(wordSetRef.current);
    const lengthGroups = allWords.reduce((acc, word) => {
      const len = word.length;
      acc[len] = (acc[len] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    
    return {
      totalWords: wordSetRef.current.size,
      isLoaded: !isLoading,
      lengthDistribution: lengthGroups,
      sampleWords: allWords.slice(0, 10),
      longestWords: allWords.filter(w => w.length >= 15).slice(0, 5)
    };
  }, [isLoading]); // Stable dependency

  // SADECE BİR useEffect - MOUNT'TA ÇALIŞIR
  useEffect(() => {
    if (!loadPromiseRef.current && !isInitializedRef.current) {
      loadPromiseRef.current = loadWordList().finally(() => {
        setIsLoading(false);
      });
    }
  }, []); // Boş dependency array - sadece mount'ta

  // RETURN HER ZAMAN AYNI SAYIDA HOOK İLE BİTER
  return {
    validateWord,
    isValidating,
    isLoading,
    getWordListStats
  };
};