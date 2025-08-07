-- Create storage bucket for dictionary files
INSERT INTO storage.buckets (id, name, public) VALUES ('dictionaries', 'dictionaries', false);

-- Create RLS policies for dictionary files
CREATE POLICY "Authenticated users can upload dictionary files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'dictionaries' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own dictionary files" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'dictionaries' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own dictionary files" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'dictionaries' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own dictionary files" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'dictionaries' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);