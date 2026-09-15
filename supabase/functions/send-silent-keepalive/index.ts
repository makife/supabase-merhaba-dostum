import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * 🔥 Silent Push Notification - Arka Planda Canlı Tutma
 * 
 * Bu edge function, uygulamayı arka planda canlı tutmak için
 * DATA-ONLY (silent) push notification gönderir.
 * 
 * Silent push:
 * - Kullanıcıya bildirim göstermez
 * - Uygulamayı arka planda uyandırır
 * - Android: priority=high + content_available
 * - iOS: content-available=1
 */

interface SilentKeepAliveRequest {
  userId: string
}

async function getAccessToken(): Promise<string> {
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID')!
  const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY')!.replace(/\\n/g, '\n')
  const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL')!

  const now = Math.floor(Date.now() / 1000)
  const exp = now + 3600

  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: exp,
    scope: 'https://www.googleapis.com/auth/firebase.messaging'
  }

  const encoder = new TextEncoder()
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const message = `${headerB64}.${payloadB64}`

  const keyData = privateKey.replace('-----BEGIN PRIVATE KEY-----', '')
                           .replace('-----END PRIVATE KEY-----', '')
                           .replace(/\s/g, '')
  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, encoder.encode(message))
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
                      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const jwt = `${message}.${signatureB64}`

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  })

  const tokenData = await tokenResponse.json()
  return tokenData.access_token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Auth kontrolü
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { userId }: SilentKeepAliveRequest = await req.json()

    // Güvenlik: Sadece kendi kendine silent push gönderebilir
    if (userId !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Push token'ı al
    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .select('push_token')
      .eq('id', userId)
      .single()

    if (profileError || !profileData?.push_token) {
      console.log('Push token not found for user', userId)
      return new Response(
        JSON.stringify({ success: true, message: 'No push token' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 🔥 SILENT DATA MESSAGE - Bildirim göstermez, sadece uygulamayı uyandırır
    const accessToken = await getAccessToken()
    const projectId = Deno.env.get('FIREBASE_PROJECT_ID')!

    const fcmMessage = {
      message: {
        token: profileData.push_token,
        // 🔥 notification YOK - Bu bir DATA-ONLY mesaj
        data: {
          type: 'silent_keepalive',
          timestamp: Date.now().toString(),
          action: 'keep_connection_alive'
        },
        android: {
          priority: 'high', // 🔥 HIGH priority - hemen teslim
          // 🔥 notification YOK - Sessiz bildirim
        },
        apns: {
          headers: {
            'apns-priority': '10', // 🔥 Immediate delivery
            'apns-push-type': 'background' // 🔥 Background push
          },
          payload: {
            aps: {
              'content-available': 1, // 🔥 Silent push trigger
              // 🔥 alert, sound, badge YOK - Sessiz
            }
          }
        }
      }
    }

    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(fcmMessage)
      }
    )

    if (response.ok) {
      console.log('Silent keepalive sent to user', userId)
      
      // last_seen güncelle (bağlantıyı canlı tut)
      await supabaseClient
        .from('profiles')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', userId)

      return new Response(
        JSON.stringify({ success: true, message: 'Silent keepalive sent' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      const error = await response.text()
      console.error('Failed to send silent keepalive:', error)
      return new Response(
        JSON.stringify({ success: false, error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('Error in send-silent-keepalive:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
