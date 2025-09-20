import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style as StatusBarStyle } from '@capacitor/status-bar';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - third-party plugin may not ship full types
import { NavigationBar } from '@ethion/capacitor-navigation-bar';

const DARK_HEX = '#1a1a1a';
const AUTO_HIDE_MS = 3000;

export function useImmersiveBars() {
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const Nav: any = NavigationBar as any;

    const applyDarkBars = async () => {
      try {
        // StatusBar settings
        await StatusBar.setOverlaysWebView({ overlay: true });
        await StatusBar.setBackgroundColor({ color: DARK_HEX });
        await StatusBar.setStyle({ style: StatusBarStyle.Light });
      } catch {}
      try {
        // NavigationBar settings (Android only)
        if (Nav?.setColor) await Nav.setColor({ color: DARK_HEX });
        // Prefer transient bars by swipe when available
        if (Nav?.setBehavior) {
          try {
            await Nav.setBehavior({ behavior: 'overlay-swipe' });
          } catch {
            // fallback for other enum names
            try { await Nav.setBehavior({ behavior: 'inset-swipe' }); } catch {}
          }
        }
      } catch {}
    };

    const showBars = async () => {
      try { await StatusBar.show(); } catch {}
      try { Nav?.setVisibility && (await Nav.setVisibility({ visibility: 'visible' })); } catch {}
    };

    const hideBars = async () => {
      try { await StatusBar.hide(); } catch {}
      try { Nav?.setVisibility && (await Nav.setVisibility({ visibility: 'hidden' })); } catch {}
    };

    const scheduleAutoHide = () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        hideBars();
      }, AUTO_HIDE_MS);
    };

    const handleTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      touchStartY.current = t.clientY;
      touchStartX.current = t.clientX;
    };

    const handleTouchMove = async (e: TouchEvent) => {
      if (touchStartY.current == null || touchStartX.current == null) return;
      const t = e.touches[0];
      const deltaY = t.clientY - touchStartY.current;
      const deltaX = Math.abs(t.clientX - touchStartX.current);
      const h = window.innerHeight;
      const isVertical = Math.abs(deltaY) > deltaX;
      const topEdge = touchStartY.current < 50 && deltaY > 24;
      const bottomEdge = touchStartY.current > h - 50 && deltaY < -24;
      if (isVertical && (topEdge || bottomEdge)) {
        await showBars();
        scheduleAutoHide();
      }
    };

    const handleTouchEnd = () => {
      touchStartY.current = null;
      touchStartX.current = null;
    };

    (async () => {
      await applyDarkBars();
      await hideBars(); // start hidden (immersive)
    })();

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);
}
