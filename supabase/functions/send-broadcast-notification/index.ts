import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
    exp,
    scope: 'https://www.googleapis.com/auth/firebase.messaging'
  }

  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const message = `${headerB64}.${payloadB64}`

  const keyData = privateKey.replace('-----BEGIN PRIVATE KEY-----', '').replace('-----END PRIVATE KEY-----', '').replace(/\s/g, '')
  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey('pkcs8', binaryKey, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(message))
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const jwt = `${message}.${signatureB64}`
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt })
  })
  const tokenData = await tokenResponse.json()
  return tokenData.access_token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Verify caller is authenticated
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Verify caller is admin
    const adminClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const { data: roleData } = await adminClient.from('user_roles').select('role').eq('user_id', user.id).maybeSingle()
    if (!roleData || roleData.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: admin only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { title, body } = await req.json()
    if (!title || !body) {
      return new Response(JSON.stringify({ error: 'Missing title or body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Fetch all users with push tokens
    const { data: profiles, error: profilesError } = await adminClient
      .from('profiles')
      .select('id, push_token')
      .not('push_token', 'is', null)
      .neq('push_token', '')

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      return new Response(JSON.stringify({ error: 'Failed to fetch users' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const tokens = profiles || []
    console.log(`Broadcasting to ${tokens.length} users`)

    if (tokens.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: 'No users with push tokens' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const accessToken = await getAccessToken()
    const projectId = Deno.env.get('FIREBASE_PROJECT_ID')!

    let successCount = 0
    let failCount = 0

    // Send in batches of 10 to avoid overwhelming FCM
    const batchSize = 10
    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize)
      const results = await Promise.allSettled(
        batch.map(async (profile) => {
          const fcmMessage = {
            message: {
              token: profile.push_token,
              notification: { title, body },
              android: {
                priority: 'high' as const,
                notification: {
                  sound: 'default',
                  channel_id: 'kelimeci_notifications',
                  notification_priority: 'PRIORITY_HIGH' as const,
                  visibility: 'PUBLIC' as const,
                  default_sound: true,
                  default_vibrate_timings: true
                }
              },
              apns: {
                headers: { 'apns-priority': '10' },
                payload: { aps: { sound: 'default', badge: 1, 'content-available': 1 } }
              }
            }
          }

          const response = await fetch(
            `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
            {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(fcmMessage)
            }
          )
          if (!response.ok) {
            const errText = await response.text()
            throw new Error(errText)
          }
        })
      )

      for (const r of results) {
        if (r.status === 'fulfilled') successCount++
        else failCount++
      }
    }

    console.log(`Broadcast complete: ${successCount} sent, ${failCount} failed`)

    return new Response(
      JSON.stringify({ success: true, sent: successCount, failed: failCount, total: tokens.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in broadcast notification:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
