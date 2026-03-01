-- FIX: 2026-03-02'ye yanlış birleştirilen veriyi 2026-02-23'e geri taşı
-- Bu hafta (March 2) henüz hiç oyun oynanmadı, tüm veri geçen haftaya (Feb 23) ait
UPDATE public.weekly_stats
SET week_start = '2026-02-23'::DATE
WHERE week_start = '2026-03-02'::DATE;