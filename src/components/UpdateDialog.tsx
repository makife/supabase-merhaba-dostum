import React, { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { nativeStorage } from "@/utils/nativeStorage";

// Basit semver karşılaştırma: a < b ise -1, eşitse 0, a > b ise 1
const compareVersions = (a: string, b: string): number => {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
};

const DISMISS_KEY = "kelimele:update_dismissed_version";

export const UpdateDialog: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(false);
  const [storeUrl, setStoreUrl] = useState<string>("");
  const [latestVersion, setLatestVersion] = useState<string>("");
  const [releaseNotes, setReleaseNotes] = useState<string>("");

  useEffect(() => {
    const check = async () => {
      try {
        if (!Capacitor.isNativePlatform()) return;
        const platform = Capacitor.getPlatform();
        if (platform !== "ios" && platform !== "android") return;

        const info = await CapacitorApp.getInfo();
        const currentVersion = info.version;

        // 1) Mağaza versiyonunu otomatik çek (Apple lookup / Play Store)
        let storeLatest: string | null = null;
        let resolvedStoreUrl = "";
        try {
          const { data, error } = await supabase.functions.invoke("check-app-version", {
            body: { platform },
          });
          if (!error && data) {
            storeLatest = data.latest_version || null;
            resolvedStoreUrl = data.store_url || "";
          }
        } catch (e) {
          console.warn("[UpdateDialog] store version fetch failed:", e);
        }

        // 2) Manuel override (Supabase tablosu) — opsiyonel kill switch
        let manualLatest: string | null = null;
        let manualMin: string | null = null;
        let manualForce = false;
        let manualStoreUrl = "";
        let manualNotes = "";
        try {
          const { data: row } = await supabase
            .from("app_versions")
            .select("latest_version, min_version, store_url, force_update, release_notes")
            .eq("platform", platform)
            .maybeSingle();
          if (row) {
            manualLatest = row.latest_version;
            manualMin = row.min_version;
            manualForce = !!row.force_update;
            manualStoreUrl = row.store_url || "";
            manualNotes = row.release_notes || "";
          }
        } catch (e) {
          console.warn("[UpdateDialog] manual override fetch failed:", e);
        }

        // En yüksek bilinen sürümü kullan: mağaza vs manuel
        const candidates = [storeLatest, manualLatest].filter(Boolean) as string[];
        if (candidates.length === 0) return;
        const latest = candidates.reduce((a, b) => (compareVersions(a, b) >= 0 ? a : b));

        const isBelowLatest = compareVersions(currentVersion, latest) < 0;
        const isBelowMin = manualMin
          ? compareVersions(currentVersion, manualMin) < 0
          : false;

        if (!isBelowLatest && !isBelowMin) return;

        const force = isBelowMin || manualForce;

        // Opsiyonel ise: aynı sürümü tekrar göstermeyelim
        if (!force) {
          const dismissed = await nativeStorage.getItem(DISMISS_KEY);
          if (dismissed === latest) return;
        }

        setLatestVersion(latest);
        setStoreUrl(resolvedStoreUrl || manualStoreUrl);
        setReleaseNotes(manualNotes);
        setForceUpdate(force);
        setOpen(true);
      } catch (e) {
        console.warn("[UpdateDialog] check failed:", e);
      }
    };
    check();
  }, []);

  const handleUpdate = () => {
    if (!storeUrl) return;
    try {
      window.open(storeUrl, "_system");
    } catch {
      window.location.href = storeUrl;
    }
  };

  const handleLater = async () => {
    if (latestVersion) {
      await nativeStorage.setItem(DISMISS_KEY, latestVersion);
    }
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (forceUpdate) return;
        if (!v) handleLater();
      }}
    >
      <DialogContent
        className="w-[90%] max-w-sm rounded-2xl border-0 p-6"
        style={{ backgroundColor: "#1e2d45" }}
        onPointerDownOutside={(e) => forceUpdate && e.preventDefault()}
        onEscapeKeyDown={(e) => forceUpdate && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-center text-white text-xl">
            Yeni Güncelleme Mevcut
          </DialogTitle>
          <DialogDescription className="text-center text-white/70 mt-2">
            {releaseNotes ||
              `Kelimele'nin yeni sürümü (${latestVersion}) yayında. Daha iyi bir deneyim için lütfen güncelleyin.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 mt-4">
          <Button
            onClick={handleUpdate}
            className="w-full rounded-xl text-white"
            style={{ backgroundColor: "#3b82f6" }}
          >
            Güncelle
          </Button>
          {!forceUpdate && (
            <Button
              onClick={handleLater}
              variant="ghost"
              className="w-full rounded-xl text-white/70 hover:text-white"
            >
              Daha Sonra
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
