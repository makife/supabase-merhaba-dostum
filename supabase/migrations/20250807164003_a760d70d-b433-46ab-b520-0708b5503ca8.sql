-- Kullanıcı satın alımları tablosu
CREATE TABLE public.user_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  item_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE NULL
);

-- Kullanıcı envanteri tablosu (ipucu paketleri, kredi öğeleri vb.)
CREATE TABLE public.user_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  item_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Kullanıcı tema/görünüm ayarları tablosu
CREATE TABLE public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  active_theme TEXT DEFAULT 'default',
  active_avatar_frame TEXT DEFAULT 'none',
  active_sound_pack TEXT DEFAULT 'default',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS politikaları
ALTER TABLE public.user_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- user_purchases politikaları
CREATE POLICY "Kullanıcılar kendi satın alımlarını görebilir" 
ON public.user_purchases 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Kullanıcılar satın alma kaydı oluşturabilir" 
ON public.user_purchases 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Kullanıcılar kendi satın alımlarını güncelleyebilir" 
ON public.user_purchases 
FOR UPDATE 
USING (auth.uid() = user_id);

-- user_inventory politikaları
CREATE POLICY "Kullanıcılar kendi envanterini görebilir" 
ON public.user_inventory 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Kullanıcılar envanter kaydı oluşturabilir" 
ON public.user_inventory 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Kullanıcılar kendi envanterini güncelleyebilir" 
ON public.user_inventory 
FOR UPDATE 
USING (auth.uid() = user_id);

-- user_settings politikaları
CREATE POLICY "Kullanıcılar kendi ayarlarını görebilir" 
ON public.user_settings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Kullanıcılar ayar kaydı oluşturabilir" 
ON public.user_settings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Kullanıcılar kendi ayarlarını güncelleyebilir" 
ON public.user_settings 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Otomatik timestamp güncelleme için trigger
CREATE TRIGGER update_user_inventory_updated_at
BEFORE UPDATE ON public.user_inventory
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Profiller tablosuna ipucu hakkı kolonu ekle
ALTER TABLE public.profiles 
ADD COLUMN hint_credits INTEGER DEFAULT 0;