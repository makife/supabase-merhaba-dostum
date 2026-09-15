-- Eksik "Ayın Lideri" rozetini kullanıcıya ekle
INSERT INTO public.user_badges (user_id, badge_id)
VALUES ('d8db37ac-f594-45a5-b499-5028322f9bf3', 'b1000001-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;