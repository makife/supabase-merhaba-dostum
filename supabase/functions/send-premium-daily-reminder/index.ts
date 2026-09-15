import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FCMMessage {
  message: {
    token: string
    notification: {
      title: string
      body: string
    }
    data?: Record<string, string>
    android?: {
      priority: 'high' | 'normal'
      notification: {
        sound: string
        channel_id: string
        notification_priority: 'PRIORITY_HIGH' | 'PRIORITY_MAX' | 'PRIORITY_DEFAULT'
        visibility: 'PUBLIC' | 'PRIVATE' | 'SECRET'
        default_sound: boolean
        default_vibrate_timings: boolean
      }
    }
    apns?: {
      headers?: {
        'apns-priority': string
      }
      payload: {
        aps: {
          sound: string
          badge?: number
          'content-available'?: number
        }
      }
    }
  }
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

async function sendFirebaseNotification(message: FCMMessage): Promise<boolean> {
  try {
    const accessToken = await getAccessToken()
    const projectId = Deno.env.get('FIREBASE_PROJECT_ID')!

    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      }
    )

    if (response.ok) {
      return true
    } else {
      const error = await response.text()
      console.error('FCM error:', error)
      return false
    }
  } catch (error) {
    console.error('Error sending FCM:', error)
    return false
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🎁 Starting premium daily reminder job...')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get today's date
    const today = new Date().toISOString().split('T')[0]

    // Find premium users who:
    // 1. Have active premium subscription (premium_until > now)
    // 2. Have push token
    // 3. Haven't claimed today's jokers yet
    const { data: premiumUsers, error: usersError } = await supabaseClient
      .from('profiles')
      .select('id, username, push_token, premium_until')
      .not('push_token', 'is', null)
      .gt('premium_until', new Date().toISOString())

    if (usersError) {
      console.error('Error fetching premium users:', usersError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!premiumUsers || premiumUsers.length === 0) {
      console.log('No premium users with push tokens found')
      return new Response(
        JSON.stringify({ success: true, message: 'No premium users to notify', sent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${premiumUsers.length} premium users with push tokens`)

    // Check which users haven't claimed today
    const { data: claimedToday, error: claimedError } = await supabaseClient
      .from('premium_daily_rewards')
      .select('user_id')
      .eq('reward_date', today)

    const claimedUserIds = new Set((claimedToday || []).map(r => r.user_id))
    
    // Filter users who haven't claimed
    const usersToNotify = premiumUsers.filter(u => !claimedUserIds.has(u.id))

    console.log(`${usersToNotify.length} premium users haven't claimed today's jokers`)

    let sentCount = 0
    let failedCount = 0

    // Send notifications
    for (const user of usersToNotify) {
      if (!user.push_token) continue

      const fcmMessage: FCMMessage = {
        message: {
          token: user.push_token,
          notification: {
            title: '🎁 VIP Günlük Jokerler Hazır!',
            body: 'Günlük 5x Değiştir, 5x Fısılda, 5x Sen Yaz jokerleriniz sizi bekliyor!'
          },
          data: {
            type: 'premium_daily_reminder',
            action: 'open_app'
          },
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
              channel_id: 'kelimeci_notifications',
              notification_priority: 'PRIORITY_HIGH',
              visibility: 'PUBLIC',
              default_sound: true,
              default_vibrate_timings: true
            }
          },
          apns: {
            headers: { 'apns-priority': '10' },
            payload: {
              aps: {
                sound: 'default',
                badge: 1,
                'content-available': 1
              }
            }
          }
        }
      }

      const success = await sendFirebaseNotification(fcmMessage)
      
      if (success) {
        sentCount++
        console.log(`✅ Sent reminder to ${user.username || user.id}`)
      } else {
        failedCount++
        console.log(`❌ Failed to send to ${user.username || user.id}`)
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log(`🎁 Premium daily reminder complete: ${sentCount} sent, ${failedCount} failed`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Premium daily reminders sent',
        stats: {
          totalPremiumUsers: premiumUsers.length,
          alreadyClaimed: claimedUserIds.size,
          notified: sentCount,
          failed: failedCount
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in send-premium-daily-reminder:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
