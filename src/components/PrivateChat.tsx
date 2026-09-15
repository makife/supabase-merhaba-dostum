// PrivateChat.tsx - Real-time düzeltmeleri (autoReconnect ile) + Linkify
import { setActivePrivateChat, removeActivePrivateChat } from "@/utils/notifications";
import { useUser } from "@/contexts/UserContext";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useSounds } from "@/hooks/useSounds";
import { usePageResync } from "@/hooks/useGlobalResync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Send, ArrowLeft, Flag, Check, CheckCheck } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { ReportMessageDialog } from "@/components/ReportMessageDialog";
import { toast } from "sonner";
import { useChatNotifications } from "@/hooks/useChatNotifications";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useMobileNotifications } from "@/hooks/useMobileNotifications";
import { setLastChatId, getLastChatId } from "@/utils/persistentState";
import { autoReconnect } from "@/utils/supabaseAutoReconnect";
import { useMessageCooldown } from "@/hooks/useMessageCooldown";

interface PrivateMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  is_read: boolean;
  recipient_id?: string;
}

interface PrivateChatProps {
  chatId: string;
  otherUser: {
    id: string;
    username: string;
    avatar_url?: string;
  };
  onBack: () => void;
}

// 🔗 URL REGEX - Link algılama
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

// 🔗 Linkify fonksiyonu - Mesajdaki linkleri <a> tag'ine çevir
const linkifyText = (text: string) => {
  const parts = text.split(URL_REGEX);

  return parts.map((part, index) => {
    if (part.match(URL_REGEX)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-blue-300 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

export function PrivateChat({ chatId, otherUser, onBack }: PrivateChatProps) {
  const { user } = useAuth();
  const { profile, isSystemConnected, loading: userLoading } = useUser(); // Hepsini tek seferde alıyoruz
  const { playSound } = useSounds();
  const { sendMessageNotification } = useMobileNotifications();
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { cooldownRemaining, isCoolingDown, startCooldown } = useMessageCooldown();
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportingMessage, setReportingMessage] = useState<{
    id: string;
    userId: string;
    username: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { refreshUnreadCounts } = useChatNotifications();

  // 🔄 Global Resync Hook - bağlantı kopup geldiğinde otomatik tazele
  const handlePrivateChatResync = useCallback(async () => {
    await fetchMessages();
  }, [chatId]);

  usePageResync(handlePrivateChatResync, `PrivateChat-${chatId?.slice(-8)}`, true);

  // 🔴🟢 AKTİF SOHBET TAKİBİ - Component mount/unmount
  useEffect(() => {
    if (!chatId) return;

    console.log("🟢 PrivateChat mounted - Aktif sohbet eklendi:", chatId);
    setActivePrivateChat(chatId);
    setLastChatId(chatId);

    // 🆕 DB'ye yaz (push notification edge function bunu kontrol eder)
    if (user?.id) {
      supabase.from("profiles").update({ active_chat_id: chatId }).eq("id", user.id).then(() => {});
    }

    return () => {
      console.log("🔴 PrivateChat unmounted - Aktif sohbet kaldırıldı:", chatId);
      removeActivePrivateChat(chatId);
      setLastChatId(null);
      if (user?.id) {
        supabase.from("profiles").update({ active_chat_id: null }).eq("id", user.id).then(() => {});
      }
    };
  }, [chatId, user?.id]);

  // 🎯 SAYFA DEĞİŞİKLİĞİ TAKİBİ - URL değiştiğinde de çalışsın
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("🟢 Sayfa görünür - Aktif sohbet:", chatId);
        setActivePrivateChat(chatId);
        if (user?.id) {
          supabase.from("profiles").update({ active_chat_id: chatId }).eq("id", user.id).then(() => {});
        }
      } else {
        console.log("🔴 Sayfa gizlendi - Aktif sohbet kaldırıldı:", chatId);
        removeActivePrivateChat(chatId);
        if (user?.id) {
          supabase.from("profiles").update({ active_chat_id: null }).eq("id", user.id).then(() => {});
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [chatId, user?.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      console.log("📥 Fetching private messages for chatId:", chatId);

      const { data, error } = await supabase
        .from("private_messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const reversedData = data ? [...data].reverse() : [];
      setMessages(reversedData || []);
      console.log(`✅ Loaded ${reversedData.length} private messages`);

      // Mesajları okundu olarak işaretle
      await markMessagesAsRead();
    } catch (error) {
      console.error("❌ Error fetching private messages:", error);
    }
  };

  const markMessagesAsRead = async () => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from("private_messages")
        .update({ is_read: true })
        .eq("chat_id", chatId)
        .eq("recipient_id", user.id)
        .eq("is_read", false);

      if (error) {
        console.error("Error marking messages as read:", error);
      } else {
        refreshUnreadCounts();
      }
    } catch (error) {
      console.error("Error in markMessagesAsRead:", error);
    }
  };

  // TEK BİR REAL-TIME SUBSCRIPTION (autoReconnect ile)
  useEffect(() => {
    if (!chatId || !user?.id) return;

    console.log("🔄 Setting up Private Chat real-time subscription for:", chatId);

    // İlk mesajları yükle
    fetchMessages();

    // Unique channel name
    const channelName = `private-chat-${chatId.substring(0, 30)}`;

    // autoReconnect ile kaydet
    autoReconnect.registerChannel(channelName, () =>
      supabase
        .channel(channelName, {
          config: {
            broadcast: { self: false },
          },
        })
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "private_messages",
            filter: `chat_id=eq.${chatId}`,
          },
          (payload) => {
            console.log("📨 New private message received:", payload.new);

            const newMessage = payload.new as PrivateMessage;

            setMessages((prev) => {
              // Duplicate kontrolü
              const exists = prev.some((msg) => msg.id === newMessage.id);
              if (exists) {
                console.log("⚠️ Private message already exists, skipping");
                return prev;
              }

              console.log("✅ Adding new private message to state");
              return [...prev, newMessage].sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
              );
            });

            // Sadece başkalarından gelen mesajlar için ses çal
            if (newMessage.sender_id !== user?.id) {
              playSound("correctWord");
              // Mesajı okundu olarak işaretle
              setTimeout(markMessagesAsRead, 1000);
            }

            // Unread count'u güncelle
            refreshUnreadCounts();
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "private_messages",
            filter: `chat_id=eq.${chatId}`,
          },
          (payload) => {
            console.log("📝 Private message updated:", payload.new);

            setMessages((prev) => prev.map((msg) => (msg.id === payload.new.id ? { ...msg, ...payload.new } : msg)));
          },
        )
        .subscribe((status) => {
          console.log("📡 Private subscription status:", status);

          if (status === "SUBSCRIBED") {
            console.log("✅ Private chat subscription active");
          }
        }),
    );

    // Cleanup - autoReconnect'ten kayıt sil
    return () => {
      console.log("🧹 [PrivateChat] Cleaning up channel:", channelName);
      autoReconnect.unregisterChannel(channelName);
    };
  }, [chatId, user?.id]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !chatId) return;

    const trimmedMessage = newMessage.trim();

    // Chat ID'den other user ID'yi çıkar
    const otherUserId =
      chatId
        .replace("chat_", "")
        .split("_")
        .find((id) => id !== user.id) || otherUser.id;

    // OPTIMISTIC UPDATE - Mesajı hemen göster
    const tempMessage: PrivateMessage = {
      id: `temp-${Date.now()}`,
      chat_id: chatId,
      sender_id: user.id,
      recipient_id: otherUserId,
      message: trimmedMessage,
      created_at: new Date().toISOString(),
      is_read: false,
    };

    setMessages((prev) => [...prev, tempMessage]);
    setNewMessage("");
    setIsLoading(true);

    try {
      console.log("📤 Sending private message...");

      const { data: insertData, error } = await supabase
        .from("private_messages")
        .insert({
          chat_id: chatId,
          sender_id: user.id,
          recipient_id: otherUserId,
          message: trimmedMessage,
        })
        .select()
        .single();

      if (error) throw error;

      console.log("✅ Private message sent successfully");

      // Temp mesajı gerçek mesajla değiştir
      setMessages((prev) => prev.map((msg) => (msg.id === tempMessage.id ? { ...insertData } : msg)));

      playSound("buttonClick");
      refreshUnreadCounts();
      startCooldown();

      // 🔔 BİLDİRİM GÖNDER - Artık akıllı bildirim sistemi var
      await sendMessageNotification(
        otherUserId, // Alıcının ID'si
        profile?.username || "Anonim", // Gönderenin kullanıcı adı
        chatId, // Chat ID
      );
      console.log("✅ Notification sent to:", otherUser.username);
    } catch (error) {
      console.error("❌ Error sending private message:", error);

      // Hata durumunda temp mesajı kaldır
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessage.id));
      setNewMessage(trimmedMessage); // Mesajı geri koy

      toast.error("Mesaj gönderilirken hata oluştu");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleReportMessage = (messageId: string, senderId: string) => {
    if (!user) {
      toast.error("Rapor göndermek için giriş yapmalısınız");
      return;
    }

    if (senderId === user.id) {
      toast.info("Kendi mesajınızı raporlayamazsınız");
      return;
    }

    setReportingMessage({ id: messageId, userId: senderId, username: otherUser.username });
    setReportDialogOpen(true);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-b from-[#2D3436] to-[#3d4548]">
      {/* Header - Back button ve kullanıcı bilgisi */}
      <div className="flex items-center space-x-3 p-4 border-b border-white/10 bg-[#2D3436]">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            console.log("🔙 Back butonuna basıldı - Sohbet kapatılıyor:", chatId);
            removeActivePrivateChat(chatId); // Manuel olarak da kaldır
            onBack();
          }}
          className="flex-shrink-0 text-white hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>

        {/* Avatar - UserAvatar yerine direkt Avatar kullanıyoruz */}
        <Avatar className="w-8 h-8">
          <AvatarImage src={otherUser.avatar_url} alt={otherUser.username} />
          <AvatarFallback className="bg-green-500/20 text-green-400 text-xs">
            {otherUser.username?.charAt(0)?.toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate text-white">{otherUser.username}</h3>
          <p className="text-xs text-gray-400">Özel sohbet</p>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4 overflow-hidden">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`group flex ${message.sender_id === user?.id ? "justify-end" : "justify-start"}`}
            >
              <div className="flex items-end space-x-2 max-w-[85%] min-w-0">
                {message.sender_id !== user?.id && (
                  <button
                    onClick={() => handleReportMessage(message.id, message.sender_id)}
                    className="opacity-70 group-hover:opacity-100 transition-opacity p-1 hover:bg-orange-100 rounded mb-1 flex-shrink-0"
                    title="Mesajı bildir"
                  >
                    <Flag className="w-3 h-3 text-orange-500" />
                  </button>
                )}

                <div
                  className={`p-3 rounded-lg min-w-0 overflow-hidden ${
                    message.sender_id === user?.id
                      ? "bg-gradient-to-r from-green-500 to-green-600 text-white"
                      : "bg-white/10 text-gray-200"
                  }`}
                >
                  <div className="break-all overflow-hidden text-sm whitespace-pre-wrap">
                    {linkifyText(message.message)}
                  </div>
                  <div
                    className={`text-xs mt-1 flex items-center justify-end gap-1 ${
                      message.sender_id === user?.id ? "text-white/70" : "text-gray-400"
                    }`}
                  >
                    <span>{formatTime(message.created_at)}</span>
                    {message.sender_id === user?.id &&
                      (message.is_read ? (
                        <CheckCheck className="w-3.5 h-3.5 text-sky-400" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <Separator className="bg-white/10" />

      <div className="p-4 bg-[#2D3436] border-t border-white/10">
        <div className="flex space-x-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isCoolingDown ? `${cooldownRemaining}s bekleyin...` : "Mesajınızı yazın..."}
            maxLength={500}
            disabled={isLoading || isCoolingDown}
            autoComplete="on"
            autoCorrect="on"
            spellCheck={true}
            inputMode="text"
            enterKeyHint="send"
            className={`flex-1 bg-white/10 border-white/20 text-white focus:border-green-400/50 focus:ring-green-400/30 ${isCoolingDown ? "placeholder:text-red-400/70" : "placeholder:text-gray-400"}`}
          />
          <Button
            onClick={() => { playSound("buttonClick"); sendMessage(); }}
            disabled={!newMessage.trim() || isLoading || isCoolingDown}
            size="sm"
            className="px-3 flex-shrink-0 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <div className="text-xs text-gray-400 mt-1 text-right">{newMessage.length}/500</div>
      </div>

      {/* Report Dialog */}
      {reportingMessage && (
        <ReportMessageDialog
          isOpen={reportDialogOpen}
          onClose={() => {
            setReportDialogOpen(false);
            setReportingMessage(null);
          }}
          messageId={reportingMessage.id}
          messageType="private"
          reportedUserId={reportingMessage.userId}
          reportedUsername={reportingMessage.username}
        />
      )}
    </div>
  );
}
