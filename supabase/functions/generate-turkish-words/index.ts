import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WordGenerationRequest {
  category?: string;
  count?: number;
  minLength?: number;
  maxLength?: number;
  difficulty?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Rate limiting check
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;

    if (authHeader) {
      const { data: { user }, error } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''));
      if (!error && user) {
        userId = user.id;
        
        // Rate limit: 5 requests per hour (AI is expensive)
        const { data: rateLimitCheck, error: rateLimitError } = await supabaseClient
          .rpc('check_rate_limit', {
            p_user_id: userId,
            p_action: 'generate-turkish-words',
            p_max_requests: 5,
            p_window_minutes: 60
          });

        if (rateLimitError) {
          console.error('Rate limit check error:', rateLimitError);
        } else if (!rateLimitCheck) {
          return new Response(
            JSON.stringify({ 
              error: 'Çok fazla kelime üretme isteği gönderdiniz. Lütfen bir saat sonra tekrar deneyin.',
              rateLimited: true,
              success: false
            }),
            { 
              status: 429, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
      }
    }

    const {
      category = 'genel', 
      count = 50, 
      minLength = 3, 
      maxLength = 12,
      difficulty = 2 
    }: WordGenerationRequest = await req.json();

    console.log(`Generating ${count} Turkish words for category: ${category}`);

    // Kategoriye göre prompt oluştur
    const categoryPrompts = {
      hayvanlar: 'hayvan isimleri (köpek, kedi, aslan, kartal, balık vb.)',
      yemekler: 'yemek ve içecek isimleri (pilav, çorba, meyve, sebze vb.)',
      meslekler: 'meslek isimleri (doktor, öğretmen, mühendis, aşçı vb.)',
      objeler: 'günlük eşya ve obje isimleri (masa, sandalye, kalem, kitap vb.)',
      fiiller: 'eylem kelimeleri (koşmak, yemek, uyumak, oynamak vb.)',
      sıfatlar: 'sıfat kelimeleri (güzel, büyük, hızlı, akıllı vb.)',
      renkler: 'renk isimleri (kırmızı, mavi, yeşil, sarı vb.)',
      doğa: 'doğa ile ilgili kelimeler (ağaç, çiçek, deniz, dağ vb.)',
      genel: 'çeşitli Türkçe kelimeler (isim, sıfat, fiil karışık)'
    };

    const categoryPrompt = categoryPrompts[category as keyof typeof categoryPrompts] || categoryPrompts.genel;

    const prompt = `Türkçe ${categoryPrompt} listesi oluştur. Kurallar:
- Sadece gerçek, geçerli Türkçe kelimeler
- ${minLength}-${maxLength} harf arası
- Her kelime yeni satırda
- Hiç açıklama ya da numara ekleme
- ${count} adet kelime
- Türkçe karakterler kullan (ç, ğ, ı, ı, ö, ş, ü)
- Zorluk seviyesi: ${difficulty}/5 (1=çok kolay, 5=çok zor)

Kelimeler:`;

    console.log('Sending request to OpenAI...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'Sen Türkçe kelime uzmanısın. Sadece gerçek, doğru Türkçe kelimeler üretirsin. Hiçbir zaman yanlış ya da uydurma kelime vermezsin.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content;

    console.log('OpenAI response received');

    // Kelimeleri işle
    const words = generatedText
      .split('\n')
      .map((word: string) => word.trim().toUpperCase())
      .filter((word: string) => {
        // Sadece geçerli Türkçe karakterler ve uygun uzunluk
        return word.length >= minLength && 
               word.length <= maxLength && 
               /^[A-ZÇĞIİÖŞÜ]+$/.test(word) &&
               word.length > 0;
      })
      .slice(0, count); // İstenen adet kadar al

    console.log(`Processed ${words.length} valid words`);

    if (words.length === 0) {
      throw new Error('No valid Turkish words generated');
    }

    // Mevcut kelimeleri kontrol et
    const { data: existingWords, error: selectError } = await supabaseClient
      .from('words')
      .select('word');

    if (selectError) {
      console.error('Error fetching existing words:', selectError);
      throw selectError;
    }

    const existingWordSet = new Set(existingWords?.map(w => w.word.toUpperCase()) || []);
    console.log(`Found ${existingWordSet.size} existing words in database`);
    
    // Sadece yeni kelimeleri filtrele
    const newWords = words.filter((word: string) => !existingWordSet.has(word.toUpperCase()));
    
    console.log(`${newWords.length} new words to insert`);

    if (newWords.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Tüm üretilen kelimeler zaten veritabanında mevcut',
        statistics: {
          generatedWords: words.length,
          newWordsAdded: 0,
          category: category,
          totalInDatabase: existingWordSet.size
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Zorluk hesaplama fonksiyonu
    const calculateDifficulty = (word: string): number => {
      const length = word.length;
      if (length <= 4) return 1;      // Kolay
      if (length <= 6) return 2;      // Orta
      if (length <= 8) return 3;      // Zor
      return 4;                       // Çok zor
    };

    // Veritabanına ekle
    const wordsToInsert = newWords.map((word: string) => ({
      word: word.toUpperCase(),
      length: word.length,
      difficulty: calculateDifficulty(word),
      is_approved: true
    }));

    let totalInserted = 0;
    const batchSize = 100;

    for (let i = 0; i < wordsToInsert.length; i += batchSize) {
      const batch = wordsToInsert.slice(i, i + batchSize);
      
      try {
        const { error } = await supabaseClient
          .from('words')
          .insert(batch);

        if (error) {
          console.error(`Error inserting batch ${i / batchSize + 1}:`, error);
          // Duplicate hatası varsa tek tek dene
          if (error.code === '23505') {
            console.log('Duplicate error detected, inserting words individually...');
            for (const word of batch) {
              const { error: singleError } = await supabaseClient
                .from('words')
                .insert([word]);
              
              if (!singleError) {
                totalInserted++;
              } else if (singleError.code !== '23505') {
                console.error('Unexpected error inserting word:', word.word, singleError);
              }
            }
          } else {
            throw error;
          }
        } else {
          totalInserted += batch.length;
          console.log(`Inserted batch ${i / batchSize + 1}: ${totalInserted} total words`);
        }
      } catch (batchError) {
        console.error(`Fatal error in batch ${i / batchSize + 1}:`, batchError);
        throw batchError;
      }
    }

    // Final istatistikler
    const { count: finalCount } = await supabaseClient
      .from('words')
      .select('*', { count: 'exact', head: true });

    return new Response(JSON.stringify({
      success: true,
      message: `AI ile ${category} kategorisinde ${totalInserted} yeni kelime eklendi`,
      statistics: {
        generatedWords: words.length,
        newWordsAdded: totalInserted,
        category: category,
        totalInDatabase: finalCount,
        difficulty: difficulty
      },
      generatedWordsList: words.slice(0, 10) // İlk 10 kelimeyi önizleme olarak göster
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating Turkish words:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});