-- Tournament matches tablosundaki foreign key kısıtlamalarını kaldır ve nullable player ID'lere izin ver
-- Botlar için profile gerektirmeyen yapı oluştur

-- Önce mevcut foreign key constraint'leri kontrol et ve kaldır
DO $$ 
DECLARE
    constraint_name TEXT;
BEGIN
    -- player1_id foreign key constraint'i varsa kaldır
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'tournament_matches' 
    AND tc.constraint_type = 'FOREIGN KEY'
    AND tc.constraint_name LIKE '%player1_id%';
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE tournament_matches DROP CONSTRAINT ' || constraint_name;
    END IF;
    
    -- player2_id foreign key constraint'i varsa kaldır
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'tournament_matches' 
    AND tc.constraint_type = 'FOREIGN KEY'
    AND tc.constraint_name LIKE '%player2_id%';
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE tournament_matches DROP CONSTRAINT ' || constraint_name;
    END IF;
    
    -- winner_id foreign key constraint'i varsa kaldır
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'tournament_matches' 
    AND tc.constraint_type = 'FOREIGN KEY'
    AND tc.constraint_name LIKE '%winner_id%';
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE tournament_matches DROP CONSTRAINT ' || constraint_name;
    END IF;
END $$;

-- Tournament participants için de aynı işlemi yap
DO $$ 
DECLARE
    constraint_name TEXT;
BEGIN
    -- user_id foreign key constraint'i varsa kaldır (botlar için nullable olmalı)
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'tournament_participants' 
    AND tc.constraint_type = 'FOREIGN KEY'
    AND tc.constraint_name LIKE '%user_id%';
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE tournament_participants DROP CONSTRAINT ' || constraint_name;
    END IF;
END $$;