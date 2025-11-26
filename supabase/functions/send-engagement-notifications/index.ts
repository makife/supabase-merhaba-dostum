import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FCMMessage {
  message: {
    token: string;
    notification: {
      title: string;
      body: string;
    };
    data?: Record<string, string>;
    android?: {
      priority: string;
      notification: {
        sound: string;
        channel_id: string;
      };
    };
    apns?: {
      payload: {
        aps: {
          sound: string;
        };
      };
    };
  };
}

// Firebase authentication ve notification sending
async function getAccessToken(): Promise<string> {
  const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT') || '{}');
  
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header));
  const payloadB64 = btoa(JSON.stringify(payload));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    encoder.encode(serviceAccount.private_key),
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    encoder.encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  const jwt = `${unsignedToken}.${signatureB64}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

async function sendFirebaseNotification(message: FCMMessage): Promise<boolean> {
  try {
    const accessToken = await getAccessToken();
    const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT') || '{}');
    const projectId = serviceAccount.project_id;

    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(message),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('FCM API error:', error);
      return false;
    }

    console.log('✅ Push notification sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending Firebase notification:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    console.log('🔍 Checking for inactive users...');

    // Son 24 saatte giriş yapmayan kullanıcıları bul
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: inactiveUsers, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, username, push_token, last_seen')
      .not('push_token', 'is', null)
      .lt('last_seen', oneDayAgo)
      .gt('last_seen', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()); // Max 7 gün önce

    if (fetchError) {
      console.error('Error fetching inactive users:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch inactive users' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Found ${inactiveUsers?.length || 0} inactive users`);

    if (!inactiveUsers || inactiveUsers.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No inactive users found', count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Motivasyon mesajları
    const messages = [
      'Kelime yarışına hazır mısın? 🎮',
      'Rakipler seni bekliyor! ⚔️',
      'Bugün kaç kelime bulabilirsin? 🔥',
      'Liderlik tablosunda yerini al! 🏆',
      'Arkadaşların seni bekliyor! 👥',
      'Yeni kelimeleri keşfet! ✨',
      'Beynini çalıştırmanın zamanı! 🧠',
      'Kelime ustalığını göster! 🎯',
    ];

    const notificationsSent: string[] = [];
    const notificationsFailed: string[] = [];

    // Her kullanıcıya bildirim gönder
    for (const user of inactiveUsers) {
      if (!user.push_token) continue;

      const randomMessage = messages[Math.floor(Math.random() * messages.length)];

      const fcmMessage: FCMMessage = {
        message: {
          token: user.push_token,
          notification: {
            title: 'Kelimeci',
            body: randomMessage,
          },
          data: {
            type: 'engagement',
            userId: user.id,
          },
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
              channel_id: 'kelimeci_notifications',
            },
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
              },
            },
          },
        },
      };

      const success = await sendFirebaseNotification(fcmMessage);
      
      if (success) {
        notificationsSent.push(user.id);
        
        // Bildirimi veritabanına kaydet
        await supabaseAdmin.from('notifications').insert({
          user_id: user.id,
          type: 'engagement',
          title: 'Kelimeci',
          message: randomMessage,
          is_read: false,
        });
      } else {
        notificationsFailed.push(user.id);
      }

      // Rate limiting - her bildirim arasında 100ms bekle
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`✅ Notifications sent: ${notificationsSent.length}`);
    console.log(`❌ Notifications failed: ${notificationsFailed.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        totalUsers: inactiveUsers.length,
        sent: notificationsSent.length,
        failed: notificationsFailed.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in send-engagement-notifications:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
