import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WordValidationRequest {
  word: string;
}

interface WordValidationResponse {
  isValid: boolean;
  difficulty?: number;
  definition?: string;
}

// Turkish word validation using a simple dictionary approach
const turkishWords = new Set([
  'kelime', 'masa', 'kale', 'top', 'tor', 'mat', 'as', 'sa', 'el', 'al', 'ol', 'ev', 'av', 'ok', 'at', 'et', 'it', 'ut', 'ot',
  'kedi', 'köpek', 'kuş', 'balık', 'ağaç', 'çiçek', 'güneş', 'ay', 'yıldız', 'su', 'ateş', 'toprak', 'hava',
  'kitap', 'kalem', 'defter', 'okul', 'öğretmen', 'öğrenci', 'sınıf', 'masa', 'sandalye',
  'anne', 'baba', 'kardeş', 'aile', 'ev', 'oda', 'mutfak', 'banyo', 'salon',
  'araba', 'otobüs', 'tren', 'uçak', 'gemi', 'bisiklet', 'yol', 'sokak', 'cadde',
  'meyve', 'sebze', 'ekmek', 'süt', 'peynir', 'yumurta', 'et', 'tavuk', 'balık',
  'kırmızı', 'mavi', 'yeşil', 'sarı', 'beyaz', 'siyah', 'pembe', 'mor', 'turuncu',
  'büyük', 'küçük', 'uzun', 'kısa', 'kalın', 'ince', 'geniş', 'dar', 'yüksek', 'alçak',
  'koş', 'yürü', 'otur', 'kalk', 'uyu', 'uyan', 'ye', 'iç', 'oku', 'yaz', 'çiz', 'say',
  'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz', 'on'
]);

const calculateDifficulty = (word: string): number => {
  const length = word.length;
  if (length <= 3) return 1;
  if (length <= 5) return 2;
  if (length <= 7) return 3;
  return 4;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { word }: WordValidationRequest = await req.json();
    
    if (!word || typeof word !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Word is required and must be a string' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const normalizedWord = word.toLowerCase().trim();
    
    // Check if word exists in our simple dictionary
    const isValid = turkishWords.has(normalizedWord);
    
    const response: WordValidationResponse = {
      isValid,
      difficulty: isValid ? calculateDifficulty(normalizedWord) : undefined
    };

    console.log(`Word validation: ${normalizedWord} -> ${isValid ? 'valid' : 'invalid'}`);

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error validating word:', error);
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});