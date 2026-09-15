-- user_inventory tablosuna DELETE policy ekle
CREATE POLICY "Kullanıcılar kendi envanterini silebilir"
ON public.user_inventory
FOR DELETE
USING (auth.uid() = user_id);