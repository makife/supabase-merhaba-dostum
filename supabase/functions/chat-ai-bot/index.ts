import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BOT_NAME = "kelimele";
const BOT_AVATAR = "/bot-avatar.png";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function askAI(apiKey: string, instructions: string, input: string): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-5.6-sol",
      instructions,
      input,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw Object.assign(new Error(`AI gateway error ${res.status}: ${detail.slice(0, 300)}`), {
      status: res.status,
    });
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload);
        if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
          text += evt.delta;
        } else if (evt.type === "response.completed" && !text) {
          text = evt.response?.output_text ?? "";
        }
      } catch {
        // ignore partial/non-JSON frames
      }
    }
  }

  return text.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const mode = body?.mode === "greeting" ? "greeting" : "reply";
    const username = String(body?.username ?? "Oyuncu").slice(0, 40);
    const message = String(body?.message ?? "").slice(0, 800);
    const history = Array.isArray(body?.history)
      ? body.history
          .slice(-8)
          .map((m: any) => `${String(m?.username ?? "?").slice(0, 30)}: ${String(m?.message ?? "").slice(0, 200)}`)
          .join("\n")
      : "";

    if (mode === "reply" && !message) return json({ error: "message required" }, 400);

    const GAME_KNOWLEDGE = [
      "OYUN BILGI TABANI (sadece buradaki bilgileri gercek kabul et, uydurma yapma):",
      "- Uygulama adi: kelimele. Turkce kelime bulma/yazma oyunu. Maclar 120 saniye, sunucu senkronize.",
      "- Oyun modlari: Rastgele Rakip (rastgele eslesme), Yapay Zeka (AI rakip), Ozel Oda (kod ile arkadas davet), Turnuva (ceyrek-yari-final; en az 2 gercek oyuncu, kalan slotlar bot).",
      "- Duello & Gorevler (Challenge) mini oyunlari: Kelime Puzzle, Harf Kosusu (kosan karakterli runner), Refleks, Kelime Hafiza, Karma (HADI - 2048 tarzi harf birlestirme). Her biri gunde bir kez oynanir, odul verir.",
      "- Mini Oyunlar sayfasi: Yilan, Hafiza, Refleks.",
      "- Diger ekranlar: Liderlik (haftalik/aylik/genel siralama ve oduller), Kirtasiye/Market (murekkep, oyun hakki, joker satin alma; gunluk reklam izleyerek 5 murekkep), Sans Carki, Profil (istatistikler, rank), Arkadaslar, Sohbet, Ayarlar, Radyo.",
      "- Jokerler (Degistir, Fisilda, Sen Yaz) ve murekkep (oyun hakki) sistemi var. VIP abonelik: sinirsiz sayfa/akis + gunluk joker hediyesi.",
      "- VIP gunluk joker miktari: AYLIK VIP her gun her jokerden 5'er (5 Degistir + 5 Fisilda + 5 Sen Yaz), YILLIK VIP her gun 7'ser (7 Degistir + 7 Fisilda + 7 Sen Yaz). Bu miktarlar kesindir.",
      "- Puan/EXP: kazanma x5, beraberlik x2, kaybetme x1. Mactan ayrilirsan EXP cezasi var. Rank sistemi 7 kademeli, +50/-30 RP.",
      "- Sohbette @rumuz ile mention, emoji tepki, engelleme ve sikayet (bayrak) ozellikleri var. Kufur/argo bot tarafindan tespit edilir.",
      "Bilmedigin bir detay sorulursa uydurmadan 'emin degilim' de ve ilgili sayfaya yonlendir.",
    ].join("\n");

    const instructions = [
      "Sen 'kelimele' adlı, Türkçe bir kelime oyunu mobil uygulamasının sohbet asistanısın.",
      "Her zaman Türkçe yaz. Samimi, sıcak, esprili ve kısa konuş.",
      "Cevaplar en fazla 2 kısa cümle ve 220 karakter olsun. Madde işareti, markdown ve emoji spamı kullanma (en fazla 1 emoji).",
      "Küfür, hakaret, siyaset ve müstehcen içerikten uzak dur; provokasyona kibarca gülümseyerek karşılık ver.",
      "Oyun hakkında sorulursa aşağıdaki bilgi tabanını kullan; oyun içeriğini asla uydurma.",
      "Oyun ismi veya mini oyun listesi sorulursa net isimleri say.",
      "\n" + GAME_KNOWLEDGE,
      "\nCANLI VERI: Asagida 'CANLI VERI' bolumu varsa oradaki siralama ve oyuncu bilgilerini kullanarak net cevap ver; 'liderlik verisine erisemiyorum' demeyi birak.",
    ].join(" ");

    // --- Canlı veri: liderlik ilk 3 + soruyu soranın durumu ---
    const admin = createClient(supabaseUrl, serviceKey);
    let liveContext = "";
    if (mode === "reply") {
      try {
        const [weekly, monthly, season] = await Promise.all([
          admin.rpc("get_weekly_leaderboard", { limit_count: 5 }),
          admin.rpc("get_monthly_leaderboard", { limit_count: 5 }),
          admin.rpc("get_season_leaderboard", { limit_count: 5 }),
        ]);

        const fmt = (rows: any, scoreKeys: string[]) =>
          Array.isArray(rows)
            ? rows
                .slice(0, 3)
                .map((r: any, i: number) => {
                  const score = scoreKeys.map((k) => r?.[k]).find((v) => typeof v === "number") ?? 0;
                  return `${i + 1}. ${r?.username ?? "Anonim"} (${score} puan)`;
                })
                .join(", ")
            : "veri yok";

        liveContext = [
          "CANLI VERI (su anki gercek siralama):",
          `- Haftalik ilk 3: ${fmt(weekly.data, ["weekly_score", "total_score", "score"])}`,
          `- Aylik ilk 3: ${fmt(monthly.data, ["monthly_score", "total_score", "score"])}`,
          `- Genel/sezon ilk 3: ${fmt(season.data, ["season_score", "total_score", "score"])}`,
          "Not: Haftalik pazartesi 00:00'da, aylik ay basinda, sezon 4 ayda bir sifirlanir; oduller donem bitince verilir.",
        ].join("\n");

        const { data: me } = await admin
          .from("profiles")
          .select("username, level, total_score, games_played, games_won, game_credits, premium_until")
          .eq("id", userData.user.id)
          .maybeSingle();
        if (me) {
          const vip = me.premium_until && new Date(me.premium_until) > new Date() ? "VIP aktif" : "VIP yok";
          liveContext += `\n- Soruyu soran oyuncu (${me.username ?? username}): seviye ${me.level ?? "?"}, ${me.total_score ?? 0} puan, ${me.games_played ?? 0} mac, ${me.games_won ?? 0} galibiyet, ${me.game_credits ?? 0} murekkep, ${vip}.`;
        }
      } catch (e) {
        console.error("live context error:", (e as any)?.message ?? e);
      }
    }

    const input =
      mode === "greeting"
        ? `Sohbete "${username}" adlı oyuncu katıldı. Ona rastgele, her seferinde farklı ve doğal bir karşılama mesajı yaz. İsmini mutlaka kullan ve gününün nasıl gittiğini sor. Tek cümle olsun.`
        : `${liveContext ? liveContext + "\n\n" : ""}Genel sohbet geçmişi:\n${history || "(yok)"}\n\n"${username}" sana şunu yazdı: ${message}\n\nOna doğal bir şekilde cevap ver, ismini kullanabilirsin.`;


    let reply = await askAI(apiKey, instructions, input);
    if (!reply) {
      reply =
        mode === "greeting"
          ? `${username} hoş geldin! Bugün nasıl gidiyor? 🙂`
          : `${username}, tam anlayamadım ama tekrar yazarsan yardımcı olayım.`;
    }
    if (reply.length > 400) reply = reply.slice(0, 397) + "...";

    const { data: inserted, error: insertError } = await admin
      .from("global_chat")
      .insert({
        user_id: null,
        username: BOT_NAME,
        message: reply,
        avatar_url: BOT_AVATAR,
      })
      .select()
      .single();

    if (insertError) return json({ error: insertError.message }, 500);

    return json({ reply, message: inserted });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    console.error("chat-ai-bot error:", error?.message ?? error);
    return json({ error: error?.message ?? "Bilinmeyen hata" }, status);
  }
});
