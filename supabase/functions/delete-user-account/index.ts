import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Get the user's JWT from the request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create a client with the user's JWT to get their user ID
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: { Authorization: authHeader }
      }
    })

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    
    if (userError || !user) {
      console.error('User authentication error:', userError)
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = user.id
    console.log('Deleting user account for:', userId)

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // First, delete all user data from public tables
    console.log('Deleting user data from public tables...')
    
    // Nullify game_rooms references
    await supabaseAdmin.from('game_rooms').update({ host_id: null }).eq('host_id', userId)
    await supabaseAdmin.from('game_rooms').update({ player1_id: null }).eq('player1_id', userId)
    await supabaseAdmin.from('game_rooms').update({ player2_id: null }).eq('player2_id', userId)
    await supabaseAdmin.from('game_rooms').update({ winner_id: null }).eq('winner_id', userId)
    
    // Nullify tournament_matches references
    await supabaseAdmin.from('tournament_matches').update({ player1_id: null }).eq('player1_id', userId)
    await supabaseAdmin.from('tournament_matches').update({ player2_id: null }).eq('player2_id', userId)
    await supabaseAdmin.from('tournament_matches').update({ winner_id: null }).eq('winner_id', userId)
    
    // Nullify tournaments references
    await supabaseAdmin.from('tournaments').update({ creator_id: null }).eq('creator_id', userId)
    
    // Delete from all user-related tables
    const tablesToDelete = [
      { table: 'user_presence', column: 'user_id' },
      { table: 'user_badges', column: 'user_id' },
      { table: 'user_bans', column: 'user_id' },
      { table: 'user_inventory', column: 'user_id' },
      { table: 'user_purchases', column: 'user_id' },
      { table: 'user_roles', column: 'user_id' },
      { table: 'user_settings', column: 'user_id' },
      { table: 'daily_leaderboard', column: 'user_id' },
      { table: 'daily_stats', column: 'user_id' },
      { table: 'weekly_stats', column: 'user_id' },
      { table: 'monthly_stats', column: 'user_id' },
      { table: 'game_sessions', column: 'user_id' },
      { table: 'game_history', column: 'player_id' },
      { table: 'game_words', column: 'player_id' },
      { table: 'game_participants', column: 'user_id' },
      { table: 'global_chat', column: 'user_id' },
      { table: 'global_messages', column: 'user_id' },
      { table: 'message_reactions', column: 'user_id' },
      { table: 'notifications', column: 'user_id' },
      { table: 'player_activities', column: 'player_id' },
      { table: 'tournament_participants', column: 'user_id' },
      { table: 'wheel_spins', column: 'user_id' },
      { table: 'memory_game_plays', column: 'user_id' },
    ]

    for (const { table, column } of tablesToDelete) {
      const { error } = await supabaseAdmin.from(table).delete().eq(column, userId)
      if (error) {
        console.log(`Warning: Could not delete from ${table}:`, error.message)
      }
    }

    // Handle tables with multiple user references
    await supabaseAdmin.from('user_blocks').delete().eq('blocker_id', userId)
    await supabaseAdmin.from('user_blocks').delete().eq('blocked_id', userId)
    await supabaseAdmin.from('private_messages').delete().eq('sender_id', userId)
    await supabaseAdmin.from('private_messages').delete().eq('recipient_id', userId)
    await supabaseAdmin.from('private_chats').delete().eq('user1_id', userId)
    await supabaseAdmin.from('private_chats').delete().eq('user2_id', userId)
    await supabaseAdmin.from('message_reports').delete().eq('reporter_id', userId)
    await supabaseAdmin.from('message_reports').delete().eq('reported_user_id', userId)
    await supabaseAdmin.from('rematch_requests').delete().eq('from_user_id', userId)
    await supabaseAdmin.from('rematch_requests').delete().eq('to_user_id', userId)
    await supabaseAdmin.from('rematch_opt_outs').delete().eq('user_id', userId)

    // Delete profile last (before auth user)
    const { error: profileError } = await supabaseAdmin.from('profiles').delete().eq('id', userId)
    if (profileError) {
      console.log('Warning: Could not delete profile:', profileError.message)
    }

    console.log('All public data deleted, now deleting auth user...')

    // Finally, delete the user from auth.users using admin API
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    
    if (deleteError) {
      console.error('Failed to delete auth user:', deleteError)
      return new Response(
        JSON.stringify({ error: 'Failed to delete authentication account', details: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User account fully deleted:', userId)

    return new Response(
      JSON.stringify({ success: true, message: 'Account deleted successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error during account deletion:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
