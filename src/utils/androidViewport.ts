import { registerPlugin } from "@capacitor/core";

interface WindowMetrics {
  width: number;
  height: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
}

const StableViewport = registerPlugin<{ getMetrics(): Promise<WindowMetrics> }>("StableViewport");

// Native measurements are physical pixels, whereas CSS uses WebView CSS pixels.
export function toCssViewport(metrics: WindowMetrics, cssWidth: number) {
  const scale = cssWidth / metrics.width;
  return {
    height: metrics.height * scale,
    top: metrics.top * scale,
    bottom: metrics.bottom * scale,
    left: metrics.left * scale,
    right: metrics.right * scale,
  };
}

export async function initializeAndroidViewport() {
  // Retry only during startup: bar visibility and keyboard changes must not
  // continuously recalculate the pinned layout. Older native builds fall back.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const metrics = await StableViewport.getMetrics();
      if (metrics.width <= 0 || metrics.height <= 0) return;
      const viewport = toCssViewport(metrics, window.innerWidth);
      const root = document.documentElement;
      root.style.setProperty("--android-stable-height", `${viewport.height}px`);
      for (const side of ["top", "bottom", "left", "right"] as const) {
        root.style.setProperty(`--android-stable-safe-${side}`, `${viewport[side]}px`);
      }
      return;
    } catch {
      if (attempt < 4) await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
}