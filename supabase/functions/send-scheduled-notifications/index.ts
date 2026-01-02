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
      creditNotifications: 0,
      wheelReminders: 0,
      errors: [] as string[],
    };

    // ========== 1. CREDIT REFRESH NOTIFICATIONS ==========
    // Find users who:
    // - Have push_token
    // - game_credits < 5
    // - last_credit_refresh was more than 72 minutes ago (meaning they got a credit)
    // - Not premium or unlimited lives
    console.log('📱 Checking credit refresh notifications...');

    const creditCheckTime = new Date(Date.now() - 72 * 60 * 1000).toISOString(); // 72 minutes ago

    const { data: creditUsers, error: creditError } = await supabase
      .from('profiles')
      .select('id, username, push_token, game_credits, last_credit_refresh')
      .not('push_token', 'is', null)
      .lt('game_credits', 5)
      .or('premium_until.is.null,premium_until.lt.now()')
      .or('unlimited_lives_until.is.null,unlimited_lives_until.lt.now()')
      .not('last_credit_refresh', 'is', null)
      .lte('last_credit_refresh', creditCheckTime);

    if (creditError) {
      console.error('Credit users query error:', creditError);
      results.errors.push(`Credit query: ${creditError.message}`);
    }

    if (creditUsers && creditUsers.length > 0) {
      console.log(`Found ${creditUsers.length} users for credit notification`);

      for (const user of creditUsers) {
        // Calculate how many credits should have been added
        const lastRefresh = new Date(user.last_credit_refresh).getTime();
        const now = Date.now();
        const creditsPending = Math.floor((now - lastRefresh) / (72 * 60 * 1000));
        
        if (creditsPending > 0 && user.push_token) {
          const newCredits = Math.min(user.game_credits + creditsPending, 5);
          
          const message: FCMMessage = {
            message: {
              token: user.push_token,
              notification: {
                title: '🎮 Hakların Yenilendi!',
                body: `${newCredits} oyun hakkın hazır! Hadi bir maç yapalım!`,
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
                type: 'credit_refresh',
                credits: String(newCredits),
              },
            },
          };

          const sent = await sendFirebaseNotification(message);
          if (sent) {
            results.creditNotifications++;
            console.log(`✅ Credit notification sent to ${user.username}`);
            
            // Update credits and reset timer
            await supabase
              .from('profiles')
              .update({
                game_credits: newCredits,
                last_credit_refresh: newCredits >= 5 ? null : new Date().toISOString(),
              })
              .eq('id', user.id);
          }
        }
      }
    }

    // ========== 2. WHEEL SPIN REMINDERS (Günde 1 kez) ==========
    // Kullanıcı çarkı çevirmediyse GÜNDE SADECE 1 KEZ hatırlatma gönder
    console.log('🎡 Checking wheel spin reminders (daily limit: 1)...');

    const today = new Date().toISOString().split('T')[0];
    const todayStart = new Date(today).toISOString(); // Günün başlangıcı
    
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

      // GÜNDE 1 KEZ - Bugün zaten hatırlatma gönderilmiş mi kontrol et
      const { data: todayReminders } = await supabase
        .from('notifications')
        .select('user_id')
        .eq('type', 'wheel_reminder')
        .gte('created_at', todayStart);

      const alreadyRemindedTodayUserIds = new Set((todayReminders || []).map(n => n.user_id));

      for (const user of usersToRemind) {
        // Bugün zaten hatırlatma gönderildiyse atla
        if (alreadyRemindedTodayUserIds.has(user.id)) {
          console.log(`⏭️ Skipping ${user.username} - already reminded today`);
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

            // Log the reminder to prevent spam (5 hour cooldown)
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
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
