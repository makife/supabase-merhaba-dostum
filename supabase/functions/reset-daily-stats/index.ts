import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          daily_games: number | null
          daily_wins: number | null
          win_streak: number | null
          last_daily_reset: string | null
        }
        Update: {
          daily_games?: number | null
          daily_wins?: number | null
          win_streak?: number | null
          last_daily_reset?: string | null
        }
      }
    }
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('🔄 Starting daily stats reset...')

    // Get current date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0]
    
    // Reset daily stats for all users
    const { data, error } = await supabase
      .from('profiles')
      .update({
        daily_games: 0,
        daily_wins: 0,
        win_streak: 0, // Seri de günlük olarak sıfırlanıyor
        last_daily_reset: today
      })
      .neq('id', '00000000-0000-0000-0000-000000000000') // Exclude system user if any
      .select('id')

    if (error) {
      console.error('❌ Daily stats reset error:', error)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const resetCount = data?.length || 0
    console.log(`✅ Daily stats reset completed for ${resetCount} users`)

    // Also clean up old daily_leaderboard entries (older than 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const cleanupDate = thirtyDaysAgo.toISOString().split('T')[0]

    const { error: cleanupError } = await supabase
      .from('daily_leaderboard')
      .delete()
      .lt('date', cleanupDate)

    if (cleanupError) {
      console.warn('⚠️ Daily leaderboard cleanup warning:', cleanupError)
    } else {
      console.log('🧹 Old daily leaderboard entries cleaned up')
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Daily stats reset for ${resetCount} users`,
        date: today 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})