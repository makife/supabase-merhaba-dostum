import { supabase } from "@/integrations/supabase/client";
import { Tournament } from "@/types/tournament";

const ACTIVE_TOURNAMENT_LIMIT = 8;

export const getTournamentServerNow = async (): Promise<Date> => {
  const { data, error } = await supabase.rpc("get_server_time");
  if (error || !data) throw error || new Error("Server time alınamadı");
  return new Date(data as string);
};

const queryActiveTournaments = async (limit: number): Promise<Tournament[]> => {
  const serverNow = await getTournamentServerNow();
  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .eq("status", "waiting")
    .or(`expires_at.gt.${serverNow.toISOString()},and(is_private.eq.true,expires_at.is.null)`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []) as Tournament[];
};

const runEnsurePoolInBackground = () => {
  void supabase.functions.invoke("ensure-bot-tournaments").then(async ({ error }) => {
    if (!error) return;
    try {
      await supabase.rpc("cleanup_expired_tournaments");
    } catch {
      // Liste yenilemesini bloke etme.
    }
  });
};

export const fetchActiveTournamentList = async (limit = ACTIVE_TOURNAMENT_LIMIT): Promise<Tournament[]> => {
  const activeTournaments = await queryActiveTournaments(limit);
  runEnsurePoolInBackground();

  return activeTournaments;
};
