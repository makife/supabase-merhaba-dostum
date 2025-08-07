import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WordValidationRequest {
  word: string;
}

interface WordValidationResponse {
  isValid: boolean;
  word: string;
  length?: number;
  difficulty?: number;
}

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

    const { word }: WordValidationRequest = await req.json();
    
    if (!word || typeof word !== 'string') {
      return new Response(JSON.stringify({ 
        error: 'Valid word is required',
        isValid: false 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Normalize the word (uppercase, trim)
    const normalizedWord = word.trim().toUpperCase();
    
    console.log(`Validating word: ${normalizedWord}`);
    
    // Check if word exists in database
    const { data, error } = await supabaseClient
      .from('words')
      .select('id, word, length, difficulty')
      .eq('word', normalizedWord)
      .eq('is_approved', true)
      .maybeSingle();

    if (error) {
      console.error('Database error:', error);
      return new Response(JSON.stringify({ 
        error: 'Database error',
        isValid: false 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isValid = data !== null;
    
    console.log(`Word validation result: ${normalizedWord} -> ${isValid ? 'valid' : 'invalid'}`);
    
    const response: WordValidationResponse = {
      isValid,
      word: normalizedWord,
      ...(isValid && {
        length: data.length,
        difficulty: data.difficulty
      })
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error validating word:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      isValid: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});