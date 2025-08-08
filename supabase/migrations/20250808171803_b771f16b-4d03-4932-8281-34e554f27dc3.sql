-- Fix RLS policies for game rooms and participants

-- Allow users to update game rooms they host
CREATE POLICY "Oda sahipleri kendi odalarını güncelleyebilir" 
ON public.game_rooms 
FOR UPDATE 
USING (auth.uid() = host_id);

-- Allow users to update their own participant records (scores, etc.)
CREATE POLICY "Oyuncular kendi katılımcı kayıtlarını güncelleyebilir" 
ON public.game_participants 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Allow users to delete their own participant records (leave room)
CREATE POLICY "Oyuncular kendi katılımcı kayıtlarını silebilir" 
ON public.game_participants 
FOR DELETE 
USING (auth.uid() = user_id);

-- Allow room hosts to delete participant records from their rooms
CREATE POLICY "Oda sahipleri katılımcıları çıkarabilir" 
ON public.game_participants 
FOR DELETE 
USING (
  auth.uid() IN (
    SELECT host_id FROM public.game_rooms WHERE id = room_id
  )
);