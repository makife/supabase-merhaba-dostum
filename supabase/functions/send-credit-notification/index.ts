import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FCMMessage {
  message: {
    token: string;
    notification: { title: string; body: string };
    android?: {
      priority: "high" | "normal";
      notification: {
        channel_id: string;
        sound: string;
        notification_priority: "PRIORITY_HIGH" | "PRIORITY_MAX";
        visibility: "PUBLIC" | "PRIVATE";
        default_sound: boolean;
        default_vibrate_timings: boolean;
      };
    };
    apns?: {
      headers?: { "apns-priority": string };
      payload: { aps: { sound: string; badge?: number } };
    };
    data?: Record<string, string>;
  };
}

async function getAccessToken(): Promise<string> {
  const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL");
  const privateKey = Deno.env.get("FIREBASE_PRIVATE_KEY")?.replace(/\\n/g, "\n");
  const projectId = Deno.env.get("FIREBASE_PROJECT_ID");

  if (!clientEmail || !privateKey || !projectId) {
    throw new Error("Firebase credentials not configured");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const keyData = privateKey
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");

  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, encoder.encode(unsignedToken));

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${unsignedToken}.${signatureB64}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

async function sendFirebaseNotification(message: FCMMessage): Promise<boolean> {
  try {
    const projectId = Deno.env.get("FIREBASE_PROJECT_ID");
    const accessToken = await getAccessToken();

    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("FCM error:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Send notification error:", error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Sunucu zamanını veritabanından al (saat farkı sorununu önlemek için)
    const { data: serverTimeData } = await supabase.rpc("get_server_time");
    const serverNow = serverTimeData ? new Date(serverTimeData).getTime() : Date.now();
    console.log(`🕐 Server time: ${new Date(serverNow).toISOString()}, Edge time: ${new Date().toISOString()}`);

    const CREDIT_INTERVAL_MS = 72 * 60 * 1000; // 72 dakika
    const OFFLINE_THRESHOLD_MS = 60 * 1000; // 60 saniye
    const creditCheckTime = new Date(serverNow - CREDIT_INTERVAL_MS).toISOString();
    const onlineThreshold = new Date(serverNow - OFFLINE_THRESHOLD_MS).toISOString();

    let sent = 0;
    let skippedOnline = 0;
    const errors: string[] = [];

    // Kredisi < 5 (game+bonus toplam), last_credit_refresh 72+ dk önce, push_token var, premium/unlimited değil
    // NOT: game_credits < 5 filtresi ile DB'den alıyoruz, sonra JS'de toplam kredi kontrolü yapıyoruz
    const { data: users, error: queryError } = await supabase
      .from("profiles")
      .select("id, username, push_token, game_credits, bonus_credits, last_credit_refresh, last_seen")
      .not("push_token", "is", null)
      .lt("game_credits", 5)
      .or("premium_until.is.null,premium_until.lt.now()")
      .or("unlimited_lives_until.is.null,unlimited_lives_until.lt.now()")
      .not("last_credit_refresh", "is", null)
      .lte("last_credit_refresh", creditCheckTime);

    if (queryError) {
      console.error("Query error:", queryError);
      errors.push(queryError.message);
    }

    // KRITIK: Toplam kredi (game_credits + bonus_credits) >= 5 ise HIÇBIR işlem yapma
    // Hem kredi artırma hem de push gönderme atlanmalı
    const eligibleUsers = users
      ? users.filter((u) => {
          const totalCredits = (u.game_credits || 0) + (u.bonus_credits || 0);
          if (totalCredits >= 5) {
            console.log(
              `⏭️ ${u.username} toplam kredisi zaten ${totalCredits} (game:${u.game_credits}, bonus:${u.bonus_credits}) - kredi ekleme ve push ATLANDI`,
            );
            return false;
          }
          return true;
        })
      : [];

    if (eligibleUsers.length > 0) {
      console.log(
        `📱 Found ${eligibleUsers.length} users eligible for +1 credit (filtered from ${users?.length || 0})`,
      );

      for (const user of eligibleUsers) {
        // Kullanıcı online kontrolü - sunucu zamanına göre last_seen son 60sn içindeyse online
        const lastSeenTime = user.last_seen ? new Date(user.last_seen).getTime() : 0;
        const isOnline = lastSeenTime > serverNow - OFFLINE_THRESHOLD_MS;

        console.log(
          `👤 ${user.username}: last_seen=${user.last_seen}, isOnline=${isOnline}, threshold=${onlineThreshold}`,
        );
        if (isOnline) {
          // Online kullanıcıya sadece krediyi ekle, push gönderme
          // Sadece game_credits'e ekle (bonus_credits'e değil), toplam 5 sınırını aşma
          const currentGameCredits = user.game_credits || 0;
          const currentBonusCredits = user.bonus_credits || 0;
          const currentTotal = currentGameCredits + currentBonusCredits;

          // Zaten toplam 5 ise (bu noktaya gelmiş olmamalı ama güvenlik için)
          if (currentTotal >= 5) {
            console.log(`⏭️ ${user.username} ONLINE ama toplam zaten ${currentTotal} - atlanıyor`);
            skippedOnline++;
            continue;
          }

          const newGameCredits = Math.min(currentGameCredits + 1, 5 - currentBonusCredits);
          const newTotal = newGameCredits + currentBonusCredits;
          const nextRefreshTime = new Date(new Date(user.last_credit_refresh).getTime() + CREDIT_INTERVAL_MS);

          await supabase
            .from("profiles")
            .update({
              game_credits: newGameCredits,
              last_credit_refresh: newTotal >= 5 ? null : nextRefreshTime.toISOString(),
            })
            .eq("id", user.id);

          skippedOnline++;
          console.log(
            `⏭️ ${user.username} ONLINE - kredi eklendi (game:${newGameCredits}, bonus:${currentBonusCredits}, toplam:${newTotal}) ama push gönderilmedi`,
          );
          continue;
        }

        // Offline kullanıcıya +1 kredi + push bildirim
        // Toplam 5 sınırını aşmadan sadece game_credits'e ekle
        const currentGameCredits = user.game_credits || 0;
        const currentBonusCredits = user.bonus_credits || 0;
        const newGameCredits = Math.min(currentGameCredits + 1, 5 - currentBonusCredits);
        const newTotal = newGameCredits + currentBonusCredits;
        const nextRefreshTime = new Date(new Date(user.last_credit_refresh).getTime() + CREDIT_INTERVAL_MS);

        const message: FCMMessage = {
          message: {
            token: user.push_token,
            notification: {
              title: "🎮 +1 Oyun Sayfan Geldi!",
              body:
                newTotal >= 5
                  ? "Tüm Sayfaların doldu! Hadi bir maç yapalım! 🎉"
                  : `Şu an ${newTotal}/5 sayfan var. Oynamaya hazır mısın?`,
            },
            android: {
              priority: "high",
              notification: {
                channel_id: "kelimeci_notifications",
                sound: "default",
                notification_priority: "PRIORITY_HIGH",
                visibility: "PUBLIC",
                default_sound: true,
                default_vibrate_timings: true,
              },
            },
            apns: {
              headers: { "apns-priority": "10" },
              payload: { aps: { sound: "default", badge: 1 } },
            },
            data: {
              type: "credit_refresh",
              credits: String(newTotal),
            },
          },
        };

        const pushSent = await sendFirebaseNotification(message);
        if (pushSent) {
          sent++;
          console.log(
            `✅ OFFLINE push sent to ${user.username} (game:${newGameCredits}, bonus:${currentBonusCredits}, toplam:${newTotal})`,
          );
        }

        // Krediyi güncelle
        await supabase
          .from("profiles")
          .update({
            game_credits: newGameCredits,
            last_credit_refresh: newTotal >= 5 ? null : nextRefreshTime.toISOString(),
          })
          .eq("id", user.id);
      }
    } else {
      console.log("📱 No users eligible for credit notification");
    }

    console.log(
      `📊 Credit notifications complete: ${sent} push sent, ${skippedOnline} online skipped, ${errors.length} errors`,
    );

    return new Response(JSON.stringify({ success: true, sent, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Credit notification error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
