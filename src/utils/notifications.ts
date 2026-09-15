// utils/notifications.ts - Console log versiyonu (TypeScript hatasız)

import { supabase } from "@/integrations/supabase/client";

// Aktif sohbet state'ini takip etmek için global bir değişken

let activePrivateChats: Set<string> = new Set();

// Aktif sohbeti kaydetmek için fonksiyon

export const setActivePrivateChat = (chatId: string) => {
  activePrivateChats.add(chatId);

  console.log("🔵 Aktif sohbet eklendi:", chatId, Array.from(activePrivateChats));
};

// Aktif sohbeti kaldırmak için fonksiyon

export const removeActivePrivateChat = (chatId: string) => {
  activePrivateChats.delete(chatId);

  console.log("🔴 Aktif sohbet kaldırıldı:", chatId, Array.from(activePrivateChats));
};

// Tüm aktif sohbetleri getir (debug için)

export const getActivePrivateChats = () => {
  return Array.from(activePrivateChats);
};

// Mention bildirimi - Veritabanı kaydı ile

export const sendMentionNotification = async (
  userId: string,

  senderUsername: string,

  message: string,

  messageId?: string,
) => {
  try {
    const notificationMessage = `${senderUsername} seni bir mesajda etiketledi: "${message.substring(0, 50)}${message.length > 50 ? "..." : ""}"`;

    const { error } = await supabase.from("notifications").insert({
      user_id: userId,

      type: "mention",

      message: notificationMessage,

      related_id: messageId,

      is_read: false,
    });

    if (error) {
      console.error("Mention notification error:", error);

      return false;
    }

    console.log("🔔 MENTION NOTIFICATION SAVED:", {
      to: userId,

      from: senderUsername,

      message: message.substring(0, 50) + "...",

      type: "mention",

      timestamp: new Date().toLocaleString("tr-TR"),
    });

    // Browser bildirimi göster

    showBrowserNotification("📢 Senden bahsedildi!", notificationMessage);

    return true;
  } catch (error) {
    console.error("Error sending mention notification:", error);

    return false;
  }
};

// Özel mesaj bildirimi - Her zaman veritabanına kaydet

export const sendMessageNotification = async (userId: string, senderUsername: string, chatId: string) => {
  try {
    const notificationMessage = `${senderUsername} sana özel mesaj gönderdi`;

    const { error } = await supabase.from("notifications").insert({
      user_id: userId,

      type: "message",

      message: notificationMessage,

      related_id: chatId,

      is_read: false,
    });

    if (error) {
      console.error("Message notification error:", error);

      return false;
    }

    console.log("💬 PRIVATE MESSAGE NOTIFICATION SAVED:", {
      to: userId,

      from: senderUsername,

      chatId: chatId,

      type: "message",

      timestamp: new Date().toLocaleString("tr-TR"),
    });

    return true;
  } catch (error) {
    console.error("Error sending message notification:", error);

    return false;
  }
};

// Oyun daveti bildirimi

export const sendGameInviteNotification = async (receiverId: string, senderUsername: string, roomCode: string) => {
  try {
    // Aynı room için yakın zamanda bildirim gönderilmiş mi kontrol et (5 saniye içinde)

    const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString();

    const { data: recentNotifications } = await supabase

      .from("notifications")

      .select("id")

      .eq("user_id", receiverId)

      .eq("type", "invite")

      .eq("related_id", roomCode)

      .gte("created_at", fiveSecondsAgo)

      .limit(1);

    if (recentNotifications && recentNotifications.length > 0) {
      console.log("🚫 DUPLICATE GAME INVITE PREVENTED:", {
        to: receiverId,

        from: senderUsername,

        roomCode: roomCode,
      });

      return true; // Zaten gönderilmiş, hata sayılmasın
    }

    const { error } = await supabase.rpc("create_notification", {
      p_user_id: receiverId,

      p_type: "invite",

      p_message: `${senderUsername} sana oyun daveti gönderdi`,

      p_related_id: roomCode,
    });

    if (error) {
      console.error("Game invite notification error:", error);

      return false;
    }

    console.log("🎮 GAME INVITE NOTIFICATION SAVED:", {
      to: receiverId,

      from: senderUsername,

      roomCode: roomCode,

      type: "game_invite",

      timestamp: new Date().toLocaleString("tr-TR"),
    });

    return true;
  } catch (error) {
    console.error("Error sending game invite notification:", error);

    return false;
  }
};

// Tekrar oyun bildirimi

export const sendRematchNotification = async (
  receiverId: string,

  senderUsername: string,

  roomCode: string,

  gameType: string,
) => {
  try {
    // Aynı room için yakın zamanda bildirim gönderilmiş mi kontrol et (5 saniye içinde)

    const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString();

    const { data: recentNotifications } = await supabase

      .from("notifications")

      .select("id")

      .eq("user_id", receiverId)

      .eq("type", "invite")

      .eq("related_id", roomCode)

      .gte("created_at", fiveSecondsAgo)

      .limit(1);

    if (recentNotifications && recentNotifications.length > 0) {
      console.log("🚫 DUPLICATE REMATCH PREVENTED:", {
        to: receiverId,

        from: senderUsername,

        roomCode: roomCode,
      });

      return true; // Zaten gönderilmiş, hata sayılmasın
    }

    const gameTypeText = gameType === "timed" ? "Zamana Karşı" : "Skora Karşı";

    const { error } = await supabase.rpc("create_notification", {
      p_user_id: receiverId,

      p_type: "invite",

      p_message: `${senderUsername} sana tekrar oyun daveti gönderdi (${gameTypeText})`,

      p_related_id: roomCode,
    });

    if (error) {
      console.error("Rematch notification error:", error);

      return false;
    }

    console.log("🔄 REMATCH NOTIFICATION SAVED:", {
      to: receiverId,

      from: senderUsername,

      roomCode: roomCode,

      gameType: gameType,

      type: "invite",

      timestamp: new Date().toLocaleString("tr-TR"),
    });

    return true;
  } catch (error) {
    console.error("Error sending rematch notification:", error);

    return false;
  }
};

// Bildirimleri okundu olarak işaretle

export const markNotificationsAsRead = async (notificationIds: string[]) => {
  try {
    const { error } = await supabase.from("notifications").update({ is_read: true }).in("id", notificationIds);

    return !error;
  } catch (error) {
    console.error("Error marking notifications as read:", error);

    return false;
  }
};

// Kullanıcı bildirimlerini getir

export const getUserNotifications = async (userId: string, limit = 20) => {
  try {
    const { data, error } = await supabase

      .from("notifications")

      .select("*")

      .eq("user_id", userId)

      .order("created_at", { ascending: false })

      .limit(limit);

    if (error) {
      console.error("Error getting user notifications:", error);

      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Error in getUserNotifications:", error);

    return [];
  }
};

// Browser notification göster

export const showBrowserNotification = (title: string, message: string) => {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, {
      body: message,

      icon: "/favicon.ico",
    });
  }
};
