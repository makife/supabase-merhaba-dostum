import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SystemMessage } from "@/hooks/useSystemMessages";
import { Bell } from "lucide-react";
import { useSounds } from "@/hooks/useSounds";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: SystemMessage[];
  loading?: boolean;
  readIds: Set<string>;
  markAllRead: () => void;
}

export function SystemMessagesDialog({
  open,
  onOpenChange,
  messages,
  loading,
  readIds,
  markAllRead,
}: Props) {
  // Açılışta okunma durumunun anlık görüntüsü; kullanıcı "Yeni" tabını boş görmesin
  const [snapshotRead, setSnapshotRead] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"new" | "read">("new");
  const { playSound } = useSounds();

  useEffect(() => {
    if (open) {
      setSnapshotRead(new Set(readIds));
      const hasUnread = messages.some((m) => !readIds.has(m.id));
      setTab(hasUnread ? "new" : "read");
      // Açıldıktan kısa süre sonra okundu işaretle
      const t = setTimeout(() => markAllRead(), 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  const unread = messages.filter((m) => !snapshotRead.has(m.id));
  const read = messages.filter((m) => snapshotRead.has(m.id));

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const renderList = (list: SystemMessage[], emptyText: string) => {
    if (loading && messages.length === 0) {
      return <p className="text-sm text-slate-400 py-8 text-center">Yükleniyor...</p>;
    }
    if (list.length === 0) {
      return (
        <div className="py-10 flex flex-col items-center text-slate-400">
          <Bell className="w-10 h-10 mb-3 opacity-50" />
          <p className="text-sm">{emptyText}</p>
        </div>
      );
    }
    return list.map((m) => (
      <div key={m.id} className="rounded-xl bg-white/5 border border-white/10 p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-bold text-sm text-white">{m.title}</h3>
          <span className="text-[10px] text-slate-400 whitespace-nowrap">
            {formatDate(m.created_at)}
          </span>
        </div>
        <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
          {m.body}
        </p>
      </div>
    ));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1e2d45] border-white/10 text-white max-w-md w-[90%] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Bell className="w-5 h-5 text-amber-400" />
            Sistem Mesajları
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => { playSound("buttonClick"); setTab(v as "new" | "read"); }}>
          <TabsList className="grid w-full grid-cols-2 bg-white/5">
            <TabsTrigger value="new" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">
              Yeni Mesajlar {unread.length > 0 && `(${unread.length})`}
            </TabsTrigger>
            <TabsTrigger value="read" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">
              Okunanlar {read.length > 0 && `(${read.length})`}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="new" className="mt-3">
            <div className="max-h-[55vh] overflow-y-auto space-y-3 pr-1">
              {renderList(unread, "Yeni mesaj yok")}
            </div>
          </TabsContent>
          <TabsContent value="read" className="mt-3">
            <div className="max-h-[55vh] overflow-y-auto space-y-3 pr-1">
              {renderList(read, "Okunmuş mesaj yok")}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
