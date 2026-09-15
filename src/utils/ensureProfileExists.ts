import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const getFallbackUsername = (user: User) => {
  const metadataUsername = user.user_metadata?.username;
  if (typeof metadataUsername === "string" && metadataUsername.trim()) {
    return metadataUsername.trim();
  }

  const fullName = user.user_metadata?.full_name;
  if (typeof fullName === "string" && fullName.trim()) {
    return fullName.trim();
  }

  const emailPrefix = user.email?.split("@")[0]?.trim();
  return emailPrefix || "Oyuncu";
};

export const ensureProfileExists = async (user: User | null | undefined) => {
  if (!user?.id) return null;

  const { data: existingProfile, error: existingError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existingError) {
    console.error("[ensureProfileExists] Profil kontrol hatası:", existingError);
    return null;
  }

  if (existingProfile) {
    return existingProfile;
  }

  const profilePayload = {
    id: user.id,
    email: user.email || `${user.id}@oauth.local`,
    username: getFallbackUsername(user),
    game_credits: 5,
    bonus_credits: 0,
    ink_count: 0,
    total_score: 0,
    total_games: 0,
    wins: 0,
    losses: 0,
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(profilePayload, { onConflict: "id" })
    .select("id")
    .single();

  if (error) {
    console.error("[ensureProfileExists] Profil oluşturma hatası:", error);
    return null;
  }

  console.log("[ensureProfileExists] ✅ Profil hazır:", user.id);
  return data;
};
