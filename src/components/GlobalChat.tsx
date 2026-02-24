import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { useSounds } from "@/hooks/useSounds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Send, Shield, MessageCircle, X, Trash2, Mail, Users, UserX, Flag, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { UserAvatar } from "@/components/UserAvatar";
import { PrivateChat } from "@/components/PrivateChat";
import { ReportMessageDialog } from "@/components/ReportMessageDialog";
import { toast } from "sonner";
import { useMobileNotifications } from "@/hooks/useMobileNotifications";
import { isUserBanned, containsBannedWords, banUser, getBanTimeLeft } from "@/utils/chatBot";
import { useUserBlocking } from "@/hooks/useUserBlocking";
import { useNavigate } from "react-router-dom";
import { autoReconnect } from "@/utils/supabaseAutoReconnect";
import { usePageResync } from "@/hooks/useGlobalResync";
import { useMessageCooldown } from "@/hooks/useMessageCooldown";

interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  message: string;
  created_at: string;
  avatar_url?: string;
}

interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

interface GlobalChatProps {
  isOpen: boolean;
  onClose: () => void;
  isFullPage?: boolean;
  onStartPrivateChat?: (user: SelectedUser) => void;
}

type ViewMode = "global" | "users" | "private-chat" | "blocked-users";

interface SelectedUser {
  id: string;
  username: string;
  avatar_url?: string;
}

