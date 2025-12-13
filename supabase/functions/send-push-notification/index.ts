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
      notification: {
        sound: string
        channel_id: string
      }
    }
    apns?: {
      payload: {
        aps: {
          sound: string
          badge?: number
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
      console.log('Push notification sent successfully')
      return true
    } else {
      const error = await response.text()
      console.error('Failed to send push notification:', error)
      return false
    }
  } catch (error) {
    console.error('Error sending push notification:', error)
    return false
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

    // Verify user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

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

    const { title, body, data } = requestBody

    // Get receiver's push token from database
    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .select('push_token')
      .eq('id', receiverId)
      .single()

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

    // Prepare FCM message
    const fcmMessage: FCMMessage = {
      message: {
        token: profileData.push_token,
        notification: {
          title,
          body
        },
        data: data ? Object.fromEntries(
          Object.entries(data).map(([key, value]) => [key, String(value)])
        ) : undefined,
        android: {
          notification: {
            sound: 'default',
            channel_id: 'kelimeci_notifications'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        }
      }
    }

    // Send notification in background
    const sendNotification = async () => {
      const success = await sendFirebaseNotification(fcmMessage)
      
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

      console.log(`Notification ${success ? 'sent' : 'failed'} to user ${receiverId}`)
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