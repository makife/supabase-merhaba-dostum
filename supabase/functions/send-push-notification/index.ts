import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PushNotificationRequest {
  receiverId?: string
  userId?: string  // Backward compatibility
  title: string
  body: string
  data?: Record<string, any>
  // If true, skip sending push if user was recently active (app likely in foreground)
  skipIfOnline?: boolean
}

interface FCMMessage {
  message: {
    token?: string
    topic?: string
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
        notification_priority: 'PRIORITY_HIGH' | 'PRIORITY_MAX' | 'PRIORITY_DEFAULT' | 'PRIORITY_LOW' | 'PRIORITY_MIN'
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
          'mutable-content'?: number
        }
      }
    }
  }
}

interface FirebaseSendResult {
  success: boolean
  errorCode?: string
  errorText?: string
}

function normalizePushToken(token?: string | null): string {
  return token?.trim() ?? ''
}

function isApnsTokenFormat(token?: string | null): boolean {
  return /^[A-F0-9]{64}$/.test(normalizePushToken(token))
}

function extractFcmErrorCode(errorText: string): string | undefined {
  try {
    const parsed = JSON.parse(errorText)
    const fcmDetail = parsed?.error?.details?.find((detail: Record<string, unknown>) => {
      return detail?.['@type'] === 'type.googleapis.com/google.firebase.fcm.v1.FcmError'
    }) as { errorCode?: string } | undefined

    return fcmDetail?.errorCode || parsed?.error?.status
  } catch {
    return undefined
  }
}

async function clearStoredPushToken(supabaseClient: any, receiverId: string, reason: string) {
  try {
    const { error } = await supabaseClient
      .from('profiles')
      .update({ push_token: null })
      .eq('id', receiverId)

    if (error) {
      console.error(`Failed to clear invalid push token for user ${receiverId}:`, error)
      return
    }

    console.log(`Cleared invalid push token for user ${receiverId} (${reason})`)
  } catch (error) {
    console.error(`Unexpected error clearing push token for user ${receiverId}:`, error)
  }
}

async function getAccessToken(): Promise<string> {
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID')!
  const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY')!.replace(/\\n/g, '\n')
  const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL')!

  const now = Math.floor(Date.now() / 1000)
  const exp = now + 3600 // 1 hour

  // JWT Header
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  }

  // JWT Payload
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: exp,
    scope: 'https://www.googleapis.com/auth/firebase.messaging'
  }

  // Create JWT manually (since we can't use external JWT libraries easily in Deno)
  const encoder = new TextEncoder()
  
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  
  const message = `${headerB64}.${payloadB64}`
  
  // Import private key for signing
  const keyData = privateKey.replace('-----BEGIN PRIVATE KEY-----', '')
                           .replace('-----END PRIVATE KEY-----', '')
                           .replace(/\s/g, '')
  
  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0))
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(message)
  )
  
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
                      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  
  const jwt = `${message}.${signatureB64}`
  
  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  })
  
  const tokenData = await tokenResponse.json()
  return tokenData.access_token
}

async function sendFirebaseNotification(message: FCMMessage): Promise<FirebaseSendResult> {
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
      console.log('Push notification sent successfully')
      return { success: true }
    }

    const error = await response.text()
    const errorCode = extractFcmErrorCode(error)
    console.error('Failed to send push notification:', error)
    return { success: false, errorCode, errorText: error }
  } catch (error) {
    console.error('Error sending push notification:', error)
    return { success: false, errorText: String(error) }
  }
}

serve(async (req) => {
  // Handle CORS
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

    // Try to verify user - but allow internal calls (from pg_net triggers) without auth
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()
    
    // If no auth, check for internal call marker (pg_net sends anon key, not a user JWT)
    // We allow unauthenticated calls since verify_jwt is already false in config.toml
    // and this function is also called by database triggers via pg_net
    const isInternalCall = !user

    // Rate limit removed - not critical for push notifications

    const requestBody: PushNotificationRequest = await req.json()
    const receiverId = requestBody.receiverId || requestBody.userId

    if (!receiverId || !requestBody.title || !requestBody.body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: receiverId (or userId), title, body' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const { title, body, data, skipIfOnline } = requestBody

    // Get receiver's push token, last_seen and active_chat_id from database
    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .select('push_token, last_seen, active_chat_id')
      .eq('id', receiverId)
      .single()

    // 🔕 Eğer mesaj bildirimi ise ve kullanıcı zaten o özel sohbeti açık tutuyorsa push'u atla
    if (data?.type === 'message' && data?.chatId && profileData?.active_chat_id === data.chatId) {
      console.log(`User ${receiverId} is already in chat ${data.chatId} - skipping push`)
      return new Response(
        JSON.stringify({ success: true, message: 'User already in this chat, skipping push', skipped: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (profileError || !profileData?.push_token) {
      console.log('Push token not found for user', receiverId, '- silently succeeding')
      return new Response(
        JSON.stringify({ success: true, message: 'User does not have push notifications enabled' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const pushToken = normalizePushToken(profileData.push_token)

    if (isApnsTokenFormat(pushToken)) {
      console.warn(`User ${receiverId} has an APNs token in profiles.push_token - clearing invalid token`) 
      await clearStoredPushToken(supabaseClient, receiverId, 'apns_token_detected')
      return new Response(
        JSON.stringify({ success: true, message: 'Invalid APNs token cleared from profile', skipped: true }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // If skipIfOnline is true, check if user was active in last 30 seconds
    // This means their app is likely in foreground and they'll see in-app notifications
    if (skipIfOnline && profileData.last_seen) {
      const lastSeen = new Date(profileData.last_seen)
      const now = new Date()
      const secondsSinceLastSeen = (now.getTime() - lastSeen.getTime()) / 1000
      
      if (secondsSinceLastSeen < 30) {
        console.log(`User ${receiverId} was active ${secondsSinceLastSeen}s ago - skipping push (will see in-app notification)`)
        return new Response(
          JSON.stringify({ success: true, message: 'User is online, skipping push notification', skipped: true }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
    }

    // Prepare FCM message with HIGH PRIORITY for heads-up display
    const fcmMessage: FCMMessage = {
      message: {
        token: pushToken,
        notification: {
          title,
          body
        },
        data: data ? Object.fromEntries(
          Object.entries(data).map(([key, value]) => [key, String(value)])
        ) : undefined,
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
          headers: {
            'apns-priority': '10'
          },
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              'content-available': 1,
              'mutable-content': 1
            }
          }
        }
      }
    }

    // Send notification in background
    const sendNotification = async () => {
      const result = await sendFirebaseNotification(fcmMessage)

      if (!result.success && result.errorCode === 'UNREGISTERED') {
        await clearStoredPushToken(supabaseClient, receiverId, 'fcm_unregistered')
      }
      
      // Store notification in database (only fields that exist in the table)
      try {
        await supabaseClient
          .from('notifications')
          .insert({
            user_id: receiverId,
            type: data?.type || 'general',
            message: `${title}: ${body}`,
            related_id: data?.roomCode || data?.chatId || data?.tournamentId || null,
            is_read: false
          })
      } catch (dbError) {
        console.log('Could not save notification to DB:', dbError)
      }

      console.log(`Notification ${result.success ? 'sent' : `failed (${result.errorCode ?? 'unknown'})`} to user ${receiverId}`)
    }

    // Use background task for notification sending
    // Background task - send notification asynchronously
    sendNotification().catch(console.error)

    return new Response(
      JSON.stringify({ success: true, message: 'Notification queued successfully' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error in send-push-notification function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})