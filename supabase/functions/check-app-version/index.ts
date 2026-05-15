// Mağaza sürümünü otomatik kontrol eder.
// iOS: Apple iTunes Lookup API (resmi)
// Android: Play Store HTML scrape

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const IOS_BUNDLE_ID = "com.ergan.kelimele";
const ANDROID_PACKAGE = "com.ergan.kelimele";
const IOS_STORE_URL = "https://apps.apple.com/tr/app/kelimele-online-kelime-oyunu/id6759326006?l=tr";
const ANDROID_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}&hl=tr`;

// In-memory cache (cold-start sonrası 1 saat dayanır)
type CacheEntry = { value: string; expires: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 saat

const getCached = (key: string): string | null => {
  const e = cache.get(key);
  if (e && e.expires > Date.now()) return e.value;
  return null;
};
const setCached = (key: string, value: string) => {
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
};

async function fetchIosVersion(): Promise<string | null> {
  const cached = getCached("ios");
  if (cached) return cached;
  try {
    const res = await fetch(
      `https://itunes.apple.com/lookup?bundleId=${IOS_BUNDLE_ID}&t=${Date.now()}`,
      { headers: { "Cache-Control": "no-cache" } }
    );
    const data = await res.json();
    const version = data?.results?.[0]?.version;
    if (version) {
      setCached("ios", version);
      return version;
    }
  } catch (e) {
    console.error("iOS version fetch failed:", e);
  }
  return null;
}

async function fetchAndroidVersion(): Promise<string | null> {
  const cached = getCached("android");
  if (cached) return cached;
  try {
    const res = await fetch(ANDROID_STORE_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    const html = await res.text();

    // Play Store HTML birkaç farklı pattern içerebiliyor — sırayla dene
    const patterns = [
      /\[\[\["(\d+\.\d+(?:\.\d+)*(?:\.\d+)?)"\]\],?\s*"\d+"\]/, // klasik dizi pattern
      /"softwareVersion"\s*:\s*"(\d+\.\d+(?:\.\d+)*)"/,
      /Current Version[\s\S]{0,200}?>(\d+\.\d+(?:\.\d+)*)</,
      /\[\[\[\"(\d+\.\d+\.\d+)\"\]/,
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m && m[1]) {
        setCached("android", m[1]);
        return m[1];
      }
    }
  } catch (e) {
    console.error("Android version fetch failed:", e);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let platform = url.searchParams.get("platform");
    if (!platform && req.method === "POST") {
      try {
        const body = await req.json();
        platform = body?.platform;
      } catch (_) {
        // body opsiyonel
      }
    }

    if (platform !== "ios" && platform !== "android") {
      return new Response(
        JSON.stringify({ error: "platform must be 'ios' or 'android'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const latestVersion =
      platform === "ios" ? await fetchIosVersion() : await fetchAndroidVersion();

    const storeUrl = platform === "ios" ? IOS_STORE_URL : ANDROID_STORE_URL;

    return new Response(
      JSON.stringify({
        platform,
        latest_version: latestVersion, // null olabilir (mağaza yanıtsız)
        store_url: storeUrl,
        cached_until: Date.now() + CACHE_TTL_MS,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("check-app-version error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
