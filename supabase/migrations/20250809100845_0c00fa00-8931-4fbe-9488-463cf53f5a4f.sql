-- Create private chats table for 1-on-1 conversations
CREATE TABLE public.private_chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID NOT NULL,
  user2_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user1_id, user2_id),
  CHECK (user1_id != user2_id)
);

-- Create private messages table
CREATE TABLE public.private_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES public.private_chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_read BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.private_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for private_chats
CREATE POLICY "Users can view their own chats" 
ON public.private_chats 
FOR SELECT 
USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can create chats with others" 
ON public.private_chats 
FOR INSERT 
WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can update their own chats" 
ON public.private_chats 
FOR UPDATE 
USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- RLS policies for private_messages
CREATE POLICY "Users can view messages in their chats" 
ON public.private_messages 
FOR SELECT 
USING (
  auth.uid() IN (
    SELECT user1_id FROM public.private_chats WHERE id = chat_id
    UNION
    SELECT user2_id FROM public.private_chats WHERE id = chat_id
  )
);

CREATE POLICY "Users can send messages in their chats" 
ON public.private_messages 
FOR INSERT 
WITH CHECK (
  auth.uid() = sender_id AND
  auth.uid() IN (
    SELECT user1_id FROM public.private_chats WHERE id = chat_id
    UNION
    SELECT user2_id FROM public.private_chats WHERE id = chat_id
  )
);

CREATE POLICY "Users can update their own messages" 
ON public.private_messages 
FOR UPDATE 
USING (
  auth.uid() IN (
    SELECT user1_id FROM public.private_chats WHERE id = chat_id
    UNION
    SELECT user2_id FROM public.private_chats WHERE id = chat_id
  )
);

-- Enable realtime for private messages
ALTER TABLE public.private_chats REPLICA IDENTITY FULL;
ALTER TABLE public.private_messages REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.private_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.private_messages;

-- Function to create or get existing chat
CREATE OR REPLACE FUNCTION public.get_or_create_private_chat(other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chat_id UUID;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  IF current_user_id = other_user_id THEN
    RAISE EXCEPTION 'Cannot create chat with yourself';
  END IF;
  
  -- Try to find existing chat (either direction)
  SELECT id INTO chat_id 
  FROM public.private_chats 
  WHERE (user1_id = current_user_id AND user2_id = other_user_id) 
     OR (user1_id = other_user_id AND user2_id = current_user_id);
  
  -- If no chat exists, create one
  IF chat_id IS NULL THEN
    INSERT INTO public.private_chats (user1_id, user2_id)
    VALUES (LEAST(current_user_id, other_user_id), GREATEST(current_user_id, other_user_id))
    RETURNING id INTO chat_id;
  END IF;
  
  RETURN chat_id;
END;
$$;