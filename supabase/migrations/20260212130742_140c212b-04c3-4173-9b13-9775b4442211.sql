
-- Arkadaşlık tablosu
CREATE TABLE public.friendships (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  friend_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending, accepted, rejected
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

-- RLS
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Herkes kendi arkadaşlıklarını görebilir
CREATE POLICY "Users can view their friendships"
ON public.friendships FOR SELECT
USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Kullanıcılar arkadaşlık daveti gönderebilir
CREATE POLICY "Users can send friend requests"
ON public.friendships FOR INSERT
WITH CHECK (auth.uid() = user_id AND user_id != friend_id);

-- İlgili kullanıcılar güncelleyebilir (kabul/red)
CREATE POLICY "Users can update friendships"
ON public.friendships FOR UPDATE
USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- İlgili kullanıcılar silebilir (arkadaşlıktan çıkarma)
CREATE POLICY "Users can delete friendships"
ON public.friendships FOR DELETE
USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Index
CREATE INDEX idx_friendships_user_id ON public.friendships(user_id);
CREATE INDEX idx_friendships_friend_id ON public.friendships(friend_id);
CREATE INDEX idx_friendships_status ON public.friendships(status);