export function GlobalChat({ isOpen, onClose, isFullPage = false, onStartPrivateChat }: GlobalChatProps) {
  const { user } = useAuth();
  const { profile, onlineUsers, isUserOnline, refreshOnlineUsers } = useUser();
  const { playSound } = useSounds();
  const { isUserBlocked, blockUser, unblockUser, blockedUsers } = useUserBlocking();
  const navigate = useNavigate();
  const { sendMentionNotification } = useMobileNotifications();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { cooldownRemaining, isCoolingDown, startCooldown } = useMessageCooldown();
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [currentChannel, setCurrentChannel] = useState<any>(null);
  const [messageReactions, setMessageReactions] = useState<{ [messageId: string]: MessageReaction[] }>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [userAvatars, setUserAvatars] = useState<{ [userId: string]: string }>({});
  const [viewMode, setViewMode] = useState<ViewMode>("global");
  const [privateChatEnabled, setPrivateChatEnabled] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<SelectedUser[]>([]);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportingMessage, setReportingMessage] = useState<{
    id: string;
    userId: string;
    username: string;
  } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 🔄 Global Resync Hook - bağlantı kopup geldiğinde otomatik tazele
  const handleGlobalChatResync = useCallback(async () => {
    if (isOpen && user?.id) {
      await fetchMessages();
      refreshOnlineUsers();
    }
  }, [isOpen, user?.id, refreshOnlineUsers]);

  usePageResync(handleGlobalChatResync, "GlobalChat", true);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // GlobalChat.tsx - fetchReactions fonksiyonu
  const fetchReactions = async () => {
    try {
      // Sadece gerçek UUID'leri filtrele (temp- ile başlamayanlar)
      const realMessageIds = messages.filter((m) => !m.id.startsWith("temp-")).map((m) => m.id);

      if (realMessageIds.length === 0) return;

      const { data, error } = await supabase
        .from("message_reactions")
        .select("*")
        .in("message_id", realMessageIds as any);

      if (error) throw error;

      const reactionsByMessage: { [messageId: string]: MessageReaction[] } = {};
      (data as any[])?.forEach((reaction: any) => {
        if (!reactionsByMessage[reaction.message_id]) {
          reactionsByMessage[reaction.message_id] = [];
        }
        reactionsByMessage[reaction.message_id].push(reaction as MessageReaction);
      });

      setMessageReactions(reactionsByMessage);
    } catch (error) {
      console.error("Error fetching reactions:", error);
    }
  };

  // Fetch user avatars
  const fetchUserAvatars = async (userIds: string[]) => {
    // Null, undefined ve geçersiz UUID'leri filtrele
    const validUserIds = userIds.filter((id) => {
      if (!id || id === "null" || id === "undefined") return false;
      // UUID formatını kontrol et (36 karakter, tire'ler dahil)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(id);
    });

    if (validUserIds.length === 0) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, avatar_url")
        .in("id", validUserIds as any);

      if (error) throw error;

      const avatarMap: { [userId: string]: string } = {};
      (data as any[])?.forEach((profile: any) => {
        if (profile.avatar_url) {
          avatarMap[profile.id] = profile.avatar_url;
        }
      });

      setUserAvatars((prev) => ({ ...prev, ...avatarMap }));
    } catch (error) {
      console.error("Error fetching user avatars:", error);
    }
  };

  // Fetch avatars when messages change - düzeltilmiş versiyon
  useEffect(() => {
    if (messages.length > 0) {
      // User ID'leri toplarken null/undefined kontrolü yap
      const userIds = messages
        .map((m) => m.user_id)
        .filter((id) => id && id !== "null" && id !== "undefined")
        .filter((id, index, arr) => arr.indexOf(id) === index); // Duplicate'leri kaldır

      if (userIds.length > 0) {
        fetchUserAvatars(userIds);
      }
    }
  }, [messages]);

  // Fetch all users for private chat
  const fetchAllUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, email, avatar_url")
        .neq("id", user?.id as any)
        .order("username", { ascending: true })
        .limit(50);

      if (error) throw error;
      setAllUsers((data || []) as SelectedUser[]);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  // Fetch users when private chat is enabled
  useEffect(() => {
    if (privateChatEnabled && isOpen) {
      fetchAllUsers();
    }
  }, [privateChatEnabled, isOpen]);

  useEffect(() => {
    if (messages.length > 0) {
      fetchReactions();
    }
  }, [messages]);

  // Bot hoşgeldin mesajı - sadece kullanıcıya özel toast olarak göster
  useEffect(() => {
    const showBotWelcome = () => {
      if (!user?.id || !isOpen) return;

      try {
        // Son bot mesajı zamanını kontrol et
        const lastBotMessageKey = `lastBotWelcome_${user.id}`;
        const lastBotTime = localStorage.getItem(lastBotMessageKey);
        const now = Date.now();
        const thirtyMinutes = 30 * 60 * 1000; // 30 dakika milisaniye cinsinden

        // Eğer 30 dakika geçmemişse bot mesajı gösterme
        if (lastBotTime) {
          const timeDiff = now - parseInt(lastBotTime);
          if (timeDiff < thirtyMinutes) {
            const remainingMinutes = Math.ceil((thirtyMinutes - timeDiff) / 60000);
            console.log(`🤖 Bot hoşgeldin için ${remainingMinutes} dakika daha beklenmeli`);
            return;
          }
        }

        console.log("🤖 Bot hoşgeldin mesajı gösteriliyor (sadece kullanıcıya özel)...");

        // Global chat'e mesaj göndermek yerine toast ile göster
        toast.info(
          "🤖 Hoşgeldiniz! 🎉 Lütfen kurallar çerçevesinde sohbet ediniz. Küfür, argo ve hakaret içeren mesajlar otomatik olarak tespit edilir ve 2 gün sohbet yasağı uygulanır.",
          {
            duration: 8000,
            position: "top-center",
          },
        );

        // Son bot mesajı zamanını kaydet
        localStorage.setItem(lastBotMessageKey, now.toString());
        console.log("✅ Bot hoşgeldin mesajı gösterildi (toast)!");
      } catch (error) {
        console.error("❌ Bot hoşgeldin hatası:", error);
      }
    };

    // Chat açıldığında bot mesajı kontrolü yap
    if (isOpen && user?.id) {
      setTimeout(() => {
        showBotWelcome();
      }, 1000); // 1 saniye gecikme ile
    }
  }, [isOpen, user?.id]);

  // Real-time subscription için ayrı bir useEffect (auto-reconnect destekli)
  useEffect(() => {
    if (!isOpen || !user?.id) return;

    console.log("🔄 Setting up Global Chat real-time subscription (auto-reconnect)");

    // İlk mesajları ve online kullanıcıları yükle
    fetchMessages();
    refreshOnlineUsers();

    // Real-time subscription kur (auto-reconnect destekli)
    const channelName = `global-chat-realtime-${user.id}`;
    autoReconnect.registerChannel(channelName, () =>
      supabase
        .channel("global-chat-realtime", {
          config: {
            broadcast: { self: false }, // Kendi mesajlarını tekrar alma
          },
        })
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "global_chat",
          },
          (payload) => {
            console.log("📨 New global message received:", payload.new);

            const newMessage = payload.new as ChatMessage;

            setMessages((prev) => {
              // Duplicate kontrolü
              const exists = prev.some((msg) => msg.id === newMessage.id);
              if (exists) {
                console.log("⚠️ Message already exists, skipping");
                return prev;
              }

              console.log("✅ Adding new message to state");
              return [...prev, newMessage].sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
              );
            });

            // Sadece başkalarının mesajları için ses çal
            if (newMessage.user_id !== user?.id) {
              playSound("correctWord");
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "global_chat",
          },
          (payload) => {
            console.log("🗑️ Message deleted:", payload.old);
            setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id));
          },
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "message_reactions",
          },
          (payload) => {
            console.log("😀 New reaction received:", payload.new);
            const newReaction = payload.new as MessageReaction;
            setMessageReactions((prev) => {
              const existing = prev[newReaction.message_id] || [];
              // Duplicate kontrolü
              if (existing.some((r) => r.id === newReaction.id)) return prev;
              // Optimistic temp tepkiyi kaldır, gerçek veriyle değiştir
              const withoutTemp = existing.filter(
                (r) => !(r.id.startsWith("temp-") && r.user_id === newReaction.user_id && r.emoji === newReaction.emoji)
              );
              // Tekrar duplicate kontrolü
              if (withoutTemp.some((r) => r.id === newReaction.id)) return { ...prev, [newReaction.message_id]: withoutTemp };
              return {
                ...prev,
                [newReaction.message_id]: [...withoutTemp, newReaction],
              };
            });
          },
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "message_reactions",
          },
          (payload) => {
            console.log("😀 Reaction removed:", payload.old);
            const oldReaction = payload.old as any;
            setMessageReactions((prev) => {
              const messageId = oldReaction.message_id;
              if (!messageId || !prev[messageId]) return prev;
              return {
                ...prev,
                [messageId]: prev[messageId].filter((r) => r.id !== oldReaction.id),
              };
            });
          },
        )
        .subscribe((status) => {
          console.log("📡 Global subscription status:", status);

          if (status === "CHANNEL_ERROR") {
            console.error("❌ Channel error detected - auto-reconnect will handle");
          }
        }),
    );

    return () => {
      console.log("🧹 Cleaning up global real-time channel");
      autoReconnect.unregisterChannel(channelName);
    };
  }, [isOpen, user?.id]);

  const fetchMessages = async () => {
    try {
      console.log("📥 Fetching global messages...");

      const { data, error } = await supabase
        .from("global_chat")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const reversedData = data ? [...data].reverse() : [];
      setMessages(reversedData as ChatMessage[]);

      console.log(`✅ Loaded ${reversedData.length} global messages`);
    } catch (error) {
      console.error("❌ Error fetching global messages:", error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !profile) return;

    // Ban kontrolü
    const isBanned = await isUserBanned(user.id);
    if (isBanned) {
      const timeLeft = await getBanTimeLeft(user.id);
      toast.error(`Sohbet yasağınız var! Kalan süre: ${timeLeft}`);
      return;
    }

    const trimmedMessage = newMessage.trim();
    if (trimmedMessage.length > 200) {
      toast.error("Mesaj 200 karakterden uzun olamaz");
      return;
    }

    // 🚫 ÖNCELİKLİ: Client-side küfür kontrolü (RPC'den önce!)
    const bannedCheck = containsBannedWords(trimmedMessage);
    if (bannedCheck.found) {
      console.log(`🚫 KÜFÜR TESPİT EDİLDİ: "${bannedCheck.word}" - Severity: ${bannedCheck.severity}`);

      if (bannedCheck.severity === "high") {
        toast.error(`Ağır küfür tespit edildi! 2 gün sohbet yasağı aldınız.`);
        await banUser(user.id, `Ağır küfür: ${bannedCheck.word}`, 48);
      } else {
        toast.error("Yasaklı kelime kullandınız! 2 gün sohbet yasağı aldınız.");
        await banUser(user.id, `Yasaklı kelime: ${bannedCheck.word}`, 48);
      }
      setNewMessage("");
      return;
    }

    // İsteğe bağlı: Server-side ek kontrol (varsa)
    try {
      const { data: moderationResult, error: moderationError } = await supabase.rpc("moderate_message_advanced", {
        p_user_id: user.id,
        p_message: trimmedMessage,
      });

      if (!moderationError && moderationResult && moderationResult.length > 0) {
        const result = moderationResult[0];
        if (!result.is_appropriate) {
          if (result.should_ban) {
            toast.error(`${result.reason} - 2 gün sohbet yasağı aldınız!`);
            await banUser(user.id, result.reason, 48);
          } else {
            toast.warning(`${result.reason} - Lütfen daha dikkatli olun.`);
          }
          setNewMessage("");
          return;
        }
      }
    } catch (error) {
      console.log("Server-side moderation skipped:", error);
      // Client-side kontrol zaten yapıldı, devam et
    }

    const username = profile.username || user.email?.split("@")[0] || "Anonim";

    // OPTIMISTIC UPDATE - Mesajı hemen göster
    const tempMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      user_id: user.id,
      username,
      message: trimmedMessage,
      created_at: new Date().toISOString(),
      avatar_url: profile.avatar_url,
    };

    setMessages((prev) => [...prev, tempMessage]);
    setNewMessage("");
    setIsLoading(true);

    try {
      console.log("📤 Sending global message...");

      const { data: insertData, error: insertError } = await supabase
        .from("global_chat")
        .insert({
          user_id: user.id,
          username: username,
          message: trimmedMessage,
          avatar_url: profile.avatar_url,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      console.log("✅ Global message sent successfully");

      // Temp mesajı gerçek mesajla değiştir
      setMessages((prev) =>
        prev.map((msg) => (msg.id === tempMessage.id ? { ...insertData, id: insertData.id } : msg)),
      );

      // Mention kontrolü - Unicode + noktalama destekli (@çağrı, @cagri_1, @cagri.)
      const mentionRegex = /@([\p{L}\p{N}_.-]+)/gu;
      let match;
      const processedUsers = new Set<string>(); // Aynı kullanıcıya birden fazla bildirim göndermeyi önle

      while ((match = mentionRegex.exec(trimmedMessage)) !== null) {
        const rawMention = match[1] ?? "";
        const mentionedUsername = rawMention.replace(/[.,!?;:]+$/g, "").trim();
        if (!mentionedUsername) continue;

        // Case-insensitive arama
        const { data: mentionedUser, error: mentionedUserError } = await supabase
          .from("profiles")
          .select("id, username")
          .ilike("username", mentionedUsername)
          .maybeSingle();

        if (mentionedUserError) {
          console.warn("Mention user lookup error:", mentionedUserError);
          continue;
        }

        if (mentionedUser && mentionedUser.id !== user.id && !processedUsers.has(mentionedUser.id)) {
          processedUsers.add(mentionedUser.id);
          console.log("📢 Mention detected, sending notification to:", mentionedUser.username, mentionedUser.id);

          // 1. Veritabanına bildirim kaydı oluştur (Realtime tetikleyecek - in-app toast için)
          const shortMessage = trimmedMessage.length > 50 ? trimmedMessage.substring(0, 47) + "..." : trimmedMessage;

          // BU SATIRI YORUMA ALDIN:
          // const notificationMessage = `${username} seni bir mesajda etiketledi: "${shortMessage}"`;

          await supabase.from("notifications").insert({
            user_id: mentionedUser.id,
            type: "mention",
            // HATA ALMAMAK İÇİN BURAYA DOĞRUDAN METNİ YAZMALISIN:
            message: `${username} seni bir mesajda etiketledi: "${shortMessage}"`,
            related_id: insertData.id,
            is_read: false,
          });

          // 2. Push bildirim gönder (background için)
          await sendMentionNotification(mentionedUser.id, username, trimmedMessage, insertData.id);
        }
      }

      playSound("buttonClick");
      startCooldown();
    } catch (error) {
      console.error("❌ Error sending global message:", error);

      // Hata durumunda temp mesajı kaldır
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessage.id));
      setNewMessage(trimmedMessage); // Mesajı geri koy

      toast.error("Mesaj gönderilirken hata oluştu");
    } finally {
      setIsLoading(false);
    }
  };
  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    if (user && currentChannel && currentChannel.state === "joined") {
      try {
        const displayName = profile?.username || user.email?.split("@")[0] || "Anonim";

        // Typing durumunu güncelle
        await currentChannel.track({
          user_id: user.id,
          username: displayName,
          typing: e.target.value.length > 0, // Yazı yazılıyorsa true
          online_at: new Date().toISOString(),
        });

        // Timeout'u temizle ve yeniden kur
        if (typingTimeout) {
          clearTimeout(typingTimeout);
        }

        const timeout = setTimeout(async () => {
          if (currentChannel && currentChannel.state === "joined") {
            await currentChannel.track({
              user_id: user.id,
              username: displayName,
              typing: false, // Yazma durduruldu
              online_at: new Date().toISOString(),
            });
          }
        }, 2000);

        setTypingTimeout(timeout);
      } catch (error) {
        console.error("Error handling typing indicator:", error);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const addReaction = async (messageId: string, emoji: string) => {
    if (!user) return;

    // Check if user already has this reaction
    const existingReaction = messageReactions[messageId]?.find((r) => r.user_id === user.id && r.emoji === emoji);

    if (existingReaction) {
      toast.info("Bu emoji reaksiyonunu zaten vermişsiniz");
      setShowEmojiPicker(null);
      return;
    }

    try {
      // Optimistic update - add reaction immediately
      const tempReaction: MessageReaction = {
        id: `temp-${Date.now()}`,
        message_id: messageId,
        user_id: user.id,
        emoji: emoji,
        created_at: new Date().toISOString(),
      };

      setMessageReactions((prev) => ({
        ...prev,
        [messageId]: [...(prev[messageId] || []), tempReaction],
      }));

      const { error } = await supabase.from("message_reactions").insert({
        message_id: messageId,
        user_id: user.id,
        emoji: emoji,
      });

      if (error) {
        // Remove optimistic update on error
        setMessageReactions((prev) => ({
          ...prev,
          [messageId]: (prev[messageId] || []).filter((r) => r.id !== tempReaction.id),
        }));

        // Handle duplicate key error
        if (error.code === "23505") {
          toast.info("Bu emoji reaksiyonunu zaten vermişsiniz");
        } else {
          throw error;
        }
        return;
      }

      playSound("buttonClick");
      setShowEmojiPicker(null);
    } catch (error) {
      console.error("Error adding reaction:", error);
      toast.error("Reaksiyon eklenirken hata oluştu");
    }
  };

  // Remove emoji reaction
  const removeReaction = async (messageId: string, emoji: string) => {
    if (!user) return;

    // Optimistic removal - anında UI'dan kaldır
    const previousReactions = messageReactions[messageId] || [];
    setMessageReactions((prev) => ({
      ...prev,
      [messageId]: (prev[messageId] || []).filter(
        (r) => !(r.user_id === user.id && r.emoji === emoji)
      ),
    }));

    try {
      const { error } = await supabase
        .from("message_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", user.id)
        .eq("emoji", emoji);

      if (error) throw error;
      playSound("buttonClick");
    } catch (error) {
      console.error("Error removing reaction:", error);
      // Hata durumunda geri al
      setMessageReactions((prev) => ({
        ...prev,
        [messageId]: previousReactions,
      }));
      toast.error("Reaksiyon kaldırılırken hata oluştu");
    }
  };

  // Toggle emoji reaction
  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;

    const userReaction = messageReactions[messageId]?.find((r) => r.user_id === user.id && r.emoji === emoji);

    if (userReaction) {
      await removeReaction(messageId, emoji);
    } else {
      await addReaction(messageId, emoji);
    }
  };

  // Report message
  const handleReportMessage = (messageId: string, userId: string, username: string) => {
    if (!user) {
      toast.error("Rapor göndermek için giriş yapmalısınız");
      return;
    }

    if (userId === user.id) {
      toast.info("Kendi mesajınızı raporlayamazsınız");
      return;
    }

    setReportingMessage({ id: messageId, userId, username });
    setReportDialogOpen(true);
  };

  // Delete message
  const deleteMessage = (messageId: string) => {
    if (!user) return;
    setDeletingMessageId(messageId);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteMessage = async () => {
    if (!user || !deletingMessageId) return;

    try {
      const { error } = await supabase.from("global_chat").delete().eq("id", deletingMessageId).eq("user_id", user.id);

      if (error) throw error;

      playSound("buttonClick");
      toast.success("Mesaj silindi");
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error("Mesaj silinirken hata oluştu");
    } finally {
      setDeleteConfirmOpen(false);
      setDeletingMessageId(null);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Group reactions by emoji
  const groupReactions = (reactions: MessageReaction[]) => {
    const grouped: { [emoji: string]: MessageReaction[] } = {};
    reactions.forEach((reaction) => {
      if (!grouped[reaction.emoji]) {
        grouped[reaction.emoji] = [];
      }
      grouped[reaction.emoji].push(reaction);
    });
    return grouped;
  };

  const startPrivateChat = async (targetUser: SelectedUser) => {
    if (!user) return;

    try {
      playSound("buttonClick");

      // Chat ID oluştur
      const participants = [user.id, targetUser.id].sort();
      const chatId = `private_${participants.join("_")}`;

      // Chat var mı kontrol et
      const { data: existingChat, error: chatError } = await supabase
        .from("private_chats")
        .select("id")
        .eq("id", chatId)
        .single();

      if (chatError && chatError.code !== "PGRST116") {
        throw chatError;
      }

      // Yeni chat oluştur
      if (!existingChat) {
        const { error: createError } = await supabase.from("private_chats").insert({
          id: chatId,
          user1_id: participants[0],
          user2_id: participants[1],
          created_at: new Date().toISOString(),
        });

        if (createError) throw createError;
      }

      setSelectedUser(targetUser);
      setActiveChatId(chatId);
      setViewMode("private-chat");

      toast.success(`${targetUser.username} ile özel sohbet başlatıldı`, {
        icon: "💛",
        duration: 2000,
      });
    } catch (error) {
      console.error("Error starting private chat:", error);
      toast.error("Özel sohbet başlatılırken hata oluştu");
    }
  };

  // Render different views
  const renderContent = () => {
    if (viewMode === "private-chat" && selectedUser && activeChatId) {
      return (
        <PrivateChat
          chatId={activeChatId}
          otherUser={selectedUser}
          onBack={() => {
            setViewMode("global");
            setSelectedUser(null);
            setActiveChatId(null);
          }}
        />
      );
    }

    if (viewMode === "users") {
      return renderUsersList();
    }

    if (viewMode === "blocked-users") {
      return renderBlockedUsersList();
    }

    return renderGlobalChat();
  };

  const renderUsersList = () => (
    <>
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2D3436] via-[#3d4548] to-[#636E72] text-white p-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Users className="w-6 h-6" />
          <div>
            <h3 className="font-semibold text-lg">Kullanıcılar</h3>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setViewMode("global")}
          className="text-white hover:bg-white/10 p-2 rounded-full"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Online Users */}
      {onlineUsers.length > 0 && (
        <div className="p-4 bg-white/5 border-b border-white/10">
          <div className="flex items-center space-x-2 mb-3">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-green-400">Çevrimiçi</span>
          </div>
          <div className="space-y-2">
            {onlineUsers.map((targetUser) => (
              <Card
                key={targetUser.id}
                className="p-3 hover:shadow-md transition-all cursor-pointer border-white/10 bg-white/5 hover:bg-white/10"
                onClick={() => startPrivateChat(targetUser)}
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <UserAvatar
                      src={targetUser.avatar_url}
                      alt={targetUser.username}
                      fallback={targetUser.username?.charAt(0).toUpperCase()}
                      size="sm"
                      className={`border-2 ${isUserBlocked(targetUser.id) ? "border-red-300 opacity-60" : "border-green-400"}`}
                    />
                    <div
                      className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${isUserBlocked(targetUser.id) ? "bg-red-500" : "bg-green-500"}`}
                    ></div>
                  </div>
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/profile/${targetUser.id}`);
                    }}
                  >
                    <div
                      className={`font-medium ${isUserBlocked(targetUser.id) ? "text-red-400 line-through" : "text-white"} hover:text-blue-400 transition-colors`}
                    >
                      {targetUser.username}
                    </div>
                    <div className={`text-xs ${isUserBlocked(targetUser.id) ? "text-red-400" : "text-green-400"}`}>
                      {isUserBlocked(targetUser.id) ? "Engellendi" : "Çevrimiçi"}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        isUserBlocked(targetUser.id) ? unblockUser(targetUser.id) : blockUser(targetUser.id);
                      }}
                      className={`text-xs px-2 py-1 h-6 ${isUserBlocked(targetUser.id) ? "text-green-600 border-green-600 hover:bg-green-50" : "text-red-600 border-red-600 hover:bg-red-50"}`}
                    >
                      {isUserBlocked(targetUser.id) ? "Engeli Kaldır" : "Engelle"}
                    </Button>
                    <MessageCircle className="w-5 h-5 text-chat-500" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* All Users */}
      <ScrollArea className="flex-1 bg-gradient-to-b from-[#2D3436] to-[#3d4548]">
        <div className="p-4 space-y-3">
          <div className="flex items-center space-x-2 mb-3">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-300">Tüm Kullanıcılar</span>
          </div>

          {allUsers.map((targetUser) => (
            <Card
              key={targetUser.id}
              className="p-4 hover:shadow-md transition-all cursor-pointer border-white/10 bg-white/5 hover:bg-white/10"
              onClick={() => startPrivateChat(targetUser)}
            >
              <div className="flex items-center space-x-3">
                <UserAvatar
                  src={targetUser.avatar_url}
                  alt={targetUser.username}
                  fallback={targetUser.username.charAt(0).toUpperCase()}
                  size="sm"
                  className="border-2 border-chat-300"
                />
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/profile/${targetUser.id}`);
                  }}
                >
                  <p className="font-medium text-white truncate hover:text-blue-400 transition-colors">
                    {targetUser.username}
                  </p>
                  <p className="text-sm text-gray-400">Özel mesaj gönder</p>
                </div>
                <div className="flex items-center space-x-2">
                  {isUserOnline(targetUser.id) && (
                    <div className="w-2 h-2 bg-green-500 rounded-full" title="Çevrimiçi"></div>
                  )}
                  {isUserBlocked(targetUser.id) ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        unblockUser(targetUser.id);
                      }}
                      className="text-xs px-2 py-1 h-6 text-green-600 border-green-600 hover:bg-green-50"
                    >
                      Engeli Kaldır
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        blockUser(targetUser.id);
                      }}
                      className="text-xs px-2 py-1 h-6 text-red-600 border-red-600 hover:bg-red-50"
                    >
                      Engelle
                    </Button>
                  )}
                  <Mail className="w-5 h-5 text-chat-500" />
                </div>
              </div>
            </Card>
          ))}

          {allUsers.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50 text-gray-500" />
              <p>Henüz kullanıcı bulunamadı</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  );

  const renderBlockedUsersList = () => (
    <>
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2D3436] via-[#3d4548] to-[#636E72] text-white p-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <UserX className="w-6 h-6" />
          <div>
            <h3 className="font-semibold text-lg">Engellediklerim</h3>
            <p className="text-gray-300 text-sm">{blockedUsers.length} kişi engellendi</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setViewMode("global")}
          className="text-white hover:bg-white/10 p-2 rounded-full"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Blocked Users List */}
      <ScrollArea className="flex-1 bg-gradient-to-b from-[#2D3436] to-[#3d4548]">
        <div className="p-4 space-y-3">
          {blockedUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <UserX className="w-12 h-12 mx-auto mb-3 opacity-50 text-gray-500" />
              <p className="text-white/80">Engellenen kullanıcı yok</p>
              <p className="text-sm text-gray-400">Kullanıcıları engellemek için kullanıcılar listesini kullanın</p>
            </div>
          ) : (
            allUsers
              .filter((user) => blockedUsers.includes(user.id))
              .map((blockedUser) => (
                <Card key={blockedUser.id} className="p-4 border-red-500/30 bg-red-500/10">
                  <div className="flex items-center space-x-3">
                    <div
                      className="cursor-pointer"
                      onClick={() => navigate(`/profile/${blockedUser.id}`, { state: { from: "/chat" } })}
                    >
                      <UserAvatar
                        src={blockedUser.avatar_url}
                        alt={blockedUser.username}
                        fallback={blockedUser.username.charAt(0).toUpperCase()}
                        size="sm"
                        className="border-2 border-red-300 opacity-60"
                      />
                    </div>
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => navigate(`/profile/${blockedUser.id}`, { state: { from: "/chat" } })}
                    >
                      <p className="font-medium text-red-300 truncate hover:text-red-200 transition-colors">
                        {blockedUser.username}
                      </p>
                      <p className="text-sm text-red-400">Engellendi</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => unblockUser(blockedUser.id)}
                      className="text-xs px-3 py-1 h-7 text-green-400 border-green-400/50 hover:bg-green-500/20"
                    >
                      Engeli Kaldır
                    </Button>
                  </div>
                </Card>
              ))
          )}
        </div>
      </ScrollArea>
    </>
  );
  // GlobalChat.tsx - Yeni tasarım
  const renderGlobalChat = () => (
    <>
      {/* Messages */}
      <ScrollArea className="flex-1 p-4 bg-gradient-to-b from-[#2D3436] to-[#3d4548]">
        <div className="space-y-3">
          {messages
            .filter((message) => !message.user_id || !isUserBlocked(message.user_id))
            .map((message) => (
              <div
                key={message.id}
                className="group flex flex-col space-y-1 p-3 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10 hover:border-white/20 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() =>
                        message.user_id && navigate(`/profile/${message.user_id}`, { state: { from: "/chat" } })
                      }
                    >
                      <UserAvatar
                        src={message.user_id ? userAvatars[message.user_id] : "/bot-avatar.png"} // Bot için özel avatar
                        alt={message.username}
                        fallback={message.username.charAt(0).toUpperCase()}
                        size="xs"
                        className={`border-2 ${message.username === "kelimeciBot" ? "border-blue-500" : "border-chat-300"}`}
                      />
                    </div>
                    <span
                      className={`text-sm font-medium cursor-pointer hover:text-blue-400 transition-colors ${
                        message.username === "kelimeciBot"
                          ? "text-blue-400 font-bold"
                          : message.user_id === user?.id
                            ? "text-green-400"
                            : "text-gray-200"
                      }`}
                      onClick={() =>
                        message.user_id && navigate(`/profile/${message.user_id}`, { state: { from: "/chat" } })
                      }
                    >
                      {message.username}
                      {message.username === "kelimeciBot" && " 🤖"}
                    </span>

                    {/* Online indicator - sadece gerçek kullanıcılar için */}
                    {message.user_id && message.username !== "kelimeciBot" && isUserOnline(message.user_id) && (
                      <div className="w-2 h-2 bg-green-500 rounded-full" title="Çevrimiçi"></div>
                    )}

                    <span className="text-xs text-gray-400">{formatTime(message.created_at)}</span>

                    {/* Private message button - sadece gerçek kullanıcılar için */}
                    {message.user_id &&
                      message.user_id !== user?.id &&
                      message.username !== "kelimeciBot" &&
                      onStartPrivateChat && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            onStartPrivateChat({
                              id: message.user_id,
                              username: message.username,
                              avatar_url: userAvatars[message.user_id],
                            });
                          }}
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-chat-100"
                          title="Özel mesaj gönder"
                        >
                          <Mail className="w-3 h-3 text-chat-600" />
                        </Button>
                      )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center space-x-1">
                    {/* Report button - başkalarının mesajları için */}
                    {message.user_id && message.user_id !== user?.id && message.username !== "kelimeciBot" && (
                      <button
                        onClick={() => handleReportMessage(message.id, message.user_id, message.username)}
                        className="opacity-70 group-hover:opacity-100 transition-opacity p-1 hover:bg-orange-100 rounded"
                        title="Mesajı bildir"
                      >
                        <Flag className="w-3 h-3 text-orange-500" />
                      </button>
                    )}

                    {/* Delete button - sadece kendi mesajları için */}
                    {message.user_id === user?.id && (
                      <button
                        onClick={() => deleteMessage(message.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 rounded"
                        title="Mesajı sil"
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </button>
                    )}
                  </div>
                </div>

                <div
                  className={`text-gray-200 break-words ${
                    message.username === "kelimeciBot" ? "font-medium text-blue-300" : ""
                  }`}
                >
                  {message.message}
                </div>

                {/* Reactions - temp mesajlar ve bot mesajları için gösterme */}
                {!message.id.startsWith("temp-") && message.username !== "kelimeciBot" && (
                  <div className="flex items-center flex-wrap gap-1.5 mt-2">
                    {/* Mevcut tepkiler (sayaçlı) */}
                    {messageReactions[message.id] &&
                      Object.entries(groupReactions(messageReactions[message.id])).map(([emoji, reactions]) => (
                        <button
                          key={emoji}
                          onClick={() => toggleReaction(message.id, emoji)}
                          className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs transition-colors ${
                            reactions.some((r) => r.user_id === user?.id)
                              ? "bg-green-500/20 text-green-300 border border-green-500/30"
                              : "bg-white/10 hover:bg-white/20 border border-transparent text-gray-300"
                          }`}
                        >
                          <span>{emoji}</span>
                          <span className="font-medium">{reactions.length}</span>
                        </button>
                      ))}

                    {/* Sabit emoji seti */}
                    {showEmojiPicker === message.id ? (
                      <div className="flex items-center gap-1 bg-[#2D3436] border border-white/20 rounded-full px-2 py-0.5 shadow-sm">
                        {["👍", "👎", "❤️", "😂", "😮", "😢", "🤔", "🔥"].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => {
                              toggleReaction(message.id, emoji);
                              setShowEmojiPicker(null);
                            }}
                            className="text-base hover:scale-125 transition-transform p-0.5"
                          >
                            {emoji}
                          </button>
                        ))}
                        <button
                          onClick={() => setShowEmojiPicker(null)}
                          className="text-gray-400 hover:text-gray-600 ml-0.5 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowEmojiPicker(message.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded-full hover:bg-gray-100 text-xs"
                        title="Tepki ekle"
                      >
                        😀+
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

          {/* Typing indicator */}
          {typingUsers.size > 0 && (
            <div className="flex items-center space-x-2 text-green-400 text-sm italic p-2 bg-white/5 rounded-lg">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-chat-600 rounded-full animate-bounce"></div>
                <div
                  className="w-2 h-2 bg-chat-600 rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                ></div>
                <div
                  className="w-2 h-2 bg-chat-600 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                ></div>
              </div>
              <span>{Array.from(typingUsers).slice(0, 2).join(", ")} yazıyor...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="p-4 bg-[#2D3436] border-t border-white/10">
        <div className="flex space-x-2">
          <Input
            value={newMessage}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder={isCoolingDown ? `${cooldownRemaining}s bekleyin...` : "Mesajınızı yazın..."}
            maxLength={200}
            disabled={isLoading || isCoolingDown}
            className={`flex-1 bg-white/10 border-white/20 text-white focus:border-green-400/50 focus:ring-green-400/30 ${isCoolingDown ? "placeholder:text-red-400/70" : "placeholder:text-gray-400"}`}
          />
          <Button
            onClick={sendMessage}
            disabled={!newMessage.trim() || isLoading || isCoolingDown}
            size="sm"
            className="px-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <div className="text-xs text-gray-400 mt-1 text-right">{newMessage.length}/200</div>
      </div>
    </>
  );

  // Delete Confirm Dialog
  const deleteDialog = (
    <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
      <AlertDialogContent className="max-w-sm rounded-2xl border-destructive/20 bg-background/95 backdrop-blur-md shadow-2xl">
        <AlertDialogHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <Trash2 className="h-6 w-6 text-destructive" />
          </div>
          <AlertDialogTitle className="text-lg font-bold">Mesajı Sil</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            Bu mesajı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2 sm:justify-center">
          <AlertDialogCancel
            className="flex-1 rounded-xl border-muted-foreground/20 mt-0"
            onClick={() => setDeletingMessageId(null)}
          >
            Vazgeç
          </AlertDialogCancel>
          <AlertDialogAction
            className="flex-1 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={confirmDeleteMessage}
          >
            Evet, Sil
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  // Report Dialog - her zaman render et
  const reportDialog = reportingMessage && (
    <ReportMessageDialog
      isOpen={reportDialogOpen}
      onClose={() => {
        setReportDialogOpen(false);
        setReportingMessage(null);
      }}
      messageId={reportingMessage.id}
      messageType="global"
      reportedUserId={reportingMessage.userId}
      reportedUsername={reportingMessage.username}
    />
  );

  if (!isOpen) return <>{reportDialog}{deleteDialog}</>;

  // If it's full page mode, don't wrap in modal
  if (isFullPage) {
    return (
      <>
        <div className="h-full w-full flex flex-col">{renderGlobalChat()}</div>
        {reportDialog}
        {deleteDialog}
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md h-[600px] flex flex-col bg-background border-2 border-primary/20">
          {renderContent()}
        </Card>
      </div>
      {reportDialog}
      {deleteDialog}
    </>
  );
}
