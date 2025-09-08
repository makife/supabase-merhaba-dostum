-- Tüm oyuncu verilerini sıfırla
-- Oyun verilerini temizle
DELETE FROM game_words;
DELETE FROM game_participants;
DELETE FROM game_rooms;
DELETE FROM game_sessions;
DELETE FROM game_history;

-- İstatistikleri temizle
DELETE FROM daily_leaderboard;
DELETE FROM daily_stats;
DELETE FROM weekly_stats;
DELETE FROM monthly_stats;

-- Kullanıcı verilerini temizle
DELETE FROM user_badges;
DELETE FROM user_inventory;
DELETE FROM user_purchases;
DELETE FROM user_settings;
DELETE FROM user_presence;
DELETE FROM user_bans;
DELETE FROM user_blocks;
DELETE FROM wheel_spins;

-- Sohbet verilerini temizle
DELETE FROM global_chat;
DELETE FROM private_messages;
DELETE FROM private_chats;
DELETE FROM message_reactions;

-- Turnuva verilerini temizle
DELETE FROM tournament_matches;
DELETE FROM tournament_participants;
DELETE FROM tournaments;

-- Bildirim ve diğer verileri temizle
DELETE FROM notifications;
DELETE FROM rematch_requests;

-- Profilleri temizle (en son çünkü foreign key'ler var)
DELETE FROM profiles;