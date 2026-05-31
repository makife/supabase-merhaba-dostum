import { supabase } from "@/integrations/supabase/client";
import { getGlobalServerNow } from "@/contexts/ServerTimeContext";
import { Tournament } from "@/types/tournament";

const ACTIVE_TOURNAMENT_LIMIT = 8;

export const getTournamentServerNow = async (): Promise<Date> => {
  const { data, error } = await supabase.rpc("get_server_time");
  if (!error && data) return new Date(data as string);
  return new Date(getGlobalServerNow());
};

export const fetchActiveTournamentList = async (limit = ACTIVE_TOURNAMENT_LIMIT): Promise<Tournament[]> => {
  const { error: ensureError } = await supabase.functions.invoke("ensure-bot-tournaments");

  if (ensureError) {
    try {
      await supabase.rpc("cleanup_expired_tournaments");
    } catch {
      // Edge function already failed silently; keep list refresh best-effort.
    }
  }

  const serverNow = await getTournamentServerNow();
  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .eq("status", "waiting")
    .gt("expires_at", serverNow.toISOString())
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []) as Tournament[];
};
