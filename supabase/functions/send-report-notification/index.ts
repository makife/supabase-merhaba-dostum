import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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

    // Email gönder
    const emailResponse = await resend.emails.send({
      from: "Kelime Oyunu Moderasyon <onboarding@resend.dev>",
      to: ["wayannesini@gmail.com"],
      subject: `🚨 Yeni Mesaj Raporu - ${translatedReason}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              border-radius: 10px 10px 0 0;
              text-align: center;
            }
            .content {
              background: #f9fafb;
              padding: 30px;
              border: 1px solid #e5e7eb;
              border-top: none;
            }
            .info-box {
              background: white;
              padding: 20px;
              border-radius: 8px;
              margin: 15px 0;
              border-left: 4px solid #667eea;
            }
            .info-row {
              display: flex;
              margin: 10px 0;
              padding: 8px 0;
              border-bottom: 1px solid #f3f4f6;
            }
            .info-row:last-child {
              border-bottom: none;
            }
            .label {
              font-weight: 600;
              color: #6b7280;
              width: 150px;
              flex-shrink: 0;
            }
            .value {
              color: #111827;
              flex: 1;
            }
            .warning {
              background: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 15px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .message-box {
              background: #f3f4f6;
              padding: 15px;
              border-radius: 8px;
              margin: 15px 0;
              font-family: monospace;
              white-space: pre-wrap;
              word-break: break-word;
            }
            .button {
              display: inline-block;
              background: #667eea;
              color: white;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
              font-weight: 600;
            }
            .footer {
              text-align: center;
              color: #9ca3af;
              font-size: 14px;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">🚨 Yeni Mesaj Raporu</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Moderasyon gerekli</p>
          </div>
          
          <div class="content">
            <div class="warning">
              <strong>⚠️ Dikkat:</strong> Bir kullanıcı mesaj raporu gönderdi. Lütfen aşağıdaki detayları inceleyin.
            </div>

            <div class="info-box">
              <h3 style="margin-top: 0; color: #667eea;">Rapor Detayları</h3>
              
              <div class="info-row">
                <span class="label">Rapor ID:</span>
                <span class="value"><code>${reportId}</code></span>
              </div>
              
              <div class="info-row">
                <span class="label">Mesaj Türü:</span>
                <span class="value">${messageType === 'global' ? '🌍 Global Sohbet' : '💬 Özel Mesaj'}</span>
              </div>
              
              <div class="info-row">
                <span class="label">Bildiren:</span>
                <span class="value"><strong>${reporterUsername}</strong></span>
              </div>
              
              <div class="info-row">
                <span class="label">Bildirilen:</span>
                <span class="value"><strong>${reportedUsername}</strong> (ID: ${reportedUserId})</span>
              </div>
              
              <div class="info-row">
                <span class="label">Neden:</span>
                <span class="value"><strong>${translatedReason}</strong></span>
              </div>
              
              ${description ? `
                <div class="info-row">
                  <span class="label">Açıklama:</span>
                  <span class="value">${description}</span>
                </div>
              ` : ''}
            </div>

            ${messageContent ? `
              <div class="info-box">
                <h3 style="margin-top: 0; color: #dc2626;">Bildirilen Mesaj İçeriği</h3>
                <div class="message-box">${messageContent}</div>
              </div>
            ` : ''}

            <div style="text-align: center;">
              <a href="https://supabase.com/dashboard/project/nnlvtqmuwmrqfinsgvwc/editor/29476?schema=public" class="button">
                📊 Raporları İncele
              </a>
            </div>

            <div class="info-box" style="background: #fef2f2; border-left-color: #dc2626;">
              <h3 style="margin-top: 0; color: #dc2626;">Moderasyon Önerileri</h3>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Mesaj içeriğini ve bağlamını inceleyin</li>
                <li>Bildirilen kullanıcının geçmiş raporlarını kontrol edin</li>
                <li>Gerekirse kullanıcıyı geçici veya kalıcı olarak yasaklayın</li>
                <li>Yanlış raporlar için bildiren kullanıcıyı uyarın</li>
              </ul>
            </div>
          </div>

          <div class="footer">
            <p>Bu e-posta otomatik olarak gönderilmiştir.</p>
            <p>Kelime Oyunu Moderasyon Sistemi</p>
          </div>
        </body>
        </html>
      `,
    });

    if (emailResponse.error) {
      console.error("Resend error:", emailResponse.error);
      throw emailResponse.error;
    }

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse.data?.id }),
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
