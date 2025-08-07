import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting dictionary import...');

    // Türkçe kelime listesi - GitHub'dan açık kaynak Türkçe kelime listesi çekiyoruz
    const response = await fetch('https://raw.githubusercontent.com/mertemin/turkish-word-list/master/turkish_word_list.txt');
    
    if (!response.ok) {
      throw new Error('Failed to fetch Turkish word list');
    }

    const text = await response.text();
    const words = text.split('\n').filter(word => word.trim().length > 0);
    
    console.log(`Found ${words.length} words to import`);

    // Kelimeleri işle ve veritabanına ekle
    const processedWords = words.map(word => {
      const cleanWord = word.trim().toUpperCase();
      return {
        word: cleanWord,
        length: cleanWord.length,
        difficulty: calculateDifficulty(cleanWord),
        is_approved: true
      };
    }).filter(word => 
      word.word.length >= 3 && 
      word.word.length <= 15 && 
      /^[A-ZÇĞIİÖŞÜ]+$/.test(word.word)
    );

    console.log(`Processing ${processedWords.length} valid words`);

    // Mevcut kelimeleri kontrol et
    const { data: existingWords } = await supabaseClient
      .from('words')
      .select('word');

    const existingWordSet = new Set(existingWords?.map(w => w.word) || []);
    
    // Sadece yeni kelimeleri filtrele
    const newWords = processedWords.filter(word => !existingWordSet.has(word.word));
    
    console.log(`${newWords.length} new words to insert`);

    // Batch olarak ekle (1000'er kelime)
    const batchSize = 1000;
    let totalInserted = 0;

    for (let i = 0; i < newWords.length; i += batchSize) {
      const batch = newWords.slice(i, i + batchSize);
      
      const { error } = await supabaseClient
        .from('words')
        .insert(batch);

      if (error) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, error);
        throw error;
      }

      totalInserted += batch.length;
      console.log(`Inserted batch ${i / batchSize + 1}: ${totalInserted} total words`);
    }

    // İstatistikleri al
    const { count } = await supabaseClient
      .from('words')
      .select('*', { count: 'exact', head: true });

    return new Response(JSON.stringify({
      success: true,
      message: `Dictionary import completed successfully`,
      statistics: {
        totalWordsInDatabase: count,
        newWordsAdded: totalInserted,
        wordsProcessed: processedWords.length,
        wordsFromSource: words.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error importing dictionary:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function calculateDifficulty(word: string): number {
  const length = word.length;
  
  // Zorluk seviyesi kelime uzunluğuna göre
  if (length <= 4) return 1;      // Kolay
  if (length <= 6) return 2;      // Orta
  if (length <= 8) return 3;      // Zor
  return 4;                       // Çok zor
}