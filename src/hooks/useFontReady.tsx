import { useEffect, useState } from "react";

/**
 * Bir web fontunun yüklenip yüklendiğini takip eder.
 * FOUT (yazı tipinin önce fallback ile görünüp sonra değişmesi) engellemek için kullanılır.
 */
export function useFontReady(fontSpec: string, timeoutMs = 2000) {
  const [ready, setReady] = useState(() => {
    try {
      return typeof document !== "undefined" && (document as any).fonts?.check?.(fontSpec) === true;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    const done = () => {
      if (!cancelled) setReady(true);
    };

    const fonts: any = (document as any).fonts;
    if (!fonts?.load) {
      done();
      return;
    }

    fonts.load(fontSpec).then(done).catch(done);
    const t = window.setTimeout(done, timeoutMs);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [fontSpec, timeoutMs, ready]);

  return ready;
}
