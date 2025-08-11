import { useState, useEffect, useRef, useCallback } from 'react';

interface WordValidationResult {
  isValid: boolean;
  points: number;
  message: string;
}

export const useWordValidation = () => {
  const [isValidating, setIsValidating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const wordSetRef = useRef<Set<string> | null>(null);
  const loadPromiseRef = useRef<Promise<void> | null>(null);
  const isInitializedRef = useRef(false);

  // DÜZELTME: loadWordList fonksiyonunu useCallback ile stabilize et
  const loadWordList = useCallback(async (): Promise<void> => {
    if (wordSetRef.current !== null || isInitializedRef.current) {
      return; // Zaten yüklenmiş
    }

    isInitializedRef.current = true;

    try {
      console.log('📚 65K kelimeli wordlist yükleniyor...');
      
      // Public klasöründen yükle
      const response = await fetch('/wordlist.txt');
      
      if (!response.ok) {
        throw new Error(`Wordlist dosyası bulunamadı! Status: ${response.status}`);
      }
      
      const text = await response.text();
      
      console.log('🔄 65K kelime işleniyor...');
      const startTime = performance.now();
      
      // Büyük dosya için optimize edilmiş processing
      const words = text
        .split('\n')
        .map(word => word.trim().toUpperCase()) // Türkçe karakterler için
        .filter(word => {
          // Hızlı filtreleme: sadece geçerli Türkçe kelimeleri al
          return word.length >= 3 && 
                 word.length <= 25 && 
                 /^[A-ZÇĞIİÖŞÜ]+$/.test(word);
        });
      
      // Set'e dönüştür (65K kelime için optimize edilmiş)
      wordSetRef.current = new Set(words);
      
      const endTime = performance.now();
      const processingTime = Math.round(endTime - startTime);
      
      console.log(`🎉 ${words.length.toLocaleString()} kelime başarıyla yüklendi!`);
      console.log(`⚡ İşlem süresi: ${processingTime}ms`);
      console.log(`📊 Memory kullanımı: ~${Math.round(words.length * 10 / 1024)} KB`);
      
    } catch (error) {
      console.error('❌ Wordlist yüklenirken hata:', error);
      console.log('💡 Çözüm: wordlist.txt dosyasını public/ klasörüne koyduğunuzdan emin olun');
      
      // Son çare: boş set oluştur (oyun çalışır ama kelime kabul etmez)
      wordSetRef.current = new Set<string>();
      console.log('⚠️ Boş wordlist ile devam ediliyor - hiçbir kelime kabul edilmeyecek');
    }
  }, []);

  // DÜZELTME: calculatePoints fonksiyonunu useCallback ile stabilize et
  const calculatePoints = useCallback((word: string): number => {
    const length = word.length;
    
    // Base points - her harf 5 puan
    let points = length * 5;
    
    // Uzunluk bonusları
    if (length >= 6) points += 10;  // 6+ harf bonus
    if (length >= 8) points += 20;  // 8+ harf bonus
    if (length >= 10) points += 30; // 10+ harf bonus
    if (length >= 12) points += 50; // 12+ harf büyük bonus
    
    // Nadir harf bonusları (Türkçe'de daha az kullanılan)
    const rareLetters = ['Ç', 'Ğ', 'Ş', 'J', 'X', 'Z'];
    const rareBonus = word.toUpperCase().split('').reduce((bonus, letter) => {
      return rareLetters.includes(letter) ? bonus + 5 : bonus;
    }, 0);
    
    return points + rareBonus;
  }, []);

  // DÜZELTME: validateWord fonksiyonunu stabilize et
  const validateWord = useCallback(async (word: string): Promise<WordValidationResult> => {
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

    // Türkçe karakter kontrolü
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

      // Super fast O(1) lookup - Set'den kontrol et
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

      // Debug log
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
  }, [calculatePoints]); // calculatePoints dependency'si eklendi

  // DÜZELTME: getWordListStats fonksiyonunu stabilize et
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
  }, [isLoading]);

  // DÜZELTME: Component mount olduğunda wordlist'i yükle - sadece bir kez
  useEffect(() => {
    if (!loadPromiseRef.current && !isInitializedRef.current) {
      loadPromiseRef.current = loadWordList().finally(() => {
        setIsLoading(false);
      });
    }
  }, []); // Boş dependency array - sadece mount'ta çalışır

  return {
    validateWord,
    isValidating,
    isLoading,
    getWordListStats // Debug için - production'da silinebilir
  };
};