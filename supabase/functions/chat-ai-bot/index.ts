import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      "- OYUN MODU SAYISI: tam 4 cesit ana oyun modu var: 1) Rastgele Rakip (rastgele eslesme), 2) Turnuva (ceyrek-yari-final; en az 2 gercek oyuncu, kalan slotlar bot), 3) Yapay Zeka (AI rakip), 4) Ozel Oda (kod ile arkadas davet). 'Kac cesit oyun modu var' sorusuna 4 de ve isimleri say.",
      "- Duello & Gorevler (Challenge) mini oyunlari: 5 adet -> Kelime Puzzle, Harf Kosusu (kosan karakterli runner), Refleks, Kelime Hafiza, HADI (2048 tarzi harf birlestirme). Her biri gunde bir kez oynanir, odul verir.",
      "- Mini Oyunlar sayfasi: 3 adet -> Yilan, Hafiza, Refleks.",
      "- Diger ekranlar: Liderlik (haftalik/aylik/genel siralama ve oduller), Kirtasiye/Market (murekkep, oyun hakki, joker satin alma; gunluk reklam izleyerek 5 murekkep), Sans Carki, Profil (istatistikler, rank), Arkadaslar, Sohbet, Ayarlar, Radyo.",
      "- Jokerler: 3 cesit -> Degistir, Fisilda, Sen Yaz. Murekkep = oyun hakki. VIP abonelik: sinirsiz sayfa/akis + gunluk joker hediyesi.",
      "- VIP gunluk joker miktari: AYLIK VIP her gun her jokerden 5'er (5 Degistir + 5 Fisilda + 5 Sen Yaz), YILLIK VIP her gun 7'ser (7 Degistir + 7 Fisilda + 7 Sen Yaz). Bu miktarlar kesindir.",
      "- Puan/EXP: kazanma x5, beraberlik x2, kaybetme x1. Mactan ayrilirsan EXP cezasi var.",
      "- RANK SISTEMI: sadece rastgele eslesme maclari rank puani (RP) verir. Kazanma +50 RP, beraberlik +10 RP, kaybetme -30 RP.",
      "  7 rank grubu ve 22 kademe var: Cirak (Harf Ciragi, Hece Toplayici, Kelime Fidani, Soz Tomurcugu), Katip (Murekkep Yolcusu, Defter Bekcisi, Satir Dokumacisi), Yazar (Kalem Zanaatkari, Divan Sakirdi, Beyit Iscisi), Sair (Gazel Nakkasi, Misra Mimari, Kaside Hattati), Bilge (Soz Simyacisi, Hikmet Dervisi, Irfan Seyhi), Efsane (Lugat Filozofu, Efsane Ozan, Soz Sultani), Ustat (Kelime Piri, Lisan-i Ustad, Kelam-i Ezel).",
      "- Sohbette @rumuz ile mention, emoji tepki, engelleme ve sikayet (bayrak) ozellikleri var. Kufur/argo bot tarafindan tespit edilir.",
      "Bilmedigin bir detay sorulursa uydurmadan 'emin degilim' de ve ilgili sayfaya yonlendir.",
    ].join("\n");

    const instructions = [
      "Sen 'kelimele' adlı, Türkçe bir kelime oyunu mobil uygulamasının sohbet asistanısın.",
      "Her zaman Türkçe yaz. Samimi, sıcak, esprili ve kısa konuş.",
      "Cevaplar en fazla 2 kısa cümle ve 220 karakter olsun. Madde işareti, markdown ve emoji spamı kullanma (en fazla 1 emoji).",
      "Küfür, hakaret, siyaset ve müstehcen içerikten uzak dur; provokasyona kibarca gülümseyerek karşılık ver.",
      "Oyun hakkında sorulursa aşağıdaki bilgi tabanını kullan; oyun içeriğini asla uydurma.",
      "Oyun ismi, oyun modu sayısı veya mini oyun listesi sorulursa net sayı ve isimleri say; 'bilmiyorum' deme.",
      "\n" + GAME_KNOWLEDGE,
      "\nCANLI VERI: Asagida 'CANLI VERI' bolumu varsa oradaki siralama, oyuncu ve rank bilgilerini kullanarak net cevap ver; 'veriye erisemiyorum' demeyi birak. Bir oyuncu sorulduysa ve 'SORULAN OYUNCULAR' bolumunde varsa onun rank adi, RP'si ve istatistiklerini soyle.",
    ].join(" ");

    // Rank kademeleri (src/utils/rankSystem.ts ile birebir aynı)
    const RANK_TIERS: { name: string; min: number }[] = [
      { name: "Harf Çırağı", min: 0 },
      { name: "Hece Toplayıcı", min: 100 },
      { name: "Kelime Fidanı", min: 210 },
      { name: "Söz Tomurcuğu", min: 320 },
      { name: "Mürekkep Yolcusu", min: 450 },
      { name: "Defter Bekçisi", min: 630 },
      { name: "Satır Dokumacısı", min: 840 },
      { name: "Kalem Zanaatkârı", min: 1080 },
      { name: "Divan Şakirdi", min: 1340 },
      { name: "Beyit İşçisi", min: 1640 },
      { name: "Gazel Nakkaşı", min: 1980 },
      { name: "Mısra Mimarı", min: 2360 },
      { name: "Kaside Hattatı", min: 2780 },
      { name: "Söz Simyacısı", min: 3240 },
      { name: "Hikmet Dervişi", min: 3740 },
      { name: "İrfan Şeyhi", min: 4290 },
      { name: "Lügat Filozofu", min: 4700 },
      { name: "Efsane Ozan", min: 4980 },
      { name: "Söz Sultanı", min: 5200 },
      { name: "Kelime Piri", min: 5350 },
      { name: "Lisan-ı Üstad", min: 5430 },
      { name: "Kelâm-ı Ezel", min: 5480 },
    ];
    const rankName = (rp: number) => {
      let name = RANK_TIERS[0].name;
      for (const t of RANK_TIERS) if (rp >= t.min) name = t.name;
      return name;
    };

    const PROFILE_FIELDS =
      "id, username, total_score, total_games, wins, losses, win_streak, best_streak, rank_points, game_credits, bonus_credits, ink_count, premium_until, tournament_wins, weekly_first_count, monthly_first_count, season_first_count, longest_word, highest_word, highest_word_score, in_game, last_seen";

    const describeProfile = (p: any) => {
      const rp = p?.rank_points ?? 0;
      const vip = p?.premium_until && new Date(p.premium_until) > new Date() ? "VIP aktif" : "VIP yok";
      return `${p?.username ?? "Anonim"}: rank ${rankName(rp)} (${rp} RP), ${p?.total_score ?? 0} puan, ${p?.total_games ?? 0} mac, ${p?.wins ?? 0} galibiyet / ${p?.losses ?? 0} yenilgi, seri ${p?.win_streak ?? 0} (rekor ${p?.best_streak ?? 0}), ${p?.game_credits ?? 0}+${p?.bonus_credits ?? 0} oyun hakki, ${p?.ink_count ?? 0} murekkep, ${p?.tournament_wins ?? 0} turnuva sampiyonlugu, en uzun kelime ${p?.longest_word ?? "-"}, en yuksek kelime ${p?.highest_word ?? "-"} (${p?.highest_word_score ?? 0}p), ${vip}, ${p?.in_game ? "su an macta" : "macta degil"}`;
    };

    // --- Canlı veri: liderlik + soran oyuncu + mesajda geçen oyuncular ---
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
          .select(PROFILE_FIELDS)
          .eq("id", userData.user.id)
          .maybeSingle();
        if (me) liveContext += `\n- Soruyu soran oyuncu -> ${describeProfile(me)}`;

        // Mesajda adı geçen oyuncuları bul (rank/istatistik sorguları için)
        const tokens = Array.from(
          new Set(
            message
              .replace(/[@?!.,;:()"']/g, " ")
              .split(/\s+/)
              .map((t) => t.trim())
              .filter((t) => t.length >= 3 && t.toLowerCase() !== "kelimele")
              .slice(0, 12),
          ),
        );

        if (tokens.length) {
          const orFilter = tokens
            .map((t) => `username.ilike.${t.replace(/[,%]/g, "")}`)
            .concat(tokens.map((t) => `username.ilike.${t.replace(/[,%]/g, "")}%`))
            .join(",");
          const { data: matched } = await admin
            .from("profiles")
            .select(PROFILE_FIELDS)
            .or(orFilter)
            .neq("id", userData.user.id)
            .limit(4);
          if (matched?.length) {
            liveContext +=
              "\nSORULAN OYUNCULAR (mesajda adi gecenler):\n" +
              matched.map((p: any) => `- ${describeProfile(p)}`).join("\n");
          }
        }

        // Genel canlı istatistikler
        const [{ count: totalPlayers }, { count: onlineNow }, { count: activeTournaments }] = await Promise.all([
          admin.from("profiles").select("id", { count: "exact", head: true }),
          admin
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .gt("last_seen", new Date(Date.now() - 5 * 60 * 1000).toISOString()),
          admin
            .from("tournaments")
            .select("id", { count: "exact", head: true })
            .in("status", ["waiting", "active", "in_progress"]),
        ]);
        liveContext += `\n- Toplam kayitli oyuncu: ${totalPlayers ?? "?"}, son 5 dakikada aktif: ${onlineNow ?? "?"}, devam eden turnuva: ${activeTournaments ?? "?"}.`;
      } catch (e) {
        console.error("live context error:", (e as any)?.message ?? e);
      }
    }


    const input =
      mode === "greeting"
        ? `Sohbete "${username}" adlı oyuncu katıldı. Sen kelimele uygulamasının yapay zeka sohbet asistanısın. Ona samimi, esprili ve her seferinde farklı bir karşılama mesajı yaz. İsmini kullan. Günün nasıl geçtiğini sormak zorunda değilsin; bazen oyunla, bazen sohbetle, bazen de kısa bir espriyle karşıla. Tek cümle olsun ve kesinlikle yapay zeka olduğunu belli edecek şekilde doğal konuş.`
        : `${liveContext ? liveContext + "\n\n" : ""}Genel sohbet geçmişi:\n${history || "(yok)"}\n\n"${username}" sana şunu yazdı: ${message}\n\nOna doğal bir şekilde cevap ver, ismini kullanabilirsin.`;


    let reply = await askAI(apiKey, instructions, input);
    if (!reply) {
      reply =
        mode === "greeting"
          ? `Selam ${username}! Ben kelimele'nin yapay zeka asistanıyım. Sohbette bana @kelimele yazarak istediğini sorabilirsin. 🎯`
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
