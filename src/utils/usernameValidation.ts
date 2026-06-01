import { supabase } from "@/integrations/supabase/client";

export type UsernameCheckResult = "ok" | "taken" | "banned" | "invalid" | "error";

export async function checkUsernameAvailable(username: string): Promise<UsernameCheckResult> {
  try {
    const { data, error } = await supabase.rpc("check_username_available", {
      p_username: username,
    });
    if (error) {
      console.error("[checkUsernameAvailable] RPC hata:", error);
      return "error";
    }
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
