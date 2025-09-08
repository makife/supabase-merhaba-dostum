import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { TURKISH_WORDS_RAW } from "./wordlist-data.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cache for wordlist to avoid repeated processing
let wordlistCache: Set<string> | null = null;

// Turkish character normalization function
function normalizeTurkishWord(word: string): string {
  return word.toUpperCase()
    .replace(/İ/g, 'I')  // İ -> I normalization for Turkish
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ş/g, 'S')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .trim();
}

async function loadWordlist(): Promise<Set<string>> {
  if (wordlistCache) {
    return wordlistCache;
  }

  const words = TURKISH_WORDS_RAW.split('\n')
    .map(word => word.trim().toUpperCase())
    .filter(word => word.length >= 3 && word.length > 0);

  wordlistCache = new Set(words);
  console.log(`Loaded ${wordlistCache.size} words from embedded wordlist`);
  return wordlistCache;
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
    const normalizedWord = normalizeTurkishWord(word);
    console.log(`Validating word: ${upperWord}, normalized: ${normalizedWord}`);

    // Load wordlist
    const wordlist = await loadWordlist();
    
    // Check if word exists in our wordlist - try both original and normalized versions
    const isValid = wordlist.has(upperWord) || wordlist.has(normalizedWord) ||
      Array.from(wordlist).some(dictWord => {
        const dictNormalized = normalizeTurkishWord(dictWord);
        return dictNormalized === normalizedWord || dictNormalized === upperWord;
      });
    
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