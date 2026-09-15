import { useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

/**
 * In-App Review prompt — iOS SKStoreReviewController + Android In-App Review API
 * üzerinden native rating dialog'unu açar.
 *
 * OS kuralları:
 * - iOS: yılda max 3 kez gösterilir, gerisi sessizce yutulur
 * - Android: Google quota uygular
 * Bu yüzden sadece "mutlu an"larda ve cooldown sonrası tetikleriz.
 *
 * Guard'lar:
 *  - Sadece native platform
 *  - Son istek üzerinden en az 60 gün geçmiş olmalı
 *  - Kullanıcı en az 5 maç tamamlamış olmalı
 *  - Kullanıcı en az 3 gün önce kayıt olmuş olmalı
 */

const LAST_PROMPT_KEY = "kelimele.review.lastPromptAt";
const MATCH_COUNT_KEY = "kelimele.review.matchCount";
const COOLDOWN_MS = 60 * 24 * 60 * 60 * 1000; // 60 gün
const MIN_MATCHES = 5;
const MIN_ACCOUNT_AGE_MS = 3 * 24 * 60 * 60 * 1000; // 3 gün

export type ReviewTrigger = "match_end" | "rank_up";

async function getNumber(key: string): Promise<number> {
  try {
    const { value } = await Preferences.get({ key });
    return value ? parseInt(value, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

async function setNumber(key: string, val: number): Promise<void> {
  try {
    await Preferences.set({ key, value: String(val) });
  } catch {
    /* noop */
  }
}

/** Maç bitince çağır — guard'lar geçerse review dialog tetiklenir */
export function useAppReviewPrompt() {
  const incrementMatchCount = useCallback(async () => {
    const cur = await getNumber(MATCH_COUNT_KEY);
    await setNumber(MATCH_COUNT_KEY, cur + 1);
    return cur + 1;
  }, []);

  const maybeRequestReview = useCallback(
    async (trigger: ReviewTrigger, opts?: { accountCreatedAt?: string | Date | null }) => {
      try {
        if (!Capacitor.isNativePlatform()) return;

        // Cooldown
        const last = await getNumber(LAST_PROMPT_KEY);
        if (last > 0 && Date.now() - last < COOLDOWN_MS) {
          return;
        }

        // Hesap yaşı
        if (opts?.accountCreatedAt) {
          const created = new Date(opts.accountCreatedAt).getTime();
          if (!isNaN(created) && Date.now() - created < MIN_ACCOUNT_AGE_MS) {
            return;
          }
        }

        // Maç sayısı (rank_up için skip etmiyoruz; rank atlamak zaten yeterli sinyal)
        if (trigger === "match_end") {
          const matches = await getNumber(MATCH_COUNT_KEY);
          if (matches < MIN_MATCHES) return;
        }

        const mod = await import("@capacitor-community/in-app-review");
        const InAppReview: any = (mod as any).InAppReview ?? (mod as any).default;
        if (!InAppReview?.requestReview) return;

        await InAppReview.requestReview();
        await setNumber(LAST_PROMPT_KEY, Date.now());
        console.log(`[InAppReview] Dialog requested (trigger=${trigger})`);
      } catch (e) {
        console.log("[InAppReview] error (non-fatal):", e);
      }
    },
    [],
  );

  return { maybeRequestReview, incrementMatchCount };
}
