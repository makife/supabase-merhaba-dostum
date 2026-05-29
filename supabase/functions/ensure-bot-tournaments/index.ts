// Ensures that a random number of global bot-created tournaments are always waiting.
// Bot tournaments are pre-filled with bot slots; real players replace those slots.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Hedef sayıyı her çağrıda 2-9 arası rastgele seç
const pickTarget = () => 2 + Math.floor(Math.random() * 8);
const BOT_TOURNAMENT_TTL_SEC = 30; // her turnuva 30 saniye yaşar
const MAX_PARTICIPANTS = 8;

// Inline minimal name/avatar helpers (duplicated from client to avoid bundling)
const MALE = ["ahmet","mehmet","ali","emre","can","burak","yusuf","berk","arda","efe","emir","kaan","mert","kerem","bora","doruk","eren","alp","ege","koray","tolga","onur","umut","barış"];
const FEMALE = ["ayşe","zeynep","elif","ece","selin","merve","sude","ada","defne","ilayda","asya","nisa","irem","ela","nehir","maya","eylül","lara","derin","pelin","damla","su","ceren","begüm","deniz"];
const ALL = [...MALE, ...FEMALE];
const MALE_AV = Array.from({ length: 45 }, (_, i) => i + 1);
const FEMALE_AV = Array.from({ length: 45 }, (_, i) => i + 46);

function makeBot(seed: number) {
  const name = ALL[Math.abs(seed) % ALL.length];
  const isMale = MALE.includes(name);
  const pool = isMale ? MALE_AV : FEMALE_AV;
  const av = pool[Math.abs(seed * 13 + 7) % pool.length];
  const decor = Math.abs(seed) % 4;
  const num = 100 + (Math.abs(seed * 31) % 9000);
  const finalName =
    decor === 0 ? `${name}${num}` :
    decor === 1 ? `_${name}_` :
    decor === 2 ? `${name}.${Math.abs(seed) % 100}` :
                  `${name.charAt(0).toUpperCase()}${name.slice(1)}${num}`;
  return { username: finalName, avatar_url: `/avatarlar/${av}.svg` };
}

async function fillBotSlots(supabase: ReturnType<typeof createClient>, tournamentId: string) {
  const { count } = await supabase
    .from("tournament_participants")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);

  const missing = Math.max(0, MAX_PARTICIPANTS - (count || 0));
  if (missing === 0) return 0;

  const rows = Array.from({ length: missing }, () => ({
    tournament_id: tournamentId,
    user_id: crypto.randomUUID(),
    is_bot: true,
  }));

  const { error } = await supabase.from("tournament_participants").insert(rows);
  if (error) {
    console.error("fill bot slots failed", tournamentId, error);
    return 0;
  }

  return missing;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Cleanup: sadece gerçek oyuncusu olmayan, eski (>30s) bot turnuvalarını iptal et
    const staleCutoff = new Date(Date.now() - BOT_TOURNAMENT_TTL_SEC * 1000).toISOString();
    const { data: staleCandidates } = await supabase
      .from("tournaments")
      .select("id")
      .eq("is_bot_tournament", true)
      .eq("status", "waiting")
      .lt("created_at", staleCutoff);

    if (staleCandidates && staleCandidates.length > 0) {
      for (const t of staleCandidates) {
        const { count: realCount } = await supabase
          .from("tournament_participants")
          .select("id", { count: "exact", head: true })
          .eq("tournament_id", t.id)
          .eq("is_bot", false);
        if ((realCount || 0) === 0) {
          await supabase.from("tournaments").update({ status: "cancelled" }).eq("id", t.id);
        }
      }
    }

    // Waiting bot turnuvalarında katılımcı listesi her zaman 8 bot/oyuncu slotu dolu olsun
    const { data: activeBotTournaments } = await supabase
      .from("tournaments")
      .select("id")
      .eq("is_bot_tournament", true)
      .eq("status", "waiting");

    let slotsFilled = 0;
    for (const t of activeBotTournaments || []) {
      slotsFilled += await fillBotSlots(supabase, t.id);
    }

    // Count existing active bot tournaments
    const have = activeBotTournaments?.length ?? 0;

    const target = pickTarget();
    const need = Math.max(0, target - have);
    const created: string[] = [];

    for (let i = 0; i < need; i++) {
      const expiresAt = new Date(Date.now() + BOT_TOURNAMENT_TTL_SEC * 1000).toISOString();
      const hour = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
      const { data: t, error } = await supabase
        .from("tournaments")
        .insert({
          name: `Turnuva ${hour}`,
          creator_id: null,
          status: "waiting",
          game_type: "timed",
          max_participants: 8,
          current_round: 1,
          timeout_duration: 120,
          expires_at: expiresAt,
          is_bot_tournament: true,
        })
        .select("id")
        .single();

      if (error || !t) {
        console.error("create tournament failed", error);
        continue;
      }

      // Katılımcı listesi baştan 8 bot slotuyla dolu görünür.
      // Gerçek oyuncu katılınca rastgele bir bot slotunun yerini alır.
      slotsFilled += await fillBotSlots(supabase, t.id);
      created.push(t.id);
    }

    return new Response(JSON.stringify({ ok: true, have, target, created: created.length, slotsFilled }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
