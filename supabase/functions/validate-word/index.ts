import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cache for wordlist to avoid repeated file reads
let wordlistCache: Set<string> | null = null;

async function loadWordlist(): Promise<Set<string>> {
  if (wordlistCache) {
    return wordlistCache;
  }

  try {
    // Load from local wordlist.txt file
    const text = await Deno.readTextFile('./wordlist.txt');
    const words = text.split('\n')
      .map(word => word.trim().toUpperCase())
      .filter(word => word.length >= 3); // En az 3 harfli kelimeler

    wordlistCache = new Set(words);
    console.log(`Loaded ${wordlistCache.size} words from local wordlist`);
    return wordlistCache;
  } catch (error) {
    console.error('Error loading local wordlist:', error);
    // Fallback - temel Türkçe kelimeler
    wordlistCache = new Set([
      'KELIME', 'OYUN', 'TÜRKÇE', 'DİL', 'SES', 'HARF', 'SKOR', 'PUAN',
      'EV', 'OKUL', 'ANNE', 'BABA', 'SU', 'EKMEK', 'MASA', 'SANDALYE',
      'KITAP', 'KALEM', 'DEFTER', 'ÇANTA', 'AYAKKABI', 'GÖMLEK', 'PANTOLON',
      'ARABA', 'OTOBÜS', 'TREN', 'UÇAK', 'GEMİ', 'BİSİKLET', 'MOTOR',
      'TELEFON', 'BİLGİSAYAR', 'TELEVİZYON', 'RADYO', 'MÜZİK', 'ŞARKI',
      'DANS', 'RESİM', 'SANAT', 'SPOR', 'FUTBOL', 'BASKETBOL', 'TENİS',
      'YÜZME', 'KOŞU', 'YÜRÜYÜŞ', 'DAĞCILIK', 'KAMP', 'TATİL', 'SEYAHAT'
    ]);
    return wordlistCache;
  }
}

function calculatePoints(word: string): number {
  // Temel puan hesaplama
  let points = word.length * 10;
  
  // Nadir harfler için bonus
  const rareLetters = ['Ç', 'Ğ', 'J', 'Ö', 'Ş', 'Ü', 'Q', 'W', 'X', 'Z'];
  for (const letter of word) {
    if (rareLetters.includes(letter)) {
      points += 5;
    }
  }
  
  // Uzun kelimeler için bonus
  if (word.length >= 6) points += 20;
  if (word.length >= 8) points += 40;
  
  return points;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { word } = await req.json();
    
    if (!word || typeof word !== 'string') {
      return new Response(
        JSON.stringify({ 
          error: 'Word is required and must be a string' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const upperWord = word.trim().toUpperCase();
    console.log(`Validating word: ${upperWord}`);

    // Load wordlist
    const wordlist = await loadWordlist();
    
    // Check if word exists in our wordlist
    const isValid = wordlist.has(upperWord);
    
    let result;
    if (isValid) {
      const points = calculatePoints(upperWord);
      result = {
        isValid: true,
        points,
        message: `"${upperWord}" geçerli bir kelime! (${points} puan)`
      };
    } else {
      result = {
        isValid: false,
        points: 0,
        message: `"${upperWord}" kelime listesinde bulunamadı.`
      };
    }

    console.log(`Word validation result: ${upperWord} -> ${isValid ? 'valid' : 'invalid'}`);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in word validation:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        isValid: false,
        points: 0,
        message: 'Kelime doğrulama sırasında hata oluştu'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});