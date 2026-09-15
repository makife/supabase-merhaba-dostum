import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReportNotificationRequest {
  reportId: string;
  reportedUserId: string;
  reportedUsername: string;
  reporterUsername: string;
  messageType: string;
  reason: string;
  description?: string;
  messageContent?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting check
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;

    if (authHeader) {
      const { data: { user }, error } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''));
      if (!error && user) {
        userId = user.id;
        
        // Rate limit: 5 requests per hour (report abuse prevention)
        const { data: rateLimitCheck, error: rateLimitError } = await supabaseClient
          .rpc('check_rate_limit', {
            p_user_id: userId,
            p_action: 'send-report-notification',
            p_max_requests: 5,
            p_window_minutes: 60
          });

        if (rateLimitError) {
          console.error('Rate limit check error:', rateLimitError);
        } else if (!rateLimitCheck) {
          return new Response(
            JSON.stringify({ 
              error: 'Çok fazla rapor gönderdiniz. Lütfen bir saat sonra tekrar deneyin.',
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
      reportId,
      reportedUserId,
      reportedUsername,
      reporterUsername,
      messageType,
      reason,
      description,
      messageContent,
    }: ReportNotificationRequest = await req.json();

    console.log("Sending report notification:", {
      reportId,
      reportedUsername,
      reporterUsername,
      messageType,
      reason,
    });

    // Türkçe nedenleri İngilizceye çevir
    const reasonTranslations: Record<string, string> = {
      spam: "Spam",
      harassment: "Taciz",
      inappropriate_content: "Uygunsuz İçerik",
      hate_speech: "Nefret Söylemi",
      violence: "Şiddet",
      other: "Diğer",
    };

    const translatedReason = reasonTranslations[reason] || reason;

    console.log("📧 Email notification (disabled):", {
      to: ["wayannesini@gmail.com"],
      subject: `🚨 Yeni Mesaj Raporu - ${translatedReason}`,
      reportId,
      reportedUsername,
      reporterUsername,
      messageType,
      reason: translatedReason,
      description,
      messageContent
    });

    return new Response(
      JSON.stringify({ success: true, emailId: "disabled" }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-report-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
