import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SystemMessage {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

export function useSystemMessages() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<SystemMessage[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [{ data: msgs }, { data: reads }] = await Promise.all([
        supabase
          .from("system_messages" as any)
          .select("id,title,body,created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("system_message_reads" as any)
          .select("message_id")
          .eq("user_id", user.id),
      ]);
      setMessages(((msgs as any) || []) as SystemMessage[]);
      setReadIds(new Set(((reads as any) || []).map((r: any) => r.message_id)));
    } catch (e) {
      console.error("[useSystemMessages] fetch error", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAll();
    if (!user) return;
    const ch = supabase
      .channel("system-messages-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_messages" },
        () => fetchAll()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, fetchAll]);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    const unread = messages.filter((m) => !readIds.has(m.id));
    if (unread.length === 0) return;
    const rows = unread.map((m) => ({ user_id: user.id, message_id: m.id }));
    try {
      await supabase.from("system_message_reads" as any).insert(rows as any);
      setReadIds((prev) => {
        const next = new Set(prev);
        unread.forEach((m) => next.add(m.id));
        return next;
      });
    } catch (e) {
      console.error("[useSystemMessages] markAllRead error", e);
    }
  }, [user, messages, readIds]);

  const unreadCount = messages.reduce(
    (acc, m) => acc + (readIds.has(m.id) ? 0 : 1),
    0
  );

  return { messages, unreadCount, loading, fetchAll, markAllRead, readIds };
}
