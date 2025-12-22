-- Yeni kullanıcı kayıt olduğunda 3'er joker vermek için fonksiyon
CREATE OR REPLACE FUNCTION public.give_initial_jokers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Değiştir jokeri - 3 adet
  INSERT INTO public.user_inventory (user_id, item_type, quantity)
  VALUES (NEW.id, 'degistir', 3)
  ON CONFLICT (user_id, item_type) DO NOTHING;
  
  -- Fısılda jokeri - 3 adet
  INSERT INTO public.user_inventory (user_id, item_type, quantity)
  VALUES (NEW.id, 'fisilda', 3)
  ON CONFLICT (user_id, item_type) DO NOTHING;
  
  -- Sen Yaz jokeri - 3 adet
  INSERT INTO public.user_inventory (user_id, item_type, quantity)
  VALUES (NEW.id, 'senyaz', 3)
  ON CONFLICT (user_id, item_type) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Eğer trigger yoksa oluştur
DROP TRIGGER IF EXISTS on_new_user_give_jokers ON public.profiles;

CREATE TRIGGER on_new_user_give_jokers
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.give_initial_jokers();

-- user_inventory tablosuna unique constraint ekle (ON CONFLICT için gerekli)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_inventory_user_item_unique'
  ) THEN
    ALTER TABLE public.user_inventory 
    ADD CONSTRAINT user_inventory_user_item_unique UNIQUE (user_id, item_type);
  END IF;
END $$;