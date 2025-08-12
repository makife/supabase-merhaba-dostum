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
    // Eğer zaten yüklenmiş ise çık
    if (wordSetRef.current !== null || isInitializedRef.current) {
      return;
    }

    isInitializedRef.current = true;

    try {
      console.log('📚 65K kelimeli wordlist yükleniyor...');
      
      const response = await fetch('/wordlist.txt');
      
      if (!response.ok) {
        throw new Error(`Wordlist dosyası bulunamadı! Status: ${response.status}`);
      }
      
      const text = await response.text();
      
      console.log('🔄 65K kelime işleniyor...');
      const startTime = performance.now();
      
      const words = text
        .split('\n')
        .map(word => word.trim().toUpperCase())
        .filter(word => {
          return word.length >= 3 && 
                 word.length <= 25 && 
                 /^[A-ZÇĞIİÖŞÜ]+$/.test(word);
        });
      
      wordSetRef.current = new Set(words);
      
      const endTime = performance.now();
      const processingTime = Math.round(endTime - startTime);
      
      console.log(`🎉 ${words.length.toLocaleString()} kelime başarıyla yüklendi!`);
      console.log(`⚡ İşlem süresi: ${processingTime}ms`);
      
    } catch (error) {
      console.error('❌ Wordlist yüklenirken hata:', error);
      console.log('💡 Çözüm: wordlist.txt dosyasını public/ klasörüne koyduğunuzdan emin olun');
      
      // Boş set oluştur - oyun çalışır ama kelime kabul etmez
      wordSetRef.current = new Set<string>();
      console.log('⚠️ Boş wordlist ile devam ediliyor');
    }
  }, []); // Boş dependency array

  const calculatePoints = useCallback((word: string): number => {
    const length = word.length;
    let points = length * 5;
    
    if (length >= 6) points += 10;
    if (length >= 8) points += 20;
    if (length >= 10) points += 30;
    if (length >= 12) points += 50;
    
    const rareLetters = ['Ç', 'Ğ', 'Ş', 'J', 'X', 'Z'];
    const rareBonus = word.toUpperCase().split('').reduce((bonus, letter) => {
      return rareLetters.includes(letter) ? bonus + 5 : bonus;
    }, 0);
    
    return points + rareBonus;
  }, []); // Boş dependency array

  const validateWord = useCallback(async (word: string): Promise<WordValidationResult> => {
    // HİÇBİR KOŞULLU RETURN YOK - SADECE DATA KONTROLÜ
    
    // Hızlı pre-validations
    if (word.length < 3) {
      return {
        isValid: false,
        points: 0,
        message: 'Kelime en az 3 harf olmalıdır.'
      };
    }

    if (word.length > 25) {
      return {
        isValid: false,
        points: 0,
        message: 'Kelime çok uzun.'
      };
    }

    if (!/^[A-ZÇĞIİÖŞÜa-zçğıiöşü]+$/.test(word)) {
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
        await loadPromiseRef.current;
      }

      // O(1) lookup
      const normalizedWord = word.toUpperCase();
      const isValid = wordSetRef.current?.has(normalizedWord) || false;
      const points = isValid ? calculatePoints(word) : 0;

      const result: WordValidationResult = {
        isValid,
        points,
        message: isValid 
          ? `Doğru! +${points} puan` 
          : 'Bu kelime sözlükte bulunmuyor.'
      };

      console.log(`🔍 "${word}" -> ${isValid ? '✅' : '❌'} (${points} puan)`);
      return result;

    } catch (error) {
      console.error('Kelime doğrulama hatası:', error);
      return {
        isValid: false,
        points: 0,
        message: 'Kelime doğrulanamadı.'
      };
    } finally {
      setIsValidating(false);
    }
  }, [calculatePoints]); // Stable dependency

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