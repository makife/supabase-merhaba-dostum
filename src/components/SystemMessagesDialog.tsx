import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SystemMessage } from "@/hooks/useSystemMessages";
import { Bell } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: SystemMessage[];
  loading?: boolean;
}

export function SystemMessagesDialog({ open, onOpenChange, messages, loading }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1e2d45] border-white/10 text-white max-w-md w-[90%] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Bell className="w-5 h-5 text-amber-400" />
            Sistem Mesajları
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
          {loading && messages.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">Yükleniyor...</p>
          ) : messages.length === 0 ? (
            <div className="py-10 flex flex-col items-center text-slate-400">
              <Bell className="w-10 h-10 mb-3 opacity-50" />
              <p className="text-sm">Henüz sistem mesajı yok</p>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className="rounded-xl bg-white/5 border border-white/10 p-3"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-bold text-sm text-white">{m.title}</h3>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">
                    {new Date(m.created_at).toLocaleDateString("tr-TR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {m.body}
                </p>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
