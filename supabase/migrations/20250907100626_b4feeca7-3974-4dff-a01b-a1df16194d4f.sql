-- tournament_participants tablosundaki user_id tipini uuid'ye çevir
ALTER TABLE tournament_participants ALTER COLUMN user_id TYPE uuid USING user_id::uuid;