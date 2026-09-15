import { useCallback, useRef, useState } from "react";
import ExitConfirmCardDialog from "@/components/ExitConfirmCardDialog";

/**
 * Mini oyun / düello-görev sayfaları için "Çıkmak istediğine emin misin?"
 * onayı sağlayan yeniden kullanılabilir hook.
 *
 * Kullanım:
 *   const { requestExit, ExitConfirmDialog } = useExitGameConfirm();
 *   <button onClick={() => requestExit(() => navigate(-1))}>Geri</button>
 *   {ExitConfirmDialog}
 */
export const useExitGameConfirm = (options?: {
  variant?: "default" | "tournament" | "tournament-bracket";
}) => {
  const [open, setOpen] = useState(false);
  const actionRef = useRef<(() => void) | null>(null);

  const requestExit = useCallback((onConfirm: () => void, skipConfirm = false) => {
    if (skipConfirm) {
      onConfirm();
      return;
    }
    actionRef.current = onConfirm;
    setOpen(true);
  }, []);

  const handleCancel = useCallback(() => {
    setOpen(false);
    actionRef.current = null;
  }, []);

  const handleConfirm = useCallback(() => {
    const fn = actionRef.current;
    setOpen(false);
    actionRef.current = null;
    if (fn) fn();
  }, []);

  const ExitConfirmDialog = (
    <ExitConfirmCardDialog
      open={open}
      onContinue={handleCancel}
      onExit={handleConfirm}
      variant={options?.variant}
    />
  );

  return { requestExit, ExitConfirmDialog, isOpen: open };
};
