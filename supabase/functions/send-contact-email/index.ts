// supabase/functions/send-contact-email/index.ts
// Bu dosyayı supabase/functions/send-contact-email/index.ts konumuna ekleyin
// Sonra: supabase functions deploy send-contact-email

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const TO_EMAIL = "makifergan@gmail.com";
const FROM_EMAIL = "Kelimele <team@kelimele.site>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { subject, message, senderEmail } = await req.json();

    // Basit validasyon
    if (!subject?.trim() || !message?.trim()) {
      return new Response(JSON.stringify({ error: "Konu ve mesaj alanları zorunludur." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (subject.length > 100 || message.length > 1000) {
      return new Response(JSON.stringify({ error: "Konu veya mesaj çok uzun." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resend API ile mail gönder
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        subject: `[Kelimele Destek] ${subject}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 24px; border-radius: 12px;">
            <div style="background: #1a1a2e; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
              <h1 style="color: #818cf8; margin: 0; font-size: 24px;">KELİMELE</h1>
              <p style="color: #94a3b8; margin: 4px 0 0; font-size: 13px;">Destek Talebi</p>
            </div>

            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #818cf8;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 13px; width: 100px;">Gönderen:</td>
                  <td style="padding: 6px 0; color: #1e293b; font-size: 13px; font-weight: 500;">${senderEmail ?? "Anonim"}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Konu:</td>
                  <td style="padding: 6px 0; color: #1e293b; font-size: 13px; font-weight: 500;">${subject}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Tarih:</td>
                  <td style="padding: 6px 0; color: #1e293b; font-size: 13px;">${new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</td>
                </tr>
              </table>
            </div>

            <div style="background: white; padding: 20px; border-radius: 8px; margin-top: 12px;">
              <h3 style="color: #374151; margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Mesaj</h3>
              <p style="color: #374151; line-height: 1.7; white-space: pre-wrap; margin: 0;">${message}</p>
            </div>

            <p style="text-align: center; color: #94a3b8; font-size: 11px; margin-top: 20px;">
              Bu mail Kelimele uygulaması üzerinden otomatik olarak gönderilmiştir.
            </p>
          </div>
        `,
        // Kullanıcıya yanıt verebilmek için reply-to ekle
        reply_to: senderEmail ?? undefined,
      }),
    });

    const resendData = await res.json();

    if (!res.ok) {
      console.error("Resend error:", resendData);
      throw new Error(resendData.message ?? "Mail gönderilemedi");
    }

    return new Response(JSON.stringify({ success: true, id: resendData.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: err.message ?? "Sunucu hatası" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
