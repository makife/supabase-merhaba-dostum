-- Create words table for Turkish dictionary
CREATE TABLE IF NOT EXISTS public.words (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  word TEXT NOT NULL UNIQUE,
  length INTEGER NOT NULL,
  difficulty INTEGER NOT NULL DEFAULT 1,
  is_approved BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;

-- Create policies for words (public read access for game validation)
CREATE POLICY "Words are viewable by everyone" 
ON public.words 
FOR SELECT 
USING (true);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_words_word ON public.words(word);
CREATE INDEX IF NOT EXISTS idx_words_length ON public.words(length);
CREATE INDEX IF NOT EXISTS idx_words_difficulty ON public.words(difficulty);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_words_updated_at
BEFORE UPDATE ON public.words
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();