import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    android?: {
      priority: 'high' | 'normal';
      notification: {
        channel_id: string;
        sound: string;
        notification_priority: 'PRIORITY_HIGH' | 'PRIORITY_MAX';
        visibility: 'PUBLIC' | 'PRIVATE';
        default_sound: boolean;
        default_vibrate_timings: boolean;
      };
    };
    apns?: {
      headers?: {
        'apns-priority': string;
      };
      payload: {
        aps: {
          sound: string;
          badge?: number;
        };
      };
    };
    data?: Record<string, string>;
  };
}

// Get Firebase access token
async function getAccessToken(): Promise<string> {
  const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL');
  const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID');

  if (!clientEmail || !privateKey || !projectId) {
    throw new Error('Firebase credentials not configured');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const keyData = privateKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const jwt = `${unsignedToken}.${signatureB64}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// Send FCM notification
async function sendFirebaseNotification(message: FCMMessage): Promise<boolean> {
  try {
    const projectId = Deno.env.get('FIREBASE_PROJECT_ID');
    const accessToken = await getAccessToken();

    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('FCM error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Send notification error:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results = {
      wheelReminders: 0,
      errors: [] as string[],
    };

    // Kredi bildirimleri artık ayrı fonksiyonda: send-credit-notification

    // ========== WHEEL SPIN REMINDERS (Günde 1 kez: 20:00 Türkiye saati) ==========
    console.log('🎡 Checking wheel spin reminders (daily limit: 1)...');

    const today = new Date().toISOString().split('T')[0];
    const todayStart = new Date(today).toISOString();
    
    // Get users with push tokens who haven't spun today
    const { data: allUsers, error: usersError } = await supabase
      .from('profiles')
      .select('id, username, push_token')
      .not('push_token', 'is', null);

    if (usersError) {
      console.error('Users query error:', usersError);
      results.errors.push(`Users query: ${usersError.message}`);
    }

    if (allUsers && allUsers.length > 0) {
      // Get users who already spun today
      const { data: todaySpins, error: spinsError } = await supabase
        .from('wheel_spins')
        .select('user_id')
        .eq('date', today);

      if (spinsError) {
        console.error('Spins query error:', spinsError);
        results.errors.push(`Spins query: ${spinsError.message}`);
      }

      const spunUserIds = new Set((todaySpins || []).map(s => s.user_id));
      const usersToRemind = allUsers.filter(u => !spunUserIds.has(u.id));

      console.log(`Found ${usersToRemind.length} users who haven't spun the wheel today`);

      // GÜNDE 1 KEZ - Bugün hatırlatma gönderilmiş mi kontrol et
      const { data: todayReminders } = await supabase
        .from('notifications')
        .select('user_id')
        .eq('type', 'wheel_reminder')
        .gte('created_at', todayStart);

      const remindedUsers = new Set((todayReminders || []).map(n => n.user_id));

      for (const user of usersToRemind) {
        // Bugün zaten hatırlatma gönderilmişse atla
        if (remindedUsers.has(user.id)) {
          continue;
        }

        if (user.push_token) {
          const message: FCMMessage = {
            message: {
              token: user.push_token,
              notification: {
                title: '🎡 Günlük Çarkını Çevirmeyi Unutma!',
                body: 'Bugün henüz çarkını çevirmedin. Ücretsiz ödül kazanabilirsin!',
              },
              android: {
                priority: 'high',
                notification: {
                  channel_id: 'kelimeci_notifications',
                  sound: 'default',
                  notification_priority: 'PRIORITY_HIGH',
                  visibility: 'PUBLIC',
                  default_sound: true,
                  default_vibrate_timings: true,
                },
              },
              apns: {
                headers: {
                  'apns-priority': '10',
                },
                payload: {
                  aps: {
                    sound: 'default',
                    badge: 1,
                  },
                },
              },
              data: {
                type: 'wheel_reminder',
                route: '/wheel',
              },
            },
          };

          const sent = await sendFirebaseNotification(message);
          if (sent) {
            results.wheelReminders++;
            console.log(`✅ Wheel reminder sent to ${user.username}`);

            await supabase
              .from('notifications')
              .insert({
                user_id: user.id,
                type: 'wheel_reminder',
                message: 'Günlük çark hatırlatması gönderildi',
              });
          }
        }
      }
    }

    console.log('📊 Scheduled notifications complete:', results);

    return new Response(
      JSON.stringify({
        success: true,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Scheduled notifications error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
