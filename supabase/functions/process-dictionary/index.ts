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

    const { fileName } = await req.json();
    
    if (!fileName) {
      return new Response(JSON.stringify({ 
        error: 'File name is required',
        success: false 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing dictionary file: ${fileName}`);

    // Download the file from storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('dictionaries')
      .download(fileName);

    console.log('Download result:', { hasData: !!fileData, error: downloadError });

    if (downloadError) {
      console.error('Download error:', downloadError);
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }
    
    if (!fileData) {
      throw new Error('No file data received');
    }

    // Read file content
    const text = await fileData.text();
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    console.log(`Found ${lines.length} lines in file`);

    // Process words
    const processedWords = lines.map(line => {
      const cleanWord = line.trim().toUpperCase();
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

    // Check existing words
    const { data: existingWords } = await supabaseClient
      .from('words')
      .select('word');

    const existingWordSet = new Set(existingWords?.map(w => w.word) || []);
    
    // Filter new words
    const newWords = processedWords.filter(word => !existingWordSet.has(word.word));
    const duplicates = processedWords.length - newWords.length;
    
    console.log(`${newWords.length} new words to insert, ${duplicates} duplicates`);

    // Insert new words in batches
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

    // Get final count
    const { count } = await supabaseClient
      .from('words')
      .select('*', { count: 'exact', head: true });

    return new Response(JSON.stringify({
      success: true,
      message: `Dictionary processed successfully`,
      statistics: {
        totalWords: lines.length,
        newWords: totalInserted,
        duplicates: duplicates,
        totalInDatabase: count
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing dictionary:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function calculateDifficulty(word: string): number {
  const length = word.length;
  
  if (length <= 4) return 1;      // Easy
  if (length <= 6) return 2;      // Medium
  if (length <= 8) return 3;      // Hard
  return 4;                       // Very Hard
}