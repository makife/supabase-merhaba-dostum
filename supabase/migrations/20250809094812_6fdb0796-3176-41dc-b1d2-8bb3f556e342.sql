-- Create message reactions table
CREATE TABLE public.message_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Enable Row Level Security
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Create policies for message reactions
CREATE POLICY "Reaksiyonlar herkese görünür" 
ON public.message_reactions 
FOR SELECT 
USING (true);

CREATE POLICY "Kullanıcılar reaksiyon ekleyebilir" 
ON public.message_reactions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Kullanıcılar kendi reaksiyonlarını silebilir" 
ON public.message_reactions 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add foreign key reference to global_chat
ALTER TABLE public.message_reactions 
ADD CONSTRAINT fk_message_reactions_message_id 
FOREIGN KEY (message_id) REFERENCES public.global_chat(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX idx_message_reactions_message_id ON public.message_reactions(message_id);
CREATE INDEX idx_message_reactions_user_id ON public.message_reactions(user_id);