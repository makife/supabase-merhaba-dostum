import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    console.log('🔧 Nakama config requested');

    // Nakama server bilgilerini env'den al
    const nakamaHost = Deno.env.get('NAKAMA_HOST') || 'localhost';
    const nakamaPort = Deno.env.get('NAKAMA_PORT') || '7350';
    const nakamaServerKey = Deno.env.get('NAKAMA_SERVER_KEY') || 'default';

    const config = {
      host: nakamaHost,
      port: nakamaPort,
      serverKey: nakamaServerKey,
      useSSL: nakamaHost !== 'localhost' && nakamaHost !== '127.0.0.1'
    };

    console.log('✅ Nakama config prepared:', { 
      host: config.host, 
      port: config.port, 
      useSSL: config.useSSL 
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        config 
      }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 200
      }
    );

  } catch (error) {
    console.error('❌ Nakama config error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 500
      }
    );
  }
});
