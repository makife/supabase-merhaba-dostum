import { useCallback, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
}) => {
  const [open, setOpen] = useState(false);
  const actionRef = useRef<(() => void) | null>(null);

  const requestExit = useCallback((onConfirm: () => void) => {
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
    <AlertDialog open={open} onOpenChange={(v) => !v && handleCancel()}>
      <AlertDialogContent className="max-w-[90%] sm:max-w-md rounded-2xl bg-[#1e2d45] border-white/10 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">
            {options?.title ?? "Oyundan çık"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-white/70">
            {options?.description ??
              "Oyundan çıkmak istediğine emin misin? Mevcut ilerlemeni kaybedebilirsin."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={handleCancel}
            className="rounded-xl bg-white/10 border-white/10 text-white hover:bg-white/15"
          >
            {options?.cancelText ?? "Devam et"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {options?.confirmText ?? "Çık"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { requestExit, ExitConfirmDialog, isOpen: open };
};
