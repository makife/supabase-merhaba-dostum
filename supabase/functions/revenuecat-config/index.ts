import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { platform } = await req.json();
    
    let apiKey: string | undefined;
    
    if (platform === 'ios') {
      apiKey = Deno.env.get("REVENUECAT_IOS_API_KEY");
    } else if (platform === 'android') {
      apiKey = Deno.env.get("REVENUECAT_ANDROID_API_KEY");
    }
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: `API key not configured for platform: ${platform}` }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    return new Response(
      JSON.stringify({ apiKey }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
