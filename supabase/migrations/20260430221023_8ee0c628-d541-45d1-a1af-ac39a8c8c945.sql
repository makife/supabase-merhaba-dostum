
INSERT INTO user_badges (user_id, badge_id)
VALUES ('d8db37ac-f594-45a5-b499-5028322f9bf3', '0ffac18c-4309-479d-ab08-629f7a25d7c2')
ON CONFLICT (user_id, badge_id) DO NOTHING;

INSERT INTO notifications (user_id, type, message, related_id)
SELECT 'd8db37ac-f594-45a5-b499-5028322f9bf3', 'badge_earned', '🏆 Yeni rozet kazandınız: Saygın Kelimele Yazarı', '0ffac18c-4309-479d-ab08-629f7a25d7c2'
WHERE EXISTS (SELECT 1 FROM user_badges WHERE user_id = 'd8db37ac-f594-45a5-b499-5028322f9bf3' AND badge_id = '0ffac18c-4309-479d-ab08-629f7a25d7c2');
