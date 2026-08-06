import { useEffect, useState } from "react";
import { SystemMessage } from "@/hooks/useSystemMessages";
import { Bell } from "lucide-react";
import { useSounds } from "@/hooks/useSounds";
import sistemMesajlariPenceresi from "@/assets/sistemMesajlariPenceresi.png";

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
  const [snapshotRead, setSnapshotRead] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"new" | "read">("new");
  const { playSound } = useSounds();

  useEffect(() => {
    if (open) {
      setSnapshotRead(new Set(readIds));
      const hasUnread = messages.some((m) => !readIds.has(m.id));
      setTab(hasUnread ? "new" : "read");
      const t = setTimeout(() => markAllRead(), 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;

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

  const list = tab === "new" ? unread : read;
  const emptyText = tab === "new" ? "Yeni mesaj yok" : "Okunmuş mesaj yok";

  const renderList = () => {
    if (loading && messages.length === 0) {
      return <p className="text-center text-[#4a4a4a] py-8" style={{ fontSize: "3.6cqw" }}>Yükleniyor...</p>;
    }
    if (list.length === 0) {
      return (
        <div className="py-10 flex flex-col items-center text-[#5a5a5a]">
          <Bell className="w-[8cqw] h-[8cqw] mb-2 opacity-50" />
          <p style={{ fontSize: "3.6cqw" }}>{emptyText}</p>
        </div>
      );
    }
    return list.map((m) => (
      <div key={m.id} className="rounded-[2cqw] bg-white/70 border border-black/10 p-[3cqw]">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-bold text-[#16324f]" style={{ fontSize: "3.8cqw" }}>
            {m.title}
          </h3>
          <span className="text-[#6b6b6b] whitespace-nowrap" style={{ fontSize: "2.6cqw" }}>
            {formatDate(m.created_at)}
          </span>
        </div>
        <p className="text-[#26374a] whitespace-pre-wrap leading-relaxed" style={{ fontSize: "3.4cqw" }}>
          {m.body}
        </p>
      </div>
    ));
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="relative w-full max-w-[400px] animate-in fade-in zoom-in-95 duration-300"
        style={{ containerType: "inline-size" }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={sistemMesajlariPenceresi}
          alt="Sistem Mesajları"
          className="w-full h-auto select-none pointer-events-none"
          draggable={false}
        />

        {/* Yeni Mesajlar sekmesi */}
        <button
          type="button"
          aria-label="Yeni Mesajlar"
          onClick={() => { playSound("buttonClick"); setTab("new"); }}
          className="absolute bg-transparent active:scale-95 transition-transform"
          style={{ left: "13%", width: "36.2%", top: "31.8%", height: "4.3%", touchAction: "manipulation" }}
        >
          {tab === "read" && <span className="absolute inset-0 rounded-[2cqw] bg-black/25" />}
          {unread.length > 0 && (
            <span className="absolute -top-[1.5cqw] -right-[1.5cqw] min-w-[5cqw] h-[5cqw] px-[1cqw] bg-red-500 rounded-full flex items-center justify-center font-bold text-white" style={{ fontSize: "3cqw" }}>
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </button>

        {/* Okunanlar sekmesi */}
        <button
          type="button"
          aria-label="Okunanlar"
          onClick={() => { playSound("buttonClick"); setTab("read"); }}
          className="absolute bg-transparent active:scale-95 transition-transform"
          style={{ left: "50.8%", width: "36.2%", top: "31.8%", height: "4.3%", touchAction: "manipulation" }}
        >
          {tab === "read" && <span className="absolute inset-0 rounded-[2cqw] bg-green-500/45" />}
        </button>

        {/* Mesaj listesi (gri alan) */}
        <div
          className="absolute overflow-y-auto space-y-[2cqw] p-[2cqw]"
          style={{ left: "11.7%", right: "11.7%", top: "38.8%", bottom: "23.2%" }}
        >
          {renderList()}
        </div>

        {/* Kapat */}
        <button
          type="button"
          aria-label="Kapat"
          onClick={() => { playSound("buttonClick"); onOpenChange(false); }}
          className="absolute bg-transparent active:scale-95 transition-transform"
          style={{ left: "31.9%", width: "36.5%", top: "78.8%", height: "4.8%", touchAction: "manipulation" }}
        />
      </div>
    </div>
  );
}
