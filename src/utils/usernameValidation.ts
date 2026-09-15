import { supabase } from "@/integrations/supabase/client";
import { containsBannedWords } from "@/utils/chatBot";

export type UsernameCheckResult = "ok" | "taken" | "banned" | "invalid" | "error";

export async function checkUsernameAvailable(username: string): Promise<UsernameCheckResult> {
  const clean = (username || "").trim();
  if (clean.length < 2) return "invalid";

  // Sohbetteki banlist sistemi ile aynı kontrol (leet/bypass dahil)
  const banCheck = containsBannedWords(clean);
  if (banCheck.found) return "banned";

  try {
    const { data, error } = await supabase.rpc("check_username_available", {
      p_username: clean,
    });
    if (error) {
      console.error("[checkUsernameAvailable] RPC hata:", error);
      return "error";
    }
    // DB sadece taken / invalid / ok döndürebilir; banned'i client'ta zaten yakaladık
    return (data as UsernameCheckResult) ?? "error";
  } catch (e) {
    console.error("[checkUsernameAvailable] exception:", e);
    return "error";
  }
}


export function usernameErrorMessage(result: UsernameCheckResult): string | null {
  switch (result) {
    case "ok":
      return null;
    case "taken":
      return "Bu isim daha önce alınmış";
    case "banned":
      return "Bu isim uygunsuz ifade içeriyor";
    case "invalid":
      return "Rumuz en az 2 karakter olmalıdır";
    default:
      return "Rumuz kontrol edilemedi, tekrar deneyin";
  }
}
